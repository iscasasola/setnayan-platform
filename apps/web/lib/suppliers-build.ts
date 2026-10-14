/**
 * suppliers-build.ts — the pure rules behind the BUILD body of the couple's
 * one-screen Suppliers page (owner 2026-10-07; corpus
 * `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR3; prototype
 * `prototypes/suppliers_page_2026-10-07_fable.html`, Build mode).
 *
 *   This build    one line per category on the event — the booked supplier,
 *                 or ONE dropdown of the couple's own shortlist for it (priced,
 *                 and free on their date), or the door back to Find
 *   the money     Booked · If you book these · Budget · Buffer
 *   the fit line  how many priced picks are free on the date
 *   All builds    this build first, then every saved one, side by side
 *   the bar       Saved | Save · Save as new | Save this build, + Book this build
 *
 * NO NEW STATE AND NO NEW READ. Everything here is derived from what the page
 * already holds: the ring rows Find draws (`lib/explore-in-plan.ts`), the plan
 * model's prices, the build picks (`event_build_picks`), the saved builds
 * (`budget_builds.snapshot`) and the date-fit map. Nothing here touches a DOM,
 * so the page, the lab (`/dev/suppliers-lab`) and the tests cannot disagree.
 *
 * 🔑 A BUILD IS THE BOOKED SUPPLIERS PLUS THE PICKS — the prototype's
 * `currentPicks()`. The old "Current" column (`page.tsx`, `planPicks`) took the
 * FIRST shortlisted supplier of every category whether or not it was picked;
 * a build saved from this body holds only what is really in it.
 */
import { askEndedOf, askLine, coupleAskEndedLine, type AskEnded } from './booking-ask-words';
import { teamMoney, type TeamMoney } from './your-team';
import type { TallyChild } from './suppliers-shell';
import type { DateFit } from './calendar-truth';

/* ── THE SNAPSHOT A BUILD IS SAVED AS ─────────────────────────────────────
 * The shape `savePlanBuildNamed` has always posted (`PlanBuildSnapshot` in
 * `vendors/build-actions.ts`), spelled here so this file stays free of a
 * server-action import. Field for field the same — held by the golden test. */
export type BuildSnapshotPick = {
  groupId: string;
  label: string;
  vendorName: string;
  costPhp: number | null;
  locked: boolean;
  vendorId?: string;
  inclusions?: string[];
};
export type BuildSnapshot = { budgetPhp: number | null; totalPhp: number; picks: BuildSnapshotPick[] };

/* ── THIS BUILD'S LINES ───────────────────────────────────────────────────── */

export type BuildSupplier = {
  vendorId: string;
  name: string;
  /** The plan group a pick for this supplier is written under. */
  groupId: string | null;
  /** Whole pesos, or null — a supplier with no recorded price is never ₱0. */
  pricePhp: number | null;
  /** What their price comes with (their linked services, the couple's own
   *  inclusions) — saved with the build, as the old "Current" column saved it. */
  inclusions: string[];
};

export type BuildLine = {
  /** The Find row this category is (`?open=<tile>`). */
  tile: string;
  label: string;
  /** Booked here — the line is settled and offers no dropdown. */
  booked: BuildSupplier | null;
  /** In the build, not booked yet. */
  pick: BuildSupplier | null;
  /** Why the pick cannot be booked as things stand (taken on the date,
   *  declined) — the card's own words — or null when it can. */
  pickNote: string | null;
  /** The couple has already asked this pick to book; the supplier has not
   *  answered. It is not asked a second time. */
  pickAsked: boolean;
  /** How the last ask ended, when it did not end in a booking: they said no,
   *  the answer window ran out, or the couple took it back. Each way the pick
   *  may be asked again (the shipped rule — `lib/bench-card-actions.ts`). */
  pickAnswer: AskEnded | null;
  /** The dropdown: shortlisted here, priced, and free on the date. */
  candidates: BuildSupplier[];
};

export type BuildLineInputVendor = {
  vendorId: string;
  name: string;
  status: 'considering' | 'locked';
  planGroupId: string | null;
  /**
   * Where the booking ask stands — `lockRequestStateOf` over the row's own
   * `(status, lock_request_state)`, the pair the supplier's answer writes.
   * No new status: the shipped vocabulary, read as it is.
   */
  lockState?: 'none' | 'requested' | 'declined' | 'cancelled' | 'expired' | 'locked';
};

/**
 * THE WORD FOR EACH ANSWER, on a pick's line — the SAME sentences the
 * supplier's customer card reads for the same row, pronoun turned
 * (`lib/booking-ask-words.ts`; owner 2026-10-10, pair P2: "ask, agree, decline,
 * lapse, withdraw all show on both pages in the same words"). "Agreed" needs
 * none here: the line becomes the booked supplier.
 */
export const PICK_ASKED_NOTE = askLine('requested', 'couple');
export const PICK_DECLINED_NOTE = coupleAskEndedLine('declined');
export const PICK_LAPSED_NOTE = coupleAskEndedLine('expired');
export const PICK_WITHDRAWN_NOTE = coupleAskEndedLine('cancelled');

/** The line under a pick whose last ask ended without a booking. */
export function pickAnswerNote(answer: AskEnded): string {
  return coupleAskEndedLine(answer);
}

export function buildLinesOf(args: {
  /** The category rows Find shows, in its order. */
  tiles: ReadonlyArray<{ tile: string; label: string; vendors: ReadonlyArray<BuildLineInputVendor> }>;
  /** A supplier's price in whole pesos, or null when none is recorded. */
  priceOf: (vendorId: string) => number | null;
  /** What a supplier's price comes with. Absent → nothing recorded. */
  inclusionsOf?: (vendorId: string) => readonly string[];
  /** Suppliers pinned to the build (`event_build_picks`). */
  inBuild: ReadonlySet<string>;
  /** Suppliers who cannot be booked (taken on the date, or the ask was
   *  refused) → the words that say why. */
  blocked: ReadonlyMap<string, string>;
}): BuildLine[] {
  const supplier = (v: BuildLineInputVendor): BuildSupplier => ({
    vendorId: v.vendorId,
    name: v.name,
    groupId: v.planGroupId,
    pricePhp: args.priceOf(v.vendorId),
    inclusions: [...(args.inclusionsOf?.(v.vendorId) ?? [])],
  });
  return args.tiles.map((t) => {
    const bookedRow = t.vendors.find((v) => v.status === 'locked') ?? null;
    const open = t.vendors.filter((v) => v.status !== 'locked');
    const pickRow = open.find((v) => args.inBuild.has(v.vendorId)) ?? null;
    return {
      tile: t.tile,
      label: t.label,
      booked: bookedRow ? supplier(bookedRow) : null,
      pick: pickRow ? supplier(pickRow) : null,
      pickNote: pickRow ? (args.blocked.get(pickRow.vendorId) ?? null) : null,
      pickAsked: pickRow?.lockState === 'requested',
      pickAnswer: askEndedOf(pickRow?.lockState),
      // "Only picks those that are shortlisted and compatible for the date"
      // (owner 2026-10-07) — and only a priced supplier can be in a build.
      candidates: open
        .filter((v) => v.planGroupId != null && args.priceOf(v.vendorId) != null && !args.blocked.has(v.vendorId))
        .map(supplier),
    };
  });
}

/** The supplier a line holds — booked first, else the pick. */
export const lineSupplier = (l: BuildLine): BuildSupplier | null => l.booked ?? l.pick;

/** "N of M categories". */
export function buildCounts(lines: readonly BuildLine[]): { filled: number; total: number; toBook: number } {
  return {
    filled: lines.filter((l) => lineSupplier(l) != null).length,
    total: lines.length,
    // A pick that is already asked is waiting on the supplier, not on the couple.
    toBook: lines.filter((l) => l.booked == null && l.pick != null && !l.pickAsked).length,
  };
}

/** What Save posts: the booked suppliers and the picks, one row each. */
export function buildSnapshotOf(lines: readonly BuildLine[], budgetPhp: number | null): BuildSnapshot {
  const seen = new Set<string>();
  const picks: BuildSnapshotPick[] = [];
  for (const l of lines) {
    const s = lineSupplier(l);
    if (!s || !s.groupId) continue;
    const key = `${s.groupId}::${s.vendorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({
      groupId: s.groupId,
      label: l.label,
      vendorName: s.name,
      costPhp: s.pricePhp,
      locked: l.booked != null,
      vendorId: s.vendorId,
      inclusions: [...s.inclusions],
    });
  }
  return { budgetPhp, totalPhp: picks.reduce((sum, p) => sum + (p.costPhp ?? 0), 0), picks };
}

/* ── TWIN DETECTION ───────────────────────────────────────────────────────
 * Owner 2026-10-07: *"check if the services they pick already is exactly from
 * a similar build"*. Two builds are the same when they hold the same supplier
 * in every category — booked lines included, prices and names ignored. */

type KeyPick = { groupId?: string | null; vendorId?: string | null; vendorName?: string | null };

/** One build as a comparable string. Order never matters; an empty build is ''. */
export function buildKeyOf(picks: ReadonlyArray<KeyPick> | null | undefined): string {
  const keys = new Set<string>();
  for (const p of picks ?? []) {
    if (!p?.groupId) continue;
    const who = p.vendorId ? `id:${p.vendorId}` : p.vendorName ? `name:${p.vendorName.trim().toLowerCase()}` : null;
    if (who) keys.add(`${p.groupId}::${who}`);
  }
  return [...keys].sort().join('|');
}

export function sameBuild(a: ReadonlyArray<KeyPick> | null | undefined, b: ReadonlyArray<KeyPick> | null | undefined): boolean {
  return buildKeyOf(a) === buildKeyOf(b);
}

/**
 * The saved build that is exactly these picks, or null. An EMPTY build is
 * nobody's twin — two empty builds are not "the same choice", they are no
 * choice. `exceptId` leaves one build out (the one being overwritten).
 */
export function twinOf<B extends { id: string; picks: ReadonlyArray<KeyPick> }>(
  current: ReadonlyArray<KeyPick>,
  builds: ReadonlyArray<B>,
  exceptId?: string | null,
): B | null {
  const key = buildKeyOf(current);
  if (key === '') return null;
  return builds.find((b) => b.id !== exceptId && buildKeyOf(b.picks) === key) ?? null;
}

/* ── THE LOWER BAR ────────────────────────────────────────────────────────
 * The prototype's rule, in its order:
 *   the picks are exactly a saved build   → ✓ Saved
 *   a build is open and has been changed  → 💾 Save · ＋ Save as new
 *   otherwise                             → 💾 Save this build (off until a line is filled)
 * …plus 📅 Book this build whenever a pick is not booked yet. */
export type BuildBarKind = 'saved' | 'edited' | 'new';

export function buildBarOf(s: { twinId: string | null; openId: string | null; openIsEdited: boolean; filled: number; toBook: number }): {
  kind: BuildBarKind;
  canSave: boolean;
  book: boolean;
} {
  const kind: BuildBarKind = s.twinId ? 'saved' : s.openId && s.openIsEdited ? 'edited' : 'new';
  return { kind, canSave: s.filled > 0, book: s.toBook > 0 };
}

/** What pressing Save / Saved opens, before anything is written. */
export type SaveSheetKind = 'nothing_changed' | 'already_saved' | 'name';

export function saveSheetOf(s: { twinId: string | null; openId: string | null }): SaveSheetKind {
  if (s.twinId && s.twinId === s.openId) return 'nothing_changed';
  if (s.twinId) return 'already_saved';
  return 'name';
}

/* ── THE MONEY ────────────────────────────────────────────────────────────
 * ONE SUM: `teamMoney`, the function behind the segment's own total
 * (`buildTally`) — so "Build 3/5 · ₱1,227,000" above and the figures here
 * cannot disagree, and a missing price is COUNTED, never added as ₱0. */
const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

export function buildMoneyOf(children: ReadonlyArray<TallyChild>, lockedCentavos: number, budgetPhp: number | null): TeamMoney {
  let lockedUnpriced = 0;
  const candidateCostsPhp: Array<number | null> = [];
  for (const c of children) {
    const isLocked = (p: TallyChild['picks'][number]) => Boolean(p.raw_status && LOCKED.has(p.raw_status));
    lockedUnpriced += c.picks.filter((p) => isLocked(p) && p.rolled_cost_php == null).length;
    for (const vid of c.buildPickVendorIds) {
      const p = c.picks.find((x) => x.vendor_id === vid);
      if (p && !isLocked(p)) candidateCostsPhp.push(p.rolled_cost_php);
    }
  }
  return teamMoney({ lockedCentavos, lockedUnpricedCount: lockedUnpriced, candidateCostsPhp, budgetPhp });
}

/** "N of your people have no price" — the prototype's words under "Not knowable". */
export function noPriceNote(count: number): string {
  return `of your people ${count === 1 ? 'has' : 'have'} no price`;
}

/* ── THE FIT LINE ─────────────────────────────────────────────────────────
 * "✓ 2 of 2 priced picks are free on Dec 18". A supplier counts as free only
 * where the calendar was READ; one whose calendar is not shared is counted
 * apart and said — never called free, never called taken — and so is one who
 * never set a calendar ("· 1 not set", P5). */
export type BuildFit = { priced: number; free: number; taken: number; unread: number; notSet: number };

export function buildFitOf(
  lines: readonly BuildLine[],
  dateFit: ReadonlyMap<string, DateFit> | null,
): BuildFit {
  const priced = lines.map(lineSupplier).filter((s): s is BuildSupplier => s != null && s.pricePhp != null);
  const booked = new Set(lines.filter((l) => l.booked).map((l) => l.booked!.vendorId));
  let free = 0;
  let taken = 0;
  let unread = 0;
  let notSet = 0;
  for (const s of priced) {
    // A booked supplier holds the date — that is what the booking is.
    const fit = booked.has(s.vendorId) ? 'free' : dateFit?.get(s.vendorId);
    if (fit === 'free') free += 1;
    else if (fit === 'booked') taken += 1;
    // P5 calendar truth: a calendar the supplier never set is said — never counted free (`lib/calendar-truth.ts`).
    else if (fit === 'not_set') notSet += 1;
    else unread += 1;
  }
  return { priced: priced.length, free, taken, unread, notSet };
}

/* ── ALL BUILDS ───────────────────────────────────────────────────────────── */

export type BuildCardFree =
  | { kind: 'dates'; labels: string[]; more: number }
  | { kind: 'none'; who: string[] }
  | null;

export type BuildCard = {
  /** 'current' for this build, else the saved build's id. */
  id: string;
  name: string;
  /** The STORED title (null = auto-named) — what an overwrite writes back. */
  title: string | null;
  /** The budget the build was saved against. */
  savedBudgetPhp: number | null;
  /** The prices that exist, summed. */
  totalPhp: number;
  /** Suppliers in it with no recorded price. */
  unpriced: number;
  /** One per category on the event, in the lines' order. */
  rows: Array<{ label: string; supplier: string | null; inclusions: string[] }>;
  free: BuildCardFree;
  /** Budget − total; null while a price is missing or there is no budget. */
  bufferPhp: number | null;
  /** The picks a Use writes — never a booked category (`planPicksToApply`). */
  apply: Array<{ planGroupId: string; vendorId: string }>;
  picks: BuildSnapshotPick[];
};

/** The first word of a supplier's name — how the cards name them side by side. */
export function shortSupplierName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first || name.trim();
}

export function buildCardOf(args: {
  id: string;
  name: string;
  title?: string | null;
  savedBudgetPhp?: number | null;
  picks: ReadonlyArray<BuildSnapshotPick>;
  /** The categories on the event, in order: label + the plan group each is. */
  categories: ReadonlyArray<{ label: string; groupId: string | null }>;
  budgetPhp: number | null;
  free: BuildCardFree;
  lockedGroupIds: ReadonlySet<string>;
}): BuildCard {
  const picks = [...args.picks];
  const byGroup = new Map<string, BuildSnapshotPick>();
  for (const p of picks) if (!byGroup.has(p.groupId)) byGroup.set(p.groupId, p);
  const unpriced = picks.filter((p) => p.costPhp == null).length;
  const totalPhp = picks.reduce((sum, p) => sum + (p.costPhp ?? 0), 0);
  const seen = new Set<string>();
  const apply: BuildCard['apply'] = [];
  for (const p of picks) {
    if (!p.vendorId || args.lockedGroupIds.has(p.groupId)) continue;
    const key = `${p.groupId}::${p.vendorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    apply.push({ planGroupId: p.groupId, vendorId: p.vendorId });
  }
  return {
    id: args.id,
    name: args.name,
    title: args.title ?? null,
    savedBudgetPhp: args.savedBudgetPhp ?? null,
    totalPhp,
    unpriced,
    rows: args.categories.map((c) => {
      const p = c.groupId ? byGroup.get(c.groupId) : undefined;
      return { label: c.label, supplier: p ? shortSupplierName(p.vendorName) : null, inclusions: [...(p?.inclusions ?? [])] };
    }),
    free: args.free,
    bufferPhp: unpriced > 0 || args.budgetPhp == null ? null : args.budgetPhp - totalPhp,
    apply,
    picks,
  };
}

/* ── THE WHOLE BODY, AS ONE VALUE ─────────────────────────────────────────── */

export type BuildView = {
  lines: BuildLine[];
  counts: { filled: number; total: number; toBook: number };
  money: {
    bookedPhp: number;
    toBookPhp: number;
    budgetPhp: number | null;
    /** null = not knowable (a price is missing) or no budget set. */
    bufferPhp: number | null;
    /** Booked suppliers and picks with no recorded price. */
    unpriced: number;
  };
  fit: BuildFit;
  /** "Dec 18" when the couple has committed to a day; null otherwise. */
  dateLabel: string | null;
  /** What Save posts. */
  snapshot: BuildSnapshot;
  /** Categories that are booked — a Use never re-opens one. */
  lockedGroupIds: string[];
  /** This build first, then the saved ones in their shipped order. */
  cards: BuildCard[];
  /** False when the saved builds could not be read — then no "none yet". */
  buildsMeasured: boolean;
};

export function buildViewOf(args: {
  lines: BuildLine[];
  money: TeamMoney;
  dateFit: ReadonlyMap<string, DateFit> | null;
  dateLabel: string | null;
  saved: ReadonlyArray<{ id: string; name: string; title: string | null; budgetPhp: number | null; picks: ReadonlyArray<BuildSnapshotPick> }>;
  buildsMeasured: boolean;
  freeByBuildId: Readonly<Record<string, BuildCardFree>>;
}): BuildView {
  const { lines, money } = args;
  const snapshot = buildSnapshotOf(lines, money.budgetPhp);
  const lockedGroupIds = [...new Set(lines.filter((l) => l.booked?.groupId).map((l) => l.booked!.groupId!))];
  const locked = new Set(lockedGroupIds);
  // A line's own plan group: its supplier's, else its first candidate's.
  const categories = lines.map((l) => ({
    label: l.label,
    groupId: lineSupplier(l)?.groupId ?? l.candidates[0]?.groupId ?? null,
  }));
  const card = (b: { id: string; name: string; title: string | null; budgetPhp: number | null; picks: ReadonlyArray<BuildSnapshotPick> }) =>
    buildCardOf({
      id: b.id,
      name: b.name,
      title: b.title,
      savedBudgetPhp: b.budgetPhp,
      picks: b.picks,
      categories,
      budgetPhp: money.budgetPhp,
      free: args.freeByBuildId[b.id] ?? null,
      lockedGroupIds: locked,
    });
  const unpriced = money.lockedUnpriced + money.inBuildUnpriced;
  return {
    lines,
    counts: buildCounts(lines),
    money: {
      bookedPhp: money.lockedPhp,
      toBookPhp: money.inBuildPhp,
      budgetPhp: money.budgetPhp,
      bufferPhp: unpriced > 0 ? null : money.bufferPhp,
      unpriced,
    },
    fit: buildFitOf(lines, args.dateFit),
    dateLabel: args.dateLabel,
    snapshot,
    lockedGroupIds,
    cards: [
      card({ id: 'current', name: 'This build', title: null, budgetPhp: money.budgetPhp, picks: snapshot.picks }),
      ...args.saved.map(card),
    ],
    buildsMeasured: args.buildsMeasured,
  };
}
