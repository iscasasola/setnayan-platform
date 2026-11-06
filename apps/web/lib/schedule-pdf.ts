/**
 * lib/schedule-pdf.ts — 📤 THE SCHEDULE AS A FILE TO SHARE: the budget PDF's look, on the same engine.
 *
 * Owner 2026-11-01: *"just like our budget design pdf. do the same for  schedule"* (DECISION_LOG "THE SCHEDULE PRINTS
 * LIKE THE BUDGET PDF"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6b). So this file is `lib/budget-pdf.ts`'s twin: it only
 * turns the schedule into a `SharePdfDoc`; `lib/share-pdf.ts` draws it the way it draws every Setnayan PDF (the mark +
 * SETNAYAN, house type, A4 · Letter · Long bond, "Generated …" and "Page n of N" on every page, a row never split, a
 * heading never alone at a page's foot). Not a new print system.
 *
 *   page 1 · the event's name · its date · what is printed · Chapters · Moments · Venues · Suppliers (real counts)
 *   then   · each chapter as a section — its date, time and venue on the heading's line — with its moments as rows:
 *            time · what · who
 *
 * ── THE MODEL IS THE ONE THE SCHEDULE ALREADY HAS ──────────────────────────
 * A CHAPTER is a top-level `event_schedule_blocks` row and a MOMENT is its child (`parent_block_id`) — the chapters
 * plan's own model (§2), on the column the schedule has carried since 2026-06-19. A chapter with no moments yet prints
 * itself as its one row, so a schedule written before chapters existed prints every line it has.
 *
 * ── 🛑 A FAILED READ NEVER PRINTS ──────────────────────────────────────────
 * When the moments or who-does-what could not be read, the counts would be a floor and "who" would be blank for
 * people who ARE on it. `scheduleDoc` refuses (`ScheduleUnreadError`); the route says so in a sentence, no file.
 *
 * `lib/print-set.server.ts` is a different thing: the programme GUESTS may see. This is the host's working copy.
 * Pure: the route (`app/api/schedule/[eventId]/export/route.ts`) does every read and hands the answers in.
 * 🔒 lib/the-schedule-prints-like-the-budget.test.ts
 */
import { formatCount } from '@/lib/format-number';
import { formatClock, formatClockRange, formatDateHeading, spanOf, wallDateKey } from '@/lib/schedule-rail';
import { isTimeTba, TIME_TBA } from '@/lib/schedule-chapters';
import type { PrintDay } from '@/lib/schedule-view-as-people';
import { sharePdf, type SharePdfColumn, type SharePdfDoc, type SharePdfPaper, type SharePdfSection } from '@/lib/share-pdf';

export type SchedulePdfBlock = {
  block_id: string;
  parent_block_id: string | null;
  label: string;
  /** The venue's wall clock written into a UTC column (`lib/schedule-datetime-local.ts`). */
  start_at: string;
  end_at: string | null;
  location: string | null;
  /** ⏰ A Time-TBA chapter (migration 20271300482585): printed "Time TBA", its stored 00:00 never printed as a time. */
  time_tba?: boolean | null;
};

export type SchedulePdfInput = {
  eventName: string;
  /** The event's date as paper prints it (`printedDate`). Null → no date. */
  eventDate: string | null;
  /** Every moment, in the schedule's order (`fetchScheduleBlocks`). NULL = the read was refused. */
  blocks: ReadonlyArray<SchedulePdfBlock> | null;
  /** block_id → who does it (supplier shop names, then the responsible party). NULL = the read was refused. */
  who: ReadonlyMap<string, ReadonlyArray<string>> | null;
  /** block_id → the supplier ids tagged on it — the Suppliers figure. NULL = the read was refused. */
  supplierIds: ReadonlyMap<string, ReadonlyArray<string>> | null;
  /** The "Include names" switch — default on. Off drops the Who column (a copy for the venue's front desk). */
  includeNames?: boolean;
  generatedAt: Date;
  /** Default A4. */
  paper?: SharePdfPaper;
};

/** A read was not answered — a file now would print a floor as a fact. */
export class ScheduleUnreadError extends Error {
  constructor() {
    super("Your schedule can't be shared right now — part of it didn't load. Please try again in a few minutes.");
    this.name = 'ScheduleUnreadError';
  }
}

export type ScheduleChapter = { chapter: SchedulePdfBlock; moments: SchedulePdfBlock[] };

/** Chapters (top-level rows, in order) with their moments (children, in order). An orphaned child is its own chapter. */
export function scheduleChapters(blocks: ReadonlyArray<SchedulePdfBlock>): ScheduleChapter[] {
  const tops = new Set(blocks.filter((b) => b.parent_block_id === null).map((b) => b.block_id));
  const out: ScheduleChapter[] = [];
  const byId = new Map<string, ScheduleChapter>();
  for (const b of blocks) {
    if (b.parent_block_id === null || !tops.has(b.parent_block_id)) {
      const c = { chapter: b, moments: [] };
      out.push(c);
      byId.set(b.block_id, c);
    }
  }
  for (const b of blocks) {
    if (b.parent_block_id !== null && tops.has(b.parent_block_id)) byId.get(b.parent_block_id)?.moments.push(b);
  }
  return out;
}

/** The four figures on page 1 — each a real count over what was read. */
export function scheduleFigures(
  blocks: ReadonlyArray<SchedulePdfBlock>,
  supplierIds: ReadonlyMap<string, ReadonlyArray<string>>,
): { chapters: number; moments: number; venues: number; suppliers: number } {
  const chapters = scheduleChapters(blocks);
  const venues = new Set(blocks.map((b) => b.location?.trim().toLowerCase()).filter((v): v is string => !!v));
  const suppliers = new Set(blocks.flatMap((b) => supplierIds.get(b.block_id) ?? []));
  return {
    chapters: chapters.length,
    moments: chapters.reduce((n, c) => n + c.moments.length, 0),
    venues: venues.size,
    suppliers: suppliers.size,
  };
}

function when(b: SchedulePdfBlock): string {
  if (isTimeTba(b)) return TIME_TBA;
  const s = spanOf(b.start_at, b.end_at);
  return b.end_at ? formatClockRange(s.startMin, s.endMin) : formatClock(s.startMin);
}

const WHO: SharePdfColumn = { label: 'Who', width: 150, align: 'left' };

/** The schedule as the engine's document. Refuses on a refused read. */
export function scheduleDoc(input: SchedulePdfInput): SharePdfDoc {
  const { blocks, who, supplierIds } = input;
  // 🛑 A refused read is not a shorter schedule. Refuse rather than print a floor as a fact.
  if (!blocks || !who || !supplierIds) throw new ScheduleUnreadError();
  const names = input.includeNames !== false;
  const chapters = scheduleChapters(blocks);
  const figures = scheduleFigures(blocks, supplierIds);
  const days = new Set(blocks.map((b) => wallDateKey(b.start_at)));

  const row = (b: SchedulePdfBlock, chapterVenue: string | null) => {
    const place = b.location?.trim() || null;
    return {
      main: `${when(b)} · ${b.label.trim() || 'Untitled'}`,
      sub: place && place !== chapterVenue ? place : null,
      cells: names ? [{ text: (who.get(b.block_id) ?? []).join(', ') || '—', tone: 'soft' as const }] : [],
    };
  };

  const sections: SharePdfSection[] = chapters.map(({ chapter, moments }) => {
    const venue = chapter.location?.trim() || null;
    const day = days.size > 1 ? formatDateHeading(wallDateKey(chapter.start_at)) : null;
    return {
      title: chapter.label.trim() || 'Untitled',
      aside: [day, when(chapter), venue].filter(Boolean).join(' · '),
      columns: names ? [WHO] : [],
      // A chapter with no moments yet is its own one row — nothing on the schedule is left off the page.
      rows: (moments.length ? moments : [chapter]).map((m) => row(m, venue)),
    };
  });
  if (!sections.length) {
    sections.push({ title: 'Nothing on the schedule yet.', columns: [], rows: [], empty: 'When you add a chapter or a moment, it is listed here.' });
  }

  return {
    kind: 'Schedule',
    title: input.eventName,
    fileTitle: `${input.eventName} — schedule`,
    meta: [input.eventDate, names ? 'The full schedule, with who does what' : 'The full schedule'],
    summary: {
      figures: [
        { label: 'Chapters', value: formatCount(figures.chapters) },
        { label: 'Moments', value: formatCount(figures.moments) },
        { label: 'Venues', value: formatCount(figures.venues) },
        { label: 'Suppliers', value: formatCount(figures.suppliers) },
      ],
    },
    sections,
    notes: ['Includes moments hidden from guests — this copy is for you, your coordinator and your suppliers.'],
    generatedAt: input.generatedAt,
    paper: input.paper,
  };
}

/** The schedule's PDF bytes. Throws `ScheduleUnreadError` when a read was refused. */
export async function schedulePdf(input: SchedulePdfInput): Promise<Uint8Array> {
  return sharePdf(scheduleDoc(input));
}

/* ── 👤 ONE PERSON'S DAY (event chapters slice 6, owner 2026-11-04 "Any View as person, Pro") ─────────────────────── */

/**
 * The day View as draws for one person — a named guest, a role, a supplier or crew, the coordinator — on the same
 * engine and in the same look. It prints exactly the screen (`PrintDay`, built from the view drawn and checked by
 * `readPrintDay`), so the paper can never show someone more than the screen did.
 */
export function personDayDoc(input: {
  eventName: string;
  eventDate: string | null;
  day: PrintDay;
  generatedAt: Date;
  paper?: SharePdfPaper;
}): SharePdfDoc {
  const { day } = input;
  const sections: SharePdfSection[] = day.chapters.map((c) => ({
    title: c.name.trim() || 'Untitled',
    aside: c.line,
    columns: [],
    rows: c.rows.map((r) => ({ main: `${r.time} · ${r.title.trim() || 'Untitled'}`, sub: r.sub, cells: [] })),
    empty: 'Nothing on it for them yet.',
  }));
  if (!sections.length) sections.push({ title: 'Nothing on the schedule for them yet.', columns: [], rows: [] });
  return {
    kind: 'Schedule',
    title: input.eventName,
    fileTitle: `${input.eventName} — ${day.person}`,
    meta: [input.eventDate, `${day.person}’s schedule`],
    summary: day.call
      ? { figures: [{ label: day.call.label, value: day.call.time }], notes: day.call.note ? [{ text: day.call.note, tone: 'soft' }] : [] }
      : undefined,
    sections,
    notes: day.footnote ? [day.footnote] : [],
    generatedAt: input.generatedAt,
    paper: input.paper,
  };
}

/** One person's day as PDF bytes. */
export async function personDayPdf(input: Parameters<typeof personDayDoc>[0]): Promise<Uint8Array> {
  return sharePdf(personDayDoc(input));
}
