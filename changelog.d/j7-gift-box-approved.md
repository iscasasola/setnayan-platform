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

### 2026-11-16 · controller audit fixes (FIX-FIRST)

- **The ticket, the badge background and the drop-in reach the box.** `gift-moments.tsx` (couple Home, supplier Today) now passes `stage` (`stageFor`) and `arrive`. `arrive` is set for a badge's gift, and not for one re-opened from its waiting line. The lazily loaded `gift-moment-shown.tsx` passes the gift's reward `ticket`.
  - The ticket is the award kit's drawing (`ticketDataUri`, #7752), and the gift itself decides which one: `GiftMomentView.ticket`, built in `lib/gift-moment.ts`.
    - A supplier's Papic gift gets its pack's ticket, by credits. A plan gift gets its plan's ticket.
    - A badge reward gets its granted kind, plus the pack its step pays from the reward table. Its frame wears the tier's metal.
  - Named gap: a free booking fee has no ticket kind in the kit, so it opens on the lit lining.
  - The ticket art stays out of the page's first load.
- **An automatic claim never shows a false ✓.** A badge reward's card says "✓ In your gifts" only once the claim is confirmed, or when `claimedAt` already says so.
  - While the claim is out, the card reads "Claiming…".
  - A lost claim says "No connection — your gift is safe. It stays here until it goes through."; a refused one says so.
  - There is still no button (owner 15 Nov). The waiting line stays, and the next showing sends the same claim again.
- **The box's colours are tokens.** All 82 literal colours in `gift-box.module.css` and `close-x.module.css` are now `--sn-gift-*` tokens in `globals.css` (umber · glow · rose · night · black · white).
  - Each one has an explicit, unchanged `html.dark` pair, because the box is a drawn object and looks the same in every theme.
  - Alpha shades use `color-mix(in srgb, var(--sn-gift-…) N%, transparent)`. The picture is unchanged.
- The guard `the-gift-box-is-the-approved-one.test.ts` gains tests 6–8. Each new assert was sabotage-checked red.

SPEC IMPACT: None.
