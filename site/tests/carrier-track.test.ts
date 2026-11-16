import { describe, it, expect } from 'vitest';
import { carriersFor } from '../src/lib/carrierTrack';

const names = (n: string) => carriersFor(n).map((c) => c.carrier);

describe('carriersFor: which carrier a tracking number looks like', () => {
  it('UPS 1Z numbers, with spaces or lower case', () => {
    expect(names('1Z999AA10123456784')).toEqual(['UPS']);
    expect(names('1z 999 aa1 01234 56784')).toEqual(['UPS']);
  });
  it('USPS 22-digit numbers and the international format', () => {
    expect(names('9400111899223197428490')).toEqual(['USPS']);
    expect(names('EC123456789US')).toEqual(['USPS']);
  });
  it('FedEx 12 and 15 digit numbers', () => {
    expect(names('123456789012')).toEqual(['FedEx']);
    expect(names('123456789012345')).toEqual(['FedEx']);
  });
  it('a 20-digit number starting 92 could be USPS or FedEx: both are offered', () => {
    expect(names('92001234567890123456')).toEqual(['USPS', 'FedEx']);
  });
  it('DHL Express 10-digit waybills', () => {
    expect(names('1234567890')).toEqual(['DHL']);
  });
  it('a pickup code or nonsense matches nothing', () => {
    expect(names('GP-7K3M9Q')).toEqual([]);
    expect(names('hello')).toEqual([]);
  });
  it('links to the carrier with the number in it', () => {
    expect(carriersFor('1Z999AA10123456784')[0].url).toBe('https://www.ups.com/track?tracknum=1Z999AA10123456784');
  });
});
