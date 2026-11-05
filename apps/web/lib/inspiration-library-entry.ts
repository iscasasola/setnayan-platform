/**
 * lib/inspiration-library-entry.ts — THE ONE WAY IN to the supplier's inspiration library, worded once.
 *
 * 🌱🖼 Owner 2026-10-19 (DECISION_LOG "SUPPLIERS FILL THE INSPIRATION LIBRARY WITHOUT AN EVENT"): *"first, we need to
 * allow the suppliers to fill up the inspiration board even if it has not come from an event. to help us create more
 * inspirations faster"* → *"go"*. The library already shipped (`/vendor-dashboard/moodboard-library`, MB10/MB11/MB21)
 * and was measured with 0 supplier photos — it sat one fold deep in Shop's tool shelf. So the SAME row is drawn on
 * Today (the Shop group) and on Shop (Your shop, under Your collections), each only when the shop's trades supply a
 * part (`moodboardLibraryAccessForProfile`). One line of why, in plain words.
 *
 * Pure strings — client- and server-safe.
 */
export const INSPIRATION_LIBRARY_HREF = '/vendor-dashboard/moodboard-library';

export const INSPIRATION_LIBRARY_ROW = {
  label: 'Add to the inspiration library',
  line: 'Your photos help couples find you',
} as const;
