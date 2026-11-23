/**
 * supplier-toolkit-count.ts — the ONE spelling of how many tools and templates a supplier gets (owner, 23 Nov 2026:
 * "put 390+ tools and templates on /for-suppliers").
 *
 * The figure is a floor, never a guess: `the-toolkit-claim-is-true.test.ts` recounts what the code ships and fails
 * the moment the count falls under `TOOLKIT_CLAIM_FLOOR`. What it counts (census, specs
 * `prototypes/toolkit_templates_2026-11-23/` Notes view):
 *   · the starting "What's included" card templates the admin keeps (`service_included_templates` seed);
 *   · the distinct payment splits (the quote maker's `PLAN_PRESETS` with chat's `NEGOTIATE_PLAN_PRESETS`);
 *   · `SPECIALIZED_TOOLS`, plus the shipped `HUB_TOOL_LIBRARY` tools that are not one of them;
 *   · the performance graphs (`CARD_ORDER`), the shop badge families, the QR modes, the print designs and pieces;
 *   · the availability styles a card can pick today.
 * A few of these are on a plan (Cake Maker, Song bank, Papic challenge, 3D plan), so the line never says "free".
 * Scanner modes, quick replies, status presets and table shapes are left out, so the floor stays honest.
 */

/** The lowest count the claim may stand on. Raise it only with the test's recount. */
export const TOOLKIT_CLAIM_FLOOR = 390;

/** The words a person reads. */
export const TOOLKIT_CLAIM = `${TOOLKIT_CLAIM_FLOOR}+ tools and templates`;
