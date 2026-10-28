// The packing advisor and the address checks.
import { describe, it, expect } from 'vitest';
import { advise, boxDims, boxesFrom } from '../src/lib/packing';
import { checkAddress, stateForZip, isPoBox } from '../src/lib/address';
import { addonsFromFile } from '../src/lib/addons';

const boxes = boxesFrom(addonsFromFile().items);
const p = (w: number, l: number, wd: number, h: number) => ({ weight_lb: w, length_in: l, width_in: wd, height_in: h, description: '', value_usd: 1 });

describe('packing advisor', () => {
  it('reads box sizes from the catalog names, largest dimension first', () => {
    expect(boxDims('Medium box, up to 16 x 12 x 10 in')).toEqual([16, 12, 10]);
    expect(boxDims('Tape')).toBeNull();
    expect(boxes.map((b) => b.code)).toEqual(['box-s', 'box-m', 'box-l']);
  });
  it('a big light box: size sets the price, the large box fits, the medium box is offered', () => {
    const a = advise(p(2, 20, 16, 12), boxes);
    expect(a.dim_applies).toBe(true);
    expect(a.billable.find((b) => b.carrier === 'UPS')!.lb).toBe(28);
    expect(a.fits?.code).toBe('box-l');
    expect(a.better?.box.code).toBe('box-m');
    expect(a.better?.saves_lb).toBe(14);
  });
  it('a small heavy box: nothing to say', () => {
    const a = advise(p(10, 10, 8, 4), boxes);
    expect(a.dim_applies).toBe(false);
    expect(a.fits?.code).toBe('box-s');
    expect(a.better).toBeNull();
  });
  it('rotated dimensions still fit; oversize is flagged', () => {
    expect(advise(p(1, 6, 12, 9), boxes).fits?.code).toBe('box-s');
    expect(advise(p(5, 60, 30, 30), boxes)).toMatchObject({ fits: null, oversize: true });
  });
});

describe('address checks', () => {
  const a = (over: Record<string, unknown>) => ({ contact_name: 'J', line_1: '1 Main St', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US', ...over }) as any;
  it('ZIP prefixes map to states, one ambiguous prefix stays ambiguous', () => {
    expect(stateForZip('71201')).toEqual(['LA']);
    expect(stateForZip('75201')).toEqual(['TX']);
    expect(stateForZip('05501')).toEqual(['MA', 'VT']);
  });
  it('a good address passes; a ZIP in another state is an error naming it', () => {
    expect(checkAddress(a({}))).toMatchObject({ errors: [], warnings: [] });
    expect(checkAddress(a({ postal_code: '75201' })).errors[0]).toMatch(/belongs to TX, not LA/);
    expect(checkAddress(a({ postal_code: '7120' })).errors[0]).toMatch(/five digits/);
    expect(checkAddress(a({ postal_code: '71201-1234' })).errors).toEqual([]);
  });
  it('PO boxes, military, territories and apartments are warnings with flags', () => {
    expect(isPoBox('PO Box 123')).toBe(true);
    expect(isPoBox('123 Box Elder Rd')).toBe(false);
    expect(checkAddress(a({ line_1: 'P.O. Box 9' }))).toMatchObject({ po_box: true, errors: [] });
    expect(checkAddress(a({ state: 'AE', postal_code: '09012' })).military).toBe(true);
    expect(checkAddress(a({ state: 'PR', postal_code: '00901' })).territory).toBe(true);
    expect(checkAddress(a({ line_1: '500 Riverside Apartments' })).warnings.join()).toMatch(/unit number/);
    expect(checkAddress(a({ line_1: '500 Riverside Apartments', line_2: 'Apt 4B' })).warnings).toEqual([]);
    expect(checkAddress(a({ line_1: 'Main Street' })).warnings.join()).toMatch(/no house number/);
  });
  it('leaves other countries alone', () => {
    expect(checkAddress(a({ country_alpha2: 'CA', postal_code: 'M5V 2T6', state: 'ON' }))).toMatchObject({ errors: [], warnings: [] });
  });
});
