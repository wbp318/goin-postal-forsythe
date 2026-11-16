// The business card shop page (/cards) and the designer's starting points (Peter, Nov 14 2026).
// Pure data and helpers: the shop page draws its pictures from these with the card renderer, and the
// designer (/cards/design?type=...) starts its gallery from a business type's colors and sample details.
import { PALETTES, TEMPLATES, PRICES, QUANTITIES, CARD_OPTIONS, SAMPLE, type TemplateId, type Details } from './cards';

export interface BusinessType { id: string; name: string; palette: number; template: TemplateId; sample: Details }

const base = { phone: '(318) 000-0000', address: 'Monroe, LA' };
// Sample businesses are made up. Each type shows its own colors and wording; the customer replaces all of it.
export const BUSINESS_TYPES: BusinessType[] = [
  { id: 'restaurant', name: 'Restaurant & Food', palette: 7, template: 'band', sample: { ...base, name: 'Dana Lee', title: 'Owner & Chef', company: 'Bayou Kitchen', email: 'eat@example.com', website: 'bayoukitchen.example', tagline: 'Fresh food, made daily' } },
  { id: 'beauty', name: 'Beauty & Salon', palette: 9, template: 'minimal', sample: { ...base, name: 'Maya Brooks', title: 'Stylist', company: 'Glow Studio', email: 'book@example.com', website: 'glowstudio.example', tagline: 'Hair, nails and more' } },
  { id: 'trades', name: 'Construction & Trades', palette: 8, template: 'topbar', sample: { ...base, name: 'Chris Hall', title: 'Licensed Contractor', company: 'Delta Builders', email: 'jobs@example.com', website: 'deltabuilders.example', tagline: 'Built right the first time' } },
  { id: 'realestate', name: 'Real Estate', palette: 0, template: 'split', sample: { ...base, name: 'Jordan Price', title: 'Realtor', company: 'Northside Realty', email: 'homes@example.com', website: 'northside.example', tagline: 'Your next home starts here' } },
  { id: 'auto', name: 'Auto & Repair', palette: 3, template: 'diagonal', sample: { ...base, name: 'Sam Ortiz', title: 'Service Manager', company: 'Main Street Auto', email: 'service@example.com', website: 'mainstreetauto.example', tagline: 'Honest repairs, fair prices' } },
  { id: 'lawn', name: 'Lawn & Landscaping', palette: 4, template: 'corner', sample: { ...base, name: 'Terry Moore', title: 'Owner', company: 'Green Acres Lawn', email: 'mow@example.com', website: 'greenacres.example', tagline: 'Mowing, trimming, cleanup' } },
  { id: 'church', name: 'Church & Nonprofit', palette: 10, template: 'frame', sample: { ...base, name: 'Pat Wilson', title: 'Pastor', company: 'Grace Fellowship', email: 'hello@example.com', website: 'gracefellowship.example', tagline: 'All are welcome' } },
  { id: 'medical', name: 'Medical & Health', palette: 6, template: 'classic', sample: { ...base, name: 'Dr. Ann Kim', title: 'Family Physician', company: 'Parkview Family Clinic', email: 'care@example.com', website: 'parkview.example', tagline: 'Caring for every age' } },
];
export const businessType = (id: string | null | undefined) => BUSINESS_TYPES.find((b) => b.id === id) ?? null;
export { SAMPLE };

/** The cheapest order on an option: the smallest quantity plus that option's price. */
export function fromPrice(code?: string): { total: number; qty: number; each: number } {
  const qty = Math.min(...QUANTITIES);
  const extra = code ? (CARD_OPTIONS.find((o) => o.code === code)?.price ?? 0) : 0;
  const total = Math.round((PRICES[qty] + extra) * 100) / 100;
  return { total, qty, each: Math.round((total / qty) * 100) / 100 };
}

/** Is every business type drawn with a real layout and color scheme? (Checked by the tests.) */
export const typesValid = () => BUSINESS_TYPES.every((b) => TEMPLATES.some((t) => t.id === b.template) && b.palette >= 0 && b.palette < PALETTES.length);
