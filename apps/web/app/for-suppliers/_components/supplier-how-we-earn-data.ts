/**
 * The ruled words of "How Setnayan earns" (DECISION_LOG e5d166cd, 16 Nov 2026), kept apart from the drawing so the guard
 * can read them without loading a CSS module. No price lives here.
 * 🔒 ../the-earn-block-says-what-was-ruled.test.ts
 *
 * Own-client words follow the 16 Nov import-fee ruling ("A NEW ACCOUNT IS FREE FOR ONE YEAR"), which retired
 * "free for life"; the promise title is main's shipped OWN_CLIENT_PROMISE so the two never drift.
 */
import { OWN_CLIENT_PROMISE } from '@/lib/own-clients';
/** Ruling e5d166cd (1), verbatim. */
export const PAID_SPOT_PROMISE = {
  title: 'No one can pay to rank above you.',
  body: 'If that ever changes, every paid spot will say Paid.',
} as const;

export const EARN_PROMISES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: OWN_CLIENT_PROMISE,
    body: 'A client new to Setnayan books you with no booking fee for 12 months. A client already on Setnayan books free for an event you are the first supplier to add them to. Each one comes with a Setnayan gift from you.',
  },
  {
    title: 'You see every fee before you agree.',
    body: 'The fee is written on the booking before you say yes. Nothing is added after.',
  },
  {
    title: 'You can question any fee.',
    body: 'Tap “Dispute this fee” on the bill. Your first one is on us; after that our team reviews it and tells you why.',
  },
  {
    title: 'We never sell or share your clients.',
    body: 'Your client list, chats and payments are yours. No one else on Setnayan sees them.',
  },
  PAID_SPOT_PROMISE,
];

export const EARN_FREE_ROWS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Your own clients',
    body: 'All your own clients, no limit. Bring them with Add a client or your codes. Clients new to Setnayan book you free for a year.',
  },
  { title: 'Your shop page', body: 'Your page, your calendar, your chat, your portfolio and your badges.' },
  {
    title: 'The tools on Free',
    body: 'Quotes, payments to your own GCash or bank, schedules and forms. Couples pay you directly; it never passes through us.',
  },
];

/** The sample found-you line (ruling e5d166cd (2)) — the shape the client card and the fee bill print. */
export const SAMPLE_FOUND_LINE = 'Found you on Setnayan · from Search, 3 Nov';

type Wedding = { name: string; role: string; story: string; fee: boolean; why: string };
export const ONE_WEDDING: ReadonlyArray<Wedding> = [
  { name: 'Liwanag Events', role: 'Coordinator', story: 'Brought Ana & Paolo onto Setnayan first.', fee: false, why: 'Their client, new to Setnayan: free for a year' },
  {
    name: 'Lola Nena’s Kitchen',
    role: 'Catering',
    story: 'The family’s caterer. Ana added them herself; never seen on Setnayan.',
    fee: false,
    why: 'Brought by the couple',
  },
  { name: 'Tala Studio', role: 'Photo & video', story: 'Ana found them on Search.', fee: true, why: 'Found you on Setnayan' },
  { name: 'Ilaw Lights', role: 'Lights', story: 'Ana saved them from Find before booking.', fee: true, why: 'Found you on Setnayan' },
  {
    name: 'Bulaklak Florals',
    role: 'Flowers',
    story: 'Liwanag recommended them. They tried to import Ana — but Ana already planned on Setnayan.',
    fee: true,
    why: 'Joined a couple already here',
  },
];

export const ONE_WEDDING_RULE =
  'Only the first supplier who brings a couple in is free with them. Once a couple plans on Setnayan, a supplier who joins them is a normal booking.';

/** The gift bundle, in the 14 Nov ruling's words ("BUY 10, GET 1 FREE"; PR #7678's bundle lines). */
export const GIFT_BUNDLE_WORDS = 'Buy 10, get 1 free.';
