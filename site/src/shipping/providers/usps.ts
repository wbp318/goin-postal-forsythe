// USPS APIs v3 (the ones that replaced Web Tools). https://developers.usps.com
// Needs: USPS_CLIENT_ID, USPS_CLIENT_SECRET (developer portal app), and for live labels
// USPS_CRID, USPS_MID, USPS_MANIFEST_MID and USPS_ACCOUNT_NUMBER (Enterprise Payment System).
// USPS_SANDBOX=1 points at the test environment. Not yet exercised against USPS: the request
// shapes follow the published reference and the first sandbox call may need field tweaks.
import type { Provider, Address, Parcel, Rate, Label } from '../types';
import { callJson, oauthToken, money } from '../http';
import { billableWeightLb } from '../dim';

const base = (env: Env) => (env.USPS_SANDBOX ? 'https://apis-tem.usps.com' : 'https://apis.usps.com');

const SERVICES: Record<string, string> = {
  USPS_GROUND_ADVANTAGE: 'USPS Ground Advantage',
  PRIORITY_MAIL: 'USPS Priority Mail',
  PRIORITY_MAIL_EXPRESS: 'USPS Priority Mail Express',
  FIRST_CLASS_PACKAGE_INTERNATIONAL_SERVICE: 'USPS First-Class Package International',
  PRIORITY_MAIL_INTERNATIONAL: 'USPS Priority Mail International',
  PRIORITY_MAIL_EXPRESS_INTERNATIONAL: 'USPS Priority Mail Express International',
};

async function token(env: Env) {
  return oauthToken(env, 'usps', `${base(env)}/oauth2/v3/token`, env.USPS_CLIENT_ID!, env.USPS_CLIENT_SECRET!, 'json');
}

function pkg(parcel: Parcel) {
  return {
    weight: parcel.weight_lb,
    length: parcel.length_in,
    width: parcel.width_in,
    height: parcel.height_in,
    processingCategory: parcel.length_in > 22 || parcel.width_in > 18 || parcel.height_in > 15 ? 'NONSTANDARD' : 'MACHINABLE',
    rateIndicator: 'SP',
    priceType: 'COMMERCIAL',
    mailingDate: new Date().toISOString().slice(0, 10),
  };
}

export const usps: Provider = {
  id: 'usps',
  configured: (env) => !!(env.USPS_CLIENT_ID && env.USPS_CLIENT_SECRET),

  async rates(env, origin, destination, parcel) {
    const t = await token(env);
    const domestic = destination.country_alpha2 === 'US';
    const body: any = domestic
      ? { originZIPCode: origin.postal_code.slice(0, 5), destinationZIPCode: destination.postal_code.slice(0, 5), ...pkg(parcel), accountType: 'EPS', accountNumber: env.USPS_ACCOUNT_NUMBER }
      : { originZIPCode: origin.postal_code.slice(0, 5), foreignPostalCode: destination.postal_code, destinationCountryCode: destination.country_alpha2, ...pkg(parcel), accountType: 'EPS', accountNumber: env.USPS_ACCOUNT_NUMBER };
    const path = domestic ? '/prices/v3/total-rates/search' : '/international-prices/v3/total-rates/search';
    const json = await callJson<any>('usps', base(env) + path, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const list: any[] = json.rateOptions ?? json.rates ?? [];
    const out: Rate[] = [];
    for (const o of list) {
      const r = o.rates?.[0] ?? o;
      const code = r.mailClass as string;
      if (!SERVICES[code]) continue;
      if (out.some((x) => x.id === `usps:${code}`)) continue;
      out.push({
        id: `usps:${code}`, carrier: 'USPS', service: SERVICES[code],
        cost: money(o.totalBasePrice ?? r.price), total_charge: money(o.totalBasePrice ?? r.price), currency: 'USD',
        min_days: null, max_days: code.includes('EXPRESS') ? 2 : code.includes('PRIORITY') ? 3 : 5,
        billable_weight_lb: billableWeightLb('USPS', parcel),
      });
    }
    return out;
  },

  async buyLabel(env, origin, destination, parcel, serviceCode, opts) {
    const t = await token(env);
    // Live labels need a payment authorization token from the EPS account.
    const pay = await callJson<any>('usps', `${base(env)}/payments/v3/payment-authorization`, {
      method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: [
        { roleName: 'PAYER', CRID: env.USPS_CRID, MID: env.USPS_MID, manifestMID: env.USPS_MANIFEST_MID, accountType: 'EPS', accountNumber: env.USPS_ACCOUNT_NUMBER },
        { roleName: 'LABEL_OWNER', CRID: env.USPS_CRID, MID: env.USPS_MID, manifestMID: env.USPS_MANIFEST_MID, accountType: 'EPS', accountNumber: env.USPS_ACCOUNT_NUMBER },
      ] }),
    });
    const addr = (a: Address) => ({ firstName: a.contact_name.split(' ')[0], lastName: a.contact_name.split(' ').slice(1).join(' ') || a.contact_name, firm: a.company_name, streetAddress: a.line_1, secondaryAddress: a.line_2, city: a.city, state: a.state, ZIPCode: a.postal_code.slice(0, 5), phone: a.contact_phone?.replace(/\D/g, ''), email: a.contact_email });
    const body = {
      imageInfo: { imageType: opts.zpl ? 'ZPL' : 'PDF', labelType: '4X6LABEL', receiptOption: 'NONE' },
      toAddress: addr(destination), fromAddress: addr(origin),
      packageDescription: { mailClass: serviceCode, ...pkg(parcel), destinationEntryFacilityType: 'NONE', packageOptions: { containsHazmat: false } },
    };
    const json = await callJson<any>('usps', `${base(env)}/labels/v3/label`, {
      method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-Payment-Authorization-Token': pay.paymentAuthorizationToken },
      body: JSON.stringify(body),
    });
    const meta = json.labelMetadata ?? json;
    const image: string | undefined = json.labelImage;
    return {
      id: `usps:${meta.trackingNumber}`, carrier: 'USPS', service: SERVICES[serviceCode] ?? serviceCode,
      label_url: !opts.zpl && image ? `data:application/pdf;base64,${image}` : null,
      label_zpl: opts.zpl && image ? image : null,
      qr_url: null,
      tracking_number: meta.trackingNumber ?? null,
      tracking_page_url: meta.trackingNumber ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${meta.trackingNumber}` : null,
      cost: money(meta.postage ?? 0),
    };
  },

  async voidLabel(env, labelId) {
    const t = await token(env);
    const tracking = labelId.split(':')[1];
    await callJson('usps', `${base(env)}/labels/v3/label/${tracking}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
  },

  async track(env, trackingNumber) {
    const t = await token(env);
    const json = await callJson<any>('usps', `${base(env)}/tracking/v3/tracking/${trackingNumber}?expand=DETAIL`, { headers: { Authorization: `Bearer ${t}` } });
    const events: any[] = json.trackingEvents ?? [];
    return events.map((e) => ({
      at: e.eventTimestamp, description: e.eventType ?? e.eventDescription ?? '', location: [e.eventCity, e.eventState].filter(Boolean).join(', '),
      status: /deliver/i.test(e.eventType ?? '') ? (/out for/i.test(e.eventType) ? 'out_for_delivery' : 'delivered') : /return/i.test(e.eventType ?? '') ? 'returned' : /accept|origin|transit|arriv|depart/i.test(e.eventType ?? '') ? 'in_transit' : /label|pre-?ship/i.test(e.eventType ?? '') ? 'label_created' : 'unknown',
    }));
  },
};
