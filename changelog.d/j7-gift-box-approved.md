## 2026-11-15 · feat(gifts): J7 — the gift box brought to the approved look

The badge build's J7 (corpus `plans/supplier_badges_build_plan_2026-11-15.md`), on the owner-approved contract
`prototypes/supplier_badges_2026-11-15/gift-box_APPROVED_2026-11-15.html` (DECISION_LOG 2026-11-15 "GIFT PAGE APPROVED" ·
"Gift box · APPROVED (confirmed)"). Only `app/_components/gift-moment/**` changes.

- **The realistic box** (`gift-box.tsx`, `gift-box-geometry.ts`, `gift-box.module.css`), ported face for face: a CSS-3D box
  with a lid, satin ribbon, double bow and a raised wax seal. **Setnayan's is gold foil** with the Setnayan mark embossed
  and on the wax; **a supplier's is terracotta, pressed with the shop's own logo** (initials when it has none). Tap → shake
  → the lid lifts and tips off, the ribbon slips, light from the lining, gold sparks + the shipped flash + confetti → the
  ticket rises out, goes up and over and lands big while the box steps back → the card rises.
- **A tap moves on** ("THE GIFT HAS NO BUTTONS"): a tap anywhere opens the box, and closes the gift once the card is up.
  No Done, no "1 of 2". "Tap to close" stays a real button in plain words, so a keyboard and a screen reader can close it.
- **The one ✕** (`close-x.tsx`, `FullscreenClose`): 44px round, top left inside the safe area, dark glass, ivory ring.
- **The badge's background** behind a badge's gift: navy rays for Verified, gold rays for a tier up.
- **Claiming** (e5ec685d point 2): a badge reward is **claimed automatically** when it shows — no Redeem, "✓ In your gifts";
  a couple's **Redeem of a supplier's gift keeps its press** ("Claiming…", "No connection — your gift is safe" + Try again,
  one claim). Both on the same once-only key.
- Every curve and length is a motion token; the box loads lazily with the popup; the reward ticket is passed in as a
  picture (the award kit's drawing, #7752), never re-drawn here. Zero new server actions, zero new routes.
- Guard: `app/_components/gift-moment/the-gift-box-is-the-approved-one.test.ts` (5 tests; 4 sabotages, each red).

SPEC IMPACT: None — builds the 2026-11-15 approved gift box as ruled.
