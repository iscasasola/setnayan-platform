## 2026-10-25 · feat(frontdoor): signed-out hero is Option B, told truthfully

Owner approved Option B of `prototypes/ceremo_deltas_2026-10-25/01_front_door.html` with an honesty fix
("don't they pay for papic?" · "unlimited camera but papic credits is used" · "free 50 credits is only on
their first event" · "DO NOT INVENT … we want to tell the truth").

- Headline: "Plan any event free. Every photo in one album." (no "never lose a photo" / "Keep every photo";
  home `<title>` and description follow).
- Sub-line keeps the "Setnayan is …" purpose sentence Google's OAuth review needs, plus the Taglish pain line.
- Trust chips: Free to start · No guest limit · No credit card · Guests don't sign in; one line under them:
  "Unlimited cameras · photos use Papic credits." (no amounts).
- Before → After strip (scattered photos → one album), drawn tiles with no invented counts.
- Main button is terracotta (`.fd-btn-terra` on `--m-mulberry`), not the gold — owner: "for setnayan use our template".
- "Start your event — free" opens the new public picker `/start` (owner: type choice BEFORE sign-up). It is the
  shipped create-event grid (`EventTypePhotoPicker`) over the same roster (`getCreatableEventTypes`); every tile goes
  straight to its own `/onboarding/<type>` — owner: "Yes they can create an event. But saving an event must link by
  logging in." Each onboarding keeps its account gate at the save. Signed in, `/start` redirects to `/dashboard/create-event`.
- Where a tapped type goes is one shared rule, `onboardingRouteFor` (+ `startHrefFor` for `/start`), now used by the
  signed-in picker too (behaviour unchanged there).
- "How it works" → `/features` (was the `/our-story` manifesto) — on the hero AND the signed-out rail row, so both doors match; `the-rail-lists-no-tools.test.ts` now counts the one Features row by its name and pins the rail row.
- New top-level segment `start`: `public/sw.js` RESERVED, `lib/reserved-slugs.ts` (generator), telemetry
  `TOP_LEVEL_SEGMENTS`; prod measured 0 event/shop slugs named "start".
- Guard: `app/_components/frontdoor/the-front-door-tells-the-truth.test.ts` (seen failing against origin/main, 5/5).
- `lib/ugat/screens.generated.json` regenerated (new /start screen; the button's door moved off /onboarding/wedding).

SPEC IMPACT: DECISION_LOG.md rows 2026-10-25 (front door Option B + honesty fix + terracotta main button; public /start picker before sign-up, saving links by logging in; How it works → /features).
