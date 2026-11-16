// The carriers the store ships with, shown across the site (Peter, Nov 15 2026): beside the logo, under the
// tracking box, on the Ship page and in the footer.
//
// The store is an authorized location for all four (Peter, Nov 15 2026), so the site says "Authorized for".
//
// Logos: the UPS, FedEx, USPS and DHL logos are trademarks. Only the official files may be used, as supplied and
// under each carrier's brand rules (usually for authorized retail locations; Goin' Postal corporate or the carrier's
// retail program provides them). Never redraw or recolor them. Until a file is here the carrier's name shows as a
// plain text badge. To switch one on: put the official file in site/public/brand/carriers/ and set `logo` below,
// for example logo: '/brand/carriers/ups.svg'.
// The official files were supplied by Peter on Nov 15 2026 and are used as supplied (the two DHL images only had
// their plain grey margin trimmed). UPS's file is small (56 x 67 px); a larger one from the UPS kit would be sharper.
export interface Carrier { id: 'usps' | 'ups' | 'fedex' | 'dhl'; name: string; logo: string | null }
export const CARRIERS: Carrier[] = [
  { id: 'usps', name: 'USPS', logo: '/brand/carriers/usps.png' },
  { id: 'ups', name: 'UPS', logo: '/brand/carriers/ups.png' },
  { id: 'fedex', name: 'FedEx Authorized ShipCenter', logo: '/brand/carriers/fedex-authorized-shipcenter.png' },
  { id: 'dhl', name: 'DHL', logo: '/brand/carriers/dhl.png' },
];
/** Certifications shown with the big carrier row on the Ship page. */
export const CERTIFICATIONS: { name: string; logo: string }[] = [
  { name: 'DHL Express Certified International Specialist', logo: '/brand/carriers/dhl-cis.png' },
];
