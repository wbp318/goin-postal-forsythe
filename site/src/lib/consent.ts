// The exact wording next to the marketing boxes (Peter, Nov 14 2026). The English sentence is what gets
// logged with each yes or no in marketing_consents, with the language the customer saw it in, as proof.
// Texts need express written consent under the TCPA: the box is never pre-ticked, agreeing is never a
// condition of buying, and the wording names the sender, the frequency, rates, STOP and HELP.
// The frequency ("up to 4 a month") is a promise: change it here and in i18n strings mkt.sms if the plan changes,
// and pick the SMS platform first (peter/TODO.md P4). Pure: safe in the browser.
export const CONSENT_WORDING = {
  email: "Email me Goin' Postal deals and news. Unsubscribe anytime.",
  sms: "Text me Goin' Postal deals and news at my mobile number. Up to 4 messages a month. Message and data rates may apply. Reply STOP to stop, HELP for help. Agreeing is not a condition of buying.",
} as const;

export type ConsentChannel = keyof typeof CONSENT_WORDING;
export const isChannel = (c: unknown): c is ConsentChannel => c === 'email' || c === 'sms';
/** What gets logged: the English wording, plus the language it was shown in when not English. */
export const loggedWording = (channel: ConsentChannel, lang?: string) => CONSENT_WORDING[channel] + (lang && lang !== 'en' ? ` [shown in ${String(lang).slice(0, 5)}]` : '');
