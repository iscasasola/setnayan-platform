## 2026-06-27 · refactor(papic): retire the free 3-seat sampler — keep one free model (the 5 free cameras)

An event had TWO free Papic mechanisms: the older **3-seat free sampler**
(`is_free_sampler`, seats 101–103, 8 photos + 2 clips each, 30-day retention,
owner-locked 2026-06-16) and the newer **per-camera funnel** ("your first 5 guest
cameras are free", owner-locked 2026-06-26, already shipped in #2288). Owner
decision 2026-06-27: keep ONLY the 5 free cameras; fully tear out the sampler.

The 5-free-camera funnel is untouched — this PR is purely the sampler teardown.

- **Capture pipeline** (`app/papic/actions.ts`, `app/api/upload/route.ts`): dropped
  the `is_free_sampler` branch end-to-end — the per-seat 8/2 cap (record-layer
  `papic_sampler_insert_capture` + presign `papic_sampler_remaining` probe + the
  per-IP sampler rate-limit), the 30-day expiry stamp, the ephemeral
  `papic-sampler/` R2 prefix, and the wall/FaceBlock skip. Seat captures are now
  uniformly permanent, written under `papic/`, wall-/FaceBlock-ingested. Per-camera
  enforcement (tier quotas, paid-gate, capture window) is unchanged.
- **UI**: removed the "Try Papic free — 3 seats" entry, `SamplerRetentionCard`,
  and the gallery expiry nudge from Studio `papic/page.tsx`; rewrote
  `crew/page.tsx` + `crew/print/page.tsx` to serve only the paid roster (pack
  seats 1–5 + per-camera Unlimited extras ≥200); the seat capture component keeps
  a generic per-seat cap mechanism (now pointed at the live per-camera cap codes,
  not the retired `sampler_*` ones).
- **Deleted**: `lib/papic-sampler.ts`, `papic-sampler-emails.ts`,
  `papic-sampler-cap-core.ts`(+test), `papic-relocation-core.ts`(+test),
  `papic-retention-core.ts`(+test), `papic-retention.ts`, the `/admin/papic-sampler`
  surface (+ its nav entries), `scripts/apply-papic-r2-lifecycle.mjs`,
  `scripts/lint-papic-keep-permanent.mjs` (+ its `lint:papic-keep` script and CI job).
- **Migration** `20270307073708_remove_papic_sampler.sql`: drops the 3 sampler
  RPCs, the `papic_sampler_email_log` table, and `paparazzi_seats.is_free_sampler`;
  nulls any remaining `papic_photos.expires_at` so existing sampler captures become
  permanent (DATA-PRESERVING — the 13 prod sampler photos on the Maria & Jose seed
  event + the Cale & Ice test event are kept, not deleted). `papic_photos.expires_at`
  column is kept as a vestigial always-null field (read filters reference it
  harmlessly). Applies post-merge via the supabase-migrations workflow / db push.

SPEC IMPACT: Iteration 0012 Papic + `Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md`
— the free tier is now solely the per-camera "first 5 cameras free" funnel; the
3-seat sampler is retired. DECISION_LOG row added 2026-06-27. Memory
`project_setnayan_papic_free_sampler` updated to reflect the teardown.
