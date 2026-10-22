// Single place for store facts. Items marked TODO are for the owners to confirm.
export const store = {
  name: "Goin' Postal Forsythe",
  address: "Forsythe Ave & N 18th St, Monroe, LA 71201", // TODO: street number and ZIP
  phone: "(318) 000-0000", // TODO: real store number
  email: "wbp93623@gmail.com",
  // Ship-from address sent to Easyship. TODO: street number, ZIP, phone.
  origin: {
    contact_name: "Goin' Postal Forsythe",
    company_name: "Goin' Postal Forsythe",
    contact_phone: "+13180000000",
    contact_email: "wbp93623@gmail.com",
    line_1: "Forsythe Ave & N 18th St",
    city: "Monroe",
    state: "LA",
    postal_code: "71201",
    country_alpha2: "US",
  },
  formEndpoint: "https://formspree.io/f/REPLACE_ME", // TODO: create a Formspree form and paste its ID
  hours: [
    { days: "Monday to Friday", key: "days.monfri", open: "9:00 am to 6:00 pm" }, // TODO: confirm
    { days: "Saturday", key: "days.sat", open: "10:00 am to 2:00 pm" }, // TODO: confirm
    { days: "Sunday", key: "days.sun", open: "Closed", openKey: "hours.closed" },
  ],
  services: [
    { key: "ship", name: "Shipping", blurb: "UPS, FedEx, USPS and DHL under one roof. We compare rates so you pay the least." },
    { key: "pack", name: "Packing", blurb: "Bring it in loose. We box, cushion and label it so it arrives in one piece." },
    { key: "mailbox", name: "Mailbox rental", blurb: "A real street address, package acceptance from every carrier, and text alerts." },
    { key: "print", name: "Printing and copies", blurb: "Flyers, banners and everyday copies, often same day. Design your own business cards online." },
    { key: "notary", name: "Notary", blurb: "Walk-in notary service during store hours." },
    { key: "shred", name: "Shredding", blurb: "Drop off a bag or a box. Secure, by the pound." },
  ],
};
