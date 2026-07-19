## 2026-07-11 · feat(chat): Viber-style archive + Data Retention Schedule enforcement

Builds the chat side of the new **Data Retention Schedule** (`Data_Retention_Schedule_2026-07-11.md`): "keep forever" is out (RA 10173 storage-limitation), **5-yr default for chat**, with a **10-yr legal-hold floor** for any event that carries a payment. Three parts + one compliance gap fix:

1. **Per-user archive (deletes nothing).** New `chat_thread_reads.archived_at` (migration `20270714177342`). A thread is archived-for-this-viewer when `archived_at IS NOT NULL AND archived_at >= chat_threads.updated_at` — so a **new message auto-un-archives** it (Viber behavior, zero extra writes). Wired on BOTH inboxes (couple + vendor): an Archive/Unarchive icon per row + a collapsible "Archived · N" section. New `archiveThread`/`unarchiveThread` server actions (membership-checked, graceful-degrade). `fetchCoupleThreads`/`fetchVendorThreads` now embed the per-user marker and **fall back cleanly** to the plain query (all-active) if the column isn't live yet — deploy-safe ahead of the owner push.

2. **Retention sweep.** `purge_expired_chat(p_years=5)` SQL fn (SECURITY DEFINER, service-role-only) hard-deletes whole threads (cascades messages + reads) for events older than 5 yr, anchored to `events.event_date` (fallback: thread `created_at`), **EXCEPT events with any `orders` row** — a payment puts the event under the 10-yr BIR/contract floor. Driven by a new weekly Vercel cron `/api/cron/retention-sweep` (`CRON_SECRET`, fail-closed; Mondays 03:00 UTC).

3. **Compliance gap fix (was live).** Account hard-delete (`admin/users/actions.ts` · `deleteUser` + `blacklistUser`) previously left the departing user's **chat message bodies** (their own words = personal data) in `chat_messages` forever — the FK is `ON DELETE SET NULL` and threads only cascade on event-delete, but events are never deleted. Now `purgeUserAuthoredChat` hard-deletes `chat_messages WHERE sender_user_id = <target>` BEFORE the auth-delete nulls the id. Surgical, minimal-harm erasure — a co-partner's and the vendor's own messages stay intact. Best-effort with `admin_audit_log` on failure, matching `purgeOwnedEventBirthData`.

Scope note: this is **chat text only**. Media (R2) retention/lifecycle is a separate, owner-configured track (Cloudflare dashboard) — not driven from here.

Verified: `tsc --noEmit` clean; `next lint` clean (no new warnings).

SPEC IMPACT: Applied. New corpus doc `Data_Retention_Schedule_2026-07-11.md` + `DECISION_LOG.md` 2026-07-11 row (both `[PENDING COUNSEL]`). The schedule's 10-yr legal-hold floors (BIR / Civil Code) and the erasure carve-out still need external-counsel ratification; DPO = owner.
