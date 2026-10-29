// Batch shipping: the CSV reader, the three file shapes, the service pick and the mock buy path.
import { describe, it, expect } from 'vitest';
import { parseCsv, parseBatch, mapColumns, detectFormat, stateCode, choose, rateBatch, batchTotal, resultsCsv } from '../src/lib/batch';
import { buyBatchRow } from '../src/lib/batchBuy';
import * as store from '../src/shipping/store';

const env = {} as any;
const defaults = { weight_lb: 1, length_in: 10, width_in: 8, height_in: 4, value_usd: 25 };

describe('parseCsv', () => {
  it('handles quotes, commas inside quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
});

describe('parseBatch', () => {
  it('reads our template', () => {
    const csv = 'reference,name,address1,address2,city,state,zip,weight_lb\n1001,Jane Doe,1 Main St,Apt 2,Monroe,la,71201,1.5\n1002,John Roe,200 Elm Ave,,Dallas,TX,75201,\n';
    const b = parseBatch(csv, defaults);
    expect(b.format).toBe('petership');
    expect(b.rows).toHaveLength(2);
    expect(b.rows[0].to).toMatchObject({ contact_name: 'Jane Doe', line_2: 'Apt 2', state: 'LA', postal_code: '71201' });
    expect(b.rows[0].parcel?.weight_lb).toBe(1.5);
    expect(b.rows[1].parcel?.weight_lb).toBe(1);        // the default
    expect(b.rows[1].reference).toBe('1002');
    expect(b.rows.every((r) => r.errors.length === 0)).toBe(true);
  });
  it('folds a Shopify export (one line per item, address on the first) and maps state names and grams', () => {
    const csv = ['Name,Email,Financial Status,Lineitem name,Shipping Name,Shipping Street,Shipping Address1,Shipping Address2,Shipping City,Shipping Zip,Shipping Province,Shipping Country,Shipping Phone,Total Weight',
      '#1001,a@example.com,paid,Candle,Ann Lee,5 Oak St,5 Oak St,,Shreveport,71101,Louisiana,United States,3185550100,907',
      '#1001,,,Soap,,,,,,,,,,',
      '#1002,b@example.com,paid,Mug,Bo Kim,9 Pine Rd,9 Pine Rd,Unit 4,Austin,78701,Texas,United States,,'].join('\n');
    const b = parseBatch(csv, defaults);
    expect(b.format).toBe('shopify');
    expect(b.skipped).toBe(1);
    expect(b.rows.map((r) => r.reference)).toEqual(['#1001', '#1002']);
    expect(b.rows[0].to).toMatchObject({ contact_name: 'Ann Lee', state: 'LA', country_alpha2: 'US', contact_phone: '3185550100' });
    expect(b.rows[0].parcel?.weight_lb).toBe(2);         // 907 g
    expect(b.rows[0].parcel?.description).toBe('Candle');
    expect(b.rows[1].to?.line_2).toBe('Unit 4');
  });
  it('reads an Etsy export and flags bad rows instead of dropping them', () => {
    const csv = 'Order ID,Buyer,Ship Name,Ship Address1,Ship Address2,Ship City,Ship State,Ship Zipcode,Ship Country\n555,buyer1,Cy Fox,12 Bay St,,Tampa,FL,33601,United States\n556,buyer2,No State,1 X St,,Nowhere,,00000,United States\n557,buyer3,Abroad,1 Rue,,Paris,,75001,France\n';
    const b = parseBatch(csv, defaults);
    expect(b.format).toBe('etsy');
    expect(b.rows[0].errors).toEqual([]);
    expect(b.rows[0].reference).toBe('555');
    expect(b.rows[1].errors.length).toBeGreaterThan(0);
    expect(b.rows[2].errors.some((e) => /customs/.test(e))).toBe(true);
  });
  it('maps columns by alias and tells Shopify Name from a recipient name', () => {
    expect(stateCode('new york')).toBe('NY'); expect(stateCode('tx')).toBe('TX');
    expect(detectFormat(['foo'])).toBe('unknown');
    const m = mapColumns(['Name', 'Address1', 'City', 'State', 'Zip']);
    expect(m.name).toBe(0); expect(m.reference).toBeUndefined();
  });
});

describe('choose', () => {
  const rates: any[] = [
    { id: 'a', carrier: 'USPS', service: 'Ground Advantage', total_charge: 8, max_days: 5 },
    { id: 'b', carrier: 'UPS', service: 'Ground', total_charge: 9, max_days: 4 },
    { id: 'c', carrier: 'USPS', service: 'Priority Mail', total_charge: 10, max_days: 2 },
  ];
  it('cheapest, fastest, by service, none', () => {
    expect(choose(rates, 'cheapest')?.id).toBe('a');
    expect(choose(rates, 'fastest')?.id).toBe('c');
    expect(choose(rates, { service: 'usps priority' })?.id).toBe('c');
    expect(choose(rates, { service: 'FedEx' })).toBeNull();
    expect(choose([], 'cheapest')).toBeNull();
  });
});

describe('rate and buy in mock mode', () => {
  it('rates good rows with the account discount, leaves bad rows unrated, and buys a row as a billed shipment', async () => {
    const csv = 'name,address1,city,state,zip\nJane Doe,1 Main St,Monroe,LA,71201\nBad Row,,Nowhere,ZZ,1\n';
    const rows = parseBatch(csv, defaults).rows;
    const rated = await rateBatch(env, rows, 'cheapest', 10);
    expect(rated[0].chosen).not.toBeNull();
    expect(rated[1].chosen).toBeNull();
    expect(batchTotal(rated)).toBe(rated[0].chosen!.total_charge);
    const cid = (await store.upsertCustomer(env, { name: 'Batch Co', email: 'batch@example.com' }))!;
    const account = await store.addAccount(env, { customer_id: cid, business_name: 'Batch Co', discount_percent: 10, notes: '' });
    const r = await buyBatchRow(env, { to: rated[0].to!, parcel: rated[0].parcel!, rate: rated[0].chosen!, reference: '1001', account, batch: 'B-TEST', who: { id: null, name: 'Tester' }, print: true, line: 1 });
    expect(r.id).toMatch(/^GP-/);
    expect(r.error).toBeNull();
    expect(r.price).toBe(rated[0].chosen!.total_charge);
    const open = await store.accountOpenShipments(env, account);
    expect(open.some((x) => x.id === r.id)).toBe(true);
    expect(resultsCsv([r])).toContain('1001,' + r.id);
  });
});

describe('marketplace exports (v1.62.1)', () => {
  it('reads eBay, Amazon, Square and WooCommerce order exports', () => {
    const ebay = 'Sales Record Number,Order Number,Buyer Name,Ship To Name,Ship To Phone,Ship To Address 1,Ship To Address 2,Ship To City,Ship To State,Ship To Zip,Ship To Country,Item Title\n555,12-34567-89012,buyer1,Cy Fox,,12 Bay St,,Tampa,FL,33601,US,Vintage jacket\n';
    const e = parseBatch(ebay, defaults); expect(e.format).toBe('ebay'); expect(e.rows[0].to).toMatchObject({ contact_name: 'Cy Fox', state: 'FL', postal_code: '33601' }); expect(e.rows[0].reference).toBe('12-34567-89012'); expect(e.rows[0].parcel?.description).toBe('Vintage jacket');
    const amazon = 'order-id\trecipient-name\tship-address-1\tship-address-2\tship-city\tship-state\tship-postal-code\tship-country\tproduct-name'.replace(/\t/g, ',') + '\n111-222,Ann Lee,5 Oak St,,Shreveport,LA,71101,US,Candle\n';
    const a = parseBatch(amazon, defaults); expect(a.format).toBe('amazon'); expect(a.rows[0].to?.city).toBe('Shreveport'); expect(a.rows[0].reference).toBe('111-222');
    const square = 'Order ID,Recipient Name,Shipping Address Line 1,Shipping Address Line 2,Shipping City,Shipping State,Shipping Postal Code,Shipping Country\nSQ1,Bo Kim,9 Pine Rd,Unit 4,Austin,TX,78701,US\n';
    const s = parseBatch(square, defaults); expect(s.format).toBe('square'); expect(s.rows[0].to?.line_2).toBe('Unit 4'); expect(s.rows[0].reference).toBe('SQ1');
    const woo = 'Order Number,Shipping First Name,Shipping Last Name,Shipping Address 1,Shipping Address 2,Shipping City,Shipping State,Shipping Postcode,Shipping Country\n2001,Dee,Ray,1 Elm St,,Dallas,TX,75201,US\n';
    const w = parseBatch(woo, defaults); expect(w.format).toBe('woocommerce'); expect(w.rows[0].to?.contact_name).toBe('Dee Ray'); expect(w.rows[0].to?.postal_code).toBe('75201');
  });
});
