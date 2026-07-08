## 2026-07-08 · feat(plan3d): booth-template kit — 9 chassis, staff outfits + idle clips, top-20 category templates

The booth-template kit per the owner-locked catalog
(`0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`): every placed vendor
booth whose category resolves a template now renders a full mascot-smooth
build — CHASSIS × PROPS × STAFF MASCOT × SIGNAGE — on all three 3D surfaces
(couple lab · homepage demo · guest venue walk).

- **`kit/booth-chassis.tsx`** — the 9 shared chassis (COUNTER · STATION ·
  RISER · BACKDROP · DESK · DISPLAY · VEHICLE · CHAIR_STATION · GARDEN) as
  module-scope RoundedBox/lathe geometry (three's RoundedBoxGeometry from the
  installed package — no new dep), palette-aware cached materials with the
  kit's 0.45-roughness mascot sheen. `CHASSIS_SPECS` exports each chassis'
  footprint obstacle discs + sign anchor + staff anchor(s).
- **`kit/booth-props.tsx`** — 23 shared prop primitives (chafing dish, tiered
  cake, espresso machine + steam, bottle shelf, drum kit, mic stand, tripod
  camera, emissive LIVE lamp, emissive bulb mirror, console+speakers, bloom
  cart, drape wall, moving-head beam, donut board, shaker, easel, clipboard,
  podium, gown form reusing GOWN_GEO, umbrella/awning, banig CanvasTexture,
  drawn text nameboard). Repeated elements (bottles/bulbs/donuts/blooms) are
  single static InstancedMeshes; all textures procedural CanvasTextures.
- **Staff outfits** — `FigureSpec.outfit` union appended (non-breaking) with
  `chef_whites | apron | vest | uniform`: suit/neutral shells recoloured + a
  CanvasTexture garment detail each (double-breasted buttons, apron bib, vest
  V + buttons, chest stripe + badge). UV front verified empirically at canvas
  centre (u = 0.5) with a quadrant test.
- **Staff idle clips** — 10 pure wall-clock 2-key loops in `lib/figure-rig.ts`
  (`staffIdle`: pipingSwirl, shake, tamp, bowDraw, headBob, cardFlip,
  brushDab, wave, snap, present), applied like idleSway via a new
  `<Figure idleClip>` prop (overrides the quality-'low' static bake for ≤3
  staff per booth; reduced motion bakes the clip's held t=0 pose). +5 unit
  tests (envelopes, determinism, per-id desync, motion, buffer-reuse safety).
- **`kit/booth-templates.ts`** — the top-20 config table (leaf key →
  chassis/props/staff/signText/cardKind) + `boothTemplateFor` resolution
  (vendor category → taxonomy leaf → template, booth_type fallback) +
  `templateBoothObstacles` (chassis discs registered at all three call
  sites). The remaining 37 leaves deliberately fall back to the generic
  BoothMesh silhouette — the complete catalog is the next PR
  (`3dplan-booth-catalog-complete`).
- **`kit/booth-template.tsx`** — the `<BoothTemplate>` renderer, mounted via
  the shared `BoothMesh`; PRO/ENTERPRISE logo BoothSign unchanged (hung at
  the chassis sign anchor), unbranded booths get the drawn nameboard. The
  scene's invisible booth tap-target contract is untouched.
- **`/dev/booth-lab`** — internal preview grid stepping through the shipped
  templates (the /dev/figure-lab precedent; kept for the catalog-complete PR).

Draw budget per template ≈ 20–35 draws (chassis ≤ 8 · props 1–5 each, ≤ 2
where instancing applies · staff ~12/figure at quality 'low' with shadow
casting off · sign 2). typecheck + lint + 1124 unit tests green.

SPEC IMPACT: None (implements the already-locked 2026-07-08 booth-template
catalog; slice 1 of 2 — system + top-20).

## 2026-07-08 · feat(plan3d): kind-aware booth cards — menus, songlists, book-CTA

Slice 4 of the booth kit: the booth vendor card now consumes the `cardKind`
each template carries, plus the vendor's structured "what you get" lines and
a marketplace-profile CTA (owner-locked surface D — free for verified vendors).

- **`kit/booth-card-content.tsx`** (new) — the kind-aware list section inside
  the existing `booth-vendor-card.tsx`: `menu` → "Menu" · `songlist` →
  "Set list" · `drinks` → "On the bar" · `inclusions` → "What's included",
  one `Array<{label, worthPhp?}>` shape for all four; stated-worth items get
  the marketplace "₱X free" chip. Pure presentational.
- **`fetchBoothCardItems`** (lib/vendor-services.ts, new) — fail-soft read
  composition, no schema change: booth `event_vendor_id` → `event_vendors` →
  the linked profile's active `vendor_services` listing (category match beats
  first-active) → `vendor_service_inclusions` (label + worth_php), falling
  back to the listing's legacy `package_inclusions` JSONB, then to the
  host-authored `event_vendors.host_inclusions[]` for manual vendors.
  `parsePackageInclusions` exported pure + 4 unit tests.
- **LAB** — `seating/lab/page.tsx` fetches card items through the
  couple-authed client (RLS-scoped); the lab now opens the booth card on
  booth tap (invisible hit targets, plan3d-scene precedent; inspect-only —
  no walk-to) with the CTA reading "View vendor profile" (they already
  booked them).
- **DEMO** — `plan3d-demo-actions.ts` rides the same fetch through the
  `getSampleEventId` trust boundary (read-only, display-safe fields only —
  label + worth_php; the tour contract).
- **CTA** — "Book this vendor for your event" → `/v/[slug]` (new tab, so the
  3D scene keeps running) on the demo + public venue walk whenever the booth
  vendor has a PUBLICLY VISIBLE marketplace profile: `fetchBooths` now joins
  `business_slug` + `public_visibility` and nulls the slug via
  `isPubliclyVisible`, so hidden/archived vendors never leak a link. The
  public walk page joins slugs post-RPC (the v4 payload predates the field).

typecheck + lint + 1128 unit tests green.

SPEC IMPACT: None (implements the locked 2026-07-08 booth-template catalog's
cardKind contract + the owner-locked free book-this-vendor booth CTA).

## 2026-07-08 · feat(plan3d): sample-event booth content — menus, set lists, drinks

Real demo content behind the kind-aware booth cards on the Maria & Jose
sample event, so every card kind demos with substance (owner: "demo works
tonight"). Data-only — no product code touched; 1128 unit tests unchanged.

- **`scripts/seed-sample-event-maria-jose-content.sql`** — two new idempotent
  DO blocks (same resolve-by-slug / delete-then-reinsert pattern, applied to
  prod 2026-07-08 via REST):
  1. **Booth card content** — 44 `vendor_service_inclusions` rows across the
     five demo vendors the booths link to, mirrored into the listings' legacy
     `package_inclusions` JSONB (the couple-lab fallback path, since
     unpublished demo profiles fail the inclusions RLS public-read):
     Hain Catering · 10-dish plated Filipino menu w/ per-plate worths (menu) ·
     Saysay Live Band · 10-song OPM-leaning set list (songlist) ·
     Tagay Mobile Bar · 9-drink bar list w/ worths (drinks) ·
     Matamis Bakeshop · 8-item dessert bar (menu via the cake tile) ·
     Kuha Booth · 7 photobooth inclusions w/ worth chips (inclusions).
  2. **Demo floor booths** — the published sample plan had ONE booth (the
     owner-placed Mobile Bar, untouched); adds the four that exercise the
     remaining card kinds, each linked to its shortlisted demo event vendor
     so `boothTemplateFor` resolves the vendor-category template:
     `live_cooking` "Plated Dinner" → Hain Catering · `band` "Live Band" →
     Saysay Live Band · `dessert_station` "Dessert Bar" → Matamis Bakeshop ·
     `photo_booth` "Photo Booth" → Kuha Booth. Wall-side percents clear of
     the published tables / stage / entrance; short `offerings` copy each.

No new vendors were needed — all top-20 booth-card categories already have
is_demo batch vendors (Saysay Live Band, Tagay Mobile Bar, etc. shipped in
`seed-sample-event-maria-jose.sql`). Live rows verified by REST re-read
(44 inclusion rows + 5 booths, correct kinds + vendor links).

SPEC IMPACT: None (sample-event demo data only; no pricing/SKU surface).
