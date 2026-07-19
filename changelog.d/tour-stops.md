## 2026-06-20 · feat(tour): public Maria & Jose tour — stops 2–5 (vendors, seating, budget, gallery)

Completes the curated, no-login public tour of the `is_sample` Maria & Jose wedding (foundation + access boundary shipped in #1910). Four new RSC stops under `/tour/*`, each reading the sample event ONLY through the pinned `getSampleEventId()` trust boundary (never a client-supplied id) via the service-role admin client (SELECTs only), and each exposing exactly one **client-only-interactive** moment (local React state, no server, resets on reload). The `app/tour/**` `no-restricted-imports` ESLint guard enforces read-only — zero server actions, zero writes.

- **`/tour/vendors`** — Setnayan-AI shortlist via `fetchWizardVendorRecommendations(admin, …)`; a scripted vendor "chat" (`TourChatThread` + canned `VENDOR_SCRIPT`) that mimics the real thread UI but calls no chat action and reads no `chat_messages`.
- **`/tour/seating`** — `fetchTables`/`fetchAssignments` + reused `<WayfindingMap>`; in-memory "find your seat" name search (no PII beyond display name).
- **`/tour/budget`** — `fetchBudgetSnapshot`; presentational forks of the itemization + allocation cards (originals import server actions), all mutations/money-write affordances stripped.
- **`/tour/gallery`** — reused live-wall read path (`getWallSnapshot` → `wall_visible_photos`) behind a poll-free client fork (`TourLiveWall`) plus the mood-board palette + inspirations; a "bring the wall to life" timer drips pre-seeded tiles in via the wall's own `mergeTiles`/`animate-wall-enter`.
- **`scripts/seed-sample-event-maria-jose-wall.sql`** — re-runnable `wall_feed` seed (8 tiles) so Stop 5's headline wall renders real imagery; tiles point `source_id` at the seeded `papic_photos` (RPC gates: 0 faceblock guests, all visible, consenting tags) but store full Unsplash URLs in `wall_safe_r2_key` (the display pipeline returns any non-`r2://` value verbatim, so no R2 upload is needed). Applied to prod via `db query`.
- **`app/tour/page.tsx`** — flipped stops 2–5 from "soon" to live now that the routes exist.
- **`app/[slug]/page.tsx`** — added `is_sample` to the public-event select and suppressed `<StdViewBeacon>` for the sample event, so tour traffic never inflates the sample's Save-the-Date view counter.

SPEC IMPACT: None (read-only public surface over existing demo/sample data; no SKU / schema / pricing / branding change).
