## 2026-11-10 · feat(open-shop): Claim it fills Owner · equal-width choices · per-event services behind "Customize" (Build 5 Lane P, slice 3)

DECISION_LOG 2026-11-10 "CLAIM DOOR AND 'EVENTS YOU SERVE'…" — the owner's three notes, approved in the
onboarding prototype (Claim · 1 of 6, 2 of 5 · page 2, Claim · 6 of 6).

- **Claim it** (`claim-door.tsx`): the invite slide's bar verb "Confirm — continue" becomes **Claim it**; pressing
  it fills "Your role at the shop" with **Owner** (`CLAIM_OWNER_ROLE`, never over a typed role) — the draft
  (`claimDraftKey`) carries it through Google / Apple. The account slide shows it in plain ink, still editable,
  with "You pressed Claim it, so you run this business." and no "optional" word; typing makes it theirs. Same
  column (`contact_position` → `business_owner_position`).
- **Sign in & claim · I'm not this supplier** are one row at equal widths (`useFitRow`, one state for the row).
- **Events you serve** (`open-shop-wizard.tsx`): the label above, Select all · Clear one equal-width row under it;
  "What you offer at each event" (`ServicesAtEvents`) is shut behind one `Fold` — "Different services for some
  events? · Customize" — and opens by itself while a service is on for no ticked event, so the refusal is never
  behind a closed fold. `evOff` and the posted form are unchanged.
- Guard: `app/open-shop/the-claim-it-fills-owner.test.ts` (fails on the previous commit); `the-claim-door.test.ts`
  now pins "Claim it".

Left: the account slide's "Use another way · Sign in & claim" equal row; open-shop "In business since" and the
`hq_address` write fix (section F/G of the prototype).

SPEC IMPACT: None — builds the approved prototype and ruling.
