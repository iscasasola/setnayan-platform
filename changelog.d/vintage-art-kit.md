## 2026-10-16 · feat(event-hub): the Vintage art kit — painted pieces in fixed slots, one Decorations switch, Event Hub Pro

Owner, 2026-10-16 (DECISION_LOG "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS"): *"Approved — build the
vintage art kit as the proof shows (decorations come with the Vintage look, with an On/Off switch)."* Pricing, the
same evening: *"the accents we added should be part of pro."*

- **Registry** `apps/web/lib/art-kits.ts` — `ART_KITS`, keyed by the theme's existing `ornament` hook (Vintage:
  `lace-postmark`), typed by slot. Every placement is data — piece + slot + scene + box + motion — so a later per-scene
  picker writes into the same shape. `artKitShows()` is the one decision (resolved theme · switch · Pro · Maker try-on).
- **Price switch** `apps/web/lib/art-kit-pro.ts` — `ART_KIT_IS_PRO = true`: tried free on the Maker canvas, named
  "Decorations" at Apply (its own line when switched on; "Theme · Vintage, with its Decorations" on the theme's line),
  shown to guests only while the event owns Event Hub Pro (`websiteProActiveFor`, an internal host included). Off is
  always free. Kept out of the Maker's first load.
- **Drawing** `app/[slug]/_components/kit-piece.tsx` — `KitPiece` (`<picture>` AVIF → WebP, `loading="lazy"`,
  `sizes`), `KitSlot`, `KitSeal`, `KitClosing`, `KitStyle`; `art-kit-motion.tsx` marks a piece on screen so Sway/Float
  run only while seen; reduce motion takes the animation off. Mounted at: the veil (seal — deaf to the pointer, so its
  tap IS the veil's own unveil), the cover (drapes + araña, laid UNDER the words: the clipped-top-line nit), the
  countdown card (posts), the e-gifts bank card (spray + abaniko) and the divider above it, the reply card (garland),
  and the sign-off (the couple's own cover photo in the oval — an ellipse fitted to the frame's opening, the second nit
  — "See you soon.", the Narra Brown band, the Powered-by line unless `hideWatermark`). The heading flourish replaces
  the eyebrow rule; flourish + divider ship as SVG. Every mount takes `null` → byte-identical page.
- **Storage** `events.site_decorations BOOLEAN` (migration `20271270281258_events_site_decorations.sql`): NULL/true =
  on, false = off; SELECT + UPDATE to `authenticated`, nothing to `anon`, `events_host` rebuilt; drafted in the Maker
  (`HUB_DRAFT_LOOK_COLUMNS`), applied through the host's session.
- **Studio › Look › Elements**: one "Decorations" `SwitchRow` (◆ Event Hub Pro for a couple without it), only for a
  look that brings a kit.
- **Assets** `public/art-kits/vintage/` — the proof's eight Higgsfield cut-outs re-cut dark-safe (the contact shadow is
  now a true shadow; the generator's white board under the garland, the spray's card lip and the araña's floor pool are
  gone), plus the two SVG hairlines. The church drawing is not in the kit (the venue-card build owns it).
- **Lab** `/dev/art-kit-lab` (dev only): the kit on a guest page with no database — `?decor=0`, `?free=1`, `?veil=1`,
  `?photo=0`, `?ground=dark`.
- **Guard** `apps/web/lib/the-vintage-art-kit.test.ts` — Vintage only, switch off = no markup, the Pro constant both
  ways, reduced motion, ≤ 600 KB (each piece ≤ 80 KB), the seal's tap, the closing's photo.

SPEC IMPACT: None — the approval and the pricing ruling are already recorded in the corpus DECISION_LOG row
"APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS".
