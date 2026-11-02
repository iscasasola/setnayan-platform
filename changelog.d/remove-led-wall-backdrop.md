## 2026-08-11 · feat(led): remove the LED wall backdrop — it was sold and could never be delivered

**Owner decision, 2026-08-11: "remove wall backdrop."** Presented with (A) take the
promise down, (B) deliver a smaller file the browser can make, or (C) build a server
render farm, the owner chose removal.

### What was wrong

A couple paid ₱1,000 for the Animated Monogram, was told the LED backdrop was included,
designed a loop, and pressed **"Save draft & queue for render"**. Nothing was ever made.
Ten in-app screens plus the public features page (EN **and** TL) promised a 7680×4320 H.264
master loop and a USB stick in the post.

Verified against `origin/main` and the live database on 2026-08-11 — not against a doc:

| claim | measured |
|---|---|
| `led_background_renders` writers / readers | **0 / 0** across `apps/`, `packages/`, `scripts/` |
| `led_background_renders` · `led_background_configs` rows in prod | **0 · 0** |
| worker dir · wrangler config · Remotion · server ffmpeg | **none** (`@ffmpeg/ffmpeg` is the WASM build, runs in the browser) |
| generic `render_jobs` | inert — one test reference, 0 rows |
| `orders` in prod | **0** — nothing has ever been bought, so nobody is refunded |

The maker's own success screen already hedged ("the 8K render pipeline ships shortly"),
while the sell copy above it promised delivery in the present tense. One flow, two
stories, no file.

### Removed

- Route `/dashboard/[eventId]/studio/led` (page + loading + maker component), the
  `/api/led-background/save` endpoint, and `lib/led-background.ts`.
- The `LIVE_BACKGROUND ← ANIMATED_MONOGRAM` ownership alias — **the line that made a
  ₱1,000 purchase include an undeliverable backdrop** — plus `LIVE_BACKGROUND` from the
  `MEDIA_PACK` code-side bundle list (its database row goes in the same migration).
- The `led` add-on card, its `/about` detail entry, its studio-addon blurb, its App Store
  demo scenes and demo media (`led.mp4` / `led.jpg`), and its route entries in `routes.ts`.
- The **Pailaw** card from the public `/features` page — from `META` and **both** locale
  copy arrays.
- Migration `20271132121622`: deletes 3 live `vendor_service_recommendations` rows that
  pitched it to vendors, deletes the `MEDIA_PACK` bundle row, pins the catalog row
  `is_active=false`, and drops both (empty) tables. No other FK, view or matview depends
  on them — checked in prod.

### Kept, deliberately

**Hiring an LED wall vendor is real and still works.** `led_background` is also a couple
PLAN item and `led_wall` a taxonomy tile. Only the *Setnayan-made* backdrop is gone; the
plan-item copy in `wizard.ts`, `todays-one-thing.ts` and `wedding-plan-groups.ts` was
rewritten to stop claiming Setnayan renders the loop. That plan item's `subcategoryHint`
moved from `setnayan_pailaw` (a first-party leaf for a service we no longer offer, which
would find a couple nobody) to `led_video_wall`, the real rental leaf under the same tile.

`ledPaletteFromMoodBoard` survives in `site-palette.ts`: the Dance-Floor Mural reuses the
same math and is now its only caller. Its comments were corrected rather than its name.

### 🔑 A comment promising lockstep is not lockstep

`_DayOfApparatus.tsx` zips `META` with `COPY.en.services` and `COPY.tl.services` **by
index**, and said so in a comment ("Keep both arrays in lockstep") — but there were
*three* arrays and nothing checked them. Dropping a service from one and not the others
does not error; it prints the next service's words under this one's icon and brand name,
which reads as a real, wrong product. Replaced with a module-level check that fails
`next build`. Static data, so it can never throw for a visitor.

### ⚠ Named debt, not smuggled in

`setnayan_pailaw` remains in the vendor service tree. Removing a taxonomy leaf reshapes
the tree and can strand shops that selected it — a separate, riskier change.

SPEC IMPACT: `0005_led_background_maker/` is retired as a product. `DECISION_LOG.md` row
added 2026-08-11; the corpus `CLAUDE.md` iteration table row for 0005 is annotated.
