## 2026-07-24 · feat(live-studio): Roam multi-channel controller + purchase path

Owner: "Fix Live Studio Roam so a host can actually set it up and buy it."
Roam (the multi-camera "guests pick which camera / wander the venue" variant of
Live Studio, ₱3,500/day, `LIVE_STUDIO_ROAM`) had a data layer + public picker +
provisioning spine, but **no buyer path** (the SKU was `is_active=false`, which
the generic retirement guard rejects) and **no controller** (the tile fell
through to the generic `/studio/[addon]` placeholder → `notFound`). This wires
both, additively, still fully behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`.

- **Controller** — new `/dashboard/[eventId]/studio/live-studio-roam/setup`
  where the host names each channel (camera/angle/room/venue), groups them by
  venue, marks the default (featured) camera, and removes cameras — CRUD on
  `live_studio_roam_zones` via server actions (`addRoamZone` / `deleteRoamZone`
  / `setFeaturedRoamZone`), host-membership gated + RLS-backstopped, capped at
  12 channels/event. A clearly-labeled "going live needs the streaming rollout"
  panel keeps the owner-OAuth streaming step honest.
- **Buy path** — new bespoke App Store detail page
  `/dashboard/[eventId]/studio/live-studio-roam` (mirrors the Cast/panood
  pilot): the buy drawer posts `service_key = LIVE_STUDIO_ROAM` through the
  existing `submitOrderAction` → `orders` row → BDO/GCash QR rail →
  `/admin/payments`. Price is read **live** from the admin catalog
  (`formatV2Sku`), never hardcoded; the charge is re-resolved server-side from
  the catalog. Once owned, the CTA flips to "Open controller" → the setup page.
- **SKU activation** — migration `20270930100000` flips `LIVE_STUDIO_ROAM`
  `is_active=TRUE` so the retirement guard stops rejecting the purchase. The
  `/pricing` customer-catalog reader now excludes it **by name while the Roam
  flag is off** (same idiom as `TODAYS_FOCUS`), preserving the owner-locked
  "not on /pricing until launch" guarantee — launch stays a single flag flip.
- **Wiring** — `LIVE_STUDIO_ROAM` added to `V2_SKU_CODES` (so `formatV2Sku`
  resolves its price) and to `ADD_ON_SKU_MAP['live-studio-roam']` (so ownership
  flips the card to `launch`); `opensDirect: true` on the catalog entry routes
  the tile to the new page instead of the dead generic placeholder.
- **Still owner-gated:** live YouTube streaming (the pool channel + broadcast
  orchestration) needs the owner's verified Setnayan channel + OAuth (G1/G3/G4)
  — configuring channels and buying Roam need none of it.

New pure helper `lib/live-studio-roam-zones.ts` (label/venue normalization,
dense zone-index allocation, capacity cap) with 8 unit tests. Existing Roam
manifest/provision suites (18) still green. `tsc` clean on all touched files;
lint clean.

SPEC IMPACT: `LIVE_STUDIO_ROAM` is now `is_active=TRUE` (was seeded dark). The
SKU stays invisible on `/pricing` and unbuyable in the UI until the owner flips
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` — but the DB price is now recorded active.
Price (₱3,500/day) unchanged; owner should confirm before launch flip. Corpus
`Live_Studio_Cast_and_Roam_2026-07-23.md` + the ground-truth `LIVE_STUDIO_ROAM`
row remain accurate; no `.md`/`.docx` corpus edit required (the "activated at
launch" note now happens in two steps — DB active now, flag at launch).
