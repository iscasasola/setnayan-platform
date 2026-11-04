/**
 * 📅 YOUR SCHEDULE — Event Hub › Me's schedule card, as facts (owner 2026-11-01; corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3 "Call time" · "Basic, then full (Release)", §3b, §11b; samples
 * `prototypes/schedule_chapters_2026-11-01/shots/me-*.jpg`).
 *
 * Owner, verbatim: *"It starts with just the basic schedule. But 1 week before the event, we will show their full
 * schedule."* · *"Coordinator or host presses release"* · *"Call time can be set from 0-60 minutes before their first
 * task."* · *"Starts with an estimated time per role unless they get a schedule?"*
 *
 *   BEFORE RELEASE (and on Free, for good — §3b)
 *     · the chapters this guest is invited to (`on_invitation` — every guest replies to it), each with its place and
 *       time and NO lines: there is no full schedule yet;
 *     · a ROLE HOLDER (a guest the schedule names — a task for them, their role or one of their groups) sees an
 *       ESTIMATED call time: the start of the first chapter they are on, less its call lead, always labelled Estimated;
 *     · a plain guest sees the invitation's own Arrive by (`guestsArriveTime`), as everywhere else.
 *   AFTER RELEASE (Pro only)
 *     · their own full schedule: the invited chapters and every chapter they are on, each with the moments every guest
 *       may see there AND their own lines — never anybody else's;
 *     · a role holder's EXACT call time: their first task, less that chapter's call lead (0–60, default 60).
 *   TIME TBA — a chapter with no time reads "Time TBA", its stored 00:00 is never drawn, and it gives no call time.
 *
 * 🔒 WHOSE LINES: a task is this guest's only when it names THIS guest, a role THIS guest holds, or a group THIS guest
 * is in (`isMine`). The server read may hand in more (it asks for every role task at once); this is where they are
 * dropped. Held by `app/[slug]/_lib/your-schedule-is-only-yours.test.ts`.
 *
 * Pure: no I/O, no React, no clock. The read is `app/[slug]/_lib/your-schedule.server.ts`; the card `app/[slug]/_components/your-schedule-card.tsx`.
 */
import type { TaskContact } from './task-contact';
import {
  TIME_TBA,
  chapterWhere,
  chapterWhen,
  clockWords,
  shiftWall,
  taskPlace,
  type Chapter,
  type MomentLike,
  type TaskRow,
  isBackstage,
} from './schedule-chapters';
import { isOnTheGuestsSchedule } from './schedule-audience';
import { momentClockWords, runRank } from './moment-order';
import { guestInvitedTo } from './schedule-view-as';

/** A moment (a chapter's child block) as the card reads it. */
export type YourMoment = {
  block_id: string;
  parent_block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  spot?: string | null;
  is_public: boolean;
  audience: string | null;
  /** A coordinator's unreleased prep — never drawn to a guest, not even their own line in it. */
  staged: boolean;
  travel_from?: string | null;
  travel_to?: string | null;
  /** ⏭ No clock of its own — "right after the one above" (migration 20271302727358); `start_at` is only its order key. */
  time_tba?: boolean;
  follows_block_id?: string | null;
  sort_order?: number;
  /** 🕑 How its clock is meant — "About 3:15 PM" · "2:15/2:30 PM" (migration 20271303051692). */
  time_shape?: string | null;
  time_or_minutes?: number | null;
};

/** Who is looking: their seat, the roles they hold, the groups they are in. */
export type YourScheduleViewer = {
  guestId: string;
  /** `guests.role` and `guests.extra_roles` — the role words a task may name. */
  roles: readonly string[];
  groupIds: readonly string[];
  /**
   * ✉ The chapters the hosts took THIS guest off on their card (owner 2026-11-02, "Invited to"; `guest_chapter_not_invited`).
   * Absent or empty = invited to every chapter on the invitation ("existing guests keep all").
   */
  notInvited?: readonly string[];
};

export type YourScheduleInput = {
  /** Every chapter of the event (`chaptersFromBlocks`). */
  chapters: readonly Chapter[];
  /** Every moment the read handed in — those every guest may see, and those holding this guest's own lines. */
  moments: readonly YourMoment[];
  /** Tasks that MAY be this guest's (the read asks broadly; `isMine` decides). */
  tasks: readonly TaskRow[];
  viewer: YourScheduleViewer;
  /** Released AND the event holds Pro. On Free this is false, always (§3b). */
  released: boolean;
  /** The event holds Pro — only to say whether a full schedule is still to come. */
  pro: boolean;
  /** A plain guest's Arrive by — the invitation's own (`guestsArriveTime`), "4:45 PM"; null when none is set. */
  guestsArriveBy: string | null;
  /**
   * 📇 Task contacts on the event (4 additions (3)) — shown ONLY on the lines of moments this guest has a task on (they
   * are that moment's crew); never on an everyone line, never in the shared text.
   */
  contacts?: readonly { block_id: string; name: string; phone: string }[];
};

export type YourLine = {
  id: string;
  time: string;
  title: string;
  sub: string | null;
  mine: boolean;
  /** 📇 How to reach someone on this moment (the bridal-car driver) — only on their own moments. */
  contacts?: TaskContact[];
};
export type YourChapter = { id: string; name: string; line: string; lines: YourLine[] };
export type YourCall = {
  /** "Your call time" · "Estimated call time" · "Arrive by". */
  label: string;
  /** "7:00 AM", or "Time TBA". */
  time: string;
  /** "Seda Vertis North, Floor 12 · 1 hour before your first task". */
  note: string | null;
};

export type YourSchedule =
  | { kind: 'none' }
  | {
      kind: 'ok';
      stage: 'before' | 'after';
      call: YourCall | null;
      chapters: YourChapter[];
      /** Under the chapters before Release, on Pro only: "Your full schedule comes closer to the event." */
      footnote: string | null;
    };

export const YOUR_SCHEDULE_WORDS = {
  title: 'Your schedule',
  callExact: 'Your call time',
  callEstimated: 'Estimated call time',
  arriveBy: 'Arrive by',
  estimatedNote: 'your exact time comes with your full schedule',
  comesLater: 'Your full schedule comes closer to the event.',
  unread: 'We couldn’t load your schedule right now. Open Me again in a moment.',
  share: 'Print or share',
} as const;

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** 🔒 Is this task THIS guest's — their seat, a role they hold, a group they are in? Nothing else is. */
export function isMine(t: Pick<TaskRow, 'guest_id' | 'role' | 'group_id' | 'vendor_id' | 'who_label'>, v: YourScheduleViewer): boolean {
  if (t.guest_id) return t.guest_id === v.guestId;
  if (t.group_id) return v.groupIds.includes(t.group_id);
  if (t.role && norm(t.role)) return v.roles.some((r) => norm(r) === norm(t.role));
  return false;
}

/**
 * 🔒 Is this chapter on a guest's invitation? ONE rule, shared with the hosts' View as ▾ › A guest
 * (`guestInvitedTo`, lib/schedule-view-as.ts) — so what a host previews and what a guest is shown cannot disagree.
 * The per-guest narrowing (owner 2026-11-02, "Invited to") is THAT rule's second argument — handed in, never re-decided.
 */
export const invitedTo = guestInvitedTo;

/** "1 hour before your first task" · "30 minutes before your first task" · "at your first task". */
export function leadWords(minutes: number): string {
  if (minutes <= 0) return 'at your first task';
  if (minutes === 60) return '1 hour before your first task';
  return `${minutes} minutes before your first task`;
}

const byStart = <T extends { start_at: string }>(a: T, b: T) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0);

function momentLike(m: YourMoment): MomentLike {
  return { block_id: m.block_id, start_at: m.start_at, end_at: m.end_at, location: m.location, spot: m.spot ?? null, travel_from: m.travel_from ?? null, travel_to: m.travel_to ?? null };
}

/** "San Vicente Parish · 1:30 PM – 3:30 PM" · "Venue TBA · Time TBA". */
function chapterLineOf(c: Chapter): string {
  return `${chapterWhere(c)} · ${chapterWhen(c)}`;
}

export function yourSchedule(i: YourScheduleInput): YourSchedule {
  const chapters = [...i.chapters].sort(byStart);
  const chapterById = new Map(chapters.map((c) => [c.block_id, c]));
  const momentById = new Map(i.moments.map((m) => [m.block_id, m]));

  // My tasks, each with the chapter and moment it sits in. A task on a staged moment is never drawn.
  type Mine = { task: TaskRow; chapter: Chapter; moment: YourMoment | null };
  const mine: Mine[] = [];
  for (const t of i.tasks) {
    if (!isMine(t, i.viewer)) continue;
    const m = momentById.get(t.block_id) ?? null;
    if (m?.staged) continue;
    const c = m ? chapterById.get(m.parent_block_id) : chapterById.get(t.block_id);
    if (!c) continue;
    mine.push({ task: t, chapter: c, moment: m });
  }
  const myChapterIds = new Set(mine.map((x) => x.chapter.block_id));
  const roleHolder = mine.length > 0;
  const notInvited = new Set(i.viewer.notInvited ?? []);
  const invited = chapters.filter((c) => invitedTo(c, notInvited));

  const stage: 'before' | 'after' = i.released ? 'after' : 'before';
  const shown = stage === 'after' ? chapters.filter((c) => invitedTo(c, notInvited) || myChapterIds.has(c.block_id)) : invited;
  if (shown.length === 0) return { kind: 'none' };

  /* ── the call time ─────────────────────────────────────────────────────────────────────────────────────────── */
  let call: YourCall | null = null;
  if (roleHolder && stage === 'after') {
    const timed = mine
      .filter((x) => !x.chapter.time_tba)
      .map((x) => ({ ...x, at: x.task.call_at ?? x.moment?.start_at ?? x.chapter.start_at }))
      .filter((x) => Boolean(x.at))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))[0];
    if (timed) {
      const lead = timed.chapter.call_lead_minutes;
      const place = timed.moment ? taskPlace(timed.task, momentLike(timed.moment), timed.chapter) : timed.task.place?.trim() || null;
      call = {
        label: YOUR_SCHEDULE_WORDS.callExact,
        time: clockWords(shiftWall(timed.at, -lead)),
        note: `${place ?? chapterWhere(timed.chapter)} · ${leadWords(lead)}`,
      };
    } else {
      call = { label: YOUR_SCHEDULE_WORDS.callExact, time: TIME_TBA, note: null };
    }
  } else if (roleHolder) {
    // Estimated (plan §3): the start of the first chapter they are on counts as their first task.
    const first = chapters.filter((c) => myChapterIds.has(c.block_id) && !c.time_tba)[0];
    call = first
      ? {
          label: YOUR_SCHEDULE_WORDS.callEstimated,
          time: clockWords(shiftWall(first.start_at, -first.call_lead_minutes)),
          note: `${chapterWhere(first)} · ${i.pro ? YOUR_SCHEDULE_WORDS.estimatedNote : leadWords(first.call_lead_minutes)}`,
        }
      : { label: YOUR_SCHEDULE_WORDS.callEstimated, time: TIME_TBA, note: null };
  } else if (i.guestsArriveBy) {
    // The invitation's own arrival time — with no place: which chapter it belongs to is not recorded, and a guessed
    // venue beside it would send someone to the wrong door.
    call = { label: YOUR_SCHEDULE_WORDS.arriveBy, time: i.guestsArriveBy, note: null };
  }

  /* ── the chapters, and (after Release) their lines ─────────────────────────────────────────────────────────── */
  const out: YourChapter[] = shown.map((c) => {
    if (stage === 'before') return { id: c.block_id, name: c.label, line: chapterLineOf(c), lines: [] };
    const lines = new Map<string, YourLine & { at: string; rank: number }>();
    // ⏭ The run's own order — a moment "right after the one above" sits under its anchor (same order key).
    const rank = runRank(i.moments.filter((m) => m.parent_block_id === c.block_id));
    const rankOf = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
    // A moment's clock in words: "Time TBA" in a TBA chapter, "Right after" for an untimed moment.
    // 🕑 …and "About 3:15 PM" / "2:15/2:30 PM" as the coordinator wrote it (lib/time-shape.ts).
    const timeOf = (m: YourMoment | null, at: string, own: boolean) =>
      c.time_tba ? TIME_TBA : m && !own ? momentClockWords(m, null, clockWords) : clockWords(at);
    // Every guest's moments here: shown to guests, for Everyone, not staged — the database's own three questions.
    for (const m of i.moments) {
      if (m.parent_block_id !== c.block_id) continue;
      if (!isOnTheGuestsSchedule({ is_public: m.is_public, audience: m.audience, visibility: m.staged ? 'coordinator_only' : null })) continue;
      // 🎭 Backstage (the chapter's Ingress · Egress) is never on a guest's schedule — only front-of-house moments.
      if (isBackstage(m.start_at, c)) continue;
      lines.set(m.block_id, { id: m.block_id, at: m.start_at, rank: rankOf(m.block_id), time: timeOf(m, m.start_at, false), title: m.label, sub: null, mine: false });
    }
    // 📇 The contacts on a moment this guest is ON (4 additions (3)) — they are that moment's crew.
    const contactsOn = (blockId: string): TaskContact[] =>
      (i.contacts ?? []).filter((k) => k.block_id === blockId).map((k) => ({ name: k.name, phone: k.phone }));
    // Mine: on their moment's line (what they do there under it), at their own time when they have one.
    for (const x of mine) {
      if (x.chapter.block_id !== c.block_id) continue;
      const key = x.moment?.block_id ?? `task:${x.task.task_id}`;
      const at = x.task.call_at ?? x.moment?.start_at ?? c.start_at;
      // A task's own call time is a real clock; otherwise an untimed moment's start is only its order key.
      const own = Boolean(x.task.call_at);
      const had = lines.get(key);
      const title = x.moment?.label ?? x.task.what;
      const sub = x.moment ? x.task.what : null;
      if (had) {
        const subs = [had.sub, sub].filter((s): s is string => Boolean(s && s !== had.title));
        const earlier = at < had.at;
        lines.set(key, { ...had, ...(x.moment ? { contacts: contactsOn(x.moment.block_id) } : {}), at: earlier ? at : had.at, time: earlier ? timeOf(x.moment, at, own) : had.time, sub: subs.length ? [...new Set(subs)].join(' · ') : null, mine: true });
      } else {
        lines.set(key, { id: key, ...(x.moment ? { contacts: contactsOn(x.moment.block_id) } : {}), at, rank: x.moment ? rankOf(x.moment.block_id) : Number.MAX_SAFE_INTEGER, time: timeOf(x.moment, at, own), title, sub: sub && sub !== title ? sub : null, mine: true });
      }
    }
    const sorted = [...lines.values()]
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.rank - b.rank))
      .map(({ at: _at, rank: _rank, ...l }) => l);
    return { id: c.block_id, name: c.label, line: chapterLineOf(c), lines: sorted };
  });

  return {
    kind: 'ok',
    stage,
    call,
    chapters: out,
    footnote: stage === 'before' && i.pro ? YOUR_SCHEDULE_WORDS.comesLater : null,
  };
}

/** The card as plain text — what "Print or share" hands the phone's share sheet. */
export function yourScheduleText(s: Extract<YourSchedule, { kind: 'ok' }>, eventName: string): string {
  const out: string[] = [`${YOUR_SCHEDULE_WORDS.title} · ${eventName}`];
  if (s.call) out.push(`${s.call.label}: ${s.call.time}${s.call.note ? ` (${s.call.note})` : ''}`);
  for (const c of s.chapters) {
    out.push('', c.name, c.line);
    for (const l of c.lines) out.push(`${l.time}  ${l.title}${l.sub ? ` — ${l.sub}` : ''}`);
  }
  if (s.footnote) out.push('', s.footnote);
  return out.join('\n');
}
