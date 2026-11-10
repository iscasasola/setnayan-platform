## 2026-11-10 · feat(onboarding): "Name your wedding" is asked · "Not decided yet" lives inside the dropdown (Build 5 Lane P, slice 2)

Owner, 10 Nov: *"we want the event name to be set on the onboarding. And the other required parts so when
they login, and enter."* · on "What kind of wedding?": the two dropdowns were bare pills of different widths
and "Not decided yet" a third control. Step 0 rows 36–37; prototype `onboarding_every_step_2026-11-10` § B 2–3 of 10.

- **New step `w_eventname` — "Name your wedding"**, right after the names: prefilled from them through the one
  composition (`joinCoupleNames`, the first person first — "Claire & Indalecio"), editable, the Event Hub address
  (`setnayan.com/<slug>`) shown under it. `OnboardingState.eventName` is null while it follows the names, the
  couple's own words once typed. The commit sends exactly what the step showed; `wedding/actions.ts` writes it to
  `events.display_name` through `cleanDisplayName` (the names as the fallback) and seeds the slug from it as
  before. Nothing new in the schema. The prototype's live "Available" badge is NOT drawn — no client-side slug
  check exists, and `generateUniqueSlug` may add a number at the commit; a badge would claim what nobody checked.
- **What kind of wedding?** on the shared parts: Ceremony and Church are labelled full-width `StepPick`s;
  "Not decided yet" stays inside the Ceremony list (`CEREMONY_CHOICES`) and the outlined quick pill is gone.
- Guards: `lib/onboarding/the-wedding-is-named-in-onboarding.test.ts` (fails on slice 1); the template guard
  grows to w_eventname + w_kind and refuses a `quick=` pill beside a field; the order test counts 13 cards.

Left: the date dropdown ("One date — or up to 4 · A flexible window · Not decided yet"), "Your venue" with
"Not booked yet", budget's "Not decided yet", the recap's event-name title, and the remaining wedding / generic /
simple / sign-up steps onto the shared parts.

SPEC IMPACT: None — builds the approved prototype.
