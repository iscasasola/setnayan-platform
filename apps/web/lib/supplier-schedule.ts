/**
 * 🤝 THE SUPPLIER'S PART OF THE SCHEDULE — the pure half (owner 2026-11-01, DECISION_LOG "SUPPLIERS GIVE THEIR PART FROM
 * THEIR SCHEDULE VIEW"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3 "Suppliers write their own part", §3c;
 * migration 20271300619930).
 *
 * Owner, verbatim: *"so this is where suppliers can add their schedule and blow by blow as well? that is their part to
 * give to the event."* · *"yes correct. they still approve or decline"* (3 Oct).
 *
 * On a supplier's own Schedule view (Customer › Schedule):
 *   · their CHAPTERS — the ones whose `responsible_vendor_ids` hold one of their bookings (Where, #7156);
 *   · inside each, every moment: THEIR moments (tagged to them) open — they can ask to edit or delete one; everybody
 *     else's stay greyed and read-only (Suggest is the only door there, in words);
 *   · + My moment · My times (arrive and done per chapter) · Suggest — each a REQUEST the host or coordinator approves,
 *     shown as "Waiting for the host" with Take back — unless the host chose Auto-agree (ruled 1 Nov: it starts Off);
 *   · `Seen` when the schedule changed since they last looked, and a final-week `Confirm my times`.
 *
 * Nothing here reads or writes the database: the page reads, `lib/schedule-suggestion-decide.server.ts` applies.
 */

import type { TaskContact } from './task-contact';
import { chapterDayKey } from './supplier-where';
import { inRunOrder, isRightAfter, momentClockWords } from './moment-order';
import { TIMES_SUFFIX } from './schedule-hand-in-hand';
import { VENUE_TBA, clockWords, wallDay, wallIso, wallTime, shiftWall, momentSection, type ChapterSection } from './schedule-chapters';

/* ── Auto-agree ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** What a supplier's request did: it waits for the host, it went straight in, or it was words (Noted by hand). */
export type SettleOutcome = 'waits' | 'applied' | 'words';

/**
 * 🔒 AUTO-AGREE OFF MEANS THE CHANGE WAITS (ruled 1 Nov, DECISION_LOG "SCHEDULE PLAN §9" item 4). A supplier's request
 * is applied by the ONE accept path only when the event's setting reads ON. A setting that could not be read is OFF:
 * the request waits for a person, never the other way round. Held by `auto-agree-off-means-the-change-waits.test.ts`.
 */
export async function settleSupplierRequest(
  readAutoAgree: () => Promise<boolean | null>,
  apply: () => Promise<SettleOutcome>,
): Promise<SettleOutcome> {
  let on: boolean | null = null;
  try {
    on = await readAutoAgree();
  } catch {
    on = null;
  }
  if (on !== true) return 'waits';
  return apply();
}

/** The one line under a supplier's sheet saying where their change goes. */
export function whereItGoesWords(autoAgree: boolean): string {
  return autoAgree
    ? 'The host chose Auto-agree, so this goes straight in.'
    : 'The host or coordinator approves it.';
}

/** The host's choice, as their dropdown says it (Event Details › Event access). */
export const AUTO_AGREE_CHOICES = [
  { value: 'check', label: 'I check and approve / reject' },
  { value: 'auto', label: 'Auto-agree' },
] as const;

/* ── Seen and Confirm my times ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * The final week: the seven days up to and including the event day (plan §3 "a final-week Confirm my times"). The
 * database answers the same question in `supplier_mark_schedule`; this one only decides whether to DRAW the button.
 */
export function inFinalWeek(eventDay: string | null, today: string): boolean {
  if (!eventDay || !/^\d{4}-\d{2}-\d{2}$/.test(eventDay)) return false;
  const day = Date.parse(`${eventDay}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(day) || !Number.isFinite(now)) return false;
  const daysLeft = Math.round((day - now) / 86_400_000);
  return daysLeft >= 0 && daysLeft <= 7;
}

/**
 * Did anything on the supplier's part of the day change after they pressed Seen? `stamps` are the created/updated
 * times of their chapters and the moments in them. Never seen and there is a schedule = yes (it is all new to them).
 */
export function changedSinceSeen(stamps: ReadonlyArray<string | null | undefined>, seenAt: string | null): boolean {
  const seen = seenAt ? Date.parse(seenAt) : -Infinity;
  return stamps.some((s) => typeof s === 'string' && Date.parse(s) > seen);
}

/* ── Crew ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

export const CREW_MAX = 12;
export const CREW_NAME_MAX = 60;

/**
 * "Who on our side", typed as names separated by commas ("Team A, Second shooter") → the crew a request carries.
 * Trimmed, de-duplicated (case-insensitively), each cut to what a task's crew holds, at most twelve. Empty = no crew.
 */
export function crewFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, CREW_NAME_MAX).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length >= CREW_MAX) break;
  }
  return out;
}

/* ── The supplier's day ─────────────────────────────────────────────────────────────────────────────────────────── */

/** A block as the supplier's page reads it — never `notes` (couple-private, the 2026-06-12 lock). */
export type SupplierBlockRow = {
  block_id: string;
  parent_block_id: string | null;
  label: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  spot: string | null;
  time_tba: boolean;
  /** ⏭ On a moment: the one it comes right after (migration 20271302727358) — its `start_at` is then only an order key. */
  follows_block_id?: string | null;
  sort_order?: number | null;
  /** 🕑 How its clock is meant — "About 3:15 PM" · "2:15/2:30 PM" (migration 20271303051692). */
  time_shape?: string | null;
  time_or_minutes?: number | null;
  is_optional: boolean;
  responsible_vendor_ids: string[];
  created_at: string | null;
  updated_at: string | null;
  ingress_minutes_before?: number | null;
  egress_minutes_after?: number | null;
  /** 🏛 The venue booking that holds the chapter's hours (migration 20271307658341). */
  hours_vendor_id?: string | null;
};

/** One of this supplier's requests (`event_schedule_suggestions`, their org's own rows). */
export type SupplierRequestRow = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'new' | 'adjust' | 'remove' | string;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_parent_block_id: string | null;
  proposed_crew: string[] | null;
  note: string;
  status: 'open' | 'accepted' | 'declined' | 'withdrawn' | string;
  /** Went straight in under the host's Auto-agree (no person decided) — the Answered list says so. */
  auto_agreed?: boolean | null;
  created_at: string;
  /** 🏛 A venue's hours request: setup / pack-up in minutes. */
  proposed_ingress_minutes?: number | null;
  proposed_egress_minutes?: number | null;
  /** 📍 A Where request (kind 'where', migration 20271308641275): their booking and the chapters asked. */
  where_vendor_id?: string | null;
  proposed_block_ids?: string[] | null;
};

/** 📇 A task contact the supplier may read (RLS: only on moments they are on) — 4 additions (3). */
export type SupplierContactRow = { task_id: string; block_id: string; name: string; phone: string };

/** A task row as the supplier reads it — only the who and what of their own crews matter here. */
export type SupplierTaskRow = { block_id: string; vendor_id: string | null; crew: string | null };

export type SupplierMoment = {
  block_id: string;
  label: string;
  start_at: string | null;
  end_at: string | null;
  /**
   * The time the supplier reads: "6:30 AM", "Time TBA" in a Time-TBA chapter, or "Right after" for a moment with no
   * clock of its own — never a placeholder 12:00 AM, never its anchor's time.
   */
  clock: string;
  /** ⏭ No clock of its own — "right after the one above"; its `start_at` is only an order key, never shown. */
  rightAfter: boolean;
  minutes: number | null;
  section: ChapterSection;
  /** Tagged to one of this supplier's bookings: they may ask to edit or delete it. */
  mine: boolean;
  optional: boolean;
  /** Their crews on it (from the moment's tasks), in the order written. */
  crew: string[];
  /** 📇 Contacts on this moment's tasks (the bridal-car driver) — only on a moment they are on (the database decides). */
  contacts: TaskContact[];
  /** Their own request on it still waiting (an edit or a delete), if any. */
  waiting: SupplierRequestRow | null;
};

export type SupplierChapter = {
  block_id: string;
  label: string;
  start_at: string | null;
  end_at: string | null;
  time_tba: boolean;
  where: string;
  /** This supplier is linked to it (Where): + My moment and My times go here. */
  linked: boolean;
  moments: SupplierMoment[];
  /** Their waiting adds and times into this chapter. */
  waitingAdds: SupplierRequestRow[];
  /** 🏛 VENUE HOURS (2026-11-04): this supplier is the venue booked to the chapter, so it sets the chapter's hours. */
  setsHours: boolean;
  /** The hours are approved and held by this venue (the host asks it to change). */
  holdsHours: boolean;
  ingress_minutes_before: number | null;
  egress_minutes_after: number | null;
  /** Their hours, sent and waiting for the host. */
  hoursWaiting: SupplierRequestRow | null;
};

export type SupplierDay = {
  chapters: SupplierChapter[];
  /** Their waiting adds that name no chapter (the older call-time request), and words on anybody's moment. */
  otherWaiting: SupplierRequestRow[];
  /** Created/updated times of what is on their part of the day — the Seen check reads these. */
  stamps: string[];
};

function minutesOf(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = Math.round((Date.parse(b) - Date.parse(a)) / 60_000);
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * Every block of the event + this supplier's bookings, tasks and requests → their day. ONE pass, no read per chapter.
 * ⏰ A TIME-TBA CHAPTER IS KEPT (owner 2026-11-02, DECISION_LOG "TEN OWNER YESES" item 4: suppliers see it "Time TBA",
 * never hidden): its moments read "Time TBA" (`clock`) and it gives no call time. So `blocks` must be EVERY block — the
 * caller never fences TBA out of this read (`a-supplier-reader-never-drops-a-tba-chapter.test.ts`).
 * `myBookingIds` are their `event_vendors.vendor_id` rows on the event (a shop booked twice has two).
 */
export function buildSupplierDay(input: {
  blocks: readonly SupplierBlockRow[];
  myBookingIds: readonly string[];
  tasks: readonly SupplierTaskRow[];
  requests: readonly SupplierRequestRow[];
  /** 📇 Task contacts RLS let them read; absent = none read. */
  contacts?: readonly SupplierContactRow[];
  /** 🏛 Their bookings that are VENUES — a venue sets the hours of the chapters it is booked to. */
  venueBookingIds?: readonly string[];
}): SupplierDay {
  const venueIds = new Set(input.venueBookingIds ?? []);
  const contactsByBlock = new Map<string, TaskContact[]>();
  for (const c of input.contacts ?? []) contactsByBlock.set(c.block_id, [...(contactsByBlock.get(c.block_id) ?? []), { name: c.name, phone: c.phone }]);
  const mine = new Set(input.myBookingIds);
  const isMine = (b: SupplierBlockRow) => b.responsible_vendor_ids.some((id) => mine.has(id));
  const open = input.requests.filter((r) => r.status === 'open');

  const crewByBlock = new Map<string, string[]>();
  for (const t of input.tasks) {
    if (!t.vendor_id || !mine.has(t.vendor_id) || !t.crew) continue;
    const list = crewByBlock.get(t.block_id) ?? [];
    if (!list.includes(t.crew)) list.push(t.crew);
    crewByBlock.set(t.block_id, list);
  }

  // A Time-TBA chapter's 00:00 is only its day: it sorts after that day's timed chapters, never first as if at midnight.
  const dayKey = (b: SupplierBlockRow) => chapterDayKey({ startAt: b.start_at, timeTba: b.time_tba });
  const tops = input.blocks
    .filter((b) => !b.parent_block_id)
    .slice()
    .sort((a, b) => (dayKey(a) < dayKey(b) ? -1 : dayKey(a) > dayKey(b) ? 1 : 0));
  const chapterIds = new Set(tops.map((t) => t.block_id));
  const stamps: string[] = [];

  const chapters: SupplierChapter[] = tops.map((c) => {
    const linked = isMine(c);
    // ⏭ In the run's order: a moment "right after the one above" directly under it (lib/moment-order.ts).
    const kids = inRunOrder(input.blocks.filter((b) => b.parent_block_id === c.block_id));
    if (linked) {
      for (const s of [c.created_at, c.updated_at]) if (s) stamps.push(s);
    }
    const moments: SupplierMoment[] = kids.map((m) => {
      const own = isMine(m);
      if (linked || own) for (const s of [m.created_at, m.updated_at]) if (s) stamps.push(s);
      return {
        block_id: m.block_id,
        label: m.label,
        start_at: m.start_at,
        end_at: m.end_at,
        clock: momentClockWords(m, c, clockWords),
        rightAfter: isRightAfter(m),
        minutes: minutesOf(m.start_at, m.end_at),
        section:
          m.start_at && c.start_at
            ? momentSection(m.start_at, { start_at: c.start_at, end_at: c.end_at, time_tba: c.time_tba })
            : 'Event',
        mine: own,
        optional: m.is_optional,
        crew: crewByBlock.get(m.block_id) ?? [],
        contacts: contactsByBlock.get(m.block_id) ?? [],
        waiting: own ? (open.find((r) => r.block_id === m.block_id && r.kind !== 'new') ?? null) : null,
      };
    });
    return {
      block_id: c.block_id,
      label: c.label,
      start_at: c.start_at,
      end_at: c.end_at,
      time_tba: c.time_tba,
      where: [c.location, c.spot].filter(Boolean).join(' · ') || VENUE_TBA,
      linked,
      moments,
      waitingAdds: open.filter((r) => r.kind === 'new' && r.proposed_parent_block_id === c.block_id),
      setsHours: c.responsible_vendor_ids.some((id) => venueIds.has(id)),
      holdsHours: Boolean(c.hours_vendor_id && venueIds.has(c.hours_vendor_id)),
      ingress_minutes_before: c.ingress_minutes_before ?? null,
      egress_minutes_after: c.egress_minutes_after ?? null,
      hoursWaiting: open.find((r) => r.kind === 'hours' && r.block_id === c.block_id) ?? null,
    };
  });

  const ownMomentIds = new Set(
    input.blocks.filter((b) => b.parent_block_id && isMine(b)).map((b) => b.block_id),
  );
  const otherWaiting = open.filter(
    (r) =>
      (r.kind === 'new' && (!r.proposed_parent_block_id || !chapterIds.has(r.proposed_parent_block_id))) ||
      // 📍 A Where request is drawn on its own row (their Where), never as "A suggestion".
      (r.kind !== 'new' && r.kind !== 'hours' && r.kind !== 'where' && (!r.block_id || !ownMomentIds.has(r.block_id))),
  );

  return { chapters, otherWaiting, stamps };
}

/**
 * ⏰ The blocks that have a CLOCK — for the supplier's timeline, run of show and call time, never their Schedule view.
 * A Time-TBA chapter's 00:00 is only its day, and so is every moment inside it (the flag is the chapter's), so both go.
 */
export function blocksWithAClock<B extends { block_id: string; parent_block_id?: string | null; time_tba?: boolean | null }>(blocks: readonly B[]): B[] {
  const tba = new Set(blocks.filter((b) => !b.parent_block_id && b.time_tba === true).map((b) => b.block_id));
  return blocks.filter((b) => b.time_tba !== true && !(b.parent_block_id && tba.has(b.parent_block_id)));
}

/** The chapters + + My moment and My times may go into — only the ones they are linked to (plan §3). */
export function linkedChapters(day: SupplierDay): SupplierChapter[] {
  return day.chapters.filter((c) => c.linked);
}

/* ── Requests, built from what the sheets send ──────────────────────────────────────────────────────────────────── */

export const MOMENT_MINUTES_DEFAULT = 30;

/**
 * A moment's start from its chapter's day + a typed clock. A clock earlier than the chapter's start in the Egress
 * section is the next day, a clock later than its start in the Ingress section the day before (ingress and egress may
 * cross midnight, §3c #3); everything else is the chapter's day.
 */
export function momentStartIn(
  chapter: { start_at: string | null },
  hhmm: string,
  section: ChapterSection | null = null,
): string | null {
  const day = wallDay(chapter.start_at);
  const iso = wallIso(day, hhmm.trim());
  if (!iso) return null;
  if (section === 'Egress' && chapter.start_at && wallTime(iso) < wallTime(chapter.start_at)) return shiftWall(iso, 1440);
  // Ingress may begin the night before (ingress from 11 PM for a 6 AM preparation).
  if (section === 'Ingress' && chapter.start_at && wallTime(iso) > wallTime(chapter.start_at)) return shiftWall(iso, -1440);
  return iso;
}

/** Minutes typed → a whole number in 5…720, or the default. */
export function momentMinutes(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n)) return MOMENT_MINUTES_DEFAULT;
  return Math.min(720, Math.max(5, Math.round(n)));
}

/**
 * My times → the moments they ask for: "<shop> arrives" at their arrival, "<shop> is done" at their finish, each the
 * default length (the approved prototype's `timesGo`). Blank = that one is not asked. A finish clock earlier than the
 * arrival is the next day.
 */
export function timesRequests(input: {
  shop: string;
  chapter: { block_id: string; start_at: string | null };
  arrive: string;
  done: string;
}): Array<{ parent: string; label: string; start: string; end: string }> {
  const out: Array<{ parent: string; label: string; start: string; end: string }> = [];
  const shop = input.shop.trim() || 'Supplier';
  const a = input.arrive.trim() ? momentStartIn(input.chapter, input.arrive) : null;
  let d = input.done.trim() ? momentStartIn(input.chapter, input.done) : null;
  if (a) out.push({ parent: input.chapter.block_id, label: `${shop}${TIMES_SUFFIX.arrive}`.slice(0, 120), start: a, end: shiftWall(a, MOMENT_MINUTES_DEFAULT) });
  if (d && a && Date.parse(d) < Date.parse(a)) d = shiftWall(d, 1440);
  if (d) out.push({ parent: input.chapter.block_id, label: `${shop}${TIMES_SUFFIX.done}`.slice(0, 120), start: d, end: shiftWall(d, MOMENT_MINUTES_DEFAULT) });
  return out;
}

/** How a waiting request reads on the supplier's day. */
export function waitingWords(r: Pick<SupplierRequestRow, 'kind' | 'proposed_label'>, momentLabel: string | null): string {
  if (r.kind === 'where') return 'Your chapters';
  if (r.kind === 'remove') return `Delete “${momentLabel ?? r.proposed_label ?? 'a moment'}”`;
  if (r.kind === 'skip') return `Skip “${momentLabel ?? 'a part'}” today`;
  if (r.kind === 'adjust') return momentLabel ? `Change “${momentLabel}”` : 'A suggestion';
  return r.proposed_label ?? 'A new moment';
}
