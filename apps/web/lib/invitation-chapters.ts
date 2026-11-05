/**
 * ✉ GUESTS AND RSVP BY CHAPTER — the pure half (owner 2026-11-01, corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01 §3
 * "RSVP depends on chapters" · "TBA" · §9 item 7 · §11c · §12 Step 5).
 *
 *   · *"Rsvp will depend on what chapters we make."* Only chapters ON THE INVITATION (`event_schedule_blocks.on_invitation`
 *     on a top-level block) are replied to. Yes is one tap; "I can't make it" asks which.
 *   · *"If a chapter still doesnt have a venue, how can they send the rsvp? Sometime it can be tba"* — the reply still
 *     sends, as "Reception · Venue TBA". A blank venue is NEVER a reason to leave a chapter off.
 *   · Ruled 1 Nov (§9 #7): a chapter ADDED after invites went out = a notice + one Yes / Can't make it; a chapter
 *     REMOVED that people said yes to = hosts first see who said yes, then the guests are told.
 *   · §11c: the Event Hub's Details › Schedule lists the chapters this guest is invited to, with time and venue or
 *     "Venue TBA", and inside each ONLY moments marked Visible to guests.
 *
 * 🔑 ONE SOURCE OF TRUTH for "is this chapter on the invitation": `guestInvitedTo`. The reply card, the reply's write,
 * the notices, the hosts' counts and Details › Schedule all ask it (View as, #7160, carries a same-named helper — when
 * both land, that one should import this one).
 *
 * ⏰ Times are wall clocks in a UTC column (lib/schedule-datetime-local.ts): read the UTC parts, no zone maths. A Time-TBA
 * chapter's `start_at` is only its DAY at 00:00 — never drawn as a time (migration 20271300482585).
 *
 * Nothing here reads the database or knows a screen.
 */

import { formatBlockTimeRange, type ScheduleBlockRow } from './schedule';

/** A chapter as a guest may see it — names, a time, a place. Nothing else of the block crosses to a guest. */
export type InvitationChapter = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  /** Blank = "Venue TBA" — still on the invitation, still replied to. */
  location: string | null;
  spot: string | null;
  time_tba: boolean;
  sort_order: number;
};

/** The columns a guest-facing chapter read selects — and not one more (no notes, no suppliers, no photo rules). */
import { isBackstage } from './chapter-section';

export const INVITATION_CHAPTER_FIELDS = 'block_id, parent_block_id, label, start_at, end_at, location, spot, time_tba, on_invitation, sort_order';

/** The venue's words when none is set yet (owner: *"Sometime it can be tba"*). */
export const VENUE_TBA = 'Venue TBA';
export const TIME_TBA = 'Time TBA';

/**
 * 🔑 THE ONE RULE: a guest is invited to — and replies to — a top-level block with "On the invitation" on, unless the
 * hosts took THIS guest off it on their card (owner 2026-11-02, "Invited to"; `guest_chapter_not_invited`, migration
 * 20271302948959). `notInvited` is that guest's set; absent = the invitation as a whole (no guest in view, or a guest
 * with nothing taken off — "existing guests keep all").
 */
export function guestInvitedTo(
  row: { block_id?: string; on_invitation?: boolean | null; parent_block_id?: string | null },
  notInvited?: ReadonlySet<string> | null,
): boolean {
  if (row.on_invitation !== true || (row.parent_block_id ?? null) !== null) return false;
  return !(notInvited && row.block_id !== undefined && notInvited.has(row.block_id));
}

/** One guest's invitation: the event's chapters minus the ones the hosts took them off. Order kept. */
export function chaptersForGuest<C extends { block_id: string }>(chapters: readonly C[], notInvited: ReadonlySet<string> | null | undefined): C[] {
  return notInvited && notInvited.size > 0 ? chapters.filter((c) => !notInvited.has(c.block_id)) : [...chapters];
}

/**
 * 🏷 THE GUEST LIST ROW'S TAG for a partial invite (31 Oct parts model: "a partial invite shows a tag"). Null when the
 * guest is invited to every chapter (the usual case — nothing to say). Otherwise the shorter of the two true sentences:
 * "After party only" · "Ceremony and Reception only" — or, when more are kept than taken off, "Not at Ceremony".
 */
export function partialInviteTag(
  chapters: readonly Pick<InvitationChapter, 'block_id' | 'label'>[],
  notInvited: ReadonlySet<string> | null | undefined,
): string | null {
  if (!notInvited || notInvited.size === 0 || chapters.length === 0) return null;
  const kept = chapters.filter((c) => !notInvited.has(c.block_id));
  const off = chapters.filter((c) => notInvited.has(c.block_id));
  if (off.length === 0) return null;
  if (kept.length === 0) return 'Not invited to any part';
  return kept.length <= off.length
    ? `${joinChapterNames(kept.map((c) => c.label))} only`
    : `Not at ${joinChapterNames(off.map((c) => c.label))}`;
}

/**
 * 🪑 THE SEATED CHAPTER(S) — the seat plan is the reception's room. A chapter is seated when it is a reception or a
 * dinner (its kind) or is NAMED one ("Reception", "Dinner", "Banquet", "Salu-salo"), since the Schedule's chapters are
 * made with no kind. None found → nobody is taken out of seating (the seat plan stays exactly as it was).
 */
const SEATED_WORDS = /\b(reception|dinner|banquet|salu-?salo)\b/i;
export function seatedChapterIds(
  chapters: readonly { block_id: string; label: string; block_type?: string | null }[],
): Set<string> {
  return new Set(
    chapters.filter((c) => c.block_type === 'reception' || c.block_type === 'dinner' || SEATED_WORDS.test(c.label)).map((c) => c.block_id),
  );
}

/**
 * 🪑 Seats follow the invitation: a guest who is off EVERY seated chapter ("after party only") needs no seat — the seat
 * plan does not offer them, Auto arrange does not seat them, and their chair is given back when they are taken off.
 */
export function needsNoSeat(seated: ReadonlySet<string>, notInvited: ReadonlySet<string> | null | undefined): boolean {
  if (seated.size === 0 || !notInvited || notInvited.size === 0) return false;
  for (const id of seated) if (!notInvited.has(id)) return false;
  return true;
}

type ChapterRowIn = {
  block_id: string;
  parent_block_id?: string | null;
  label: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  spot?: string | null;
  time_tba?: boolean | null;
  on_invitation?: boolean | null;
  sort_order?: number | null;
};

/**
 * The invitation's chapters, in the day's order: timed chapters by their start, a Time-TBA chapter after the timed
 * ones of its day (its 00:00 is a placeholder, never "first"). A blank venue keeps its place — Venue TBA still sends.
 */
export function invitationChapters(rows: readonly ChapterRowIn[], notInvited?: ReadonlySet<string> | null): InvitationChapter[] {
  const day = (iso: string) => iso.slice(0, 10);
  return rows
    .filter((r) => guestInvitedTo(r, notInvited))
    .map((r) => ({
      block_id: r.block_id,
      label: r.label,
      start_at: r.start_at,
      end_at: r.time_tba === true ? null : (r.end_at ?? null),
      location: (r.location ?? '').trim() || null,
      spot: (r.spot ?? '').trim() || null,
      time_tba: r.time_tba === true,
      sort_order: r.sort_order ?? 0,
    }))
    .sort((a, b) => {
      const d = day(a.start_at).localeCompare(day(b.start_at));
      if (d !== 0) return d;
      if (a.time_tba !== b.time_tba) return a.time_tba ? 1 : -1;
      return a.start_at.localeCompare(b.start_at) || a.sort_order - b.sort_order;
    });
}

/** "Seda · Ballroom", or "Venue TBA". */
export function chapterWhere(c: Pick<InvitationChapter, 'location' | 'spot'>): string {
  if (!c.location) return VENUE_TBA;
  return c.spot ? `${c.location} · ${c.spot}` : c.location;
}

/** "3:00 PM – 4:30 PM", or "Time TBA" — never a guessed midnight. */
export function chapterWhen(c: Pick<InvitationChapter, 'start_at' | 'end_at' | 'time_tba'>): string {
  if (c.time_tba) return TIME_TBA;
  return formatBlockTimeRange(c.start_at, c.end_at) || TIME_TBA;
}

/** "Ceremony", "Ceremony and Reception", "Ceremony, Reception and After party". */
export function joinChapterNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/* ── the reply ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The form field each "can't make it" tick posts (one per chapter, its block id). */
export const CANT_CHAPTER_FIELD = 'cant_chapter';

export type ChapterReply = { block_id: string; attending: boolean };

/**
 * What a reply means, chapter by chapter. 🔑 ONLY the invitation's chapters get an answer: a posted id for any other
 * block (a private chapter, a moment, another event's block) is ignored — a guest is never asked, and never recorded,
 * about a chapter they were not invited to.
 *
 *   · "Yes" = every invitation chapter, one tap.
 *   · "I can't make it" with NO tick, or every chapter ticked = a plain no to all of them.
 *   · "I can't make it" with SOME ticked = no to those, yes to the rest — and the guest is coming, so the answer
 *     stored on the guest is `attending`.
 */
export function resolveChapterReply(
  posted: string,
  cantIds: readonly string[],
  chapters: readonly Pick<InvitationChapter, 'block_id'>[],
): { status: string; replies: ChapterReply[] } {
  if (chapters.length === 0 || (posted !== 'attending' && posted !== 'declined')) return { status: posted, replies: [] };
  if (posted === 'attending') return { status: posted, replies: chapters.map((c) => ({ block_id: c.block_id, attending: true })) };
  const invited = new Set(chapters.map((c) => c.block_id));
  const cant = new Set(cantIds.filter((id) => invited.has(id)));
  const partial = cant.size > 0 && cant.size < invited.size;
  return {
    status: partial ? 'attending' : 'declined',
    replies: chapters.map((c) => ({ block_id: c.block_id, attending: partial && !cant.has(c.block_id) })),
  };
}

/* ── after the invites went out (ruled 1 Nov, §9 #7) ───────────────────────────────────────────────────────────── */

/** A guest's stored answer for one chapter (`guest_chapter_replies`). */
export type StoredChapterReply = {
  block_id: string;
  attending: boolean;
  /** The chapter was taken off the invitation and the guest has seen the notice that says so. */
  removal_seen_at: string | null;
};

/** One chapter's line on a replied guest's card: their own answer, or "New" when it was added after they replied. */
export type ChapterAnswer = 'yes' | 'no' | 'new' | 'unanswered';

export function chapterAnswers(
  chapters: readonly InvitationChapter[],
  replies: readonly StoredChapterReply[] | null,
  rsvpStatus: string | null | undefined,
): Map<string, ChapterAnswer> {
  const out = new Map<string, ChapterAnswer>();
  const replied = rsvpStatus === 'attending' || rsvpStatus === 'declined';
  const byId = new Map((replies ?? []).map((r) => [r.block_id, r]));
  for (const c of chapters) {
    const r = byId.get(c.block_id);
    if (r) out.set(c.block_id, r.attending ? 'yes' : 'no');
    else if (!replied) out.set(c.block_id, 'unanswered');
    // 🔌 Only a reply read that SUCCEEDED may call a chapter "new" — a refused read keeps the guest's own answer.
    else if (replies === null) out.set(c.block_id, rsvpStatus === 'attending' ? 'yes' : 'no');
    // Replied, and no answer for this chapter on record: it joined the invitation after they replied. (A reply given
    // before ANY chapter was on the invitation is kept as rows by the database the moment the first one goes on —
    // `keep_replies_when_a_chapter_joins_the_invitation` — so this is never a guest who simply replied early.)
    else out.set(c.block_id, 'new');
  }
  return out;
}

/**
 * The notices a replied guest sees (ruled 1 Nov): a chapter ADDED after they replied asks one Yes / Can't make it; a
 * chapter they said yes to that is no longer on the invitation tells them so, once.
 */
export function chapterNotices(
  chapters: readonly InvitationChapter[],
  replies: readonly StoredChapterReply[] | null,
  rsvpStatus: string | null | undefined,
  removedLabels: ReadonlyMap<string, string>,
): { added: InvitationChapter[]; removed: { block_id: string; label: string }[] } {
  if (replies === null) return { added: [], removed: [] };
  const answers = chapterAnswers(chapters, replies, rsvpStatus);
  const added = chapters.filter((c) => answers.get(c.block_id) === 'new');
  const onInvite = new Set(chapters.map((c) => c.block_id));
  const removed = replies
    .filter((r) => r.attending && !r.removal_seen_at && !onInvite.has(r.block_id) && removedLabels.has(r.block_id))
    .map((r) => ({ block_id: r.block_id, label: removedLabels.get(r.block_id)! }));
  return { added, removed };
}

/* ── the hosts' side ───────────────────────────────────────────────────────────────────────────────────────────── */

/** How many said yes / can't make it to a chapter, and the first names who said yes (read before it comes off). */
export type ChapterCount = {
  yes: number;
  no: number;
  yesNames: string[];
  /** ✉ Guests the hosts took off this chapter on their card (owner 2026-11-02, "Invited to"). Absent = not read. */
  notInvited?: number;
};

/** "12 said yes · 3 can't make it" — or, for a count that could not be read, says so (never a false 0). */
export function chapterCountLine(count: ChapterCount | null | undefined): string {
  if (!count) return 'Replies could not be counted just now.';
  const line = `${count.yes} said yes · ${count.no} can’t make it`;
  return count.notInvited ? `${line} · ${count.notInvited} not invited` : line;
}

/* ── Details › Schedule (§11c) ─────────────────────────────────────────────────────────────────────────────────── */

/** A row the guests' Details › Schedule draws: a chapter heading, or a moment inside it. */
export type GuestScheduleRow = ScheduleBlockRow & { chapter_heading?: true; where_line?: string };

/**
 * 🔒 THE GUESTS' PROGRAMME, BY CHAPTER. Each invitation chapter (in the day's order, TBA times after), then inside it
 * ONLY its moments that are Visible to guests and for Everyone. A moment that is private, kept for one audience, staged
 * for the coordinator, or inside a chapter that is not on the invitation is never handed to the page — whatever list it
 * arrived in. Supplier times, crew calls and private moments never show (plan §11c).
 *
 * Returns null when no chapter is on the invitation: the part then draws the public moments exactly as before.
 */
export function guestScheduleByChapter(
  chapters: readonly InvitationChapter[],
  blocks: readonly ScheduleBlockRow[],
): GuestScheduleRow[] | null {
  if (chapters.length === 0) return null;
  const eventId = blocks[0]?.event_id ?? '';
  const visible = (b: ScheduleBlockRow) =>
    b.is_public === true &&
    (b.audience ?? null) === null &&
    (b as { visibility?: string | null }).visibility !== 'coordinator_only' &&
    b.time_tba !== true;
  const out: GuestScheduleRow[] = [];
  for (const c of chapters) {
    out.push({
      block_id: c.block_id,
      public_id: '',
      event_id: eventId,
      label: c.label,
      block_type: 'custom' as ScheduleBlockRow['block_type'],
      start_at: c.start_at,
      end_at: c.end_at,
      location: c.location,
      notes: null,
      is_public: true,
      sort_order: c.sort_order,
      parent_block_id: null,
      created_at: '',
      run_state: 'upcoming',
      actual_start_at: null,
      actual_end_at: null,
      audience: null,
      time_tba: c.time_tba,
      chapter_heading: true,
      where_line: chapterWhere(c),
    });
    const moments = blocks
      // 🎭 Backstage (Ingress · Egress) never reaches a guest — only the chapter's front-of-house moments.
      .filter((b) => b.parent_block_id === c.block_id && visible(b) && !isBackstage(b.start_at, c))
      .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.sort_order - b.sort_order);
    out.push(...moments);
  }
  return out;
}
