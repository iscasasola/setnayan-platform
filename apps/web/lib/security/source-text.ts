/**
 * The one comment-stripper the static guards share.
 *
 * Extracted so `shadowed-export-scan.ts` and the constant-binding half of
 * `select-column-scan.ts` cannot grow two subtly-different copies — which would
 * be a fitting way for the guards against "one rule written down twice" to
 * fail.
 *
 * ⚠ `select-column-scan.ts`'s ORIGINAL phantom-column path deliberately does
 * NOT use this. It scans raw source, doc comments included, and one of its
 * baselined entries (`t`) exists precisely because it reads a `.from('t')` out
 * of its own docblock. Stripping comments there would silently change what that
 * guard sees. New code paths strip; the old one does not. Said out loud here so
 * the asymmetry is a decision rather than a surprise.
 */

/**
 * Blank out `//` and block comments, preserving every character position and
 * newline so line numbers computed downstream stay exact.
 *
 * String literals are NOT parsed. The one shape this gets wrong — `'//'` inside
 * a string — can only ever make a caller see LESS, never more, which is the
 * safe direction for a guard that must not cry wolf.
 */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      for (let j = i; j < stop; j++) out += src[j] === '\n' ? '\n' : ' ';
      i = stop;
    } else if (src.startsWith('//', i)) {
      let stop = src.indexOf('\n', i);
      if (stop === -1) stop = src.length;
      out += ' '.repeat(stop - i);
      i = stop;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}
