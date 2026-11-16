import { describe, it, expect } from 'vitest';
import { easyshipInsurance, fedexPackageExtras, upsPackageOptions, uspsExtras } from '../src/lib/labelExtras';
import { ratePkg, shipPkg } from '../src/shipping/providers/ups';
import type { Parcel } from '../src/shipping/types';

const parcel = (extra: Partial<Parcel> = {}): Parcel => ({ weight_lb: 3, length_in: 12, width_in: 10, height_in: 6, description: 'Shoes', value_usd: 1, ...extra });

describe('nothing extra bought', () => {
  it('adds nothing to any carrier', () => {
    expect(uspsExtras(parcel())).toEqual({});
    expect(upsPackageOptions(parcel())).toEqual({});
    expect(fedexPackageExtras(parcel())).toEqual({});
    expect(easyshipInsurance(parcel())).toEqual({});
  });
});

describe('insurance reaches the carrier on the label', () => {
  it('USPS: insurance code by amount, with the insured value', () => {
    // USPS Labels v3: the insured value is packageOptions.packageValue (itemValue is for letters and flats);
    // 931 needs physicalSignatureRequired.
    expect(uspsExtras(parcel({ insured_usd: 450 }))).toEqual({ extraServices: [930], packageOptions: { packageValue: 450 } });
    expect(uspsExtras(parcel({ insured_usd: 1200 }))).toEqual({ extraServices: [931], physicalSignatureRequired: false, packageOptions: { packageValue: 1200 } });
  });
  it('UPS: declared value', () => {
    expect(upsPackageOptions(parcel({ insured_usd: 450 }))).toEqual({ PackageServiceOptions: { DeclaredValue: { Type: { Code: '01' }, CurrencyCode: 'USD', MonetaryValue: '450.00' } } });
  });
  it('FedEx: declared value', () => {
    expect(fedexPackageExtras(parcel({ insured_usd: 450 }))).toEqual({ declaredValue: { amount: 450, currency: 'USD' } });
  });
  it('Easyship: its insurance option', () => {
    expect(easyshipInsurance(parcel({ insured_usd: 450 }))).toEqual({ insurance: { is_insured: true, insured_amount: 450, insured_currency: 'USD' } });
  });
});

describe('insurance and signature together', () => {
  it('both go on the label', () => {
    const p = parcel({ insured_usd: 450, options: { signature: true } });
    expect(uspsExtras(p)).toEqual({ extraServices: [921, 930], physicalSignatureRequired: false, packageOptions: { packageValue: 450 } });
    expect(upsPackageOptions(p).PackageServiceOptions).toMatchObject({ DeliveryConfirmation: { DCISType: '2' }, DeclaredValue: { MonetaryValue: '450.00' } });
    expect(fedexPackageExtras(p)).toMatchObject({ declaredValue: { amount: 450 }, packageSpecialServices: { signatureOptionType: 'DIRECT' } });
  });
});

describe('USPS signature confirmation', () => {
  it('sends 921 with physicalSignatureRequired, which USPS requires with it', () => {
    expect(uspsExtras(parcel({ options: { signature: true } }))).toEqual({ extraServices: [921], physicalSignatureRequired: false });
  });
});

describe('hazardous materials reach USPS on the label', () => {
  it('as packageOptions.contentType HAZMAT, beside any insured value', () => {
    expect(uspsExtras(parcel({ options: { hazmat: true } }))).toEqual({ packageOptions: { contentType: 'HAZMAT' } });
    expect(uspsExtras(parcel({ options: { hazmat: true }, insured_usd: 200 }))).toEqual({ extraServices: [930], packageOptions: { packageValue: 200, contentType: 'HAZMAT' } });
  });
});

describe('UPS packaging code', () => {
  it('is PackagingType when rating and Packaging when shipping', () => {
    const p = parcel({ packaging: 'ups-express-pak' });
    expect(ratePkg(p)).toMatchObject({ PackagingType: { Code: '04' } });
    expect(ratePkg(p)).not.toHaveProperty('Packaging');
    expect(shipPkg(p)).toMatchObject({ Packaging: { Code: '04' } });
    expect(shipPkg(p)).not.toHaveProperty('PackagingType');
    expect(shipPkg(parcel()).Packaging.Code).toBe('02');
  });
});
