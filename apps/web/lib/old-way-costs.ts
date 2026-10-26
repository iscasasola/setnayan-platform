/**
 * old-way-costs.ts — what DOING IT THE OLD WAY costs: printing it yourself, keeping the list by hand.
 *
 * Read by the questionnaire's "What Setnayan does for you" (`app/(shell)/pricing/plan`, owner 2026-10-25: "And then we
 * will say what setnayan can offer to them and how much it saves time and money for them"). Prototype
 * `prototypes/pricing_ours_only_2026-10-25/quiz.html`, the controller's old-way research of 2026-10-25.
 *
 * 🔑 THESE ARE FACTS ABOUT PRINTING AND ABOUT TIME — NEVER ABOUT ANOTHER EVENT COMPANY. Owner, 2026-10-25: "I was told
 * never to compare so i do not look cheap". Each figure is a Philippine print shop's own published price, or a survey
 * figure, with its source and the date it was read. No shop is named on the page; the source stays here.
 *
 * Nothing else is counted (no courier, no camera, no RSVP cards — unsourced or weak). A figure with no source does not
 * belong in this file; `old-way-costs.test.ts` fails on one.
 */

export type OldWayFigure = {
  /** The figure: pesos for a price, hours for a time. */
  value: number;
  unit: 'php' | 'hours';
  /** What it is, in plain words. */
  what: string;
  /** Where it was read — an https page anyone can open. */
  source: string;
  /** The day it was read (YYYY-MM-DD). Prices move; this says when it was true. */
  readOn: string;
};

const READ_ON = '2026-10-25';

export const OLD_WAY = {
  /** A printed invitation with its envelope — a typical design at 100 pieces (minimum order 50). */
  printedInvitation: {
    value: 89,
    unit: 'php',
    what: 'a printed invitation with envelope, typical design at 100 pieces',
    source: 'https://paperbug.com.ph/product-category/wedding-invitations/signature-collection/',
    readOn: READ_ON,
  },
  /** One printed place card. */
  placeCard: {
    value: 10,
    unit: 'php',
    what: 'a printed place card',
    source: 'https://felizstudio.ph/pricelist',
    readOn: READ_ON,
  },
  /** One printed table number. */
  tableNumber: {
    value: 20,
    unit: 'php',
    what: 'a printed table number',
    source: 'https://felizstudio.ph/pricelist',
    readOn: READ_ON,
  },
  /** One printed welcome sign. */
  welcomeSign: {
    value: 1100,
    unit: 'php',
    what: 'a printed welcome sign',
    source: 'https://felizstudio.ph/pricelist',
    readOn: READ_ON,
  },
  /** Hours spent on the guest list alone — a UK survey of 2,000 married couples (Virgin Holidays, 2019). */
  guestListHours: {
    value: 9,
    unit: 'hours',
    what: 'hours on the guest list alone — a UK survey of 2,000 married couples, 2019',
    source: 'https://www.bravotv.com/personal-space/why-organizing-wedding-takes-time-work',
    readOn: READ_ON,
  },
} as const satisfies Record<string, OldWayFigure>;

/** Households ≈ guests ÷ 2 (one invitation per household); tables ≈ guests ÷ 10. */
export const householdsFor = (guests: number) => Math.ceil(guests / 2);
export const tablesFor = (guests: number) => Math.ceil(guests / 10);

export type OldWayMoney = {
  total: number;
  /** Each counted piece: how many, of what, at what price. Words are built by the page. */
  parts: Array<{ count: number; figure: keyof typeof OLD_WAY }>;
};

/**
 * Money kept against printing it yourself. Invitations (per household) when the guest list or online replies are
 * wanted; place cards, table numbers and one welcome sign when printables are. Nothing else.
 */
export function oldWayMoney(a: { guests: number; wantsGuestList: boolean; wantsOnlineReplies: boolean; wantsPrintables: boolean }): OldWayMoney {
  const parts: OldWayMoney['parts'] = [];
  if (a.wantsGuestList || a.wantsOnlineReplies) parts.push({ count: householdsFor(a.guests), figure: 'printedInvitation' });
  if (a.wantsPrintables) {
    parts.push({ count: a.guests, figure: 'placeCard' });
    parts.push({ count: tablesFor(a.guests), figure: 'tableNumber' });
    parts.push({ count: 1, figure: 'welcomeSign' });
  }
  const total = parts.reduce((sum, p) => sum + p.count * OLD_WAY[p.figure].value, 0);
  return { total, parts };
}
