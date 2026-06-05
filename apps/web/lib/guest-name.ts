// Shared guest-name normalization — applied on every server write path
// (detailed /guests/new form, quick-add sheet, CSV import) so two
// visually identical names always store + dedupe identically, and
// downstream surfaces (QR labels, seating cards, print packs, R2 object
// keys) never inherit invisible junk pasted from spreadsheets, PDFs, or
// web pages.
//
// What it does — all silent + non-destructive:
//   - NFC-normalizes Unicode so a precomposed accent and a base letter +
//     combining accent collapse to one representation. They render
//     identically but otherwise never match in dedupe / search / sort.
//   - Drops zero-width + BOM + soft-hyphen + bidi formatting chars that
//     render invisibly.
//   - Folds stray C0/C1 control chars (tabs / newlines from a paste) and
//     every flavour of Unicode whitespace (NBSP, thin/figure spaces,
//     ideographic space) to a single ASCII space, then trims.
//   - Clamps to MAX_GUEST_NAME_LEN so an over-long paste can't blow out
//     seating cards / QR labels / the print-pack layout.
//
// What it deliberately does NOT do: change casing. Filipino names
// (de la Cruz, Ng, Sy, McName) break under naive Title-Case, so smart
// casing is a separate, reversible UX suggestion — never a silent
// rewrite here.
//
// Implemented with explicit numeric code points (not regex \u escapes)
// so the source stays ASCII-only and survives copy/paste + diff tooling
// without smuggling in real invisible characters.

export const MAX_GUEST_NAME_LEN = 80;

// Render-invisible code points that silently defeat dedupe / search /
// sort: zero-width space + joiners, bidi marks/overrides, soft hyphen,
// word joiner, and the BOM (zero-width no-break space).
const INVISIBLE = new Set<number>([
  0x00ad, // soft hyphen
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, // ZWSP, ZWNJ, ZWJ, LRM, RLM
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // bidi embedding / override
  0x2060, // word joiner
  0xfeff, // BOM / zero-width no-break space
]);

// Unicode whitespace beyond the ASCII run — NBSP, Ogham space, the
// en/em quad family, line/paragraph separators, narrow + medium math
// spaces, and the ideographic space. All fold to one ASCII space.
const UNICODE_SPACE = new Set<number>([
  0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
  0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
]);

function isSpaceLike(cp: number): boolean {
  // ASCII space + all C0 controls (incl. tab / LF / CR) + DEL + C1
  // controls + every Unicode space above collapse to one separator.
  return (
    cp === 0x20 ||
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    UNICODE_SPACE.has(cp)
  );
}

/**
 * Normalize one guest-name field (first OR last name). Safe on any
 * string-ish input; null / undefined collapse to ''.
 */
export function normalizeGuestName(raw: string | null | undefined): string {
  if (!raw) return '';
  const src = String(raw).normalize('NFC');
  let out = '';
  let pendingSpace = false;
  for (const ch of src) {
    const cp = ch.codePointAt(0) as number;
    if (INVISIBLE.has(cp)) continue;
    if (isSpaceLike(cp)) {
      // Defer: only emit a separator if real text already exists (drops
      // leading runs) and more real text follows (drops trailing runs).
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out += ' ';
      pendingSpace = false;
    }
    out += ch;
  }
  if (out.length > MAX_GUEST_NAME_LEN) {
    out = out.slice(0, MAX_GUEST_NAME_LEN).replace(/ +$/, '');
  }
  return out;
}
