/**
 * 📤 GUESTS › SHARE OR PRINT — THE DOCUMENTS (R4 slice 8; owner 2026-10-29, prototype `printsFor` / `shareSheet`:
 * *"each print lives where its data lives"*). Each Guests view's 📤 round opens ONE "Share or print" sheet listing what
 * that view can hand over as a PDF; the ones drawn HERE are the documents no print route made yet, on the shared engine
 * (`lib/share-pdf.ts`, PR #7032):
 *
 *   guest-list   — the list AS SHOWN: the ⇅ Show and Group by of the view it was shared from (List or Map)
 *   check-in     — every coming guest A to Z, their table, an empty box to tick at the door
 *   table-list   — each table (linked tables as one) and who sits there, then who has no seat yet
 *   march        — the wedding march, walk by walk, in its order, with each pair
 *
 * Everything else the sheet lists is a print that ALREADY ships, linked rather than redrawn
 * (`lib/guests-share-sheet.ts`): the caterer's meal counts, the 2D seat plan, the entrance seating chart, the table signs
 * and place cards.
 *
 * PURE: the route (`app/dashboard/[eventId]/guests/share/route.ts`) does every read and hands the answers in. A read
 * that was refused never reaches a builder — the route answers 503 in words, never a file of "No guests".
 * Names are the printed name (`guestPrintName`: the full name, the nickname beside it). Counts carry commas.
 * 🔒 lib/guests-share-or-print.test.ts
 */
import { formatCount } from '@/lib/format-number';
import type { SharePdfDoc, SharePdfPaper, SharePdfSection } from '@/lib/share-pdf';

export type GuestsShareDocKey = 'guest-list' | 'check-in' | 'table-list' | 'march';

export const GUESTS_SHARE_DOCS: readonly GuestsShareDocKey[] = ['guest-list', 'check-in', 'table-list', 'march'];

export function isGuestsShareDoc(v: string | null | undefined): v is GuestsShareDocKey {
  return (GUESTS_SHARE_DOCS as readonly string[]).includes(v ?? '');
}

/** The head every document shares: the event's name, its date · venue line, when, and the sheet. */
export type GuestsShareHead = {
  eventName: string;
  meta: ReadonlyArray<string | null | undefined>;
  generatedAt: Date;
  paper?: SharePdfPaper;
};

const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

// ── 1 · the guest list, as shown ────────────────────────────────────────────

/** One guest row of the list. `reply` is the shipped reply word ("Attending" · "No reply" · "To invite"). */
export type ShareGuest = { name: string; sub?: string | null; reply: string; table: string | null };

export function guestListPdf(
  head: GuestsShareHead,
  list: {
    /** "Everyone" · "Attending" … — the ⇅ Show it was shared with. */
    showLabel: string;
    /** "Role" · "Side" … — the ⇅ Group by. */
    groupLabel: string;
    sections: ReadonlyArray<{ label: string; guests: readonly ShareGuest[] }>;
  },
): SharePdfDoc {
  const total = list.sections.reduce((n, s) => n + s.guests.length, 0);
  const sections: SharePdfSection[] = list.sections
    .filter((s) => s.guests.length > 0)
    .map((s) => ({
      title: s.label,
      aside: plural(s.guests.length, 'guest'),
      columns: [
        { label: 'REPLY', width: 92, align: 'left' },
        { label: 'TABLE', width: 84, align: 'left' },
      ],
      rows: s.guests.map((g) => ({ main: g.name, sub: g.sub ?? null, cells: [g.reply, g.table ?? '—'] })),
    }));
  return {
    kind: 'GUEST LIST',
    title: head.eventName,
    meta: head.meta,
    summary: {
      figures: [
        { label: 'ON THIS LIST', value: formatCount(total) },
        { label: 'SHOWING', value: list.showLabel },
        { label: 'GROUPED BY', value: list.groupLabel },
      ],
    },
    sections: sections.length
      ? sections
      : [{ title: 'Guests', columns: [], rows: [], empty: 'Nobody matches what this list was showing.' }],
    notes: ['As shown on Guests when it was shared. Full names, with their nickname beside them.'],
    generatedAt: head.generatedAt,
    paper: head.paper,
  };
}

// ── 2 · the check-in sheet ──────────────────────────────────────────────────

export type ShareCheckIn = { name: string; sub?: string | null; table: string | null };

/** Every COMING guest (the route passes attending ones), A to Z by the caller's order, a box to tick at the door. */
export function checkInPdf(head: GuestsShareHead, guests: readonly ShareCheckIn[], pending: number): SharePdfDoc {
  return {
    kind: 'CHECK-IN SHEET',
    title: head.eventName,
    meta: head.meta,
    summary: {
      figures: [
        { label: 'COMING', value: formatCount(guests.length) },
        { label: 'NO REPLY YET', value: formatCount(pending) },
      ],
      notes: pending > 0 ? [{ text: `${plural(pending, 'guest')} who have not replied are not on this sheet.`, tone: 'soft' }] : undefined,
    },
    sections: [
      {
        title: 'At the door',
        aside: 'Tick each name as they arrive',
        columns: [
          { label: 'TABLE', width: 96, align: 'left' },
          { label: 'HERE', width: 44, align: 'left' },
        ],
        rows: guests.map((g) => ({ main: g.name, sub: g.sub ?? null, cells: [g.table ?? 'Not seated yet', '[    ]'] })),
        empty: 'Nobody has said they are coming yet.',
      },
    ],
    generatedAt: head.generatedAt,
    paper: head.paper,
  };
}

// ── 3 · the table list ──────────────────────────────────────────────────────

export function tableListPdf(
  head: GuestsShareHead,
  units: ReadonlyArray<{ label: string; capacity: number | null; guests: ReadonlyArray<{ name: string; sub?: string | null }> }>,
  unseated: ReadonlyArray<{ name: string; sub?: string | null }>,
): SharePdfDoc {
  const seated = units.reduce((n, u) => n + u.guests.length, 0);
  const sections: SharePdfSection[] = units.map((u) => ({
    title: u.label,
    aside: u.capacity !== null ? `${formatCount(u.guests.length)} of ${formatCount(u.capacity)}` : plural(u.guests.length, 'guest'),
    columns: [],
    rows: u.guests.map((g) => ({ main: g.name, sub: g.sub ?? null, cells: [] })),
    empty: 'Nobody sits here yet.',
  }));
  if (unseated.length > 0) {
    sections.push({
      title: 'No seat yet',
      aside: plural(unseated.length, 'guest'),
      columns: [],
      rows: unseated.map((g) => ({ main: g.name, sub: g.sub ?? null, cells: [] })),
    });
  }
  return {
    kind: 'TABLE LIST',
    title: head.eventName,
    meta: head.meta,
    summary: {
      figures: [
        { label: 'TABLES', value: formatCount(units.length) },
        { label: 'SEATED', value: formatCount(seated) },
        { label: 'NO SEAT YET', value: formatCount(unseated.length) },
      ],
    },
    sections: sections.length ? sections : [{ title: 'Tables', columns: [], rows: [], empty: 'There are no tables on the seat plan yet.' }],
    generatedAt: head.generatedAt,
    paper: head.paper,
  };
}

// ── 4 · the wedding march ───────────────────────────────────────────────────

export function marchPdf(
  head: GuestsShareHead,
  march: {
    sections: ReadonlyArray<{ label: string; walks: ReadonlyArray<readonly string[]> }>;
    /** Who is in "Not walking" — listed last, so nobody is lost from the page. */
    notWalking: readonly string[];
    /** The march as shown carries moves not yet Applied — said, never hidden. */
    drafted: boolean;
  },
): SharePdfDoc {
  let step = 0;
  const sections: SharePdfSection[] = march.sections
    .filter((s) => s.walks.length > 0)
    .map((s) => ({
      title: s.label,
      aside: plural(s.walks.length, 'walk'),
      columns: [{ label: 'WALK', width: 44, align: 'right' }],
      rows: s.walks.map((names) => {
        step += 1;
        return { main: names.filter(Boolean).join(' & ') || '—', sub: names.filter(Boolean).length === 1 ? 'walks alone' : null, cells: [formatCount(step)] };
      }),
    }));
  if (march.notWalking.length > 0) {
    sections.push({
      title: 'Not walking',
      aside: plural(march.notWalking.length, 'person', 'people'),
      columns: [],
      rows: march.notWalking.map((n) => ({ main: n, cells: [] })),
    });
  }
  const walking = march.sections.reduce((n, s) => n + s.walks.reduce((k, w) => k + w.filter(Boolean).length, 0), 0);
  return {
    kind: 'WEDDING MARCH',
    title: head.eventName,
    meta: head.meta,
    summary: {
      figures: [
        { label: 'WALKS', value: formatCount(step) },
        { label: 'WALKING', value: formatCount(walking) },
        { label: 'NOT WALKING', value: formatCount(march.notWalking.length) },
      ],
      notes: march.drafted ? [{ text: 'Includes changes not yet Applied to your Event Hub.', tone: 'accent' }] : undefined,
    },
    sections: sections.length ? sections : [{ title: 'The march', columns: [], rows: [], empty: 'Nobody walks yet.' }],
    generatedAt: head.generatedAt,
    paper: head.paper,
  };
}
