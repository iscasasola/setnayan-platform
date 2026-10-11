## 2026-10-11 · fix(maker): a failed request never replaces the Maker with an error screen — the couple's side

Owner, verbatim: *"make sure requests does not cause a crash"*. The database is on a small plan (a first call after
a quiet gap can take 3 s; once a day it stalls ~40 s) and phones drop signal. Three faults of one class — a failure
that takes the screen, says "this page doesn't exist", or renders as emptiness. Built, not live.

**1 · A press whose request never answered is said in place.** A server action awaited inside a transition with
nothing to catch it: when it rejects (offline, a 5xx) React rethrows it and `app/error.tsx` replaces the whole Maker —
canvas, tools and every unsaved field. Caught, each the way the draft bar already is (`hubDraftAnswer`), with the
words each control already had:

- `website/editor/_components/use-scene-canvas.ts` `useSceneCanvas.save` (a scene's Style · palette look · Venue map
  switch), `details-bound-field.tsx` `answer` (a scene's words — the paragraph stays in the box, the question stays
  open), `scene-style-row.tsx` `DressFiguresRow` → "Something went wrong. Please try again — your draft is kept."
- `pabuya/_components/pabuya-message-editor.tsx` `ShippedEditor.save` → "Could not save your message."
- `launch/_components/maker-tour.tsx` `finish` and `app/_components/guided-tour-card.tsx` `dismiss` (every panel's
  first-visit card) — nothing to say; the tour is offered again next time.
- Found by the scan, same fault, mounted in the Maker: `website/photo-moments/…/photo-moments-editor.tsx`;
  `details/_components/governed-fields.tsx` (`applyField` never throws; the ceremony switch; both conflict checks);
  `launch/_components/details-your-event.tsx` `saveDay`; `_components/address-pin-field.tsx` (Find);
  `pabuya/_components/pabuya-manager.tsx` `run`; `invitation/_components/slug-field.tsx` (the address — a redirect is
  still how that action answers and is let through); `app/_components/run-of-show-header.tsx` `onAdvance` (the list is
  re-read either way, so the rows show what is true before anyone presses again);
  `launch/_components/maker-theme-picker.tsx` (its wait on the save queue).

Strings added (each already used elsewhere in the app): "That did not save. Please try again." (governed rows, e-gift
methods, the address); "We could not check your booked suppliers just now. Please try again." (governed rows, new).

Guard: `apps/web/lib/a-failed-press-never-replaces-the-maker.test.ts` + `lib/transition-await-scan.ts` (TypeScript
parser). Every `await` in a function given to a transition — in `launch/`, `website/`, and every file the Maker's page
imports for its code — is in a non-rethrowing `try/catch`, ends in `.catch`, or awaits a function proved never to
reject; every `makerSave` / `makerRedrawSave` call's rejection is taken where it is written or by a named caller.
**Still open, listed in the test with ceilings** (other tools the Maker mounts): the seating plan (31 presses through
`runGated`, which rethrows), the floor plan's Save, the checkout drawer, the guest list's two invite presses (fixed on
`rd/c-requests-never-crash`), the schedule's Announce, the Mood Board's remove-a-photo, the Save the Date's launch ·
schedule · cancel. **Not covered at all:** plain `<form action={serverAction}>` posts — React runs those in a
transition of its own and there is no `await` in our source to find.

Not verified: a real phone, a real network drop, a real event; the Maker's first-load JS budget (no build was run —
the browser code added is `hubDraftAnswer`, already in the first load, and a few `try/catch`).

SPEC IMPACT: None.
