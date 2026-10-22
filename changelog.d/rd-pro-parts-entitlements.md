## 2026-10-22 · feat(pro): Event Hub Pro, part by part — catalogue rows, per-part entitlements, the cap, every gate mapped (PR 1 of 3)

Owner rulings 2026-10-22 ("yes" / "yes to all") on the approved prototype
`prototypes/pro_part_by_part_2026-10-22.html` and the gate inventory
`shots-2026-10-22/pro-gates/PRO-GATES.md` (37 gates → 11 parts).

- **Catalogue** — migration `20271282742262_event_hub_pro_part_by_part.sql` inserts eleven
  `COUPLE_HUB_PART_*` rows at the owner's prices (BIG ₱1,000: Reveal · Background · Photos ·
  Style · Motion; SMALL ₱500: Logo & QR · Music · Prints · Post Event · Your own scenes ·
  Custom address), on sale, with NO sign-up price (onboarding keeps its one Full Pro offer).
  Full Pro (`COUPLE_WEBSITE_PRO`) is untouched. No price is typed in product code.
- **One table** — `lib/hub-parts.ts`: the eleven parts, the 37 gates each with exactly one
  home (a part, `full` = the footer only, or `free` = every guest's ticket and the
  all-guests QR sheet), the draft's units → their part, the cap and ✓ Apply's button rule.
- **Ownership per event** — `eventHubOwnership` / `eventHubPartActive` / `eventOwnsHubPart`
  (`lib/couple-website-pro.ts`): Full Pro through the whole chain (order, basket, bundle,
  comp, internal/founder host) is everything; each part by its own order or comp; THE CAP —
  the paid part orders at their catalogue (web) price, each once; reaching the Full Pro price
  is everything, footer included. `eventCoupleWebsiteProActive` now means everything (Full
  Pro or the cap). One read per render (`askedOnce`).
- **Every gate asks its part** — look writers (`requireLookPro` / `lookProAllows` now take a
  part), the Maker's ✓ Apply (`planHubDraftApply` asks each drafted item for ITS parts; a scene
  holding an owned and an unowned part writes the owned half now), the Apply sheet's effects
  (each tagged with its one part; the camera/QR/blocks blob and the RSVP look split one line
  per part), the guest page (theme → Style, page ground and effects → Background, Decorations
  → Style, Scrub → Motion, the film's song/film/gallery → Music/Reveal/Photos), uploads 500 MB
  → Background, QR look → Logo & QR, animated logo → Logo & QR, reveal openings → Reveal,
  prints → Prints, scenes of your own → Your own scenes. The footer alone asks for everything.
- **Existing Full Pro owners own every part** (the chain answers first); nothing they have
  changes. No UI changes in this PR beyond what the gates need — the Apply sheet, the parts
  page, the quiet line, Studio nesting and the custom address are PR 2; Apple products and
  the Animated Monogram retirement/alias are PR 3.

Guards: `lib/hub-parts.test.ts` (37 gates → one home each; the cap; the three button
frames; through the ONE gate, owning a part releases exactly that part — per part),
`lib/every-pro-gate-names-its-part.test.ts` (every look gate names a part literal;
"everything" asked only where it is the answer, each file with its reason; no price typed),
`tests/db/event-hub-pro-parts-and-the-cap.db.test.ts` (rows at the owner's prices; the cap on
real order rows read through `event_entitlement_facts`: ₱4,500 no, ₱5,000 yes, refund takes
it back, a part twice counts once, a submitted order owns nothing yet).

SPEC IMPACT: corpus `DECISION_LOG.md` row "EVENT HUB PRO, PART BY PART" (2026-10-22) — the
owner's rulings; and the 2026-10-02 d14 "Event Hub Plus ₱2,500" line struck as superseded.
