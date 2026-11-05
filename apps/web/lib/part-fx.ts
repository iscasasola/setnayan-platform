/**
 * lib/part-fx.ts — ✂ THE WORDS, CUT FOR THE NEW EFFECTS (owner-approved 2026-10-16, DECISION_LOG "APPROVED — SIX NEW
 * EFFECTS"; prototype `text_image_effects_2026-10-16.html`).
 *
 * Word by word, Spread and Glow each need the part's words as pieces: a span per word (Word by word's stagger; Glow's
 * halo, one blurred copy of each word drawn under it by CSS — `content: attr(data-t)`, so the copy is never text a
 * reader of the part finds), and on a short part a span per letter (Spread). ONE cutter, read by both drawings:
 *
 *   · the guest page and the Maker's canvas as the server draws them (`pahina-masthead.tsx` `txt`);
 *   · the Maker canvas's instant preview of a pick (`app/[slug]/_components/part-fx-cut.ts`).
 *
 * Offsets are into the part's WHOLE text (the string a browser's `textContent` is, as the runs' are), so a word that a
 * run splits in two keeps ONE place in the stagger, and Spread measures the whole line. Pure: no DOM, no React.
 */
import { HUB_SPREAD_LETTERS_MAX, type HubElWords } from './element-style';

/** A letter of Spread: the character and where it starts from — toward the middle of the line, in `em`. */
export type HubFxLetter = { c: string; x: string };
/** One piece of a part's text: the space between words, or a word (its place in the stagger, and its letters for Spread). */
export type HubFxPiece = { space: string } | { word: string; i: number; letters: HubFxLetter[] | null };

/** How a part's words are cut: per word (`word`), per letter inside its words (`letter`), or whole lines (`line`). */
export type HubFxCut = { letters: boolean; line: boolean };

/** Spread on a short part cuts letters; on a longer one the line opens as one piece (the approved 24-letter call). */
export function hubFxCut(words: HubElWords | null, whole: string): HubFxCut {
  const spread = words === 'spread';
  return { letters: spread && whole.length <= HUB_SPREAD_LETTERS_MAX, line: spread && whole.length > HUB_SPREAD_LETTERS_MAX };
}

/** How far a letter at `p` (of a line of `n`) starts toward the middle — the prototype's `(n/2 - i) * 0.09em`. */
export function hubFxLetterX(p: number, n: number): string {
  return `${((n / 2 - p) * 0.09).toFixed(2)}em`;
}

/** The word a character at `p` of `whole` belongs to (0-based) — words are the runs of non-space characters. */
function wordIndexAt(whole: string, p: number): number {
  let i = -1;
  for (let k = 0; k <= p && k < whole.length; k += 1) {
    if (!/\s/.test(whole[k]!) && (k === 0 || /\s/.test(whole[k - 1]!))) i += 1;
  }
  return Math.max(0, i);
}

/**
 * ONE piece of the part's text (`text`, which starts at `start` in `whole`), cut into words and the spaces between
 * them. Each word knows its place in the whole part's stagger and — with `letters` — its letters and their start.
 */
export function hubFxPieces(text: string, whole: string, start: number, cut: HubFxCut): HubFxPiece[] {
  const out: HubFxPiece[] = [];
  let at = 0;
  for (const tok of text.split(/(\s+)/)) {
    if (tok.length === 0) continue;
    const p = start + at;
    if (/^\s+$/.test(tok)) out.push({ space: tok });
    else
      out.push({
        word: tok,
        i: wordIndexAt(whole, p),
        letters: cut.letters ? Array.from(tok).map((c, k) => ({ c, x: hubFxLetterX(p + k, whole.length) })) : null,
      });
    at += tok.length;
  }
  return out;
}

/** The attributes and inline style a word span wears — the stagger place, and the copy Glow draws (`data-t`). */
export const HUB_FX_WORD_ATTR = 'data-el-w';
export const HUB_FX_LETTER_ATTR = 'data-el-l';
export const HUB_FX_LINE_ATTR = 'data-el-sl';
