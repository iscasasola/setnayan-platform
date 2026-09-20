/**
 * apps/web/lib/monogram-mark-choice.ts
 *
 * WHICH mark is live — the one they designed, or the one they uploaded — when
 * a couple has both.
 *
 * ── THE PROBLEM THIS SOLVES ───────────────────────────────────────────────
 * `resolveEventMonogramSvg` prefers an uploaded mark over a designed one, and
 * until now the ONLY way back to the designed mark was "Remove upload", which
 * nulls `monogram_uploaded_svg` — it deletes the couple's file. So a couple who
 * wanted to see their designed mark again had to destroy the uploaded one and
 * re-upload it to change their mind back. There was no way to hold both and
 * choose, and no screen that showed them side by side (owner 2026-09-20:
 * "why don't i see the comparison of the create your own and upload a logo").
 *
 * ── THE STAMP, AGAIN ──────────────────────────────────────────────────────
 * The choice rides on the mark, as `data-mark="off"` on the uploaded SVG's root
 * tag — the same mechanism as `data-ink` (lib/monogram-ink.ts) and for the same
 * reason: the dozen-odd read sites do not agree about which `events` columns
 * they SELECT, so a choice stored in a new column or in
 * `monogram_studio_config` would be invisible to half of them and the couple's
 * mark would differ between the hero and the QR code.
 *
 *   absent / anything else  → the uploaded mark is LIVE (the default, so every
 *                             mark uploaded before today is unchanged)
 *   data-mark="off"         → keep the file, but render the DESIGNED mark
 *
 * Nothing is destroyed either way, so switching is reversible in one tap and
 * "Remove upload" goes back to meaning what it says: delete the file.
 */

/** Does this uploaded mark say "keep me, but don't use me"? */
export function isUploadedMarkOff(svg: string | null | undefined): boolean {
  if (!svg) return false;
  // Only the FIRST <svg> tag speaks for the mark — a nested <svg> inside the
  // artwork must not be able to switch the couple's monogram off.
  return /^<svg[^>]*\sdata-mark="off"/i.test(svg);
}

/**
 * Stamp (or clear) the "don't use me" marker on an uploaded mark.
 *
 * `off = false` REMOVES the attribute rather than writing `data-mark="on"`, so
 * the live state is always the absence of a marker. One representation for
 * "live" means a mark uploaded before this existed and a mark switched back on
 * today are byte-comparable, and no read site has to know two spellings.
 */
export function setUploadedMarkOff(svg: string, off: boolean): string {
  if (!svg) return svg;
  return svg.replace(/^<svg([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\sdata-mark="[^"]*"/gi, '');
    return off ? `<svg${cleaned} data-mark="off">` : `<svg${cleaned}>`;
  });
}

/** The two things a couple can choose between on the chooser. */
export type MarkChoice = 'upload' | 'studio';

export function isMarkChoice(v: unknown): v is MarkChoice {
  return v === 'upload' || v === 'studio';
}
