/**
 * supplier-where.ts — WHERE A SUPPLIER GOES: the chapters they work (owner 2026-11-01, DECISION_LOG "MANY VENUES PER
 * EVENT; SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md
 * §3 "Suppliers", §12 Step 4).
 *
 *   · An event may book MORE THAN ONE VENUE; each venue picks the chapters it hosts.
 *   · Every other supplier has Where = ONE OR MORE chapters. The venue follows the chapter; a TBA venue shows as TBA.
 *   · A supplier that comes WITH a venue (in-house cake, catering, stations — "· with Reception") starts on that
 *     venue's chapters; the host can change it.
 *   · COORDINATORS are on every chapter automatically and have no Where.
 *   · WHEN: best set on the quote (it changes the price) · allowed any time · required (at least 1) once booked · a
 *     change after booking tells the supplier in the app (no email) · the price never changes by itself.
 *
 * ── ONE FACT, ON THE CHAPTER ─────────────────────────────────────────────────────────────────────────────────────────
 * A chapter is a top-level `event_schedule_blocks` row; a supplier's Where is the chapters whose
 * `responsible_vendor_ids` hold their `event_vendors.vendor_id` — the column the Schedule's per-supplier lens and the
 * call time already read (migration 20271300598766). An in-house group's CHANGED chapters live in
 * `event_vendors.covered_where`; a group with no entry follows its venue, resolved here at read.
 * The one writer is `set_supplier_where`: it refuses the same three things `whereSaveVerdict` does (so the row answers in
 * place before it asks), and when a BOOKED supplier's set changes it writes their in-app notice in the same statement.
 *
 * Pure: no React, no I/O. Executed by `supplier-where.test.ts`.
 */
import { VENUE_TBA } from './schedule-chapters';

/** The plan groups that are on EVERY chapter and never get a Where (owner: *"Coordinators are all around."*). */
export const ON_EVERY_CHAPTER_GROUPS: ReadonlySet<string> = new Set(['coordinator']);
/** The same, by the booking's stored category (`event_vendors.category`) — what the database checks. */
export const ON_EVERY_CHAPTER_CATEGORY = 'planner_coordinator';
/** The plan groups whose booking IS a venue — a venue's chapters are the ones it hosts. */
export const VENUE_GROUPS: ReadonlySet<string> = new Set(['reception_venue', 'ceremony_venue']);
/** The same, by the booking's stored category (`event_vendors.category`). */
export const VENUE_CATEGORIES: ReadonlySet<string> = new Set(['venue', 'religious_venue']);
/** The booking statuses that are BOOKED — the database's own list in `set_supplier_where`. */
export const WHERE_BOOKED_STATUSES: ReadonlySet<string> = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

export function isOnEveryChapter(groupId: string | null | undefined, category?: string | null): boolean {
  return (groupId != null && ON_EVERY_CHAPTER_GROUPS.has(groupId)) || category === ON_EVERY_CHAPTER_CATEGORY;
}

/** One chapter, as Where reads it. `tags` = the `event_vendors.vendor_id`s on it (`responsible_vendor_ids`). */
export type WhereChapter = {
  blockId: string;
  name: string;
  /** The venue typed on the chapter (`location`); null = none typed. */
  location: string | null;
  startAt: string | null;
  tags: readonly string[];
  /** The chapter's `block_type` (a default chapter's kind — `pre_ceremony`, `ceremony`, `reception`, `after_party`); null = not read. */
  kind?: string | null;
  /** ⏰ Time TBA (migration 20271300482585): its stored 00:00 is only its DAY — it goes after that day's timed chapters. */
  timeTba?: boolean;
};

/** A block as read: only top-level rows (`parent_block_id` null) are chapters. */
export type WhereBlockRow = {
  block_id: string;
  parent_block_id?: string | null;
  label: string | null;
  start_at: string | null;
  location?: string | null;
  responsible_vendor_ids?: readonly string[] | null;
  block_type?: string | null;
  time_tba?: boolean | null;
};

/**
 * ⏰ THE DAY'S ORDER (owner 2026-11-04, answer 3 on #7260: "Time TBA goes last everywhere"): a Time-TBA chapter's 00:00
 * is only its day, so it sorts AFTER that day's timed chapters — the same key the supplier's day uses
 * (lib/supplier-schedule.ts `buildSupplierDay`). One rule for every Where dropdown, so the two never disagree.
 */
export function chapterDayKey(c: { startAt: string | null; timeTba?: boolean }): string {
  return c.timeTba ? `${(c.startAt ?? '').slice(0, 10)}~` : (c.startAt ?? '');
}

/** Every block of an event → its chapters, in time order. One read of the blocks feeds it. */
export function whereChaptersFrom(rows: readonly WhereBlockRow[]): WhereChapter[] {
  return rows
    .filter((r) => !r.parent_block_id)
    .map((r) => ({
      blockId: r.block_id,
      name: (r.label ?? '').trim() || 'Untitled chapter',
      location: typeof r.location === 'string' && r.location.trim() ? r.location.trim() : null,
      startAt: r.start_at ?? null,
      tags: r.responsible_vendor_ids ?? [],
      kind: r.block_type ?? null,
      timeTba: r.time_tba === true,
    }))
    .sort((a, b) => (chapterDayKey(a) < chapterDayKey(b) ? -1 : chapterDayKey(a) > chapterDayKey(b) ? 1 : 0));
}

/**
 * The venue a chapter is at: the venue TYPED on it, else a booked VENUE that picked it (a venue's Where is the chapters
 * it hosts), else "Venue TBA". `venues` = each booked venue's `vendor_id` → its name.
 */
export function chapterVenue(c: WhereChapter, venues: ReadonlyMap<string, string>): string {
  if (c.location) return c.location;
  for (const id of c.tags) {
    const name = venues.get(id);
    if (name) return name;
  }
  return VENUE_TBA;
}

/** One option of the Where dropdown: "Reception · Seda Vertis North" · "Ceremony · Venue TBA". */
export type WhereOption = { key: string; label: string };

export function whereOptions(chapters: readonly WhereChapter[], venues: ReadonlyMap<string, string>): WhereOption[] {
  return chapters.map((c) => ({ key: c.blockId, label: `${c.name} · ${chapterVenue(c, venues)}` }));
}

/** "Preparation, Reception" · "Preparation, Reception +2" — at most two names, then the count of the rest. */
export function whereNames(chapters: readonly WhereChapter[], picked: readonly string[]): string {
  const names = chapters.filter((c) => picked.includes(c.blockId)).map((c) => c.name);
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

/** The chapters a supplier is on — those whose tags hold them. Dangling ids never appear: only real chapters are read. */
export function pickedOf(chapters: readonly WhereChapter[], vendorId: string): string[] {
  return chapters.filter((c) => c.tags.includes(vendorId)).map((c) => c.blockId);
}

/** An in-house group under a supplier ("Catering" with Seda). `picked` follows the venue unless the host changed it. */
export type InHouseWhere = {
  /** The key `set_supplier_where` stores it under (`catering`, `tile:food_truck`). */
  key: string;
  label: string;
  picked: string[];
  /** No change of its own: it is on its venue's chapters (owner: "starts on that venue's chapters"). */
  followsVenue: boolean;
};

/** One covered group a booking also brings — its key and its label, as the page read them. */
export type CoveredGroup = { key: string; label: string };

/**
 * The key an in-house group is stored under: its plan group (`catering`), else its row's words (`label:food_truck`).
 * The database checks the same shape (`^[a-z0-9_:]{1,64}$`).
 */
export function coveredKeyOf(c: { label: string; groupId?: string | null }): string {
  if (c.groupId) return c.groupId;
  const slug = c.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 58);
  return `label:${slug || 'other'}`;
}

/**
 * An in-house group's chapters: the host's own pick (`covered_where[key]`, only ids that are still chapters), else the
 * venue's own chapters. A coordinator group is never listed (on every chapter).
 */
export function inHouseWhere(
  covered: readonly CoveredGroup[],
  coveredWhere: Readonly<Record<string, readonly string[]>> | null | undefined,
  hostPicked: readonly string[],
  chapters: readonly WhereChapter[],
): InHouseWhere[] {
  const real = new Set(chapters.map((c) => c.blockId));
  const seen = new Set<string>();
  return covered
    .filter((g) => !ON_EVERY_CHAPTER_GROUPS.has(g.key) && !seen.has(g.key) && Boolean(seen.add(g.key)))
    .map((g) => {
      const own = coveredWhere?.[g.key];
      if (Array.isArray(own)) return { key: g.key, label: g.label, picked: own.filter((id) => real.has(id)), followsVenue: false };
      return { key: g.key, label: g.label, picked: [...hostPicked], followsVenue: true };
    });
}

/**
 * WHAT A TEAM ROW SAYS ABOUT WHERE.
 *   everywhere   a coordinator — "Every chapter", no dropdown
 *   no_chapters  the event has no chapter yet — "Add a chapter in Schedule first"
 *   unread       the Schedule read was refused — said, never drawn as "needs a chapter"
 *   set          the dropdown; `needsOne` = booked with none (the row's warning)
 */
export type SupplierWhere =
  | { kind: 'everywhere' }
  | { kind: 'no_chapters' }
  | { kind: 'unread' }
  | {
      kind: 'set';
      picked: string[];
      names: string;
      needsOne: boolean;
      options: WhereOption[];
      inHouse: InHouseWhere[];
    };

export function supplierWhere(args: {
  vendorId: string;
  groupId: string | null;
  /** The booking's stored category, when the plan group is not known (the quote page). */
  category?: string | null;
  booked: boolean;
  /** `null` = the read was refused. */
  chapters: readonly WhereChapter[] | null;
  venues: ReadonlyMap<string, string>;
  covered?: readonly CoveredGroup[];
  coveredWhere?: Readonly<Record<string, readonly string[]>> | null;
}): SupplierWhere {
  if (isOnEveryChapter(args.groupId, args.category)) return { kind: 'everywhere' };
  if (args.chapters === null) return { kind: 'unread' };
  if (args.chapters.length === 0) return { kind: 'no_chapters' };
  const picked = pickedOf(args.chapters, args.vendorId);
  return {
    kind: 'set',
    picked,
    names: whereNames(args.chapters, picked),
    needsOne: args.booked && picked.length === 0,
    options: whereOptions(args.chapters, args.venues),
    inHouse: inHouseWhere(args.covered ?? [], args.coveredWhere, picked, args.chapters),
  };
}

/** 📖 The ask once a supplier is booked (owner 2026-11-04, prototype frame 5). */
export const WHERE_ASK_WORDS = {
  question: 'Which chapters will they serve?',
  info: 'Their call times, headcount and Event Hub follow these chapters. Each trade starts on its usual ones — change them here, or later on their row.',
} as const;

/** How many booked rows still need a chapter — the count line's "· 2 need a chapter". */
export function needWhereCount(wheres: readonly (SupplierWhere | null)[]): number {
  return wheres.filter((w) => w?.kind === 'set' && w.needsOne).length;
}

export const WHERE_WORDS = {
  everywhere: 'Every chapter',
  needsOne: 'Needs at least 1 chapter',
  noChapters: 'Add a chapter in Schedule first.',
  unread: 'We couldn’t check your Schedule for their chapters.',
  info: 'Pick at least 1 chapter. The venue follows the chapter. A TBA venue shows as TBA until you set it. Best set before their quote, since it changes the price.',
  everywhereInfo: 'Coordinators are on every chapter, so there is nothing to pick.',
  inHouseInfo: 'Comes with the venue, so it starts on the venue’s chapters. Change it if it only works some of them.',
  keepOne: 'Keep at least 1 chapter for a booked supplier.',
} as const;

/**
 * May this Where be saved? The same three refusals the database makes (`set_supplier_where`), so the row answers in
 * place: a coordinator has none · only this event's chapters · a BOOKED supplier keeps at least one while chapters
 * exist. Before booking it may be empty (Where is allowed any time).
 */
export type WhereVerdict = { ok: true; ids: string[] } | { ok: false; reason: 'everywhere' | 'not_a_chapter' | 'keep_one'; words: string };

export function whereSaveVerdict(args: {
  groupId: string | null;
  category?: string | null;
  booked: boolean;
  picked: readonly string[];
  chapterIds: readonly string[];
}): WhereVerdict {
  if (isOnEveryChapter(args.groupId, args.category)) return { ok: false, reason: 'everywhere', words: WHERE_WORDS.everywhereInfo };
  const ids = [...new Set(args.picked)];
  const real = new Set(args.chapterIds);
  if (ids.some((id) => !real.has(id))) return { ok: false, reason: 'not_a_chapter', words: 'That chapter is gone. Reload and pick again.' };
  if (args.booked && ids.length === 0 && real.size > 0) return { ok: false, reason: 'keep_one', words: WHERE_WORDS.keepOne };
  return { ok: true, ids };
}

/** What a save answers: the chapters now saved, and whether the supplier was told (a booked supplier, a change). */
export type SetWhereResult = { ok: true; picked: string[]; told: boolean } | { ok: false; message: string; locked?: boolean };

/**
 * The database's refusal (`set_supplier_where` raises a named reason) → the words the row says. Unknown → a plain
 * "didn't save". Never "saved".
 */
export function whereRefusalWords(message: string): string {
  // 🔒 The supplier locked their part: the database's own calm line — the row then offers "Send them a request".
  if (isLockedRefusal(message)) {
    const said = message.match(/[^.]*isn.t taking changes\.[^.]*\./)?.[0]?.trim();
    return said || 'They aren’t taking changes. Send them a request instead.';
  }
  if (message.includes('a_booked_supplier_needs_a_chapter')) return WHERE_WORDS.keepOne;
  if (message.includes('coordinators_are_everywhere')) return WHERE_WORDS.everywhereInfo;
  if (message.includes('not_a_chapter')) return 'That chapter is gone. Reload and pick again.';
  if (message.includes('supplier_not_found') || message.includes('not_saved')) return 'This account can’t change where this supplier goes.';
  return 'That didn’t save. Nothing changed — try again.';
}

/* ── 📍 THE SUPPLIER PICKS, AND THE HOST CAN ALSO PICK FOR THEM (owner 2026-11-04, migration 20271308641275) ────────
 * Owner, verbatim: *"They can pick and we can also pick for them."* A booked supplier's own pick is a REQUEST
 * (`event_schedule_suggestions`, kind 'where') the host OKs through the one accept path; the host's direct
 * `set_supplier_where` still applies at once — except for a supplier who locked their part, whose Where the host
 * changes only by asking (`host_ask_supplier_where`). The database refuses the same things as below; these only let
 * the screen answer in place first. */

/** The database's lock refusal (the part lock, 20271303409352): "<shop> isn't taking changes. Send them a request instead." */
export function isLockedRefusal(message: string): boolean {
  return /isn.t taking changes/.test(message) || message.includes('supplier_part_locked');
}

/** The refusal of a Where ASK or its apply (`whereask:<code>`) → the words the screen says. Never "sent". */
export function whereAskRefusalWords(message: string): string {
  if (message.includes('whereask:unchanged')) return 'Those are already the chapters. Pick a different set first.';
  if (message.includes('whereask:keep_one')) return 'Pick at least 1 chapter.';
  if (message.includes('whereask:not_a_chapter')) return 'A chapter in that pick is gone. Reload and pick again.';
  if (message.includes('whereask:no_chapters')) return 'The hosts haven’t made their chapters yet.';
  if (message.includes('whereask:everywhere')) return WHERE_WORDS.everywhereInfo;
  if (message.includes('whereask:gone')) return 'That was already answered.';
  if (message.includes('whereask:not_booked')) return 'That supplier is no longer booked on this event.';
  if (message.includes('whereask:no_shop')) return 'This supplier isn’t on Setnayan, so there is nobody to ask.';
  if (message.includes('whereask:not_yours') || message.includes('whereask:not_allowed')) return 'This account can’t do that.';
  return 'That didn’t send. Nothing changed — try again.';
}

/** May this pick be SENT as a request? What the database refuses, plus "nothing would change". */
export type WhereAskVerdict = { ok: true; ids: string[] } | { ok: false; reason: 'keep_one' | 'unchanged' | 'not_a_chapter'; words: string };

export function whereAskVerdict(args: { picked: readonly string[]; current: readonly string[]; chapterIds: readonly string[] }): WhereAskVerdict {
  const real = new Set(args.chapterIds);
  const ids = args.chapterIds.filter((id) => args.picked.includes(id));
  if (args.picked.some((id) => !real.has(id))) return { ok: false, reason: 'not_a_chapter', words: whereAskRefusalWords('whereask:not_a_chapter') };
  if (ids.length === 0) return { ok: false, reason: 'keep_one', words: whereAskRefusalWords('whereask:keep_one') };
  const now = new Set(args.current);
  if (ids.length === now.size && ids.every((id) => now.has(id))) {
    return { ok: false, reason: 'unchanged', words: whereAskRefusalWords('whereask:unchanged') };
  }
  return { ok: true, ids };
}

/** 📖 The supplier's own Where, on their Schedule. Details sit in the ⓘ. */
export const SUPPLIER_WHERE_WORDS = {
  name: 'Where',
  info: 'The chapters you serve. Your call times and your view of the day follow them. Your pick goes to the host to OK, unless they chose Auto-agree. You can take it back while it waits.',
  lockedInfo: 'Your times are locked, so the host asks you before changing your chapters.',
  none: 'Pick a chapter',
  fromTrade: 'Started from your trade’s usual chapters. Send it when it’s right.',
  waiting: (names: string) => `Asked: ${names} · Waiting for the host`,
  sent: 'Sent. The host or coordinator OKs it.',
  saved: 'Saved. You’re on those chapters.',
} as const;

/** One of the supplier's own bookings, as their Schedule reads it. */
export type OwnBooking = { vendorId: string; category: string | null; status: string | null; label: string | null };

/** A Where request read back (`event_schedule_suggestions`, kind 'where'). */
export type WhereRequestRow = {
  suggestion_id: string;
  kind: string;
  status: string;
  direction?: string | null;
  where_vendor_id?: string | null;
  proposed_block_ids?: readonly string[] | null;
};

/** The supplier's own Where row: what they are on, what they asked, what the dropdown starts on. */
export type SupplierOwnWhere = {
  vendorId: string;
  /** Shown only when the shop is booked more than once on the event. */
  label: string | null;
  options: WhereOption[];
  /** The chapters they are on now. */
  picked: string[];
  /** Their request still waiting for the host, if any. */
  waiting: { suggestionId: string; ids: string[]; names: string } | null;
  /** What the dropdown starts on: the waiting pick, else what they are on, else their trade's usual chapters. */
  draft: string[];
  /** The draft came from the trade's usual chapters (`service_categories.default_chapters`). */
  fromTrade: boolean;
};

/**
 * Each BOOKED booking of this shop that has a Where (never a coordinator) → its row. `tradeDefault` = that booking's
 * trade's usual chapters on this event (lib/trade-chapters.ts `suggestedChapters`), only a prefill — nothing is sent
 * until they press Send.
 */
export function supplierOwnWhere(args: {
  bookings: readonly OwnBooking[];
  chapters: readonly WhereChapter[];
  requests: readonly WhereRequestRow[];
  tradeDefault?: (category: string | null) => string[];
}): SupplierOwnWhere[] {
  const real = new Set(args.chapters.map((c) => c.blockId));
  const options = whereOptions(args.chapters, new Map());
  const eligible = args.bookings.filter(
    (b) => WHERE_BOOKED_STATUSES.has(b.status ?? '') && b.category !== ON_EVERY_CHAPTER_CATEGORY,
  );
  return eligible.map((b) => {
    const picked = pickedOf(args.chapters, b.vendorId);
    const open = args.requests.find(
      (r) => r.kind === 'where' && r.status === 'open' && (r.direction ?? 'to_host') === 'to_host' && r.where_vendor_id === b.vendorId,
    );
    const askedIds = open ? (open.proposed_block_ids ?? []).filter((id) => real.has(id)) : [];
    const waiting = open ? { suggestionId: open.suggestion_id, ids: askedIds, names: whereNames(args.chapters, askedIds) } : null;
    const trade = picked.length === 0 && !waiting ? (args.tradeDefault?.(b.category) ?? []).filter((id) => real.has(id)) : [];
    return {
      vendorId: b.vendorId,
      label: eligible.length > 1 ? b.label : null,
      options,
      picked,
      waiting,
      draft: waiting ? waiting.ids : picked.length > 0 ? picked : trade,
      fromTrade: trade.length > 0,
    };
  });
}

/**
 * 📍 THE ADMIN EVENT PAGE'S WHERE LINE (Admin › Events › one event › Suppliers' schedule) — read-only, admin words:
 * "Where: Preparation, Reception" · "Where: no chapter yet" · "· asked Ceremony, waiting for the host" · "· the host
 * asked Reception, waiting for the supplier". `chapters` null = the read was refused (said, never "no chapter").
 */
export function adminWhereLine(args: {
  vendorId: string;
  category?: string | null;
  chapters: readonly WhereChapter[] | null;
  openAsks: readonly WhereRequestRow[] | null;
}): string {
  if (isOnEveryChapter(null, args.category)) return `Where: ${WHERE_WORDS.everywhere.toLowerCase()}`;
  if (args.chapters === null) return 'Where: could not be read';
  const all = (ids: readonly string[]) => args.chapters!.filter((c) => ids.includes(c.blockId)).map((c) => c.name).join(', ');
  const now = all(pickedOf(args.chapters, args.vendorId));
  const parts = [`Where: ${now || 'no chapter yet'}`];
  if (args.openAsks === null) parts.push('requests could not be read');
  for (const r of args.openAsks ?? []) {
    if (r.kind !== 'where' || r.status !== 'open' || r.where_vendor_id !== args.vendorId) continue;
    const asked = all(r.proposed_block_ids ?? []) || 'a chapter that is gone';
    parts.push(r.direction === 'to_supplier' ? `the host asked ${asked}, waiting for the supplier` : `asked ${asked}, waiting for the host`);
  }
  return parts.join(' · ');
}

/* ── 📍 OK ON THE NOTICE (owner 2026-11-04, answer 2 on #7260): the same OK as the Requests sheet, where you are ────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The host's Where notice opens the Requests sheet AND names its request, so the notice can answer it in place. */
export function whereNoticeUrl(eventId: string, suggestionId: string): string {
  return `/dashboard/${eventId}/schedule?sheet=requests&request=${suggestionId}`;
}

/**
 * The request a notice can OK in place: only a `supplier_where_asked` notice whose link names a real event and a real
 * request (both uuids). Anything else → null, and the row stays a plain row.
 */
export function whereNoticeTarget(type: string, relatedUrl: string | null | undefined): { eventId: string; suggestionId: string } | null {
  if (type !== 'supplier_where_asked' || !relatedUrl) return null;
  const m = relatedUrl.match(/^\/dashboard\/([^/?#]+)\/schedule\?(.*)$/);
  if (!m) return null;
  const eventId = m[1]!;
  const suggestionId = new URLSearchParams(m[2]).get('request') ?? '';
  return UUID_RE.test(eventId) && UUID_RE.test(suggestionId) ? { eventId, suggestionId } : null;
}
