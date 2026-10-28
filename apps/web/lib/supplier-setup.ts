/**
 * lib/supplier-setup.ts — A NEW SHOP'S SIX STEPS, DONE IN PLACE ON TODAY (pure — no I/O, no clock).
 *
 * Owner 2026-10-28 (corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE", TODAY;
 * "THE SUPPLIER PACKAGE IS SIGNED OFF"; prototype `prototypes/supplier_in_place_2026-10-28/interactive.html` v8,
 * `steps` + `stepBody`): "new-shop setup = 6 folds done in place (Save → ✓, the bar grows, the next opens; big tools
 * such as the service maker as a SHEET over Today); step 4 counts Good · Better · Best (≥ 3 cards per Service,
 * 'N to go'); step 5 documents in place …; step 6 opens the shop's Anyone-QR fold."
 *
 *   1 Name your shop · 2 Your details · 3 Add your logo · 4 What you offer · 5 Send your documents · 6 Your QR + days off
 *
 * NOTHING HERE RE-DECIDES A RULE THAT LIVES ELSEWHERE. Each fold's ✓ is read off what the shipped rail
 * (`buildFirstStepsRail`) or the shipped checklist (`businessProfileChecklist`) already measured — a fold is never
 * ticked by a press, only by the saved fact, so it cannot congratulate a step that did not happen. The rail's own
 * order (details → logo → what you offer → documents …) is the folds' order.
 *
 * 🔢 GOOD · BETTER · BEST IS A POSITION, NOT A COLUMN. There is no tier on `vendor_services`: a service's cards are
 * ordered by their own starting price (lowest first, unpriced last) and the first three are called Good, Better and
 * Best. No price is written or suggested here — only the supplier's own numbers are shown.
 */
import type { BadgeTone } from '@/app/_components/badge';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import { DETAILS_CHECKLIST_KEYS } from '@/lib/supplier-details';
import { formatCount } from '@/lib/format-number';

/** At least this many service cards per service (owner 2026-10-28). */
export const CARDS_PER_SERVICE = 3;
/** The three slots' names, in order (lowest starting price first). */
export const SERVICE_TIERS = ['Good', 'Better', 'Best'] as const;

/** One authored service card, as the setup fold needs it. */
export type SetupCard = {
  id: string;
  /** The service (`vendor_services.category`). */
  service: string;
  title: string | null;
  pricePhp: number | null;
};

export type OfferService = {
  service: string;
  /** The service's cards, lowest starting price first (unpriced last) — slot i is `SERVICE_TIERS[i]`. */
  cards: SetupCard[];
  /** Cards still to add for this service to reach `CARDS_PER_SERVICE`. */
  toGo: number;
};

export type OfferProgress = {
  services: OfferService[];
  /** Cards still to add across every service. */
  toGo: number;
};

/**
 * Every service the shop offers (its profile's services first, then any service it already made a card for), each
 * with its cards and what is left. A shop with no service at all has one whole service to go.
 */
export function offerProgress(offered: readonly string[], cards: readonly SetupCard[]): OfferProgress {
  const order: string[] = [];
  for (const s of [...offered, ...cards.map((c) => c.service)]) if (s && !order.includes(s)) order.push(s);
  const services = order.map((service) => {
    const mine = cards
      .filter((c) => c.service === service)
      .sort((a, b) => (a.pricePhp ?? Number.POSITIVE_INFINITY) - (b.pricePhp ?? Number.POSITIVE_INFINITY));
    return { service, cards: mine, toGo: Math.max(0, CARDS_PER_SERVICE - mine.length) };
  });
  const toGo = services.length === 0 ? CARDS_PER_SERVICE : services.reduce((n, s) => n + s.toGo, 0);
  return { services, toGo };
}

/** "1 to go" · "3 of 3" — the words on a service's row and on the fold. */
export function toGoWord(toGo: number): string {
  return `${formatCount(toGo)} to go`;
}

export type SetupFoldKey = 'name' | 'details' | 'logo' | 'offer' | 'docs' | 'qr';

export type SetupFold = {
  key: SetupFoldKey;
  /** 1-based, the chip's number until it is ✓. */
  n: number;
  title: string;
  /** The one quiet line under the title. */
  line: string;
  done: boolean;
  /** A state at the right of the head ("1 to go" · "Checking" · "Needs a fix"), or null. */
  badge: { word: string; tone: BadgeTone } | null;
};

export type SetupDocs = {
  /** The latest application's status (`vendor_verification_applications.status`), null when none. */
  status: string | null;
  docsIn: number;
  docsTotal: number;
};

export type SetupInput = {
  checklist: readonly BusinessProfileItem[];
  rail: FirstStepsRail;
  /** Null when the cards could not be read — the fold then says so and is not ticked. */
  offer: OfferProgress | null;
  docs: SetupDocs;
  shopName: string | null;
};

export type SetupView = {
  folds: SetupFold[];
  done: number;
  of: number;
  /** The fold that opens on arrival — the first one not done (none when all six are). */
  firstOpen: SetupFoldKey | null;
};

const NAME_KEYS = DETAILS_CHECKLIST_KEYS.name.filter((k) => k !== 'logo');
const DETAIL_KEYS = [...DETAILS_CHECKLIST_KEYS.what, ...DETAILS_CHECKLIST_KEYS.where, ...DETAILS_CHECKLIST_KEYS.contact];

/** The checklist rows a fold edits — the Your-details groups, cut the prototype's way (the name apart). */
export function setupChecklistKeys(key: 'name' | 'details' | 'logo'): readonly string[] {
  return key === 'name' ? NAME_KEYS : key === 'details' ? DETAIL_KEYS : ['logo'];
}

function allIn(checklist: readonly BusinessProfileItem[], keys: readonly string[]): boolean {
  const mine = checklist.filter((i) => keys.includes(i.key));
  return mine.length > 0 && mine.every((i) => i.ok);
}

export function assembleSetup(input: SetupInput): SetupView {
  const step = (k: string) => input.rail.steps.find((s) => s.key === k);
  const status = input.docs.status;
  const checking = status === 'pending_review' || status === 'in_review';
  const docsBadge: SetupFold['badge'] =
    step('documents')?.state === 'done'
      ? { word: 'Approved', tone: 'ok' }
      : checking
        ? { word: 'Checking', tone: 'wait' }
        : status === 'rejected'
          ? { word: 'Needs a fix', tone: 'no' }
          : { word: `${formatCount(input.docs.docsIn)} of ${formatCount(input.docs.docsTotal)} in`, tone: 'quiet' };
  const offer = input.offer;
  const folds: SetupFold[] = [
    {
      key: 'name',
      n: 1,
      title: 'Name your shop',
      line: input.shopName?.trim() || 'What couples call you',
      done: allIn(input.checklist, NAME_KEYS),
      badge: null,
    },
    {
      key: 'details',
      n: 2,
      title: 'Your details',
      line: 'What you do · where · how couples reach you',
      done: allIn(input.checklist, DETAIL_KEYS),
      badge: null,
    },
    {
      key: 'logo',
      n: 3,
      title: 'Add your logo',
      line: 'Shows on your page and cards',
      done: step('logo')?.state === 'done',
      badge: null,
    },
    {
      key: 'offer',
      n: 4,
      title: 'What you offer',
      line: 'At least 3 cards per service — Good · Better · Best',
      done: step('service_card')?.state === 'done',
      badge: offer === null ? { word: 'Couldn’t load', tone: 'no' } : offer.toGo > 0 ? { word: toGoWord(offer.toGo), tone: 'wait' } : null,
    },
    {
      key: 'docs',
      n: 5,
      title: 'Send your documents',
      line: 'DTI or SEC · BIR · permit · bank proof',
      // Sent counts as done for the supplier: the next move is Setnayan's (the rail's own "waiting is not doing").
      done: step('documents')?.state === 'done' || checking,
      badge: docsBadge,
    },
    {
      key: 'qr',
      n: 6,
      title: 'Your QR + days off',
      line: 'Share it · mark days you can’t take',
      done: step('not_available')?.state === 'done',
      badge: null,
    },
  ];
  const done = folds.filter((f) => f.done).length;
  return { folds, done, of: folds.length, firstOpen: folds.find((f) => !f.done)?.key ?? null };
}

/** "3 of 6 done" — or, once all six are, what happens next. */
export function setupHeadline(v: Pick<SetupView, 'done' | 'of'>): string {
  return v.done >= v.of ? 'All done — Setnayan checks you next' : `${formatCount(v.done)} of ${formatCount(v.of)} done`;
}

/**
 * The fold to open after a save: when the open fold has just turned ✓, the next one not done after it (then any
 * before it); otherwise the open fold stays open. Pure, so the "the next opens" promise is testable.
 */
export function nextOpenAfter(
  folds: readonly Pick<SetupFold, 'key' | 'done'>[],
  open: SetupFoldKey | null,
  wasDone: ReadonlySet<SetupFoldKey>,
): SetupFoldKey | null {
  if (!open) return open;
  const now = folds.find((f) => f.key === open);
  if (!now || !now.done || wasDone.has(open)) return open;
  const at = folds.findIndex((f) => f.key === open);
  return [...folds.slice(at + 1), ...folds.slice(0, at)].find((f) => !f.done)?.key ?? null;
}
