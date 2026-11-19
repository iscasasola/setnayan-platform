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

/** The words at the top of each shared screen — title, then one line. */
export const ONBOARDING_HEADS: Readonly<Record<Exclude<OnboardingScreen, 'open'>, readonly [string, string]>> = {
  account: ['Create your account', 'Pick how you’ll sign in. Everything you typed stays.'],
  check: ['Check your shop', 'Tap a line to fix it. Every line needs a tick before you go on.'],
  card: ['Your first service card', 'We drafted it from what you do. Add a price and approve it, edit it, or skip.'],
  done: ['You’re all set', 'One look at your plan, then open your shop.'],
};

/** Door B's first screen (PB1): the name, what you do and the main service, on one screen. */
export const OPEN_YOUR_SHOP_HEAD = ['Open your shop', 'Your shop’s name, and the main service you’re known for.'] as const;
/** Door C's first screen: the same screen, Coordination pre-picked (`?as=coordinator`). */
export const OPEN_YOUR_COORDINATION_HEAD = ['Open your shop', 'Your shop’s name, and the coordination you do.'] as const;

/** The main button on an invite door. Owner: the button says "Accept", never "Claim it". */
export const ACCEPT_LABEL = 'Accept';

/* ───────────────────────── ② Check your shop — one list, a sheet per fact ───────────────────────── */

/**
 * The facts on "Check your shop", in the drawing's order: name, contact, categories, events served, where (the map pin
 * stays), number, then the package and pay rows. `package` and `pay` are drawn only by a door that HAS them (a couple's
 * booking records what was agreed and how it is paid); the self-serve door has neither yet, so it draws no row for
 * them rather than an empty promise.
 */
export const CHECK_FACTS = ['name', 'contact', 'categories', 'events', 'where', 'number', 'package', 'pay'] as const;
export type CheckFact = (typeof CHECK_FACTS)[number];

export const CHECK_FACT_LABEL: Readonly<Record<CheckFact, string>> = {
  name: 'Shop name',
  contact: 'Contact person',
  categories: 'What you do',
  events: 'Events you serve',
  where: 'Where you are',
  number: 'Contact number',
  package: 'Package',
  pay: 'How you get paid',
};

/** The facts the self-serve sign-up (Door B, and Door C after it) draws — no package, no pay yet. */
export const SELF_SERVE_FACTS: readonly CheckFact[] = ['name', 'contact', 'categories', 'events', 'where', 'number'];

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
  if (input.choice !== 'edit') return welcome;
  if (input.cardId) return `/vendor-dashboard/services/${encodeURIComponent(input.cardId)}`;
  if (input.category) return `/vendor-dashboard/services/new/${encodeURIComponent(input.category)}`;
  return '/vendor-dashboard/services/new';
}

/** The welcome's three next steps, in the owner's order. No leads are promised. */
export const TODAY_WELCOME_STEPS = [
  { key: 'clients', label: 'Add the clients you already have', href: '/vendor-dashboard/customers?add=outside' },
  { key: 'logo', label: 'Add your logo', href: '/open-shop/logo' },
  { key: 'verify', label: 'Get verified', href: '/vendor-dashboard/profile#docs' },
] as const;

/** The welcome's own line. Says what is true without a verified seal (unverified Free reaches 0 km) — never a lead. */
export const TODAY_WELCOME_LINE =
  'Couples don’t find an unverified shop in search yet — start with the clients you already have, and get verified.';

/**
 * Which welcome Today draws — read off its own address. `?claimed=1` (Door A: the couple's invite was accepted) and
 * `?opened=1` (Doors B and C) both draw it; anything else draws none. Before 19 Nov nothing read `?claimed=1`.
 */
export function welcomeFrom(search: { claimed?: string | null; opened?: string | null }): 'claimed' | 'opened' | null {
  if (search.claimed === '1') return 'claimed';
  if (search.opened === '1') return 'opened';
  return null;
}

/** The welcome's title, by door. */
export function welcomeTitle(kind: 'claimed' | 'opened', shopName: string | null): string {
  const name = shopName?.trim();
  if (kind === 'claimed') return name ? `Welcome, ${name} — your shop is yours` : 'Welcome — your shop is yours';
  return name ? `Welcome, ${name} — your shop is open` : 'Welcome — your shop is open';
}
