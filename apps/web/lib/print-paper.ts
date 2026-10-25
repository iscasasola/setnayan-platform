/**
 * lib/print-paper.ts — WHAT A PRINT'S PICTURE SAYS ABOUT ITS PAPER (owner 2026-10-14, Studio › Prints:
 * *"i cannot see what the different prints look like"*; approved prototype
 * `prototypes/maker_prints_previews_2026-10-14_fable.html`).
 *
 * Every print already has ONE real picture — the route that saves the file also draws its page 1
 * (`/api/hub-print/<piece>?mode=screen`, `/seating/print?format=preview`, `/seating/export?format=preview`,
 * `/seating/caterer?format=preview`, `/seating/print?chart=…&format=preview`). The Maker never draws a print
 * itself. Two small asks of those routes, and nothing else new:
 *
 *   1. `?page=N` — the page-1 picture routes draw page N instead (their layouts already return every page;
 *      `previewPage` clamps it to the pages there are).
 *   2. `x-print-paper` — a header beside the picture with the layout's OWN numbers: how many pages the file
 *      has, which page this is, how many it prints in plain words ("84 codes on 7 pages"), and — measured,
 *      never guessed — whether there is nothing to print yet (`empty`) and, for the entrance chart, whether
 *      every name fits on the asked size and which size does.
 *
 * The header is JSON, URI-encoded so a "·" or a "’" never meets a header's byte rules.
 * PURE — no I/O; the routes and the Maker's Studio › Prints both read it.
 */
import { formatCount } from '@/lib/format-number';

export const PRINT_PAPER_HEADER = 'x-print-paper';

/** What a print is waiting for, when it has nothing to print yet — read from the route's own rows. */
export type PrintPaperEmpty = 'tables' | 'seated' | 'yes' | 'guests';

export type PrintPaperFacts = {
  /** How many pages the saved file has (≥ 1). */
  pages: number;
  /** Which of them this picture is (1-based). */
  page: number;
  /** A card's printed sides (2 = Front · Back) — the picture already shows them side by side, so they are not pages to flip. */
  sides?: number;
  /** "How many", in the layout's own numbers — absent where the route measured none. */
  how?: string | null;
  /** Nothing to print yet, and why — the paper still draws (its own empty words); the sheet says what is missing. */
  empty?: PrintPaperEmpty | null;
  /** 🪧 The entrance chart: every name fits on this size at a size guests can read. */
  fits?: boolean;
  /** …and when it does not, the size that holds them all (a key of `ENTRANCE_CHART_SIZES`), or null for none. */
  suggest?: string | null;
  /** …in the chart's own words (`entranceChartTooBigWords`). */
  tooFull?: string[] | null;
};

export function printPaperHeader(f: PrintPaperFacts): Record<string, string> {
  return { [PRINT_PAPER_HEADER]: encodeURIComponent(JSON.stringify(f)) };
}

/** The header read back — null for an absent or broken one (the picture then simply shows; page 1 of 1). */
export function parsePrintPaper(raw: string | null | undefined): PrintPaperFacts | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<PrintPaperFacts>;
    const pages = Number.isInteger(v.pages) && (v.pages as number) > 0 ? (v.pages as number) : 1;
    const page = Number.isInteger(v.page) && (v.page as number) > 0 ? Math.min(v.page as number, pages) : 1;
    const empty = v.empty === 'tables' || v.empty === 'seated' || v.empty === 'yes' || v.empty === 'guests' ? v.empty : null;
    return {
      pages,
      page,
      ...(Number.isInteger(v.sides) && (v.sides as number) > 0 ? { sides: v.sides as number } : {}),
      how: typeof v.how === 'string' && v.how ? v.how : null,
      empty,
      ...(typeof v.fits === 'boolean' ? { fits: v.fits } : {}),
      ...(typeof v.suggest === 'string' ? { suggest: v.suggest } : v.suggest === null ? { suggest: null } : {}),
      ...(Array.isArray(v.tooFull) ? { tooFull: v.tooFull.filter((s): s is string => typeof s === 'string') } : {}),
    };
  } catch {
    return null;
  }
}

/** `?page=N` read against the pages there are: 1 when absent or nonsense, never past the last page. */
export function previewPage(params: URLSearchParams, pages: number): number {
  const n = Number.parseInt(params.get('page') ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, pages));
}

/** The same picture's page N — the address the preview sheet asks for page 2 onward (page 1 is the thumbnail's own). */
export function paperPageSrc(src: string, page: number): string {
  if (page <= 1) return src;
  return `${src}${src.includes('?') ? '&' : '?'}page=${page}`;
}

/* ── THE WORDS, from the layouts' own numbers ─────────────────────────────── */

const pagesWord = (n: number, size = 'A4') => `${formatCount(n)} ${size} page${n === 1 ? '' : 's'}`;

export const PAPER_HOW = {
  registry: (guests: number, pages: number) =>
    guests > 0 ? `${formatCount(guests)} guest${guests === 1 ? '' : 's'} on ${pagesWord(pages)} — the reception desk list, A to Z` : null,
  qrCodes: (codes: number, pages: number) =>
    codes > 0 ? `${formatCount(codes)} code${codes === 1 ? '' : 's'} on ${pagesWord(pages)} — every guest, with their name` : null,
  seatingPack: (pages: number, tables: number, cards: number) =>
    tables > 0
      ? `${pagesWord(pages)}: a directory · ${formatCount(tables)} table sign${tables === 1 ? '' : 's'} · ${formatCount(cards)} place card${cards === 1 ? '' : 's'}`
      : null,
  caterer: (coming: number, pages: number) =>
    coming > 0 ? `${pagesWord(pages)} for ${formatCount(coming)} confirmed guest${coming === 1 ? '' : 's'} — meals per table and every dietary note` : null,
  seatPlan: (tables: number, seated: number) =>
    tables > 0 ? `1 A3 page — ${formatCount(tables)} table${tables === 1 ? '' : 's'}, ${formatCount(seated)} seated` : null,
  chart: (names: number, unseated: number) =>
    names > 0
      ? `1 sheet · ${formatCount(names)} name${names === 1 ? '' : 's'}${unseated > 0 ? ` · ${formatCount(unseated)} guest${unseated === 1 ? ' has' : 's have'} no seat yet and ${unseated === 1 ? 'is' : 'are'} not on it` : ''}`
      : null,
} as const;

/**
 * 🫙 WHAT IS MISSING, said in the preview sheet under the paper (kind 16 — the template's empty state), with the
 * door that fixes it IN PLACE where it lives in the Maker (the Seat plan is an item of Details), or the Guest list.
 */
export const PAPER_EMPTY: Record<PrintPaperEmpty, { title: string; line: string; door: 'seating' | 'guests' }> = {
  tables: { title: 'No tables yet', line: 'Make your room in Seat plan — this prints from it.', door: 'seating' },
  seated: { title: 'Nobody is seated yet', line: 'Seat your guests in Seat plan — only guests with a seat are printed.', door: 'seating' },
  yes: { title: 'Nobody has said yes yet', line: 'This counts the guests who are coming.', door: 'guests' },
  guests: { title: 'No guests yet', line: 'Add your guests — this prints from your guest list.', door: 'guests' },
};

/* ── THE BOX ──────────────────────────────────────────────────────────────── */

/** The row head's picture box (prototype `.thumb`): 72 px on a phone, 56 px on a computer. */
export const PRINT_THUMB_PX = 72;

/**
 * 📐 THE PICTURE AT ITS TRUE PAPER PROPORTIONS, inside a square box (`printPreviewBox`'s rule, small): the long
 * side fills the box, the short side follows the paper — a landscape seat plan is wide and short, a pass is a strip.
 * An unknown shape is a square.
 */
export function printThumbSize(aspect: number | null | undefined, box = PRINT_THUMB_PX): { w: number; h: number } {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return { w: box, h: box };
  return aspect >= 1 ? { w: box, h: Math.max(8, Math.round(box / aspect)) } : { w: Math.max(8, Math.round(box * aspect)), h: box };
}
