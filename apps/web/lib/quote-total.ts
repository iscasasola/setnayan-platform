/**
 * WHICH NUMBER IS THE QUOTE'S TOTAL — the one rule, for the server and the
 * composer that previews against it.
 *
 * ── THE DEFECT THIS EXISTS TO MAKE IMPOSSIBLE ───────────────────────────────
 * The in-chat composer (`send-proposal-card.tsx`) offers a template, an
 * optional package, and a Price field. It is NOT the case that the Price field
 * is the total: `sendProposalCore` takes the PACKAGE's price when there is one
 * and falls back to the typed figure only when the package total is 0 — and the
 * package can arrive from `template.default_package_id` even when the supplier
 * left the selector on "No package — set a price below".
 *
 * On 2026-09-15 a gift preview was added to that card sized off the TYPED field.
 * Measured against the real send path, a supplier picking a ₱120,000 package and
 * typing 45000 was shown "1,786 free Papic photos … ₱900" while the bill charged
 * ₱2,080 for 4,880 photos — agreeing to one number and being invoiced 2.3× it.
 * With the Price field left blank (its documented normal use alongside a
 * package) the preview resolved to zero and the block rendered NOTHING, while
 * the bill still carried a real charge: "show both" showing neither.
 *
 * 🔑 THE PREVIEW WAS NOT WRONG BY A ROUNDING — IT WAS READING A DIFFERENT FIELD.
 * Both sides were internally consistent, which is why every test passed: the
 * composer's guard asserted it called the preview, and the preview's guard
 * compared the preview to itself. Neither could see that the call site handed
 * it a figure the server discards. That is the same shape as the Papic share
 * weight and the Ninong seating tier earlier the same day — two mechanisms
 * agreeing with each other while both describe the wrong thing.
 *
 * So the rule now lives HERE, once, and both the writer and the previewer call
 * it. Drift is not guarded against; it is unavailable.
 */

/**
 * The total a proposal will actually be sent and billed at, in whole centavos.
 *
 * @param packageTotalCentavos the resolved package's own price, or 0/null when
 *   no package prices this proposal. ⚠ Includes the package a TEMPLATE supplies
 *   through `default_package_id` — resolve that before calling, exactly as
 *   `sendProposalCore` does, or the caller reproduces the original bug.
 * @param typedPhp the Price field, in PESOS as typed (may be '' / NaN).
 *
 * Returns 0 when neither is usable — callers must treat 0 as "no total yet"
 * and say nothing about money, never quote zero.
 */
export function resolveQuoteTotalCentavos(
  packageTotalCentavos: number | null | undefined,
  typedPhp: number | string | null | undefined,
): number {
  const pkg = Number(packageTotalCentavos);
  // The package wins whenever it prices anything at all.
  if (Number.isFinite(pkg) && pkg > 0) return Math.round(pkg);
  const typed = Number(typedPhp);
  if (!Number.isFinite(typed) || typed <= 0) return 0;
  return Math.round(typed * 100);
}
