// Single place for store facts. The values below are the Forsythe store, the first one. A second
// store runs the same code with its own facts: a JSON file in site/stores/<slug>.json, set on that
// store's deployment as the STORE_JSON secret (scripts/new-store.py prints the commands). Anything
// the JSON leaves out keeps the default below, so a new store only has to say what differs.
// Items marked TODO are for the owners to confirm.
import { env as cfEnv } from 'cloudflare:workers';

export interface StoreFacts {
  id: string;                 // short slug, used in logs and the Z-report: forsythe, west-carroll
  name: string;
  address: string;
  phone: string;
  email: string;
  origin: { contact_name: string; company_name: string; contact_phone: string; contact_email: string; line_1: string; line_2?: string; city: string; state: string; postal_code: string; country_alpha2: string };
  formEndpoint: string;
  reviewUrl?: string;         // the Google Business Profile review link (issue 7); the delivered email asks for a review when set
  hours: { days: string; key: string; open: string; openKey?: string }[];
  services: { key: string; name: string; blurb: string; link?: string }[];
}

export const defaults: StoreFacts = {
  id: 'forsythe',
  name: "Goin' Postal Forsythe",
  address: "1800 Forsythe Ave Ste 2, Monroe, LA 71201",
  phone: "(318) 000-0000", // TODO: real store number
  email: "wbp93623@gmail.com",
  // Ship-from address printed on labels. TODO: phone.
  origin: {
    contact_name: "Goin' Postal Forsythe",
    company_name: "Goin' Postal Forsythe",
    contact_phone: "+13180000000",
    contact_email: "wbp93623@gmail.com",
    line_1: "1800 Forsythe Ave Ste 2",
    city: "Monroe",
    state: "LA",
    postal_code: "71201",
    country_alpha2: "US",
  },
  formEndpoint: "https://formspree.io/f/REPLACE_ME", // TODO: create a Formspree form and paste its ID
  reviewUrl: "", // TODO: the Google review link from the Business Profile (issue 7); blank sends no review ask
  hours: [
    { days: "Monday to Friday", key: "days.monfri", open: "9:00 am to 6:00 pm" }, // TODO: confirm
    { days: "Saturday", key: "days.sat", open: "10:00 am to 2:00 pm" }, // TODO: confirm
    { days: "Sunday", key: "days.sun", open: "Closed", openKey: "hours.closed" },
  ],
  services: [
    { key: "ship", name: "Shipping", blurb: "UPS, FedEx, USPS and DHL under one roof. We compare rates so you pay the least." },
    { key: "pack", name: "Packing", blurb: "Bring it in loose. We box, cushion and label it so it arrives in one piece." },
    { key: "returns", name: "Returns drop-off", blurb: "Amazon, UPS, FedEx and USPS returns. We print the label from your phone, box it, and scan it in so you have proof.", link: "/returns" },
    { key: "mailbox", name: "Mailbox rental", blurb: "A real street address, package acceptance from every carrier, and text alerts.", link: "/mailbox" },
    { key: "print", name: "Printing and copies", blurb: "Flyers, banners and everyday copies, often same day. Design your own business cards online.", link: "/cards" },
    { key: "notary", name: "Notary", blurb: "Walk-in notary service during store hours." },
    { key: "shred", name: "Shredding", blurb: "Drop off a bag or a box. Secure, by the pound." },
  ],
};

/** The defaults with a store's own facts laid over them. Top-level fields replace; `origin` merges field by field; lists replace whole. */
export function mergeStore(base: StoreFacts, over: Partial<StoreFacts> | null | undefined): StoreFacts {
  if (!over || typeof over !== 'object') return base;
  return { ...base, ...over, origin: { ...base.origin, ...(over.origin ?? {}) } };
}

function overrideFromEnv(): Partial<StoreFacts> | null {
  try {
    const raw = (cfEnv as unknown as { STORE_JSON?: string } | undefined)?.STORE_JSON;
    return raw ? (JSON.parse(raw) as Partial<StoreFacts>) : null;
  } catch (e) {
    console.error('STORE_JSON is not valid JSON; using the default store facts', e);
    return null;
  }
}

export const store: StoreFacts = mergeStore(defaults, overrideFromEnv());
