/**
 * lib/print-name-fit.ts — ✂🚫 A NAME IS NEVER CUT ON PAPER.
 *
 * Owner 2026-10-29, on the printouts: *"same goes to the print outs where some names get the ..."* · *"we do not want
 * that"*. A guest's name (with their nickname beside it) is never shortened with "…" on any print: it WRAPS to more
 * lines, and only when a line still cannot hold it does the type step down — never below the print minimum
 * (`PRINT_MIN_BODY_PT`, 6 pt) — and the row or card grows to take the lines. A single word wider than its room even at
 * the minimum is broken between letters (every letter still prints); nothing is ever dropped.
 *
 * ONE fitter for every print backend — it only needs the backend's own width measure:
 *   · the print op pipeline (`lib/print-layout.ts` `measure`) — passes, place cards, table signs, the entrance chart;
 *   · pdf-lib's standard fonts (`font.widthOfTextAtSize`) — the seat plan (`lib/seating-pdf.ts`);
 *   · the Share-as-PDF engine's faces (`lib/share-pdf.ts`).
 *
 * The answer always holds the WHOLE name: `nameLinesJoin(lines)` gives it back, letter for letter.
 * 🔒 lib/names-are-never-cut.test.ts
 */

export type NameFit = {
  /** The lines, top to bottom. A word broken between letters is marked by `broken[i]` on the line it continues from. */
  lines: string[];
  /** True where line i ends mid-word (the next line continues the same word — no space between them). */
  broken: boolean[];
  /** The size every line is set at. */
  size: number;
};

/**
 * Fit `text` into `maxWidth`, starting at `size`:
 *   1. one line at `size`;
 *   2. one line shrunk, down to `wrapBelow` (default `size` — wrap before shrinking);
 *   3. wrapped — at `size`, then smaller in 0.25 pt steps down to `floor` — the fewest lines that fit, up to
 *      `preferLines` (default 3), at the largest size that achieves it;
 *   4. at `floor`: wrapped into as many lines as it takes, a too-long word broken between letters.
 * Never returns a line wider than `maxWidth` (unless one LETTER is wider, which no real room is), never an ellipsis.
 */
export function fitName(
  raw: string,
  o: { size: number; floor: number; maxWidth: number; width: (s: string, size: number) => number; wrapBelow?: number; preferLines?: number },
): NameFit {
  const s = raw.replace(/\s+/g, ' ').trim();
  const floor = Math.min(o.floor, o.size);
  if (!s) return { lines: [], broken: [], size: o.size };
  const room = o.maxWidth;
  const fits = (t: string, size: number) => o.width(t, size) <= room + 1e-6;
  if (fits(s, o.size)) return { lines: [s], broken: [false], size: o.size };
  const wrapBelow = Math.max(floor, Math.min(o.size, o.wrapBelow ?? o.size));
  const shrunk = o.size * (room / o.width(s, o.size));
  if (shrunk >= wrapBelow) return { lines: [s], broken: [false], size: shrunk };
  const prefer = Math.max(2, o.preferLines ?? 3);
  for (let size = o.size; size >= floor - 1e-9; size = Math.round((size - 0.25) * 100) / 100) {
    const at = greedy(s, size, room, fits);
    if (at && at.lines.length <= prefer && !at.broken.some(Boolean)) return { ...at, size };
  }
  return { ...(greedy(s, floor, room, fits, true) as Omit<NameFit, 'size'>), size: floor };
}

/** Greedy word wrap at `size`. Without `breakWords`, null when one word alone is too wide. */
function greedy(
  s: string,
  size: number,
  room: number,
  fits: (t: string, size: number) => boolean,
  breakWords = false,
): Omit<NameFit, 'size'> | null {
  const lines: string[] = [];
  const broken: boolean[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next, size)) {
      line = next;
      continue;
    }
    if (line) {
      lines.push(line);
      broken.push(false);
      line = '';
    }
    if (fits(word, size)) {
      line = word;
      continue;
    }
    if (!breakWords) return null;
    // Break the word between letters: as many letters per line as fit (at least one).
    let rest = [...word];
    while (rest.length) {
      let n = 1;
      while (n < rest.length && fits(rest.slice(0, n + 1).join(''), size)) n += 1;
      if (n === rest.length) {
        line = rest.join('');
        rest = [];
      } else {
        lines.push(rest.slice(0, n).join(''));
        broken.push(true);
        rest = rest.slice(n);
      }
    }
  }
  if (line) {
    lines.push(line);
    broken.push(false);
  }
  return { lines, broken };
}

/** The whole name back from its lines — a space between lines, none where a word was broken. */
export function nameLinesJoin(fit: Pick<NameFit, 'lines' | 'broken'>): string {
  return fit.lines.map((l, i) => (i < fit.lines.length - 1 && !fit.broken[i] ? `${l} ` : l)).join('');
}
