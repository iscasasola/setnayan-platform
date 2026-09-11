/**
 * shopInitials — the one shared monogram helper for a shop/vendor card with
 * no logo. Several call sites hand-rolled the same two lines:
 *
 *   const parts = name.trim().split(/\s+/).filter(Boolean);
 *   ... parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0) ...
 *
 * which takes the literal first CHARACTER of the first and last
 * whitespace-separated word — punctuation, symbols and brackets included.
 * "Saysay Live Band & Hosting (FIXTURE)" split on whitespace is
 * ["Saysay","Live","Band","&","Hosting","(FIXTURE)"], so the old helper took
 * "S" (Saysay) and "(" (the first character of "(FIXTURE)") and rendered the
 * monogram "S(".
 *
 * This version tokenizes on Unicode letters/digits only — `\p{L}\p{N}+`, so
 * "Ñoel", "123 Party Co." and "Saysay Live Band & Hosting (FIXTURE)" all
 * yield real tokens ("Ñoel"; "123","Party","Co"; "Saysay","Live","Band",
 * "Hosting","FIXTURE") and punctuation/symbols/"&"/brackets are never
 * candidates for a character. It takes the first character of the first two
 * tokens (falling back to the first two characters of a single token) — for
 * "Saysay Live Band & Hosting (FIXTURE)" that's "S" + "L" = "SL", the
 * business's own first two words, not a stray trailing "(FIXTURE)" artifact.
 *
 * Always returns exactly `maxChars` (default 2) letters/digits, or
 * `fallback` when the name carries nothing alphanumeric at all.
 */
export function shopInitials(name: string, maxChars = 2, fallback = '·'): string {
  const tokens = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return fallback;
  if (tokens.length === 1) {
    return tokens[0]!.slice(0, maxChars).toUpperCase();
  }
  let out = '';
  for (let i = 0; i < tokens.length && out.length < maxChars; i++) {
    out += tokens[i]!.charAt(0);
  }
  return out.toUpperCase();
}
