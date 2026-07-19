## 2026-07-03 · feat(render): shared render_jobs queue table (inert · build-3 PR1)

First brick of the server-side render host (owner-approved 2026-07-03: Cloudflare
Containers + FFmpeg for paid heavy renders — Patiktok compilation, Thank You
Video, AI-Highlights; the free short reels keep rendering in the browser).

- **New `render_jobs` table + RLS, table-only and inert** — ships before the
  worker exactly like Patiktok Phase 1 shipped `patiktok_render_jobs`. One shared
  queue every paid SKU enqueues into: `job_id`, `event_id`, `sku`, `spec` (JSONB
  — source R2 keys, music slug, template/LUT, target duration), `status`
  (`queued→processing→completed→failed→cancelled`), `output_key`, `error`,
  `attempts`, timestamps.
- **Canonical RLS** — event members READ (`current_event_ids()`), the couple
  INSERTS for their own event, admins UPDATE (`is_admin()`); the draining Worker
  updates via the service role (bypasses RLS). Mirrors the patiktok policies
  exactly. Two indexes for the drainer (`status, enqueued_at`) and the couple UI
  (`event_id, status, enqueued_at`).
- Applied to prod (njrupjnvkjkitfctetvi) via MCP + exact-version ledger row — no
  drift. Nothing reads or writes the table yet.

**Next (blocked on an owner action):** the Cloudflare Worker + FFmpeg Container +
the enqueue lib need Cloudflare Containers enabled on the account + secrets set
before they can be built-and-verified against real bindings.

SPEC IMPACT: None (additive internal infra; architecture recorded in DECISION_LOG
2026-07-03 + the render-pipeline design note).
