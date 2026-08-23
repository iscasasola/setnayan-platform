/**
 * HOW LONG IS THAT CLIP — the one place the number becomes words.
 *
 * Pure module — no DOM, no env, no clock. Runs under `tsx --test`.
 *
 * The canvas maker's card face carried a pill reading `▶ clip` while the
 * browser had ALREADY measured the file: `ShowcaseMediaFields` probed the
 * duration to enforce the 30-second cap and then dropped it on the floor. The
 * pill was a placeholder standing in for a fact nobody had to look up.
 *
 * ── FLOOR, NEVER ROUND ──────────────────────────────────────────────────────
 * The picker accepts up to `SHOWCASE_VIDEO_MAX_SECONDS + 0.9` because container
 * metadata rounds a true 30.0s clip up. Rounding for DISPLAY would then print
 * `0:31` on a card whose own label says the cap is 30 seconds — the product
 * contradicting itself over a metadata artefact. Flooring prints `0:30`, which
 * is what every media player shows and what the vendor's own editor showed
 * them. It also never overstates the length of somebody's work.
 *
 * ── NULL IS AN ANSWER ───────────────────────────────────────────────────────
 * A codec the browser cannot probe yields `null`, and `null` must stay visible
 * as "unknown" all the way to the pill. Substituting 0, or the cap, or the last
 * file's number would be a fabricated fact about the vendor's clip — the pill
 * falls back to the placeholder instead. Same reason the validator fails open.
 */

/**
 * `24` → `'0:24'` · `95` → `'1:35'` · `null`/NaN/∞/negative → `null`.
 *
 * `null` means "we could not read it" and callers must render the placeholder,
 * never a zero.
 */
export function formatClipDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * What the card's clip pill says, after the `▶`.
 *
 * The placeholder is deliberately the word, not a zero: a vendor who sees
 * `▶ 0:00` reads it as an empty or broken upload.
 */
export function clipPillLabel(seconds: number | null | undefined): string {
  return formatClipDuration(seconds) ?? 'clip';
}
