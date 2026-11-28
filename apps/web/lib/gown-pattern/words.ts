/**
 * 👗 gown-pattern/words — what the order view and the pattern pages screen say (plan steps B11/B12; drawing v205, word
 * for word). Kept apart from the page engine (export.ts) so the screens can say them without loading it. No money.
 * 🔒 lib/gown-pattern/export.test.ts
 */
import { formatCount } from '../format-number';
import type { GownPatternBook } from './export';

/** The papers a pattern prints on (owner D28: A4 and US Letter), mm. The page engine reads the sizes; the screens the names. */
export const GOWN_PAPERS = {
  a4: { name: 'A4', w: 210, h: 297 },
  letter: { name: 'US Letter', w: 215.9, h: 279.4 },
} as const;
export type GownPaper = keyof typeof GOWN_PAPERS;
/** The paper choice, as a dropdown's options. */
export const GOWN_PAPER_OPTIONS = (Object.keys(GOWN_PAPERS) as GownPaper[]).map((k) => ({ key: k, label: GOWN_PAPERS[k].name }));

/** Under "Export 1:1" (v205 `blocksHTML`). */
export const GOWN_EXPORT_HINT = 'Pages to tape together at true size, a page map, a 5 cm test square on every page, and one large sheet for a plotter. No prices on any sheet.';
/** When the shop's allowances could not be read: never a cut line from guessed numbers. */
export const GOWN_PATTERN_UNREAD = 'Couldn’t read your seam allowances just now, so the blocks show the stitching line only. Close and open the blocks to try again.';
/** The pages screen's one line (v205 `pp-sum`), without the bold. */
export function gownPagesSummary(book: Pick<GownPatternBook, 'total' | 'tiles' | 'diagrams'>, paperName: string): { lead: string; rest: string } {
  const d = book.diagrams.length;
  return {
    lead: `${formatCount(book.total)} page${book.total > 1 ? 's' : ''}`,
    rest: ` on ${paperName}: the page map, ${formatCount(book.tiles)} page${book.tiles === 1 ? '' : 's'} to tape together${d ? `, and ${formatCount(d)} measured diagram${d > 1 ? 's' : ''}` : ''}. Print at 100 %, then check the 5 cm square.`,
  };
}
/** v205's warning when a piece comes as a measured diagram. */
export function gownPagesDiagramWarning(diagrams: GownPatternBook['diagrams']): string | null {
  if (!diagrams.length) return null;
  const many = diagrams.length > 1;
  return `${diagrams.map((d) => `${d.piece} would take ${formatCount(d.pages)} pages`).join('; ')}: too many to tape together, so ${many ? 'they come' : 'it comes'} as a drawing with its measurements. The plotter sheet still has ${many ? 'them' : 'it'} at full size.`;
}
