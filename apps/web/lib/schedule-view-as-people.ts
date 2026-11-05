/**
 * 👤📋 VIEW AS — A NAMED GUEST, THE COORDINATOR, AND ONE PERSON'S DAY AS A FILE (event chapters slice 6, owner
 * 2026-11-04). Pure; the lens itself (keys, menu, words) is `lib/schedule-view-as.ts`.
 *
 * Owner's rulings, 4 Nov:
 *   · A NAMED GUEST — "What they see now": EXACTLY their Event Hub › Me card today (`yourSchedule`, the one rule the
 *     guest's card is drawn by): before Release only the chapters they are invited to and their call; after Release
 *     their own lines. Never a preview of a day they cannot see yet.
 *   · THE COORDINATOR — "Everything + their tasks": every chapter and every moment the host reads (backstage
 *     included — they run the set-up), with the coordinator's own tasks marked and their call time. A coordinator's
 *     STAGED prep is not here: it is hidden from the couple until released, and View as only narrows what the host
 *     already reads — it never shows more.
 *   · THE PDF — "Any View as person, Pro": the day on the screen, as one printable shape (`PrintDay`), drawn by the
 *     schedule's own PDF engine (`lib/schedule-pdf.ts` → `lib/share-pdf.ts`).
 * A crew member's day is the shipped supplier · crew view (owner: "Yes, that plus its PDF").
 */
import { yourSchedule, type YourMoment, type YourSchedule } from './guest-your-schedule';
import { TIME_TBA, chapterWhere, clockWords, taskPlace, type Chapter, type MomentLike } from './schedule-chapters';
import { RIGHT_AFTER } from './moment-order';
import { supplierDay, type ViewAsData, type ViewDay, type ViewMoment } from './schedule-view-as';

const byStartAt = <T extends { start_at: string }>(a: T, b: T) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0);

function momentLike(m: ViewMoment): MomentLike {
  return { block_id: m.block_id, start_at: m.start_at, end_at: m.end_at, location: m.location, spot: m.spot, travel_from: m.travel_from, travel_to: m.travel_to };
}

/* ── a named guest ───────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * One guest's card, as they see it today — or null when this guest cannot be read (`people` refused, or not found).
 * `tasks: null` (refused) is said by the caller; a card drawn over missing tasks would drop their own lines.
 */
export function personDay(chapters: readonly Chapter[], data: ViewAsData, guestId: string): YourSchedule | null {
  const p = data.people?.find((x) => x.guest_id === guestId);
  if (!p || data.tasks === null) return null;
  const moments: YourMoment[] = data.moments.map((m) => ({
    block_id: m.block_id,
    parent_block_id: m.parent_block_id,
    label: m.label,
    start_at: m.start_at,
    end_at: m.end_at,
    location: m.location,
    spot: m.spot,
    is_public: m.is_public,
    audience: m.audience,
    staged: m.staged,
    travel_from: m.travel_from,
    travel_to: m.travel_to,
    time_tba: m.time_tba === true,
  }));
  return yourSchedule({
    chapters,
    moments,
    tasks: data.tasks,
    viewer: { guestId: p.guest_id, roles: p.roles, groupIds: p.groupIds, notInvited: p.notInvited },
    released: data.released === true,
    pro: true,
    guestsArriveBy: data.guestsArriveBy ?? null,
  });
}

/* ── the coordinator ─────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Every chapter with every moment the host reads, each moment once; the coordinator's own tasks under their moment
 * ("You: …") and marked `mine`. Their call time is their first task (the supplier rule, `supplierDay`).
 */
export function coordDay(chapters: readonly Chapter[], data: ViewAsData, vendorId: string): ViewDay {
  const theirs = supplierDay(chapters, data, vendorId, null);
  const mineByBlock = new Map<string, string[]>();
  for (const t of data.tasks ?? []) {
    if (t.vendor_id !== vendorId) continue;
    mineByBlock.set(t.block_id, [...(mineByBlock.get(t.block_id) ?? []), t.crew?.trim() ? `${t.crew.trim()}: ${t.what}` : t.what]);
  }
  const out: ViewDay = { chapters: [], call: theirs.call, tasksUnread: data.tasks === null };
  // ⏰ A Time-TBA chapter's 00:00 is only its day: it sorts after that day's timed chapters, never first.
  const dayKey = (c: Chapter) => (c.time_tba ? `${c.start_at.slice(0, 10)}~` : c.start_at);
  for (const c of [...chapters].sort((a, b) => (dayKey(a) < dayKey(b) ? -1 : dayKey(a) > dayKey(b) ? 1 : 0))) {
    const moments = data.moments.filter((m) => m.parent_block_id === c.block_id).sort(byStartAt);
    const rows = moments.map((m) => {
      const own = mineByBlock.get(m.block_id);
      const place = taskPlace({ place: null }, momentLike(m), c) ?? chapterWhere(c);
      return {
        id: m.block_id,
        time: c.time_tba ? TIME_TBA : m.time_tba ? RIGHT_AFTER : clockWords(m.start_at),
        title: m.label,
        sub: own ? `You: ${own.join(' · ')}` : place,
        ...(own || m.responsible_vendor_ids.includes(vendorId) ? { mine: true } : {}),
      };
    });
    // A task of theirs on the chapter itself (no moment) is still theirs.
    const onChapter = mineByBlock.get(c.block_id);
    if (onChapter) rows.unshift({ id: `chapter:${c.block_id}`, time: c.time_tba ? TIME_TBA : clockWords(c.start_at), title: c.label, sub: `You: ${onChapter.join(' · ')}`, mine: true });
    out.chapters.push({ chapter: c, rows });
  }
  return out;
}

/* ── one person's day as a file ──────────────────────────────────────────────────────────────────────────────── */

/** The day on the screen, as the PDF prints it. Built in the browser from the view drawn; checked by the route. */
export type PrintDay = {
  /** "Tita Baby" · "Coordinator · Paloma Events" · "Lumina Studio · Team A". */
  person: string;
  call: { label: string; time: string; note: string | null } | null;
  chapters: { name: string; line: string; rows: { time: string; title: string; sub: string | null }[] }[];
  footnote: string | null;
};

/** The printable limits — the route refuses anything past them (a schedule is never this large). */
export const PRINT_DAY_LIMITS = { chapters: 60, rows: 400, text: 300 } as const;

export function printDayFromView(person: string, day: ViewDay): PrintDay {
  return {
    person,
    call: day.call ? { label: 'Call time', time: day.call.time, note: day.call.where } : null,
    chapters: day.chapters.map(({ chapter: c, rows }) => ({
      name: c.label,
      line: `${c.time_tba ? TIME_TBA : clockWords(c.start_at)}${c.end_at && !c.time_tba ? ` – ${clockWords(c.end_at)}` : ''} · ${chapterWhere(c)}`,
      rows: rows.map((r) => ({ time: r.time, title: r.title, sub: r.sub || null })),
    })),
    footnote: null,
  };
}

export function printDayFromCard(person: string, s: Extract<YourSchedule, { kind: 'ok' }>): PrintDay {
  return {
    person,
    call: s.call ? { label: s.call.label, time: s.call.time, note: s.call.note } : null,
    chapters: s.chapters.map((c) => ({ name: c.name, line: c.line, rows: c.lines.map((l) => ({ time: l.time, title: l.title, sub: l.sub })) })),
    footnote: s.footnote,
  };
}

/** The route's check: a PrintDay of plain strings inside the limits, or null. Nothing else is printed. */
export function readPrintDay(raw: unknown): PrintDay | null {
  const L = PRINT_DAY_LIMITS;
  const str = (v: unknown): v is string => typeof v === 'string' && v.length <= L.text;
  const opt = (v: unknown): v is string | null => v === null || str(v);
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!str(r.person) || !r.person.trim() || !opt(r.footnote ?? null) || !Array.isArray(r.chapters) || r.chapters.length > L.chapters) return null;
  let call: PrintDay['call'] = null;
  if (r.call !== null && r.call !== undefined) {
    const c = r.call as Record<string, unknown>;
    if (!str(c.label) || !str(c.time) || !opt(c.note ?? null)) return null;
    call = { label: c.label, time: c.time, note: (c.note as string | null) ?? null };
  }
  let rows = 0;
  const chapters: PrintDay['chapters'] = [];
  for (const ch of r.chapters as unknown[]) {
    const c = ch as Record<string, unknown>;
    if (!c || !str(c.name) || !str(c.line) || !Array.isArray(c.rows)) return null;
    rows += c.rows.length;
    if (rows > L.rows) return null;
    const out: PrintDay['chapters'][number]['rows'] = [];
    for (const rw of c.rows as unknown[]) {
      const x = rw as Record<string, unknown>;
      if (!x || !str(x.time) || !str(x.title) || !opt(x.sub ?? null)) return null;
      out.push({ time: x.time, title: x.title, sub: (x.sub as string | null) ?? null });
    }
    chapters.push({ name: c.name, line: c.line, rows: out });
  }
  return { person: r.person.trim(), call, chapters, footnote: (r.footnote as string | null) ?? null };
}
