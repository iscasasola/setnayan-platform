/**
 * THE ONE SWITCH FOR THE CENTERED TIP POPUPS ("STEP 1 OF 2 · … · Back / Skip / Next").
 *
 * Owner, 2026-10-03: "also remove these since we will place the spotlight tour soon."
 * The interactive spotlight tour (corpus `prototypes/spotlight_tour_sample_2026-10-02.html`) is
 * the last build before the Apple check and replaces these. Until then NOTHING pops up.
 *
 * Off means off for all of them at once — `MiniTour` (~40 mounts), the role-welcome
 * `GuidedTour` in the dashboard / admin / supplier layouts, the guest `GuestGuidedTour`
 * (invitation page, Papic guest pages) and the `GuidedTourCard` itself as the last backstop.
 *
 * 🔑 The MOUNTS stay where they are and `lib/tours.ts` keeps every word: those words and keys
 * are the spotlight tour's script. A new feature adds its words to `lib/tours.ts` and mounts a
 * `MiniTour` as before — nothing shows until this is flipped (or the spotlight tour replaces it).
 *
 * ⚠ This is NOT the switch for a first-visit QUESTION that saves a choice (e.g. "Who can reply?"
 * on the guest list). Those are settings, not tips, and do not read this.
 *
 * Kept in its own tiny file, not in `lib/tours.ts`, so the client card and guest wrapper can read
 * it without shipping the tour words to the browser (`lib/tours-stay-on-the-server.test.ts`).
 */
export const TIP_POPUPS_ON: boolean = false;
