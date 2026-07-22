## 2026-07-22 · feat(papic): clip currency → 10-second / 7-point clip (owner override §0)

Ships the isolated clip-currency half of `0012_papic/Papic_One_Pool_Model_Spec_2026-07-22.md` §0, on top of the metering foundation (#3493). Owner-locked 2026-07-22: a Papic candid clip moves from **5 seconds / 3 points → 10 seconds / 7 points** (a photo still costs 1 point). This deliberately reverses the old "5-second hard cap … not configurable" product lock. The point WEIGHT is the load-bearing constant on the fail-closed capture path; the metering RPCs never hardcode a clip cost (they take it as the `p_cost` parameter), so the pool binding is unchanged — it simply meters whatever the constant is.

**Point value (3 → 7):**
- `lib/papic-cameras.ts` — `PAPIC_POINTS_PER_CLIP` 3 → 7 (the couple pool's clip weight; flows through `papicCaptureCost` into `papic_reserve_event_points` on both the guest route and the seat action).
- `lib/vendor-papic-tier.ts` — `VENDOR_PAPIC_POINTS.clip` 3 → 7 (the vendor on-the-day capture ledger, read by `pointsForMedia` in `app/api/vendor/papic-capture/route.ts`); `app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller.tsx` optimistic spend + affordability gate 3 → 7 to match.

**Duration cap (5s → 10s) — every enforcement layer, so a 10s clip is neither rejected nor truncated:**
- Client recorders: `papic-guest-capture.tsx` (`MAX_CLIP_MS`), `papic-seat-capture.tsx` (`CLIP_MAX_MS`), vendor `papic-capture-controller.tsx` (`CLIP_MAX_MS`) → 10000.
- Server rejects: guest route `MAX_CLIP_MS` 5000 → 10000 (`too_long` 400); seat action `CLIP_MAX_MS_SERVER_TOLERANCE` 5500 → 10500 (`clip_too_long`).
- DSLR bridge: `lib/camera-bridge/types.ts` `PAPIC_CLIP_DURATION_MS` 5000 → 10000 (fixed-length trigger + the `10s clip` panel label).
- DB clamp: new migration `supabase/migrations/20270903248590_papic_clip_currency_10s.sql` — `CREATE OR REPLACE papic_record_guest_capture` with the stored-`duration_ms` clamp `LEAST(ms, 5000)` → `LEAST(ms, 10000)` (body byte-identical to #3493's definition otherwise, so guest 10s clips store true duration and agree with the seat path, which inserts un-clamped). No `is_active`/`status` flip, no rename.

**Copy + figures:** derived capacity phrases (`lib/papic-tier-copy.ts` — "one 10-second clip counts as 7", `~N ten-second clips`); marketing/dashboard copy (`app/papic/page.tsx`, `studio/papic/page.tsx`, launcher `account-inline.tsx`); `public/llms.txt` (both pool descriptions → "one 10-second clip = 7 points" + a footer changelog note; no peso figure changed, so both directions of the llms drift guard stay green).

**Tests (all binding proofs recomputed to 7):** `lib/papic-pool-metering.test.ts` (clip derives from `papicCaptureCost`, pool sized to `clip+1`; exact-fit + never-partial boundaries recomputed), `lib/papic-copy-guardrails.test.ts` (20 pts = 2 ten-second clips), plus the sibling unit proofs `papic-cameras.test.ts`, `papic-event-pool.test.ts` (clip = 7× a photo), `vendor-papic-tier.test.ts` (photo+clip+photo = 9; Ltd clip headroom 63 ok / 64 blocked). Verified GREEN: `tsc` 0 · lint clean · full `lib/**/*.test.ts` (2568) · `tests/db/*.db.test.ts` (36).

**Reel/template audit (item 5 — no code change):** the Personal-Reel renderer (`lib/reel-render.ts`) uses the actual decoded `video.duration` and caps each output slot at `CLIP_SLOT_MAX_SEC` (5s), so a 10s source is safe — it is sampled across its slot (time-compressed into ≤5s), never a hard failure. No template manifest in the repo assumes an exact-5s source. Left unchanged; flagged for the owner in case a longer reel slot is later desired.

**NOT touched (correctly out of scope):** Pabati (`pabati_record_clip` LEAST(ms,5000) — a separate 5s greeting product), Patiktok booth capture (30s template product), Boomerang/Living-Hero (≤5s moment), Alaala/editorial-media showcase clips, and `MAX_CLIP_BYTES` (a byte ceiling; the ~2× storage impact of 10s clips is the separate clip-compression/purge PR per §1.4/R1).

SPEC IMPACT: Reverses the "5-second hard cap on video clips … Not configurable" product lock (per §0, which explicitly authorizes the reversal). The corpus §0 already documents the 10s/7pt lock, and the CLAUDE.md 5-second constraint is already retired in the corpus — no further corpus edit required. Storage caveat R1 stands: 10s clips are ~2× bytes and clips do not compress yet, raising the urgency of the clip-compression/purge PR (owner accepted, staying on R2).
