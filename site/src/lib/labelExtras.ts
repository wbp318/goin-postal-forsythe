// What each carrier needs on the label for the extras a customer paid for: signature confirmation and
// insurance. Pure functions so tests/label-extras.test.ts can check every carrier's fields.
//
// Insurance (Peter, Nov 14 2026): when a customer buys insurance, the store adds that carrier's own
// insurance or declared value to the label it buys, so the package really is covered and a claim goes
// through the carrier. Before this, the fee was charged but nothing was sent to the carrier.
// `parcel.insured_usd` is set by lib/fulfil.ts from the order's insurance line, only when insurance was bought.
//
// Field names follow each carrier's published API. They are confirmed only once the store's own carrier
// accounts are connected: check the first real insured label from each carrier (see peter/EDIT-LOG.md).
import type { Parcel } from '../shipping/types';

const insured = (p: Parcel) => (p.insured_usd && p.insured_usd > 0 ? Math.round(p.insured_usd * 100) / 100 : 0);

/** USPS Labels API v3, on packageDescription (checked against USPS's published Labels spec): extra service codes in
 *  extraServices (921 Signature Confirmation; 930 insurance up to $500; 931 insurance over $500); the insured amount
 *  in packageOptions.packageValue (itemValue is for letters and flats); hazardous materials as packageOptions.contentType
 *  "HAZMAT"; and physicalSignatureRequired, which USPS requires with 921 and 931 (false lets USPS eSOL sign). */
export function uspsExtras(p: Parcel): { extraServices?: number[]; physicalSignatureRequired?: boolean; packageOptions?: { packageValue?: number; contentType?: 'HAZMAT' } } {
  const codes: number[] = [];
  if (p.options?.signature) codes.push(921);
  const amt = insured(p);
  if (amt) codes.push(amt <= 500 ? 930 : 931);
  const packageOptions = { ...(amt ? { packageValue: amt } : {}), ...(p.options?.hazmat ? { contentType: 'HAZMAT' as const } : {}) };
  return {
    ...(codes.length ? { extraServices: codes } : {}),
    ...(codes.includes(921) || codes.includes(931) ? { physicalSignatureRequired: false } : {}),
    ...(Object.keys(packageOptions).length ? { packageOptions } : {}),
  };
}

/** UPS Shipping API: Package.PackageServiceOptions. DCISType 2 is signature required; DeclaredValue is UPS's insurance. */
export function upsPackageOptions(p: Parcel): { PackageServiceOptions?: Record<string, unknown> } {
  const o: Record<string, unknown> = {};
  if (p.options?.signature) o.DeliveryConfirmation = { DCISType: '2' };
  const amt = insured(p);
  if (amt) o.DeclaredValue = { Type: { Code: '01' }, CurrencyCode: 'USD', MonetaryValue: amt.toFixed(2) };
  return Object.keys(o).length ? { PackageServiceOptions: o } : {};
}

/** FedEx Ship API: on the package line item, declaredValue is FedEx's insurance; SIGNATURE_OPTION DIRECT is a signature at the door. */
export function fedexPackageExtras(p: Parcel): Record<string, unknown> {
  const amt = insured(p);
  return {
    ...(amt ? { declaredValue: { amount: amt, currency: 'USD' } } : {}),
    ...(p.options?.signature ? { packageSpecialServices: { specialServiceTypes: ['SIGNATURE_OPTION'], signatureOptionType: 'DIRECT' } } : {}),
  };
}

/** Easyship (the bridge until the direct carrier accounts are live): its shipment-level insurance option. */
export function easyshipInsurance(p: Parcel): { insurance?: { is_insured: true; insured_amount: number; insured_currency: 'USD' } } {
  const amt = insured(p);
  return amt ? { insurance: { is_insured: true, insured_amount: amt, insured_currency: 'USD' } } : {};
}
