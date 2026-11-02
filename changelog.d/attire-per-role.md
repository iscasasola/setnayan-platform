## 2026-10-16 · feat(attire): each role wears its own designs — 45 drawings, colour zones, fixed dots, up to five guest options

Owner, 2026-10-16 (DECISION_LOG: "APPROVED — ATTIRE COLOUR ZONES…", "GUESTS: UP TO FIVE COLOUR OPTIONS…", "EACH ROLE HAS
ITS OWN LIST OF DESIGNS…", "APPROVED — THE 15 ROLE DRAWINGS", "APPROVED — ALL 45 ROLE × DESIGN DRAWINGS"): *"Approved —
use all 45 drawings and start the per-role attire build."*

- **Art** — `apps/web/scripts/build-role-attire.py` cuts the 45 approved drawings (controller
  `attire-figures/role-prompts/`) from white, neutralises every recolourable zone to white with its shading kept, and
  writes one alpha mask per zone (`public/attire/roles/<role>-<design>[-a|t|s|v|p].webp`; 45 drawings 6.2–9.2 KB, 85
  masks 0.3–6.2 KB, 535 KB in all). Props (bouquet, fan, candle, veil, pillow, box, basket, clutch, boutonnière), skin,
  hair and shoes are in no zone.
- **Data** — `lib/attire-designs.ts`: each role's Wear ▾ list (the decision row's table, word for word), the drawing
  per role × design, the row → column roles. The stored shape is unchanged — `ATTIRE_STYLES` grew by eight designs
  (3-piece suit, Tuxedo, Vest and tie, Vest and bow tie, Ball gown, Mermaid, A-line, Tulle dress). Old Wears read into
  the role's design (`designOf`): its own word as is; `formal` → Tuxedo (men) / Long gown (women); a boy's `suit` →
  Vest and bow tie (what the old boy's-suit figure drew); anything else "Not said yet".
- **Zones** (`DESIGN_ZONES`, lib/attire-figures.ts) — Suit: Coat & pants · Tie · Shirt; 3-piece: + Vest; Tuxedo:
  Jacket · Bow tie · Shirt; Vest and tie / Vest and bow tie: Vest & pants · Tie/Bow tie · Shirt; Barong: Barong · Pants;
  Smart casual: Shirt · Pants; gowns, ternos and dresses one colour. Defaults: tie = garment ×0.72, shirt white, vest =
  garment, barong pants #33302C, chinos #C9AD7E (the approved prototype's).
- **Studio › Mood Board › Attire** — an entourage role shows one labelled dot per zone and no "+"; guests show one
  figure per colour option with its dot, "+" up to five. **Guest page** — rows, "You are …" and the checklist name the
  design in the role's own words and draw the zones.
- **Caps** — `PALETTE_LIMITS.guest.max` 6 → 5 and the women's own guest options 5 (owner: "max of 5"); `groom.max`
  3 → 4 (a 3-piece is four zones).
- Build calls (recorded, not asked): the 3-piece vest is dot 4 (the approved rule keeps dot 2 tie, dot 3 shirt);
  a best man whose groomsmen wear a design he has no drawing of is drawn as a groomsman; rows with no list of their own
  (celebrant, Nikah principals, officiants & readers) keep the shipped seven; the older dress-code form keeps listing
  every word so a stored design round-trips.
- Guards: `lib/each-role-has-its-own-designs.test.ts` (the table, old data, the masks decoded, fixed dots and no "+",
  the five-option cap, the art budget); the #6587 guards updated to the role lists.

SPEC IMPACT: None — implements the five 2026-10-16 DECISION_LOG rows; the build calls above are listed for the owner.
