/**
 * 🚪 SUPPLIER ONBOARDING — ONE FLOW, THREE DOORS (owner 2026-11-19, DECISION_LOG "SUPPLIER CLAIM ONBOARDING (couple QR)
 * APPROVED", "SUPPLIER ONBOARDING — BOTH DOORS APPROVED (v3)", "COORDINATOR ONBOARDING (Door C) APPROVED"; drawing
 * `36jmQMWrANcgd2HxihAUw5` v4). About 11-14 screens become five, and the shop's first service card is made on the way:
 *
 *   (door)  Door A: Accept "<couple> invited you" · Door B: Open your shop · Door C: the same, Coordination pre-picked
 *   ①  Create account        — SECOND, never last
 *   ②  Check your shop       — ONE list, a sheet per fact
 *   ③  Your first service card — drafted; Approve (needs a price) · Edit (the shipped Card Maker) · Skip (no card)
 *   ④  You're all set        — the plan sits on this last screen
 *   then Today, with a welcome: Add the clients you already have · Add your logo · Get verified. No leads promised.
 *
 * This module is the flow's ONE vocabulary — the screen order, the words at the top of each, the fact rows of "Check
 * your shop", the first card's three ways and where each lands, and the Today welcome. Pure: every door reads it, and
 * `lib/supplier-onboarding.test.ts` pins each owner rule here, so a door cannot drift from the others.
 */

/* ───────────────────────── the screens ───────────────────────── */

/** The five screens, in the approved order. The account is SECOND (owner: "Create account (second, not last)"). */
export const ONBOARDING_SCREENS = ['open', 'account', 'check', 'card', 'done'] as const;
export type OnboardingScreen = (typeof ONBOARDING_SCREENS)[number];

/** The wizard's step number of each screen (1-based, the order above). */
export const ONBOARDING_STEP: Readonly<Record<OnboardingScreen, 1 | 2 | 3 | 4 | 5>> = {
  open: 1,
  account: 2,
  check: 3,
  card: 4,
  done: 5,
};

/**
 * The words at the top of each shared screen — title, then one line. The drawing's own words (PB2 · PB3 · PB4 · PB5),
 * not paraphrases: "Your changes save as you go." is TRUE on this device — the wizard parks every answer in this
 * browser on each step and each sheet's Save (`saveDraft`), and Google / Apple bring them back.
 */
export const ONBOARDING_HEADS: Readonly<Record<Exclude<OnboardingScreen, 'open'>, readonly [string, string]>> = {
  account: ['Create your account', 'Your changes save as you go.'],
  check: ['Your shop', 'Tap a row to fill it.'],
  card: ['Your first service card', 'We drafted it. Add your price to approve.'],
  done: ['You’re all set', 'Your shop opens on Free.'],
};

/** The card screen's line once a price is typed (PB4·b). Before it, `ONBOARDING_HEADS.card` (PB4). */
export const FIRST_CARD_PRICED_LINE = 'Approve it, edit it, or skip.';

/** The names under the step dots (the drawing's `psteps`), per door. Door B starts at "Start"; Door A at "Accept". */
export const ONBOARDING_STEP_NAMES = {
  open: ['Start', 'Account', 'Your shop', 'Your card', 'Done'],
  claim: ['Accept', 'Account', 'Your shop', 'Your card', 'Done'],
} as const;

/** Door B's first screen (PB1): the name, what you do and the main service, on one screen. */
export const OPEN_YOUR_SHOP_HEAD = ['Open your shop', 'Three answers. Free.'] as const;
/** Door C's first screen (PC1): the same screen, Coordination pre-picked (`?as=coordinator`). */
export const OPEN_YOUR_COORDINATION_HEAD = ['Open your coordination shop', 'Two answers. Free.'] as const;
/** PB1's line under the answers — what Free is, and who couples find. No lead is promised. */
export const OPEN_YOUR_SHOP_FREE_LINE = 'Free gives you the tools. Couples find verified shops.';

/** The main button on an invite door. Owner: the button says "Accept", never "Claim it". */
export const ACCEPT_LABEL = 'Accept';
/** P1's line over the button — what Accept does, and that it is free. */
export const ACCEPT_LINE = 'Accept to run this booking on Setnayan. Free.';
/** P1's quiet decline link (was the grey pill "I'm not this supplier"). */
export const NOT_MY_BUSINESS = 'Not my business';

/** P3's title (drawing v4): on the claim door the list is the couple's record to correct. Door B keeps `ONBOARDING_HEADS.check`. */
export const CLAIM_CHECK_HEAD = 'Check your shop';

/**
 * 🚪 P3 — DOOR A'S ROW NAMES (owner 19 Nov drawing). The couple's record names a booking, so its rows read Covers ·
 * Booked · Pays · They pay you where the self-serve list says Services · Booked · They pay you. `plan` (the payment
 * plan) is Door A's alone.
 */
export const CLAIM_CHECK_LABEL = {
  name: 'Shop name',
  contact: 'Contact',
  number: 'Number',
  categories: 'Covers',
  package: 'Booked',
  plan: 'Pays',
  pay: 'They pay you',
} as const;
export type ClaimCheckRow = keyof typeof CLAIM_CHECK_LABEL;
/** P3's line under the head — whatever the couple got wrong is theirs to change. */
export const claimCheckLine = (couple: string) => `Change anything ${couple} got wrong.`;
/** P3's two lines under the list — who sees a change, and who approves one. */
export const CLAIM_CHECK_NOTES = ['Contact changes: they just see them.', 'Price or service changes: they approve.'] as const;
/** P3's button — the list is right as it stands. */
export const LOOKS_RIGHT = 'Looks right';

/* ───────────────────────── ② Check your shop — one list, a sheet per fact ───────────────────────── */

/**
 * Every fact a "Your shop" list can draw. Each door draws its own subset in the drawing's order: Door B/C
 * (`SELF_SERVE_FACTS`, PB3) and Door A (P3 — the couple's record, with what was booked and how they pay).
 */
export const CHECK_FACTS = ['name', 'categories', 'events', 'where', 'contact', 'number', 'package', 'pay'] as const;
export type CheckFact = (typeof CHECK_FACTS)[number];

/** The row labels — the drawing's short words (PB3 / P3), not the old step titles. */
export const CHECK_FACT_LABEL: Readonly<Record<CheckFact, string>> = {
  name: 'Shop name',
  categories: 'Services',
  events: 'Events',
  where: 'Where',
  contact: 'Contact',
  number: 'Number',
  package: 'Booked',
  pay: 'They pay you',
};

/** What an empty row says (PB3), in place of a value — each names what to add. */
export const CHECK_FACT_EMPTY: Readonly<Partial<Record<CheckFact, string>>> = {
  events: 'Add the events you serve',
  where: 'Add your address',
  number: 'Add a number',
  pay: 'GCash, bank or cash',
};
export const checkFactEmpty = (fact: CheckFact) => CHECK_FACT_EMPTY[fact] ?? 'Add';

/**
 * PB3's rows, in its order: Shop name · Services · Events · Where · Contact · Number · They pay you. "They pay you" is
 * marked Later — the self-serve door asks for no pay details (they are added in the shop), so it never holds Continue.
 */
export const SELF_SERVE_FACTS: readonly CheckFact[] = ['name', 'categories', 'events', 'where', 'contact', 'number', 'pay'];
/** The self-serve rows that never hold Continue. */
export const SELF_SERVE_LATER: readonly CheckFact[] = ['pay'];
/** PB3's line under the list. */
export const SELF_SERVE_CHECK_NOTE = 'Contact is from your account. Change it any time.';

/** One row of the list: its fact, what it says now, and whether it still needs an answer. */
export type CheckRow = { fact: CheckFact; label: string; value: string | null; missing: boolean };

/** The list, drawn from what the door holds. A fact with no value is MISSING — drawn "Add", and it holds Continue. */
export function checkRows(
  facts: readonly CheckFact[],
  values: Partial<Record<CheckFact, string | null>>,
  optional: readonly CheckFact[] = [],
): CheckRow[] {
  return facts.map((fact) => {
    const raw = values[fact];
    const value = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    return { fact, label: CHECK_FACT_LABEL[fact], value, missing: !value && !optional.includes(fact) };
  });
}

/** The first row still missing an answer — the one Continue opens — or null when the list is done. */
export function firstMissing(rows: readonly CheckRow[]): CheckFact | null {
  return rows.find((r) => r.missing)?.fact ?? null;
}

/**
 * Which sheet holds a refused box. A refusal from the server (or the client gate) re-opens "Check your shop" ON the
 * sheet that owns the box, so the sentence is never about a screen they cannot see. The account boxes are on screen ①;
 * the name and the main service on the first screen.
 */
export const FIELD_FACT: Readonly<Record<string, CheckFact>> = {
  shop_name: 'name',
  contact_name: 'contact',
  extras: 'events',
  events: 'events',
  location: 'where',
  contact_phone: 'number',
};

/* ───────────────────────── ③ the first service card ───────────────────────── */

/** The first card's three ways. Approve needs a price · Edit opens the SHIPPED Card Maker · Skip makes no card. */
export const FIRST_CARD_CHOICES = ['approve', 'edit', 'skip'] as const;
export type FirstCardChoice = (typeof FIRST_CARD_CHOICES)[number];

/** The form fields the first card posts with the shop. */
export const FIRST_CARD_FIELD = {
  choice: 'first_card',
  title: 'first_card_title',
  price: 'first_card_price',
} as const;

export const FIRST_CARD_TITLE_MAX = 80;

/** The sentences the card screen refuses with — under its own box. */
export const FIRST_CARD_ERRORS = {
  choose: 'Approve the card, edit it, or skip it.',
  price: 'Type a price to approve this card — or Edit it, or Skip.',
  title: 'Give the card a name.',
} as const;

export function parseFirstCardChoice(v: unknown): FirstCardChoice | null {
  return typeof v === 'string' && (FIRST_CARD_CHOICES as readonly string[]).includes(v) ? (v as FirstCardChoice) : null;
}

/** A typed peso amount as a whole number, or null — "₱12,500" → 12500. Never 0: no price is not a free card. */
export function parseCardPrice(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * The card drafted from what the door knows. Door B/C: from the category + main service, and the SUPPLIER types the
 * price (none is guessed — there is no number to read). Door A passes the couple's logged price when there is one.
 */
export function draftFirstCard(input: { serviceLabel: string | null; price?: number | null }): { title: string; price: string } {
  return {
    title: (input.serviceLabel ?? '').trim().slice(0, FIRST_CARD_TITLE_MAX),
    price: input.price && input.price > 0 ? String(Math.round(input.price)) : '',
  };
}

/** The card screen's gate: the sentence that holds it, or null. */
export function firstCardRefusal(input: { choice: FirstCardChoice | null; title: string; price: string }): string | null {
  if (!input.choice) return FIRST_CARD_ERRORS.choose;
  if (input.choice === 'skip') return null;
  if (!input.title.trim()) return FIRST_CARD_ERRORS.title;
  if (input.choice === 'approve' && parseCardPrice(input.price) === null) return FIRST_CARD_ERRORS.price;
  return null;
}

/* ───────────────────────── Today, after the door ───────────────────────── */

/** Where a door lands once the shop is open: Today, with its welcome. Door A says it was a claim. */
export const WELCOME_OPENED_PATH = '/vendor-dashboard?opened=1';
export const WELCOME_CLAIMED_PATH = '/vendor-dashboard?claimed=1';

/**
 * Where the first card's way lands, once the shop is open:
 *   · Approve / Skip → Today's welcome
 *   · Edit with a card made → the SHIPPED Card Maker on that card (`/vendor-dashboard/services/<id>`)
 *   · Edit with no card made (no price yet, or the maker refused it) → the shipped maker, its kind pre-picked
 */
export function firstCardLanding(input: {
  choice: FirstCardChoice | null;
  cardId: string | null;
  category: string | null;
  welcome?: string;
}): string {
  const welcome = input.welcome ?? WELCOME_OPENED_PATH;
  // Skip made no card: the welcome is told, so its ticked row says "Your shop", never "Your shop and first card".
  if (input.choice === 'skip' || !input.choice) return `${welcome}&${FIRST_CARD_PARAM.state}=${FIRST_CARD_SKIPPED}`;
  if (input.choice !== 'edit') return welcome;
  if (input.cardId) return `/vendor-dashboard/services/${encodeURIComponent(input.cardId)}`;
  if (input.category) return `/vendor-dashboard/services/new/${encodeURIComponent(input.category)}`;
  return '/vendor-dashboard/services/new';
}

/* ── the first card, as it truly stands after the door ──
 * The shipped maker makes EVERY card as a draft (`is_active: false`, `createVendorService`); the door then asks the
 * SHIPPED switch (`toggleVendorServiceActive` — the publish gate and the plan's live-cards cap) to put it on the page
 * (`lib/first-card-live.server.ts`). Today's welcome is told which of these is true, on its own address (a service's
 * name and price — never a person's details), so it never claims a card that is not on the page:
 *   · `live`    — made AND on the page. Only then does the ticked row say "Your shop and first card".
 *   · `draft`   — made, but the switch said no; `why` is ITS sentence (a cover, what's included, the plan's cap …), and
 *                 the Card Maker opens on that card to finish it.
 *   · `waiting` — the Email way: nobody was signed in when the shop opened, so nothing is made yet; "Approve card" on
 *                 the welcome makes it.
 *   · `refused` — the maker said no; its own sentence.
 *   · `skipped` — the door's card screen was skipped; no card.
 * A bare `?opened=1` / `?claimed=1` says nothing about a card, so the row says "Your shop".
 */
export type FirstCardState = 'waiting' | 'refused' | 'draft';
/** `?card=skipped` — the door's card screen was skipped; nothing to approve, and no card is claimed. */
export const FIRST_CARD_SKIPPED = 'skipped';
/** `?card=live` — the first card is made and on the page. */
export const FIRST_CARD_LIVE = 'live';
export type FirstCardCarry = {
  state: FirstCardState;
  title: string;
  price: number;
  category: string;
  why: string | null;
  /** The made card's id (`draft` only) — the Card Maker opens on it. */
  id?: string | null;
};

export const FIRST_CARD_PARAM = {
  state: 'card',
  title: 'card_title',
  price: 'card_price',
  category: 'card_category',
  why: 'card_why',
  id: 'card_id',
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The welcome's address carrying a card that is not on the page yet. */
export function firstCardCarryPath(welcome: string, card: Omit<FirstCardCarry, 'why'> & { why?: string | null }): string {
  const q = new URLSearchParams();
  q.set(FIRST_CARD_PARAM.state, card.state);
  q.set(FIRST_CARD_PARAM.title, card.title.slice(0, FIRST_CARD_TITLE_MAX));
  q.set(FIRST_CARD_PARAM.price, String(Math.round(card.price)));
  q.set(FIRST_CARD_PARAM.category, card.category);
  if (card.why) q.set(FIRST_CARD_PARAM.why, card.why.slice(0, 200));
  if (card.id && UUID.test(card.id)) q.set(FIRST_CARD_PARAM.id, card.id);
  return `${welcome}${welcome.includes('?') ? '&' : '?'}${q.toString()}`;
}

/** The welcome's address for a card that IS on the page. */
export const firstCardLivePath = (welcome: string) => `${welcome}${welcome.includes('?') ? '&' : '?'}${FIRST_CARD_PARAM.state}=${FIRST_CARD_LIVE}`;

/** Read it back — every part re-checked (it arrives on an address anyone can type). Null when anything is off. */
export function firstCardFrom(search: Record<string, string | string[] | undefined>): FirstCardCarry | null {
  const one = (k: string) => {
    const v = search[k];
    return typeof v === 'string' ? v : null;
  };
  const state = one(FIRST_CARD_PARAM.state);
  if (state !== 'waiting' && state !== 'refused' && state !== 'draft') return null;
  const title = (one(FIRST_CARD_PARAM.title) ?? '').trim().slice(0, FIRST_CARD_TITLE_MAX);
  const price = parseCardPrice(one(FIRST_CARD_PARAM.price));
  const category = (one(FIRST_CARD_PARAM.category) ?? '').trim();
  if (!title || !price || !/^[a-z0-9_]{1,64}$/.test(category)) return null;
  const why = (one(FIRST_CARD_PARAM.why) ?? '').trim().slice(0, 200) || null;
  const rawId = one(FIRST_CARD_PARAM.id);
  const id = state === 'draft' && rawId && UUID.test(rawId) ? rawId : null;
  return { state, title, price, category, why, id };
}

/** What `?card=` says on its own — `live` / `skipped` / `draft` with no carried card (the claim door's other cards). */
export function firstCardStateFrom(search: Record<string, string | string[] | undefined>): 'live' | 'skipped' | 'draft' | null {
  const v = search[FIRST_CARD_PARAM.state];
  return v === FIRST_CARD_LIVE || v === FIRST_CARD_SKIPPED || v === 'draft' ? v : null;
}

/** What the welcome says about a first card that is not on the page. */
export const FIRST_CARD_CARRY_LINE: Readonly<Record<FirstCardState, string>> = {
  waiting: 'Your first card is drafted. Approve it to make it.',
  refused: 'Your first card wasn’t made.',
  draft: 'Your first card is made, but it isn’t on your page yet.',
};

/** Said when the shipped switch failed with no sentence of its own. */
export const FIRST_CARD_NOT_LIVE = 'We couldn’t put it on your page just now. Open it in the Card Maker to try again.';

/**
 * Reads the shipped switch's answer (`toggleVendorServiceActive` redirects, never returns): `?error=` is ITS sentence —
 * the publish gate or the live-cards cap — `?saved=1` is live, anything else is NOT a yes. Pure, so it is tested.
 */
export function firstCardLiveFrom(redirectUrl: string | null | undefined): { live: true } | { live: false; why: string } {
  const url = new URL(redirectUrl ?? '', 'http://first-card.local');
  const refused = (url.searchParams.get('error') ?? '').trim();
  if (refused) return { live: false, why: refused.slice(0, 200) };
  if (url.searchParams.get('saved') === '1') return { live: true };
  return { live: false, why: FIRST_CARD_NOT_LIVE };
}

/** The draft card's button on the welcome — asks the shipped switch again (idempotent: no second card is made). */
export const FIRST_CARD_RETRY = 'Put it on my page';
/** A door that made cards as drafts with no single card to carry (the claim door's picks). */
export const FIRST_CARD_DRAFTS_LINE = 'Your cards are made as drafts — put each on your page from the Card Maker.';

/** The welcome's three next steps, in the owner's order (PB6). No leads are promised. */
export const TODAY_WELCOME_STEPS = [
  { key: 'clients', label: 'Add the clients you already have', href: '/vendor-dashboard/customers?add=outside' },
  { key: 'logo', label: 'Add your logo', href: '/open-shop/logo' },
  { key: 'verify', label: 'Get verified to be found', href: '/vendor-dashboard/profile#docs' },
] as const;

/** The welcome's own line (PB6). Says what is true — the shop is open on Free — never a lead. */
export const TODAY_WELCOME_LINE = 'Your shop is open on Free.';
/** P6 — the claimed welcome's line: where the couple who invited them now is. */
export const claimedWelcomeLine = (couple: string, eventWord: string) => `${couple}’s ${eventWord} is in Clients.`;

/** PB6's first, already-ticked row: what the door made. */
export const TODAY_WELCOME_DONE = { withCard: 'Your shop and first card', shopOnly: 'Your shop' } as const;
/** The ticked row claims the card ONLY when the address says it is live — a bare `?opened=1` names the shop alone. */
export const welcomeDoneRow = (cardState: ReturnType<typeof firstCardStateFrom>) =>
  cardState === FIRST_CARD_LIVE ? TODAY_WELCOME_DONE.withCard : TODAY_WELCOME_DONE.shopOnly;

/** PB5 — the Free row and its line. Unverified Free is 0 km: nobody finds the shop in search yet. */
export const DONE_FREE_ROW = { name: 'Free', line: 'Tools for the clients you have' } as const;
export const DONE_FREE_LINE = 'Couples can’t find you yet. Get verified later.';

/**
 * Which welcome Today draws — read off its own address. `?claimed=1` (Door A: the couple's invite was accepted) and
 * `?opened=1` (Doors B and C) both draw it; anything else draws none. Before 19 Nov nothing read `?claimed=1`.
 */
export function welcomeFrom(search: { claimed?: string | null; opened?: string | null }): 'claimed' | 'opened' | null {
  if (search.claimed === '1') return 'claimed';
  if (search.opened === '1') return 'opened';
  return null;
}

/** The welcome's title (PB6 / P6): "Welcome, <shop>". */
export function welcomeTitle(_kind: 'claimed' | 'opened', shopName: string | null): string {
  const name = shopName?.trim();
  return name ? `Welcome, ${name}` : 'Welcome';
}
