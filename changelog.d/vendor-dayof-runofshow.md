## 2026-06-29 · feat(vendors): Day-Of Run-of-Show & Handover — live run-state + delivery acknowledgement

Wave 4 of the "Soon" vendor benefits (the heaviest item). Two operational layers — no money, no gateway, 0% commission untouched. Vendor timeline edits stay PROPOSALS (the existing `event_schedule_suggestions` Suggest flow); only host/coordinator commit timeline changes + drive the run-state.

**Migration** `20270321980372_dayof_runofshow_handover.sql` (validated against prod in a `BEGIN…ROLLBACK`; 3 new columns + 1 table + 3 RLS policies + 2 functions resolved, nothing persisted):

_Part 1 — live run-of-show:_
- `event_schedule_blocks` gets `actual_start_at TIMESTAMPTZ`, `actual_end_at TIMESTAMPTZ`, `run_state` (`schedule_run_state` enum `upcoming|live|done` DEFAULT `upcoming`) — orthogonal to the planned `start_at`/`end_at` (the header derives "running ±N min" from `actual_start_at − start_at`). Booked vendors already read the timeline via `event_schedule_blocks_booked_vendor_read`; the new columns inherit that row-level read. **No new vendor UPDATE policy** (no 2-way write).
- `public.advance_schedule_block(p_block_id UUID)` — single SECURITY DEFINER primitive for both START (target `upcoming` + nothing live → light it) and ADVANCE (target `live` → done + next `upcoming` lit). Single-winner: `SELECT … FOR UPDATE` + `run_state`-precondition UPDATEs + `GET DIAGNOSTICS ROW_COUNT`; idempotent (already-done → no-op). Auth-gated (DEFINER) to `current_event_ids()` ∪ `current_vendor_booked_event_ids()` ∪ `is_admin()`. Behaviorally tested in a transaction (start→advance→done→idempotent re-tap) on a real 6-block event.
- `event_schedule_blocks` added to the `supabase_realtime` publication (idempotent guard) so the shared header gets live `run_state` pushes — cron-free Supabase channel, no poller.

_Part 2 — delivery handover:_
- New table `public.booking_handovers` (`handover_id`, `event_vendor_id`, `event_id`, `vendor_profile_id`, `kind ∈ gallery_link|file|note|signoff`, `label`, `payload`, `delivered_at`, `couple_acknowledged_at`, `status ∈ delivered|acknowledged|disputed`). **RLS AT CREATE:** vendor insert+read own (`current_vendor_booked_event_ids()` ∩ `current_vendor_profile_ids()`); couple read via `current_event_ids()`; admin `is_admin()`. The ack is the DEFINER RPC, not a direct table UPDATE — append-only trail.
- `public.acknowledge_handover(p_handover_id UUID)` — couple confirm-receipt, modeled EXACTLY on the merged `acknowledge_vendor_deposit`: `FOR UPDATE` + `status='delivered'` precondition + `ROW_COUNT` single-winner + idempotent (`already`). Returns `event_vendor_id` so the app layer can OPTIONALLY advance the booking.

**Reuse, not duplication:** on couple-acknowledge with the "also mark delivered" opt-in, `acknowledgeHandover` calls the existing `updateVendorStatus` with `status='delivered'` — the SOLE owner of the review-request emit (+ schedule-pool gate). The review emit is never re-implemented; it self-guards against re-firing on an already-delivered/complete row.

**Shared realtime header** (`app/_components/run-of-show-header.tsx` + `app/_actions/run-of-show.ts` + pure core `lib/run-of-show.ts`): now/next/±N, modeled on `BudgetLiveSummaryCard` (channel on `event_schedule_blocks`, server-action refetch). Mounted on **three surfaces** — couple Schedule page + vendor client workspace (both `canAdvance`) + the public day-of guest card (read-only). Realtime SHIPPED (not deferred).

**Handover surfaces (three):**
- **Vendor** posts a handover on `clients/[eventId]` beside the Suggest flow — gallery link (external, never re-hosted), a proof/sample image (R2 via `uploadPublicAsset`), a note, or a sign-off; couple notified (reuses the `schedule_suggestion` notification type the change-order flow uses).
- **Couple** confirms receipt on the per-vendor workspace (`HandoverInbox`), with the optional "also mark delivered" toggle.
- **Admin** sees delivery + couple-acknowledgement state per dispute row in `/admin/disputes` (joined by `vendor_profile_id`, beside the no-show reservation-policy evidence).

**Storage:** R2 is the record for uploaded proof images (image-only, ≤6 MB via the existing helper); large galleries stay external links (`gallery_link`) — never proxied.

**SPEC IMPACT:** None (new vendor-benefit feature; no existing locked decision changed). The run-state advance and handover ack are operational signals only — Setnayan holds no money and this touches no payment path.
