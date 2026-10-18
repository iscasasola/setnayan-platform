## 2026-10-18 · feat(onboarding): Level 1 — "What do you need?" opens every shipping type's onboarding; what an event leaves off is absent

Owner 2026-10-08 (DECISION_LOG "ONBOARDING FOLLOWS WHAT THE EVENT NEEDS", "ROADMAP AMENDED … LEVEL 1"); design
EVENT_COVERAGE_MATRIX_2026-10-08_fable.md §2–§3 + prototype event_needs_onboarding_2026-10-08_fable.html frames 2–4.

- **Every one of the 20 types completes onboarding on the one engine.** Migration `20271276545380` seeds the setup
  five (guest word · gifts mode · team first · look set · camera default) for the 15 types that still walked the
  12-screen quiz (debut · gender_reveal · celebration · travel · corporate · tournament · christening · anniversary ·
  graduation · reunion · gala_night · wake · concert · open_house · grand_opening) — only rows still NULL.
- **"What do you need?"** (`app/onboarding/_shared/needs-step.tsx`) is the first screen of `/onboarding/[type]` and
  the Get-together form: name · where · when (Simple shape) · ONE preset dropdown (Simple event · Open event, one QR ·
  Guest list + replies · Fully planned — the type picks it, `lib/event-needs.ts`) · five rows (Papic always on). The
  Simple shape makes the event right there; other presets continue to the shipped cards. The type's limit line
  (matrix §1b) sits under the title. Wedding keeps its own wizard.
- **Three needs, three columns** (`events.guest_list_on` · `suppliers_on` · `hub_details_on`, NULL = on, host
  SELECT/UPDATE grants, `events_host` rebuilt). The commits re-read them (`sanitizeNeeds`) and the reply / one QR /
  guests card follow them (`applyNeedsToSetup`).
- **Off is absent:** the bottom bar drops Guests / Suppliers; Home drops their doors, guest numbers and money, never
  offers "Add your guests" / "Finish your Event Hub" to an event that left them off, shows "One QR for everyone", and
  ONE "Switch on more" row (`switch-on-actions.ts`, +1 server action); the Maker drops the stages (cover + photos =
  The Day only; no list = no Save the Date / RSVP) and Studio tiles (Info · Look only; no list = no RSVP).
- Dev labs: `/dev/onboarding-lab?type=`, `/dev/home-lab?needs=`, `/dev/maker-lab?studio=1&needs=`.

SPEC IMPACT: DECISION_LOG row wanted (controller): Level 1 onboarding built as above, with the builder's calls named in
PR body (needs as three columns; When only on the Simple shape; Save the Date kept on "Guest list + replies"; looks per
type; Mood Board level + per-type dress default NOT built — needs a frame).
