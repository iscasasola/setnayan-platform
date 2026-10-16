/**
 * apps/web/lib/art-kit-pro.ts — the art kit's PRICE SWITCH and its switch's reading, on their own.
 *
 * Split from `lib/art-kits.ts` (the registry: pieces, slots, the stylesheet) so the draft's pricing (`lib/hub-draft.ts`,
 * in the Maker's FIRST LOAD — `scripts/check-maker-js-budget.mjs`) and the Studio's switch can ask "is it Pro?" without
 * shipping every kit's pieces and placements to the browser. `lib/art-kits.ts` re-exports all of this.
 */

/**
 * 💎 IS A KIT PART OF EVENT HUB PRO? — ONE CONSTANT.
 *
 * Owner 2026-10-16, verbatim: *"the accents we added should be part of pro."* So: tried free in the Maker (the
 * canvas wears it), named "Decorations" at Apply, and on the guest page only while the event owns Event Hub Pro —
 * the event's unlock, so it covers everyone on the event, and an internal host counts (`eventSkuActive` →
 * `eventHostIsInternal`). A free event's guests see no decorations; the switch and the Maker's preview stay.
 *
 * Flip it to `false` and kits come free with their look — every reader follows; `the-vintage-art-kit.test.ts`
 * holds both values.
 */
export const ART_KIT_IS_PRO: boolean = true;

/**
 * The ornament keys (`InviteTheme.ornament`) that carry a kit — the registry's keys, held equal to
 * `Object.keys(ART_KITS)` by the guard, so the Apply sheet can say "with its Decorations" without the registry.
 */
export const ART_KIT_ORNAMENTS: readonly string[] = ['lace-postmark'];

/** The switch, read: NULL (never set) and TRUE are on — the kit comes with the look; only FALSE is off. */
export function decorationsOn(stored: unknown): boolean {
  return stored !== false;
}

/**
 * Is a drafted Decorations value a Pro change at Apply? Only turning it ON (or leaving it as the look brings it) is
 * — turning it off is never Pro.
 */
export function decorationsChangeIsPro(value: unknown, isPro: boolean = ART_KIT_IS_PRO): boolean {
  return isPro && decorationsOn(value);
}
