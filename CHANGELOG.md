# Setnayan — Changelog

Append-only log of every meaningful code change. Newest at top. Each entry includes a `SPEC IMPACT` callout (even if "None") so spec-folder edits via Cowork are never missed.

---

## 2026-06-03 · feat(schedule): hybrid Preparation — couple + vendor manual items

**Commit:** see merge commit on this PR.

**Context:** Completes the Preparation hybrid the owner asked for after the 2026-06-03 chrome-redesign delta #3 (PR #840). #840 shipped the couple's `/schedule` **Preparation** mode as a READ-ONLY auto-aggregation (`lib/preparation.ts` merges vendor payment due dates, paperwork deadlines, vendor meetings, statutory milestones) and explicitly DEFERRED manual entry to a fast-follow needing a new table (logged in `COWORK_INBOX.md` [PENDING] 2026-06-03). This PR ships that deferred manual-entry layer **and** adds a vendor-add path: (a) the couple can add their own dated prep items + delete items (incl. dismissing vendor-added ones); (b) booked vendors can push items onto the couple's prep schedule from their Bookings view. The autofill is untouched; the new rows merge into the same date-sorted, month-grouped agenda.

**What ships:**

- **NEW source in `lib/preparation.ts`** — `fetchManualItems(eventId)` reads `event_preparation_items` and maps each row to the EXISTING `PreparationItem` shape (`date`=`due_date`, `label`→`title`, per-row chip `sourceLabel`: "Added by you" for `couple_manual` / "From {vendor business name}" for `vendor_prep` — `vendor_profiles.business_name` joined; carries `itemId` + `isManual` so the agenda renders a delete control). Merged into `fetchPreparationAgenda`'s `Promise.all` + `sourceCounts`. New `'manual'` member on `PreparationSource` (icon `ListPlus`, mulberry accent). **GRACEFUL DEGRADE:** the new source catches `42P01` (and any error) → returns `[]`, so the agenda still renders autofill-only before the migration is pushed.
- **Couple add/delete UI** — a "+ Add to schedule" control on the Preparation agenda (+ in the empty state) opens the canonical Setnayan modal (bottom-sheet on mobile via `items-end → sm:items-center`, ESC + backdrop dismiss) with fields label / date / optional notes → `addPreparationItem`. Deletable rows (the `event_preparation_items` rows only — NOT autofill rows) get an inline `Trash2` → `deletePreparationItem`.
- **Vendor add/delete UI** — on `/vendor-dashboard/bookings`, each **accepted** booking gets an "Add to prep schedule" control + a list of the items that vendor has added (with per-item delete). `vendorAddPreparationItem` stamps `source_tag='vendor_prep'` + the vendor's own `vendor_profile_id`; gated to accepted threads in the action (RLS also enforces). `vendorDeletePreparationItem` removes the vendor's own rows.
- **Server actions** — input validation (label 1–200, valid `YYYY-MM-DD`; past dates allowed so they surface as "overdue"), correct field stamping, RLS-reliant authz, `revalidatePath`, graceful error surfacing to the form.
- **Token fix (incidental):** swapped three latent `bg-paper` classes (undefined token, silently no-op'd in #840) → `bg-cream` in the agenda month-header + meeting/milestone row + empty-state buttons. Purely additive cosmetics.

**NEW migration — `supabase/migrations/20260729000000_event_preparation_items.sql` (owner-push; graceful-degrade until applied):** additive `event_preparation_items` table (`item_id` PK, `event_id`→`events`, nullable `vendor_profile_id`→`vendor_profiles` (NULL = couple-added), `due_date`, `label` CHECK 1–200, `notes`, `source_tag` default `couple_manual`, `created_by`→`users`, timestamps), 2 indexes, RLS-at-create. **RLS model:** couple = full CRUD on their own event's items via `current_couple_event_ids()` (incl. deleting vendor-added rows); vendor = SELECT items they authored OR for events with an `accepted` `chat_threads` row; INSERT only for accepted-thread events stamping their own `vendor_profile_id`; UPDATE/DELETE only their own rows (all via `current_vendor_ids()`). **Schema verified against migrations** — all column/helper names in the supplied SQL matched the live schema (`events(event_id)`, `vendor_profiles(vendor_profile_id)`, `users(user_id)`, `current_couple_event_ids()` + `current_vendor_ids()` both GRANTed to authenticated, `chat_threads.vendor_profile_id` + `inquiry_status='accepted'`); **no column-name fixes needed.** Wrapped in `BEGIN/COMMIT` + idempotent guards to match repo migration convention. **Do NOT auto-push** — owner pushes.

**Files:**
- `supabase/migrations/20260729000000_event_preparation_items.sql` (new)
- `apps/web/lib/preparation.ts` (new `manual` source + `fetchManualItems` + `fetchVendorPreparationItemsByEvent` + type extensions)
- `apps/web/app/dashboard/[eventId]/schedule/prep-actions.ts` (new — couple add/delete actions)
- `apps/web/app/dashboard/[eventId]/schedule/_components/prep-item-controls.tsx` (new — couple add modal + delete button)
- `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` (wire controls + `manual` styling + per-row delete + chip override)
- `apps/web/app/vendor-dashboard/bookings/actions.ts` (new — vendor add/delete actions)
- `apps/web/app/vendor-dashboard/bookings/_components/vendor-prep-add.tsx` (new — vendor add modal + per-item delete)
- `apps/web/app/vendor-dashboard/bookings/page.tsx` (fetch vendor items + render control on accepted bookings)

**Verification:** `pnpm -F web typecheck` → 0 errors. `pnpm exec next lint --file <changed>` → no warnings or errors. `pnpm -F web build` → ✓ Compiled successfully, 113/113 pages generated (remaining warnings are all pre-existing, in untouched files: `<img>`, exhaustive-deps, a11y on other pages; the sitemap/`vendor-dashboard` "dynamic server usage / missing SUPABASE env" lines are expected env-less static-gen noise).

**SPEC IMPACT: Yes.** New `event_preparation_items` table + hybrid Preparation behavior touches: **0021** (couple dashboard / Schedule surface — Preparation is now hybrid, not read-only); **0007** (budget) + **0016** (Concierge) schedule cross-refs; **0006** (vendors) + **0022** (vendor dashboard — booked vendors can add prep items). Cowork worklist entry appended; supersedes the deferral in the #840 [PENDING].

---

## 2026-06-03 · feat(drive-copy): Phase 2 — Papic auto-sync feeder (cron-free, via after())

**Commit:** to be filled after commit.

**Context:** Phase 2 of the storage build plan. **Finding:** 5 of the 6 source services (Patiktok, Pabati, Pakanta, Monogram, QR) have no R2-artifact pipeline yet (stubs / client-side), so there is nothing to feed for them — one-line `pushToDriveCopy(...)` calls land with each future pipeline. **Papic** is the one real producer and is wired now.

**Cron-free** — the repo's 2 existing cron endpoints have no scheduler (no `vercel.json` crons, no scheduled Actions), so a polling cron would've been dead on arrival. The drain runs in the background of the capture request via Next 15 `after()`.

**What ships:**

- **Papic auto-sync feeders** — `papic/actions.ts` (paparazzo capture) + `api/papic/guest-capture` (guest disposable camera): `enqueueDriveCopy('papic', …)` then `after(() => runDriveCopyBatch({ eventId }))`. The response returns immediately; the R2→Drive copy runs in the background. No-op until Drive is connected; best-effort (never fails a capture).
- **Folder unify** — `drive-copy.ts` routes `papic` artifacts to the couple's existing `events.photo_delivery_folder_id` (same folder as the manual "Release to Drive" worker).
- **Dedup** — `enqueueRelease` skips photos already auto-synced (matched on `r2_object_key`); it also backfills anything a dropped background task missed.
- **Latent fix** — `readR2Object` strips a leading `r2://<bucket>/` prefix (also fixes the existing release worker for prefixed papic keys).

**Pilot-safe:** best-effort + enqueue-first (the row persists even if the background copy is dropped); manual release still works + dedups. No migration. No cron. No new owner action.

**SPEC IMPACT:** Yes (minor). Papic auto-syncs to Drive (the pax-pricing "photos land in your Drive" behavior), cron-free. The other 5 feeders attach as their pipelines land.

---

## 2026-06-03 · feat(messages): unread badge on the Messages icon

**Commit:** see merge commit on this PR.

**Context:** Follow-up to chrome-redesign **delta #2** (PR #837), which shipped the `MessageSquare` link in the couple top bar **icon-only** — its own comment flagged "No unread badge: chat_messages has no per-message read tracking column in V1 … Badge can be added in a follow-up once a read-receipts migration lands." This PR is that follow-up: it adds the per-user/per-thread read marker chat never had, computes an unread-thread count from it, and lights the Messages icon the same way the bell is lit.

**What ships:**

- **Unread badge on the Messages icon** in the event-scoped couple top bar (`app/dashboard/[eventId]/layout.tsx`). New client component `app/_components/unread-messages-badge.tsx` mirrors `unread-bell-badge.tsx` exactly — same pill styling (terracotta dot, `9+` cap, `font-mono text-[9px]`), `aria-label "Messages · N unread messages"`, server-rendered initial count + Supabase Realtime resync on `chat_messages` INSERT (the table is already in the `supabase_realtime` publication per `20260514140000`, and Realtime honors RLS so a client only gets events for threads it can SELECT).
- **Read-state that didn't exist before.** `countUnreadMessages(supabase, userId?)` in `lib/chat.ts` calls the new `count_unread_message_threads()` RPC; a thread is unread when it has a message from *someone else* (`sender_user_id IS DISTINCT FROM auth.uid()`) newer than the viewer's `last_read_at` (or they've never read it).
- **Mark-read on open.** Server action `markThreadRead(threadId)` in `lib/chat-actions.ts` upserts `chat_thread_reads (thread_id, user_id=auth.uid(), last_read_at=now())` on `onConflict (thread_id,user_id)`. Called on render in the couple thread page **and** the vendor thread page (parity).
- **Graceful-degrade is the whole safety story.** Both `countUnreadMessages` and `markThreadRead` log + no-op/return-0 on ANY error — most importantly when the table/function isn't in the schema yet (`isMissingRelationError`). The deploy is therefore safe **before** the migration is applied: the badge simply reads 0 and opening a thread never fails. Mirrors `countUnread`'s graceful-to-0 in `lib/notifications.ts`.

**NEW migration — `supabase/migrations/20260728000000_chat_thread_reads.sql` (OWNER-PUSH):**

- Additive only. `CREATE TABLE IF NOT EXISTS public.chat_thread_reads (thread_id, user_id, last_read_at, PK(thread_id,user_id))` with FKs to `chat_threads(thread_id)` + `users(user_id)` ON DELETE CASCADE; index on `user_id`; **RLS enabled at create**; `chat_thread_reads_self_all` policy = a user manages only `user_id = auth.uid()` rows. Plus `count_unread_message_threads()` (SECURITY DEFINER · STABLE · `GRANT EXECUTE … authenticated`).
- **One correction vs the drafted SQL:** the draft scoped vendor-side threads with `current_vendor_ids()`, but that helper is a **NULL-returning stub** in `20260512000000_setnayan_base.sql` (vendor_team_members lands in 0022, stub never repointed). The helper the 0019 chat RLS actually uses for vendor-thread scoping is **`current_vendor_profile_ids()`** (`vendor_profiles WHERE user_id = auth.uid()`), matching `chat_threads.vendor_profile_id → vendor_profiles(vendor_profile_id)`. Swapped to that so the vendor-side count actually works. All other column names (`users.user_id`, `chat_threads.{thread_id,event_id,vendor_profile_id}`, `chat_messages.{thread_id,sender_user_id,created_at}`, `current_couple_event_ids()`) matched the live schema verbatim.
- **Do NOT `supabase db push`** — owner applies migrations. Until then the badge shows 0.

**Files:**

- `supabase/migrations/20260728000000_chat_thread_reads.sql` (new)
- `apps/web/lib/chat.ts` — `countUnreadMessages()` + error-detect import
- `apps/web/lib/chat-actions.ts` — `markThreadRead()` + error-detect import
- `apps/web/app/_components/unread-messages-badge.tsx` (new)
- `apps/web/app/dashboard/[eventId]/layout.tsx` — fetch `initialUnread`, swap icon-only link → `<UnreadMessagesBadge>` (dropped now-unused `MessageSquare` import)
- `apps/web/app/dashboard/[eventId]/messages/[threadId]/page.tsx` — `markThreadRead` on render
- `apps/web/app/vendor-dashboard/messages/[threadId]/page.tsx` — `markThreadRead` on render

**Verification:** `pnpm -F web typecheck` → 0 errors. `pnpm exec next lint --file <6 changed app/lib files>` → no warnings/errors. `pnpm -F web build` → ✓ Compiled successfully · 113/113 static pages (the only build warnings are pre-existing + in untouched routes: sitemap `Missing SUPABASE env vars` locally, `/vendor-dashboard` dynamic-server `cookies`/`searchParams` notices).

**SPEC IMPACT: Yes** — iteration **0019** (Communications: chat gains a per-user/per-thread read marker `chat_thread_reads` + `count_unread_message_threads()` RPC; previously "Read receipts … deferred") and **0021** (couple dashboard chrome: the Messages icon now carries an unread badge alongside the bell). `[PENDING]` logged in `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(schedule): Preparation ⇄ Event Day toggle

**Commit:** see merge commit on this PR.

**Context:** Delta #3 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). The redesign asked for the couple's `/schedule` page to carry a **Preparation ⇄ Event Day** toggle: "Event Day" = the existing editable day-of timeline, "Preparation" = a NEW read-only agenda of dated planning items leading up to the wedding that auto-fills from payments + concierge milestones. This is a **net-new V1 surface** — the prototype intent, shipped with only the data real tables support. No new table, no migration: Preparation is pure read-only aggregation of EXISTING dated data.

**What ships:**

- **URL-driven segmented toggle** at the top of `/schedule` — `Preparation | Event Day` via `?view=preparation` / `?view=event-day` (bookmarkable, SSR-resolved, works without JS — each segment is a real prefetched `<Link>`). With no param the page defaults to **Preparation when there are prep items**, else opens straight on **Event Day** so empty-prep couples aren't met with a blank agenda. The Preparation segment carries a live count badge.
- **Event Day mode = the existing blocks UI, untouched.** The add-block form, per-block cards (inline time editor + visibility toggle + delete), and empty state were lifted verbatim into an `EventDayView` helper — behavior is byte-for-byte identical to before.
- **Preparation mode = a date-sorted, read-only agenda grouped by month.** Each row: date · label · a source chip (Payment / Paperwork / Meeting / Milestone) · optional amount, with overdue rows flagged in rose so a couple sees what slipped. A small legend explains that the agenda auto-fills (couples don't add rows by hand here). Honest empty state with deep-links to Budget + Paperwork (date-aware copy when no wedding date is set yet). Clean Editorial tokens (cream/ink/terracotta/mulberry + amber/blue/indigo source accents) consistent with Home's "Upcoming" surface.

**Data sources — exactly what was wired vs deferred** (`lib/preparation.ts` `fetchPreparationAgenda`, each source graceful-degrades independently):

- ✅ **Payment** — `event_vendor_line_items.due_date` (host-entered vendor payment milestones). Amount + vendor name + label; fully-paid lines dropped (sums `event_vendor_payments` per line, mirroring `renderBudgetIcs`). Deep-links to `/budget`.
- ✅ **Paperwork** — `event_paperwork` rows with the "complete by" date derived via `lib/paperwork.ts` `completeByDate(document_type, event_date)`; `received` docs dropped. Deep-links to `/paperwork`.
- ✅ **Meeting** — `vendor_meetings.starts_at` (consultations, tastings, fittings, site visits). Deep-links to the vendor's page.
- ✅ **Milestone** (the "concierge"-flavored derived dates) — computed statutory windows from `events.event_date` + `ceremony_type`: PSA/CENOMAR −180d, marriage-license window −120d, Pre-Cana cutoff −60d (Catholic only). Same thresholds as `lib/upcoming-items.ts`. Deep-links to `/paperwork`.
- ❌ **DEFERRED — manual / user-added prep items.** Would require a NEW table (couple-authored agenda rows). Out of scope for this additive, no-migration PR. Documented as a fast-follow in `COWORK_INBOX.md`.
- ❌ **ABSENT — orders due dates.** The `orders` table has **no due-date column** (only `created_at` / `paid_at` / `reviewed_at` / `expires_at`). `expires_at` is a *subscription-renewal* date, already surfaced on Home + Orders; it is **not** a wedding-preparation milestone, so it is intentionally omitted from Preparation.
- ❌ **ABSENT — Concierge / Today's Focus per-step milestones.** The 0016 wizard (`/today`) is an ordered card list with **no per-step due/target date column**. The only concierge-adjacent dated data is the statutory windows, wired above as the Milestone source.

**Home untouched.** The lean-home 3-block rule (PersonalizedMenu · UpcomingSchedules · ActivityFeed, owner-locked 2026-06-02) is fully respected — `apps/web/app/dashboard/[eventId]/page.tsx` was **not modified**. The `/schedule` toggle is the entire deliverable; the existing `UpcomingSchedules` block already aggregates the same kinds of dated items for Home via `lib/upcoming-items.ts` and needed no change.

**Files:**

- `apps/web/lib/preparation.ts` — NEW. The aggregator + types (`PreparationItem` / `PreparationGroup` / `PreparationAgenda`, `fetchPreparationAgenda`). Source map + deferred-sources rationale documented in the file header.
- `apps/web/app/dashboard/[eventId]/schedule/_components/schedule-mode-toggle.tsx` — NEW. Client segmented control (URL-driven, count badge).
- `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` — NEW. Read-only presentational agenda view + legend + empty state.
- `apps/web/app/dashboard/[eventId]/schedule/page.tsx` — wired the toggle + view resolution + event-row fetch (`event_date` + `ceremony_type` for the agenda math); extracted the existing blocks UI into `EventDayView` (behavior unchanged).

**Verification:** `pnpm -F web typecheck` clean (0 errors); `next lint` clean ("No ESLint warnings or errors") on all four changed files.

**SPEC IMPACT:** **Yes.** Iteration **0021** (couple dashboard — Schedule surface gains the Preparation⇄Event Day mode) plus the cross-refs to the schedule spec / iteration **0007** (budget payment due dates feed Preparation) and iteration **0016** (Concierge has no per-step dated milestone — only statutory windows feed Preparation; manual prep entry deferred). Logged as `[PENDING] 2026-06-03` in `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(services): surface in-app add-ons inside the Services tab

**Commit:** see merge commit.

**Context:** Delta #4 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). Vendors + in-app services should live in one tab so couples never need to jump to a separate Add-ons route to discover features.

**What ships:**
- **`apps/web/lib/add-ons-catalog.ts`** — new shared catalog module extracted from add-ons/page.tsx. Exports `ADD_ONS`, `AddOnEntry`, `AddOnStatus`, and the `addOnHref()` helper. Single source of truth consumed by both the full poster grid and the new compact section.
- **`apps/web/app/dashboard/[eventId]/add-ons/page.tsx`** — refactored to import `ADD_ONS` + `addOnHref` from the shared catalog. Behaviour is byte-for-byte identical; no duplicated list.
- **`apps/web/app/dashboard/[eventId]/vendors/_components/in-app-services-section.tsx`** — new server component: "In-app services & add-ons" section with a compact landscape mini-card grid (horizontal-scroll on mobile, 4-col on desktop). Cards reuse the per-service animated poster backgrounds (base + motion layers + lower-third gradient mask) from the shared catalog. Filters to live + web_v1 add-ons only; coming-soon items discoverable on the full `/add-ons` page. "See all" + "View all add-ons" links keep the canonical route reachable.
- **`apps/web/app/dashboard/[eventId]/vendors/page.tsx`** — wraps the return in a fragment; renders `<InAppServicesSection eventId={eventId} />` below `<PlanBudgetAccordion>`.

**Verification:** `pnpm -F web typecheck` — 0 errors. `next lint` on all 4 changed files — 0 warnings/errors.

**SPEC IMPACT:** Yes.
- **Iteration 0006** (`0006_vendors_management/`) — the Vendors tab (renamed Services in the chrome redesign) now also surfaces in-app services. Spec should note the dual-entry-point pattern.
- **Add-ons hub** (`0021_couple_dashboard_fully_purchased/`) — record that the compact add-ons grid now lives inside the Services tab as a second entry point (canonical `/add-ons` route unchanged).

---

## 2026-06-03 · feat(drive-copy): Phase 0 — consolidate the two Drive OAuth flows into one per-event connect

**Commit:** to be filled after commit.

**Context:** Phase 0 of the storage build plan (`Storage_and_Drive_Copy_Architecture_2026-06-03.md` § 8), following the Phase 1 keystone. An event could previously hold **two** Google Drive connections — `oauth_grants(provider='drive')` (Papic connect) and `provider='drive_photo_delivery'` (Photo Delivery connect) — each its own consent, redirect URI, and folder. The Phase-1 drive-copy layer reads `provider='drive'`, so a couple who connected only via Photo Delivery was invisible to it. This unifies them into **one** per-event "Connect Drive".

**What ships:**

- **`/api/oauth/photo-delivery/start`** — now uses the canonical Drive OAuth config (`getDriveOAuthConfig`), so the Photo Delivery connect goes through the **same Google consent + redirect URI** as Papic (→ `/api/oauth/drive/callback`). It still writes an `oauth_state` row with `provider='drive_photo_delivery'` purely as a **return-page marker**.
- **`/api/oauth/drive/callback`** — now serves **both** connects: accepts `oauth_state.provider ∈ {drive, drive_photo_delivery}`, always upserts the grant as `provider='drive'`, **mirrors `events.photo_delivery_*`** connected-state, and redirects back to the right panel.
- **`photo-delivery-release.ts`** + **`/api/photo-delivery/disconnect`** + **photo-delivery `actions.ts`** — read/revoke the unified `provider='drive'` grant.
- **`/api/oauth/drive/disconnect`** — the shared Drive disconnect now also clears `events.photo_delivery_*`.
- **`/api/oauth/photo-delivery/callback`** — marked **DEPRECATED** (unreachable post-consolidation).
- **Migration `20260727000000_drive_oauth_consolidation.sql`** — safety-net data backfill: renames pre-existing `'drive_photo_delivery'` grants → `'drive'` (conflict-safe). **No schema change; code does not depend on it.**

**Net result:** one consent, one registered redirect URI, one `provider='drive'` grant per event — powering Papic capture, Photo Delivery, and the drive-copy layer.

**Pilot-safe:** no real Drive grants exist yet (#19g pending). Disconnect now means "disconnect Drive entirely" from either panel.

**Verification:** full GitHub Actions suite green (typecheck+lint, production build, macOS/Windows build, e2e, lighthouse, bundle, secret scan).

**SPEC IMPACT:** Yes. The owner now registers only **one** Drive redirect URI (`GOOGLE_DRIVE_OAUTH_REDIRECT_URI`); `PHOTO_DELIVERY_OAUTH_REDIRECT_URI` is retired. COWORK_INBOX item appended.

---

## 2026-06-03 · feat(chrome): Messages icon in the dashboard top bar

**Commit:** see merge commit on this PR.

**Context:** Delta #2 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). Adds a Facebook-pattern Messages icon to the couple dashboard top bar right cluster, adjacent to the notifications bell.

**What ships:**

- `MessageSquare` (lucide-react) icon link added to the right cluster of the event-scoped top bar in `apps/web/app/dashboard/[eventId]/layout.tsx`, placed between the `RoleSwitchPill` (mobile-only) and `UnreadBellBadge`.
- Links to `/dashboard/${eventId}/messages` (the couple's vendor thread list, iteration 0019).
- `aria-label="Messages"` for accessibility.
- Styled exactly like `UnreadBellBadge`: `h-9 w-9 rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta` — Clean Editorial tokens throughout.
- **No unread badge:** `chat_messages` has no per-message `read_at` / `is_read` column in V1. There is no clean count source without a DB migration. Badge can be added once a read-receipts migration lands in a follow-up PR.
- Renders on both mobile and desktop (the top bar is shared across all breakpoints).

**Files changed:**

- `apps/web/app/dashboard/[eventId]/layout.tsx` — added `MessageSquare` to the lucide import; inserted the Messages `<Link>` element.

**Verification:** `pnpm -F web typecheck` → 0 errors. `next lint --file app/dashboard/[eventId]/layout.tsx` → No ESLint warnings or errors.

**SPEC IMPACT:** Yes — **iteration 0021** (couple dashboard chrome) and **iteration 0019** (communications / messages). The top bar now carries a Messages shortcut. Spec corpus should record this icon's presence in the couple dashboard chrome description. See `COWORK_INBOX.md [PENDING] 2026-06-03 — Messages icon` for the worklist entry.

---

## 2026-06-03 · feat(0001): keep the couple detail simple — remove the editorial live-view iframe

**Commit:** to be filled after commit.

**Context:** Owner clarification 2026-06-03 — "editorial" is just the same `/[slug]` page, which only becomes the editorial/recap view **after** the wedding (the existing day-of lifecycle's post/recap phase — nothing new to build). The couple's guest-detail should just show **their information, like any other guest. Keep it simple.**

**What changed (`guests/[guestId]/page.tsx`):** Removed the `CoupleEditorialPreview` live-view iframe shipped in the prior PR — the `events.slug` fetch, the render block, the component, and the now-unused `ArrowUpRight` import. The couple's detail is back to the standard info form. The couple-foundation rules are **retained** (auto-Attending, can't-delete, role + RSVP locked, renamable) — those are correctness behavior, separate from the editorial page. The unrelated `e.touches[0]` typecheck guard stays (already on `main`).

**Verification:** `tsc --noEmit` clean; `next lint` clean.

**SPEC IMPACT:** Iteration **0001** — reverts the editorial-live-view spec note. "Editorial" = the `/[slug]` page's post-wedding recap state (day-of lifecycle, 0031), activating at end of wedding; couple detail = plain info. The prior `COWORK_INBOX.md` live-view entry is rewritten accordingly.

---

## 2026-06-03 · feat(home): compact "Your wedding details" card from onboarding data

**Commit:** see merge commit on this PR.

**Context:** Delta #1 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). An audit found most of the redesign is already live (5-tab nav, Website tab, `/details` settings, Messages, top-bar Switch/bell), so this ports only the genuine new bits — starting with surfacing the couple's onboarding wedding details as one glanceable card on event Home.

**What ships:**

- **Compact "Your wedding details" card** on event Home — a keyed label→value list MERGING the events-row basics (Location · Venue · Guests · Budget · Style) with the two most service-defining onboarding style picks (Cuisine · Photo & video), plus a **"See all wedding settings →"** link to `/details`. Date + ceremony are omitted (the persistent top chrome already carries them).
- **Reshapes the existing `PersonalizedMenu` `preview` variant** — the live Home already rendered this onboarding data as chips; it now renders the kv card. `/for-you` (the `full` variant) is byte-for-byte unchanged (chips + the full "what matters" dl). Gated on `variant === 'preview' && detailRows.length > 0`, so behavior is unchanged when rows aren't passed.
- **New `buildWeddingDetailRows()` in `lib/personalized-menu.ts`** — reuses the existing `REGION_LABEL`/`VENUE_LABEL` maps + `style_preferences` cleaning; only present fields render, so the card never shows blanks.

**Files:** `lib/personalized-menu.ts` · `app/dashboard/[eventId]/_components/personalized-menu.tsx` · `app/dashboard/[eventId]/page.tsx`.

**Verification:** `pnpm -F web typecheck` ✓ · `pnpm -F web lint` (3 files) ✓ No ESLint warnings or errors. (Rebased onto current `main`, which already carries PR #830's `e.touches[0]` guard — the earlier `tsc` red on the stale base is gone.)

**SPEC IMPACT:** Yes — iteration 0021 (couple dashboard Home) gains the "Your wedding details" card. The model is already locked in corpus `DECISION_LOG.md` ("Customer dashboard chrome RE-LOCKED", 2026-06-03); logged as a `[PENDING]` COWORK_INBOX item to update 0021's Home-surface section.

---

## 2026-06-03 · feat(taxonomy): add Design › Digital Services tile + re-group the 3 Setnayan digital canonicals

**Commit:** see merge commit on this PR.

**Context:** Owner directive (2026-06-03) — surface a new **Digital Services** child tile under the DESIGN parent in the marketplace taxonomy, the home for Setnayan's digital/AI productions (Pakanta · Animated Monogram · Pro Website · Live Venue Photo Wall · Live Background/Pailaw). Code-only re-grouping (mirrors the 2026-05-31 shrink — no migration, every canonical preserved).

**What ships (`apps/web/lib/taxonomy.ts` only):**

- **New tile `digital_services`** added to the `WeddingTile` union, `WEDDING_TILE_ORDER` (after `led_wall`), `TILE_PARENT` (`→ 'design'`), `WEDDING_TILE_LABEL` (`'Digital Services'`) and `WEDDING_TILE_SLUG` (`'digital-services'`). DESIGN now has 8 tiles.
- **Re-pointed 3 existing Setnayan canonicals** to it: `setnayan_custom_monogram` (was `stylist_decorator`), `setnayan_pailaw` (was `led_wall`), `setnayan_pakanta` (was `program / wedding_singer` → now `design / digital_services`). Pakanta leaves the Program music shelf. `LED Wall` reverts to 3rd-party walls only; `Stylist / Decorator` loses the monogram option.
- **No new canonicals, no DB migration.** `setnayan_patiktok` already sits under `photo_booth` (no change). The V2 retail catalog (`platform_retail_catalog_v2`) is flat (no category column) and already carries these SKUs at owner-locked prices — nothing to seed.

**SPEC IMPACT:** Already reflected in the spec corpus this session (no Cowork action pending) — `Digital_Services_Cross_Surface_Map_2026-06-03.md` (new authoritative map) + `Vendor_Taxonomy_Shrink_2026-05-30.md` + `Service_Specifications_2026-06-02.md` + the `0006/0022/0023/0015/0021` + `Onboarding_Blueprint` surface specs + the `DECISION_LOG.md` 2026-06-03 rows. Open item flagged to owner: a Pailaw/Live-Background V2 SKU is absent from `platform_retail_catalog_v2` (needs an owner-confirmed price — not invented here); the dashboard/website/onboarding HTML prototypes update separately.

**Verification:** Additive tile + 3 re-points; all exhaustive `Record<WeddingTile,…>` maps (`TILE_PARENT` · `WEDDING_TILE_LABEL` · `WEDDING_TILE_SLUG`) updated so `tsc` stays exhaustive; a repo-wide grep found no other exhaustive `WeddingTile` map or tile-icon map. Local typecheck not runnable in this worktree (no `node_modules`) → CI clean-install runs typecheck/lint/build/Lighthouse/Vercel-preview.

---

## 2026-06-03 · feat(site-editor): flip the Website doorway to the editor + retire the journey scroll (Phase 2)

**Commit:** see merge commit on this PR.

**Context:** Phase 2 of the 2026-06-01 flip sequence (Phase 1 = card-parity, shipped PR #821). Owner directive: "make the editor the page and remove everything else." The full-screen Reels editor (`/site-editor/[eventId]`) is now the canonical wedding-website surface; the journey scroll (`/dashboard/[eventId]/website`, PR #704) is retired.

**What ships:**

- **Nav doorway → editor.** `customer-nav-config.ts` (desktop sidebar) + `customer-bottom-nav.tsx` (mobile slot 4) "Website" now point to `/site-editor/${eventId}` (was `${base}/website`). Tapping Website opens the full-screen editor directly, on mobile and desktop.
- **Journey route retired → redirect.** `/dashboard/[eventId]/website/page.tsx` is now a thin server redirect to `/site-editor/[eventId]` (not a 404), so bookmarks, deep-links, the animated-monogram back-links, and the onboarding prefetch all land on the editor. The former journey render (Steps 1–5 + Free-vs-Pro) is gone.
- **Editor wiring updated for the flip.** ✕ now closes to the event dashboard home (`/dashboard/[eventId]`) instead of the (now-redirecting) journey page — no loop. The Settings "Manage URL / Set your URL" cards + the no-slug preview CTA now deep-link to the **invitation editor** (`/dashboard/[eventId]/invitation`), which hosts the canonical shared `SlugField` + `updateEventSlug` action — so slug/URL management is fully preserved.
- **Incidental build-unblock (NOT part of the flip):** `main` was red on `tsc` from PR #827's swipe-delete (`e.touches[0].clientX/Y` unguarded under `noUncheckedIndexedAccess`, in `guest-list-multiselect.tsx`). Added a behavior-preserving null-guard so this PR — and `main` — typecheck green again. Flagged separately because it's unrelated to the flip but was blocking CI for every in-flight PR.

**Dead code (safe to delete in a follow-up cleanup):** `website/_components/{journey,pro-upgrade-panel,pro-website-panel,copy-button}.tsx` + `website/actions.ts` (`updateEventSlugFromWebsite`) — nothing imports them now.

**Verification:** `pnpm -F web typecheck` ✓ · `pnpm -F web lint` ✓ (no new warnings on edited files) · `pnpm -F web build` ✓.

**SPEC IMPACT:** Yes. The couple's "Website" doorway now opens the Reels editor; the journey scroll is retired (redirects). Iteration 0021 (couple dashboard Website tab) + the 2026-06-01 "Reels-style editor" decision-log row need the Phase-2 flip recorded. Logged as a `[PENDING]` COWORK_INBOX item.

---


## 2026-06-03 · feat(0001): couple detail shows a LIVE VIEW of their editorial (wedding) page + touches[0] typecheck fix

**Commit:** to be filled after commit.

**Context:** Owner directive 2026-06-03 (completes the deferred couple "album / custom data" item) — clicking the bride or groom shows **their future editorial page as a live view**. Their "editorial page" is their public wedding page at `/[slug]`.

**What shipped:**

1. **Editorial live view (`guests/[guestId]/page.tsx`).** Couple-only: fetch `events.slug`, then render a phone-framed, **same-origin** `<iframe src="/{slug}">` ("Editorial page" · live) above the edit form, with **Open** (new tab) + **Edit** (→ `/dashboard/[eventId]/website`) links. `loading="lazy"` keeps it off first paint. When no slug is set yet, a "Their wedding page isn't set up yet → Set up their page" fallback. Same-origin framing is safe — `next.config.ts` `headers()` sets no `X-Frame-Options` / CSP `frame-ancestors` (only touches `/sw.js` + `/manifest.json`).
2. **Pre-existing typecheck fix (`_components/guest-list-multiselect.tsx`).** `main` was red on `tsc`: the mobile swipe-to-delete card read `e.touches[0].clientX` (possibly-undefined under `noUncheckedIndexedAccess`). Guarded with `const t = e.touches[0]; if (t) …` — also hardens a real runtime crash. (Slipped onto `main` because merges aren't gated on the typecheck check.)

**Verification:** `tsc --noEmit` clean (it was *failing* on `main` before the touch guard); `next lint` clean for changed files. Visual confirmation via the PR's Vercel preview.

**SPEC IMPACT:** Iteration **0001** — the couple's guest-detail now embeds a live view of their `/[slug]` page (touches 0002/0015/0021). Completes the "album / custom data" follow-up flagged in the 2026-06-03 couple-foundation entry. Logged in `COWORK_INBOX.md` `[PENDING] 2026-06-03 (couple editorial live view)`.

## 2026-06-03 · feat(drive-copy): keystone — universal Google-Drive copy layer (R2 = system of record)

**Commit:** to be filled after commit.

**Context:** Owner storage lock 2026-06-03 (corpus `Storage_and_Drive_Copy_Architecture_2026-06-03.md` + `DECISION_LOG.md`): Cloudflare R2 is the **system of record**; Google Drive is the couple's **permanent copy** of six artifacts — Papic · Patiktok · Pabati · Pakanta · Monogram · QR codes. Panood is carved out (YouTube only). This PR is **Phase 1 (the keystone)** of the design-doc § 8 build plan: the shared copy module + its schema. Feeders (6), the cron tick, the R2 3-month compress job, and Drive quota handling are later PRs.

**What ships:**

- **Migration `20260726000000_drive_copy_layer_foundation.sql`** — generalized, additive copy-tracking schema (does NOT touch the live 0009 `photo_delivery_*` tables):
  - `drive_copy_folders` — per-event Drive folder id cache (root + one subfolder per artifact type); `UNIQUE(event_id, kind)`.
  - `drive_copy_artifacts` — per-file copy state across all six types; canonical dedupe `UNIQUE(event_id, r2_object_key)`; `copied_high_res` flag for the 3-month-window logic; pending-worker partial index. RLS enabled, **no policies** (service-role only — same convention as `photo_delivery_artifacts`).
- **`apps/web/lib/drive-upload.ts`** (new) — shared low-level byte primitives extracted **verbatim** from `photo-delivery-release.ts`: `readR2Object` + `uploadFileToDrive` (now mimeType-aware) + `createDriveFolder`. One R2→Drive path, not two.
- **`apps/web/lib/photo-delivery-release.ts`** — refactored to import the two primitives from `drive-upload.ts` (deleted its private copies). **Behavior-identical** — the live pilot Photo Delivery flow is unchanged.
- **`apps/web/lib/drive-copy.ts`** (new) — the keystone: `pushToDriveCopy()` (feeder entry point) + `enqueueDriveCopy` + `runDriveCopyBatch` (copy worker) + `ensureArtifactFolder` (root + per-type subfolder via the cache) + `getEventDriveAccessToken` (reads `oauth_grants(provider='drive')`, refresh-on-expiry). Always safe to call: with no Drive grant it enqueues and copies later.

**Seam (documented):** the layer reads the `provider='drive'` grant (Papic's original Drive connection); the live 0009 flow still uses its own `provider='drive_photo_delivery'` grant + folder. Collapsing both into one per-event "Connect Drive" is **Phase 0** (a later PR). Until then the layer is inert for events that only connected via Photo Delivery — feeders enqueue, the copy runs once a `drive` grant exists.

**Pilot-safe:** purely additive schema + a new module with no callers yet + a behavior-identical refactor of one shared file. Nothing changes for pilot couples.

**Verification:** `pnpm -F web typecheck`/`lint`/`build` not runnable in the `/tmp` worktree (no `node_modules` on the shared box) → relying on the full GitHub Actions CI gates (typecheck + lint + production build + e2e + bundle + secret scan). The admin Supabase client is untyped, so the new table/column references carry no generated-type risk; `events.event_date`/`display_name` selects mirror the existing `oauth/photo-delivery/callback` route verbatim.

**SPEC IMPACT:** Yes. Implements the 2026-06-03 storage lock. The corpus design doc (`Storage_and_Drive_Copy_Architecture_2026-06-03.md` § 7) + `DECISION_LOG.md` 2026-06-03 row already capture the architecture; the iteration-spec edits (0009 rescope · 0011 Panood carve-out · 0012 · 0017 · 0036 · 0037/0004 · 0002 · `CLAUDE.md` storage line · pax docs) are owed via Cowork. Logged as a `[PENDING]` COWORK_INBOX item.

---

## 2026-06-03 · feat(site-editor): migrate journey-page surfaces into the Reels editor carousels

**Commit:** to be filled after commit.

**Context:** The full-screen Reels editor (`/site-editor/[eventId]`, PR #719, 2026-06-01) shipped with 4 tabs but only a subset of the surfaces on the journey page it's meant to replace (`/dashboard/[eventId]/website`, PR #704). Per the 2026-06-01 decision-log flip sequence (① foundation → ② preview-follows-tab → ③ deepen per-tab tooling → ④ flip the Website tab to the editor), the editor must reach card-parity before the entry-flip. This session's owner directive: map every vital journey-page surface into the editor's Settings / Event carousels as cards. **Phase 1 = the cards (this PR). The entry-flip + journey-page retirement is Phase 2 (a later PR).**

**What ships:**

- **`apps/web/app/site-editor/[eventId]/page.tsx`** — adds the Pro-upgrade `ownedOrders` fetch (scoped to `monogram_hero_upgrade` + `pro_widget_schedule`, the two inline-buy widget upgrades), graceful-degrading to empty if the `orders` table is missing on a pre-bootstrap DB; passes `ownedOrders` to `SiteEditor`. Mirrors the journey page's fetch so the two surfaces agree on owned-state.
- **`apps/web/app/site-editor/[eventId]/_components/site-editor.tsx`:**
  - **Settings carousel** + **Keep your photos — Google Drive** (nav → `/add-ons/photo-delivery`) + **Custom QR per guest** (nav → `/add-ons/custom-qr-guest`).
  - **Event carousel** + **Monogram Hero** (Pro ₱1,999, inline buy) after Hero photo; + on-the-day cluster: **Preview day-of mode** (external `?preview=day_of`, conditional on slug), **Live stream — Panood** (nav), **Live Schedule** (Pro ₱999, inline buy), **Candid capture — Papic** (nav; the journey's two Papic rows merged), **Patiktok booth** (nav), **Live photo wall** (coming soon).
  - New **`ProCard`** component — catalog price via `findSku`/`formatCentavosPhp`, owned-state via `ownedOrders`, Upgrade CTA → `/dashboard/[eventId]/orders/new?service=<sku>`. Lifts the journey page's `ProUpgradePanel` pattern into the carousel `Card` shell.

**Architecture decision (load-bearing):** Only the **two Pro widget upgrades are inline-buy** (matching the existing `ProUpgradePanel`). Every other service — Panood / Papic / Patiktok / Custom-QR / Drive — is a **navigation card into its `/add-ons/<key>` page, which owns its own pricing + buy state**, per the locked website wiring rule (journey.tsx docstring · V2.1 Amendment #3). The earlier "full inline tools for all 5 services" intent was reconciled to this rule to avoid duplicating the canonical buy/config flows (incl. the V2 pax-based pricing). Whether to inline the Panood/Papic/Patiktok configurators too is deferred as an explicit owner decision.

**Pilot-safe:** the journey page (PR #704) is **untouched** and remains the working Website surface; this PR is additive to the already-shipped (but not-yet-primary) editor route. Nothing breaks for pilot couples.

**Verification:** `pnpm -F web typecheck` ✓ · `pnpm -F web lint` ✓ (no new warnings on the two edited files) · `pnpm -F web build` ✓ · full GitHub Actions CI suite ✓ (build macOS + Windows, production build, Lighthouse, Playwright e2e, bundle size, secret scan, typecheck + lint).

**SPEC IMPACT:** Yes. The canonical Website-editor surface now carries the full card set, including the **₱1,999 Monogram Hero** + **₱999 Live Schedule** inline upgrades and the Panood / Papic / Patiktok / Drive / Custom-QR navigation cards. The 2026-06-01 "Reels-style editor" decision-log row + iteration 0021 (couple dashboard Website tab) need a follow-up note that the editor reached card-parity with the journey page (Phase 1 of the flip). Logged as a `[PENDING]` COWORK_INBOX item.

---

## 2026-06-03 · feat(0001): bride & groom are the event's foundation — auto-Attending, undeletable, role-locked

**Commit:** to be filled after commit.

**Context:** Owner directive 2026-06-03 — the bride & groom are the foundation of the event: RSVP is automatically **Attending** (never Pending), they **can't be deleted**, they **can be renamed**, and "Bride/Groom" is hidden from the assignable **role** pickers. Clicking them opens their full detail (a richer album / custom-data surface is a separate follow-up pending owner spec).

**What shipped (`apps/web/.../guests/` + migration):**

1. **Auto-Attending.** New migration `20260725000000_guests_couple_attending.sql` — a `BEFORE INSERT OR UPDATE` trigger forces `rsvp_status='attending'` whenever `role IN ('bride','groom')`, plus a backfill for existing couples. The app also coerces on read (`coupleAttending` in `lib/guests.ts`, applied in `fetchGuestsByEvent` + `fetchGuestById`) so the UI is correct the instant this ships, before the migration is pushed. `updateGuest` forces it write-side too.
2. **Undeletable.** `softDeleteGuest` (single) + `bulkSoftDeleteGuests` (bulk) block bride/groom with a "foundation of the event" message, checked before the RSVP gate. The detail page hides the "Remove guest" button for the couple.
3. **Renamable.** Name fields stay editable on the couple's detail form.
4. **Hidden from Roles.** Bride/Groom removed from `BULK_ROLE_SECTIONS` (desktop SelectionBar + mobile Assign sheet), the new-guest role picker, and the detail-page role select. On the couple's own detail the role is read-only ("Foundation · locked") with a hidden input so the form still posts it; RSVP shows a locked "Attending · always".

**Verification:** `tsc --noEmit` clean; `next lint` clean for all changed files.

**Owner action:** push the migration (`supabase db push`) so the DB-stored value + every write path (CSV import, public RSVP) match the UI — see `OWNER_ACTIONS.md` 2026-06-03 item. The feature works in the UI without it (read-coercion); stored rsvp_status stays Pending until pushed.

**SPEC IMPACT:** Iteration **0001** — bride/groom RSVP/role/delete semantics. Logged in `COWORK_INBOX.md` `[PENDING] 2026-06-03 (couple foundation)`.

## 2026-06-03 · feat(0001): mobile Guests carousel — select-and-assign Customize, folded filters, side/role/group sort, cleaner sheet

**Commit:** to be filled after commit.

**Context:** Owner reviewed the mobile Guests page (the lower-third 4-panel carousel: Summary · Search & sort · Add · Customize) and gave five directives.

**What shipped (`apps/web/app/dashboard/[eventId]/guests/`):**

1. **Doubled line + separation (carousel container).** The carousel had a `border-t` on its container AND a `border-b` under the tab row ~40px apart — read as two overlapping lines. Replaced with a single raised-sheet treatment: `rounded-t-2xl` + soft upward shadow + one hairline `ring-1 ring-ink/10`, and dropped the tab-row bottom border. One clean "window above / panel below" separation.
2. **Removed the mobile header.** The `<header>` ("Guest list / N guests") was visible on all sizes; now `hidden lg:flex` (desktop only). On mobile the Summary panel already carries the count.
3. **Sort axes.** `SORT_OPTIONS` gains **Side · Role · Group** alongside the existing Last/First/RSVP/Newest (`role` already existed). New `sortCompare` cases: Side ranks bride→groom→both; Group sorts by each guest's first (alphabetical) custom-group label via `buildGroupSortKey`, ungrouped last. (Search already matched name/side/role/group/RSVP server-side — placeholder sharpened to "Name, side, role, group…".)
4. **Filters folded into Search & sort.** The View / Groups / Tags filter chips (displaced from Customize) now live under the Search & sort panel as a "Filter" section.
5. **Customize = select-and-assign.** New shared selection store (`guest-selection-store.ts`, `useSyncExternalStore`) bridges the list's checkboxes and the carousel. Tap **Select** → checkboxes appear on the mobile cards (gated on `selectMode`); the panel shows a **select-all checkbox + live count + Assign**. **Assign** opens a bottom sheet with **Side / Role / Group**, where Group has a create-new-group text box. Each choice dispatches the existing `bulkApplyRoleAndGroup` / `createGuestGroup` server action for the selection, then optimistically clears + closes. Desktop's floating `SelectionBar` is now `hidden lg:block` (mobile/tablet use the carousel); `BULK_ROLE_SECTIONS` exported for reuse so the sheet's role picker matches desktop exactly.

**Verification:** `tsc --noEmit` clean; `next lint` clean for all four files (no new warnings). Visual/interactive confirmation via the PR's Vercel preview (the authed Guests page needs a real session + seeded event, not reproducible in a bare local dev server).

**SPEC IMPACT:** Iteration **0001** (guest list) mobile UX changes — Customize is now select-and-assign (was filters), filters fold into Search & sort, and sort gains Side/Role/Group. Spec corpus `0001_creating_guest_list/0001_creating_guest_list.md` should reflect the new mobile carousel behavior. See `COWORK_INBOX.md` `[PENDING] 2026-06-03`.

## 2026-05-22 · docs(0001): flag guest_role bride/groom enum prod-push gap (Task #49)

**Commit:** to be filled after commit.

**Context:** Owner reported live 2026-05-22 (two screenshots) that guest-edit form throws `invalid input value for enum guest_role: "bride"` for Claire Buanhog (`S89G-6A8RCA9CJQ`) and `...groom` for Ice Casasola (`S89G-H83AGFJMK5`) when saving the "Role in wedding" select. Both forms correctly offer Bride / Groom; the production Postgres enum rejects.

**Diagnosis:** Migration `supabase/migrations/20260530020000_guest_role_add_bride_groom.sql` (commit `2e6f64f`, 2026-05-21) adds `'bride'` + `'groom'` to the `public.guest_role` enum and lives on `main`. The 2026-05-20 CLAUDE.md decision-log row 451 ("Prod migration parity verified") confirmed every migration through `20260522010000` was applied to prod — but 31 migrations have landed locally since that verification (including `20260530020000` ten days later). The owner has been pushing migrations regularly during this window; one (or more) appears to have been missed. `20260530020000` is the only one that affects the production-visible guest-list enum, so it surfaced first via this user-facing crash.

**Form schema vs DB enum audit (this row):**

- **Local main DB enum** (`supabase/migrations/20260513010000_iteration_0001_guests.sql` + `20260530020000_guest_role_add_bride_groom.sql`): 20 values including `'bride'` + `'groom'`.
- **Production DB enum** (inferred from the error message): the original 18 values from `20260513010000` — missing `'bride'` + `'groom'`.
- **Form select** (`apps/web/app/dashboard/[eventId]/guests/[guestId]/page.tsx` ROLE_OPTIONS + `new/page.tsx` ROLE_OPTIONS + `apps/web/lib/guests.ts` `GuestRole` type + `ROLE_LABELS` + `SINGLETON_GUEST_ROLES`): all 20 values including `'bride'` + `'groom'`.

**Fix path A chosen** (no code change · push existing migration to prod). The migration file follows the same `ALTER TYPE ... ADD VALUE IF NOT EXISTS` pattern as `20260514012000_notification_type_additions.sql` (the model cited in the migration's own header comment) — idempotent + safe to re-run on prod.

**What ships (this PR):**

- **`CHANGELOG.md`** — this entry.
- **`OWNER_ACTIONS.md`** — new "Owner action #11" appended to the 2026-05-22 sprint punch list with the `supabase db push --linked` instruction + verbatim SQL for the owner to paste into Supabase Studio if the CLI approach errors.
- **`STATUS.md`** — adds a "before next session" warning matching the existing pattern from 2026-05-14 (`6 unpushed migrations` warning that already lives at line 23).
- **`COWORK_INBOX.md`** — no entry (this is a deploy-side fix, not a spec-corpus update; the spec corpus already correctly documents Bride + Groom as singleton hard-single guest roles in iteration 0001).
- **NO app code changes** — the form, the lib types, the singleton enforcement migration `20260531010000_guests_unique_bride_groom_per_event.sql` are all correct on `main`.
- **NO new migration** — the existing `20260530020000_guest_role_add_bride_groom.sql` is the canonical fix; it just hasn't been applied to prod yet.

**Verification path** (post owner-action):

1. After `supabase db push --linked` succeeds, refresh the Claire Buanhog edit page and save with Bride role selected.
2. Refresh the Ice Casasola edit page and save with Groom role selected.
3. Both should succeed and the chair in the seating chart should show the correct role tier.

**Acceptance criteria:** PR ships these 3 doc updates; owner runs `supabase db push --linked`; Claire's + Ice's edits succeed.

**SPEC IMPACT:** None. The spec corpus iteration 0001 (`0001_creating_guest_list/0001_creating_guest_list.md`) already lists Bride + Groom as the two hard-single guest roles enforced via partial unique indexes. The bride/groom enum addition itself was a corpus-aligned migration when it landed 2026-05-21. This entry is purely a prod-deploy gap, not a spec-vs-code drift.

---

## 2026-05-22 · feat(0021): tiered wedding-date precision + vendor calendar intersection (Task #39 + Task #38 bundled)

**Commit:** to be filled after commit.

**Context:** Owner-confirmed V1 pilot-blocking feature (2026-05-22). Hosts shouldn't be forced to pick a specific Friday months before they know what's possible. The new model has 3 precision modes (year / month / day) — couples start at year ("Sometime in 2027"), narrow to a month once season is decided ("August 2027"), and commit to a specific day once their confirmed-vendor calendars intersect on a workable date. Bundled fix for Task #38: PR #301's `ceremony_type_locked_at = NOW()` auto-stamp on new events was a bug — broke the religion CTA for new events because the chip read locked-at and skipped CTA-state. Auto-stamp removed; chip now correctly fires the "Set wedding type" CTA on new events.

**What ships:**

- **`supabase/migrations/20260603100000_iteration_0021_event_date_precision.sql`** — new column `events.event_date_precision TEXT NOT NULL DEFAULT 'year'` with CHECK constraint `IN ('year', 'month', 'day')`. Backfill: existing rows with `event_date IS NOT NULL` → `'day'` (preserves their current full-date semantics); rows with `event_date IS NULL` → `'year'` (matches the lowest-commitment default). Idempotent `IF NOT EXISTS` pattern. No RLS changes — column piggybacks on existing event-scope policies.
- **`apps/web/lib/events.ts`** — new `EventDatePrecision` type · `formatEventDateWithPrecision(iso, precision, locale)` returns "Sometime in 2027" / "August 2027" / "Friday, August 15, 2027" depending on precision · `formatEventCountdown(iso, precision, now)` returns precision-aware countdown ("210 days to go" for day, "in 5 months" for month, "this year" / "in N months" / null for year depending on distance) · `PRECISION_ORDER` const for the refine-only ratchet comparison.
- **`apps/web/lib/vendor-availability.ts` (NEW)** — `rangeFromPrecision(iso, precision)` derives the [start, end] window from the placeholder date (year='2027-01-01' → Jan 1 - Dec 31 2027; month='2027-08-01' → Aug 1 - Aug 31 2027) · `getCommonAvailableDays(supabase, eventId, rangeStart, rangeEnd)` runs the intersection query: resolves confirmed `event_vendors.marketplace_vendor_id` for the event, pulls `vendor_calendar_blocks` overlapping the range, returns days inside [rangeStart, rangeEnd] where NO confirmed vendor has a block. RLS-respecting (uses the caller's user-scoped Supabase client). Errors return an empty result so the dashboard never crashes on a calendar-query failure.
- **`apps/web/app/dashboard/[eventId]/_components/event-date-input.tsx`** — rewritten to surface a 3-mode segmented picker (Year · Month + Year · Specific Day) above the per-mode input. Year mode = year dropdown (current year + 5 years); Month + Year mode = month + year dropdowns side-by-side; Specific Day mode = standard HTML date input. Submit packs `event_date` (placeholder for year/month) + `precision` into the form. Refine-only ratchet UI: when `confirmedVendorCount > 0`, the picker hides modes wider than the saved precision (e.g., host on day-precision with confirmed vendors sees only `[Specific Day]`; host on month-precision sees `[Month + Year] [Specific Day]`).
- **`apps/web/app/dashboard/[eventId]/_components/vendor-availability-intersection.tsx` (NEW)** — client component rendered below the date row on event home when `precision IN ('year', 'month')` AND `confirmedVendorCount > 0`. Three render modes by available-day count: (a) 0 days → "No day works" + Vendors-panel link, (b) 1–15 days → inline day chip list, click any to finalize, (c) 16+ days → "{N} days work" + Browse calendar CTA → modal grouped by month with day chips. Click any chip → confirmation modal → `updateEventDate` server action with `precision='day'` to collapse out of year/month into the specific day. Refine-only ratchet allows this transition (narrowing).
- **`apps/web/app/dashboard/[eventId]/actions.ts`** — `updateEventDate` extended to accept `precision` form field, persist `event_date_precision` alongside `event_date`, and run the refine-only ratchet: with `confirmed_vendor_count > 0`, widening precision (e.g., day → month) throws `"Can't widen precision — you have N confirmed vendor(s). Narrow your date instead (year → month → day), don't broaden it."` Same-day-changes at same precision still surface the existing Task #37 lock message.
- **`apps/web/app/dashboard/[eventId]/page.tsx`** — selects `event_date_precision` from the events row · threads `eventDatePrecision` into `EventDateInput` (as `initialPrecision`) and `WelcomeHeader` (replacing the prior `daysOut: number` prop) · WelcomeHeader rewritten to call `formatEventDateWithPrecision` + `formatEventCountdown` instead of `formatEventDate` · day-of-mode windowing (`isInDayOfWindow`) keeps reading `event_date` directly (placeholder date works correctly because no host at year/month precision is hitting the T-1h..T+8h window — they haven't booked vendors yet) · new pre-render block computes the vendor availability intersection (only fires for year/month + confirmed vendors) and renders `<VendorAvailabilityIntersection>` below the date row.
- **`apps/web/app/dashboard/create-event/actions.ts`** — **Task #38 bundled fix.** Removed the auto-stamp lines `ceremony_type_locked_at: isWedding ? new Date().toISOString() : null` and `ceremony_type_locked_by: isWedding ? user.id : null` from the events insert. New events now land with NULL `ceremony_type_locked_at` so the chip renders the "Set wedding type" CTA correctly (matching Claire & Ice's pre-launch behavior). `event_date_precision` is NOT set explicitly so the column default `'year'` applies.

**SPEC IMPACT:** Moderate — Task #39 introduces a new architectural primitive (event date as a tiered model rather than a specific-day-required field). This supersedes iteration 0021 § 10 narrative-driven multi-party date-change negotiation flow for the most common case (couple narrows date via vendor-availability intersection rather than negotiating a date change). Affects spec corpus iteration 0021 (date model + § 2.0a Date row UX) and tangentially iteration 0006 (vendor calendar blocks remain the same; new consumer for intersection queries). Spec-corpus CLAUDE.md decision log row pending — flagged in COWORK_INBOX.md.

---

## 2026-05-20 · feat(0005): wire LED Background Maker draft persistence (PR 2 of 5)

**Commit:** to be filled after commit.

**Context:** PR 2 of 5 for iteration 0005 LED Background Maker. The shipped scaffold (template gallery + loop selector + Photo Pool toggle) was UI-only — the "Render & queue for USB delivery" button generated a mock job id and nothing persisted. This PR wires the save flow against the PR #150 schema and updates the post-save copy so couples aren't promised emails the render pipeline can't deliver yet.

**What ships:**

- `apps/web/app/api/led-background/save/route.ts` — `POST /api/led-background/save`. Couple-authenticated; validates template_slug against the in-repo enum + loop_duration_s against the 5/10/30/90-min table; upserts a `led_background_configs` row keyed by `(event_id, is_default=TRUE)` via the partial unique index from PR #150. Returns `{ config_id, created }`. config_json holds `{ template_id, loop_duration_s, photo_pool_enabled }` — the rest of the spec's customization fields (palette, effect_intensity, animation_speed, overlay, aspect_ratio, show_couple_names, show_date) default at render time from the template's defaults until PR 2b adds editor controls.
- `apps/web/app/dashboard/[eventId]/add-ons/led/page.tsx` — server-side admin fetch loads the couple's default config (if any) and threads it through to the client component as `initialConfig`. Service-role admin client used because `led_background_configs` ships RLS-on with no policies yet.
- `apps/web/app/dashboard/[eventId]/add-ons/led/_components/led-background-maker.tsx`:
  - Accepts new `initialConfig` prop; restores `selectedSlug`, `loopSeconds`, `photoPoolEnabled` state from it on first render so reopening the page shows the last saved draft.
  - `handleRender` now POSTs to `/api/led-background/save`, surfaces a save error inline under the CTA when the request fails, and only flips to the success card on `res.ok`.
  - Removed the `generateMockJobId` helper; the success card now shows the real `config_id` (UUID) under "Draft ID".
  - Success-card copy rewritten to be honest: "Draft saved" instead of "Render queued"; the render-pipeline ETA / venue-USB language is now phrased as a future commitment ("when the render pipeline goes live…") rather than a near-term promise.
  - Reset CTA copy: "Render another loop" → "Edit draft". Dropped the "Track render status in Orders" link since the render flow doesn't exist yet.

**SPEC IMPACT:** Minor. The 0005 spec's § "Functional scope · Must work end-to-end" lists template gallery, live preview, render submission, render pipeline, download, Drive push, email notification, re-render. This PR delivers the persistence layer underlying the editor surface; render pipeline + Drive push + email notification + download all wait on PR 3. No locked decisions touched. The honest post-save copy is a temporary measure until the render pipeline ships; once PR 3 lands the success-card copy reverts to "Render queued" with real ETAs.

---

## 2026-05-20 · feat(0009): status + disconnect routes + finalization notifications (PR 5 of 5)

**Commit:** to be filled after commit.

**Context:** Final PR of the 0009 Photo Delivery V1 build. Closes the loop the worker (PR #154) opened: panel can now poll for live progress, couples can disconnect Drive cleanly, and finalized jobs fan out couple-side in-app + email notifications via the existing 0028 helper.

**What ships:**

- `supabase/migrations/20260520040000_iteration_0009_notification_types.sql` — adds two `notification_type` enum values (`photo_delivery_complete`, `photo_delivery_failed`). Bare migration (no transaction wrapper) since `ALTER TYPE ADD VALUE` rejects explicit BEGIN; `IF NOT EXISTS` keeps it idempotent. Matches the prior `force_majeure_filed` pattern from PR #76.
- `apps/web/lib/notifications.ts` — extends `NotificationType` enum + adds matching `NOTIFICATION_TYPE_LABEL` ("Photos delivered" / "Photo delivery failed") + `NOTIFICATION_TYPE_TONE` rows (emerald for complete, rose for failed).
- `apps/web/lib/photo-delivery-release.ts` — `finalizeJob` now calls a new `fanOutFinalizationNotice` that emits the relevant notification to every couple member of the event. Idempotency guard: `photo_delivery_jobs.notification_sent_at` is stamped first, so repeated empty-batch ticks after a job has already finalized don't re-fire.
- `apps/web/app/api/photo-delivery/status/route.ts` — `GET ?event_id=...`. Couple-authenticated. Returns `{ event: { photo_delivery_* fields }, job: { latest photo_delivery_jobs row } }`. Panel polls this ~2s during an active release.
- `apps/web/app/api/photo-delivery/disconnect/route.ts` — `POST { event_id }`. Couple-authenticated. Revokes the Drive refresh token at Google (best-effort), marks `oauth_grants.revoked_at`, and wipes the `events.photo_delivery_*` panel fields back to idle. Idempotent — safe to re-call.

**Out of scope (deliberately deferred):**

- Panel UI re-wiring (the `photo-delivery-panel.tsx` client component is still scaffold-level: 516 lines of local-state mock data). A follow-up PR replaces the mock state with real fetches against `/status`, calls `/release` on the Connect-CTA click path, and surfaces a Disconnect button against `/disconnect`. Not a blocker for V1 since the OAuth flow + worker are end-to-end functional; only the visual surface lags.
- Redeliver is implemented by simply re-POSTing to `/api/photo-delivery/release` — `enqueueRelease`'s artifact UPSERT skips already-delivered photos by virtue of the unique-on-source-photo-id constraint + `drive_file_id IS NULL` worker filter. No new route needed.

**SPEC IMPACT:** None on locked policy. The notification copy is owner-tunable; if the owner prefers different language for "Photos delivered" / "Photo delivery hit a snag", that's a small follow-up — the strings live in `apps/web/lib/photo-delivery-release.ts` (`fanOutFinalizationNotice`) for the email/notification body and in `apps/web/lib/notifications.ts` for the bell-label. The 0028 email infrastructure send-path is unchanged; this PR just emits two new notification types through it.

---

## 2026-05-20 · feat(0009): photo-delivery release producer + sweep tick (PR 4 of 5)

**Commit:** to be filled after commit.

**Context:** PR 4 of 5 for iteration 0009 Photo Delivery. The 0009 brief assumed a Cloudflare Workers + Queues background pipeline; that infra doesn't exist in this repo. This PR ships a Vercel-native equivalent that fits the existing on-access-sweep cron strategy. Follows PR 1 (schema), PR 2 (encryption.ts helper — currently unused; planned harmonization deferred), PR 3 (Drive OAuth routes).

**What ships:**

- `supabase/migrations/20260520030000_iteration_0009_photo_delivery_artifacts.sql` — new `photo_delivery_artifacts` join table (job_id, event_id, source_table='papic_photos' for now, source_photo_id, r2_object_key, drive_file_id, attempt_count, last_error_*). Unique (event_id, source_table, source_photo_id) keeps re-releases idempotent. Partial index on (event_id, attempt_count, created_at) WHERE drive_file_id IS NULL covers the worker's hot path. RLS on, no policies — server role only.
- `apps/web/lib/photo-delivery-release.ts` — `enqueueRelease` (validates event state, lists deliverable `papic_photos` rows, creates job + upserts artifacts, flips events status) and `processBatchForEvent` (token refresh via `papic-drive.ts`, R2 download via `@aws-sdk/client-s3` GetObject, Drive multipart upload to `events.photo_delivery_folder_id`, per-file retry with attempt_count cap = 5, progress rollup, terminal job finalization).
- `apps/web/app/api/photo-delivery/release/route.ts` — POST producer. Couple-auth required; validates membership via event_members; delegates to `enqueueRelease`.
- `apps/web/app/api/cron/photo-delivery-tick/route.ts` — POST sweep. `x-cron-secret` guard (reuses `OAUTH_REFRESH_CRON_SECRET`); picks up to 5 events with `photo_delivery_status ∈ {'releasing','uploading'}` per tick, processes 6 artifacts per event.

**Architecture deviations from spec (all flagged in COWORK_INBOX.md):**

1. No Cloudflare Workers — Vercel routes + cron tick instead.
2. Source of truth is `papic_photos`, not a unified `photos` table (which doesn't exist).
3. Per-photo delivery state lives in new `photo_delivery_artifacts` join table, not on the source photos table.
4. Drive route names are `/api/oauth/photo-delivery/*`, not `/api/oauth/google/*` from the spec.
5. Refresh token stays plaintext in `oauth_grants` (Papic's shipped pattern); PR 1 `events.photo_delivery_oauth_token_encrypted` column + PR 2 `encryption.ts` helper currently unused, pending a future harmonization PR that may migrate `oauth_grants.refresh_token` to encrypted via pgcrypto.

**Owner actions (gating live operation):**

1. Set `OAUTH_REFRESH_CRON_SECRET` in Vercel env vars if not already set (also unlocks the existing OAuth-refresh cron).
2. Configure an external scheduler to POST `/api/cron/photo-delivery-tick` with `x-cron-secret` header every 1-2 minutes. Cloudflare Cron Triggers or Vercel Cron are both fine; cadence is a tradeoff between Drive API quota burn and delivery latency.
3. `PHOTO_DELIVERY_OAUTH_REDIRECT_URI` + Google Cloud redirect URI registration (still pending from PR 3).
4. `ENCRYPTION_KEY` in Vercel (still pending from PR 2; unused today but kept ready for the harmonization).

**SPEC IMPACT:** SUBSTANTIAL — see `COWORK_INBOX.md` entry "2026-05-20 — Iteration 0009 architecture deviations" for the full owner-walked update list against `0009_photo_delivery.md`.

---

## 2026-05-20 · feat(0009): OAuth start + callback routes for Photo Delivery Drive (PR 3 of 5)

**Commit:** PR #153 (`ce0aa86`).

**Context:** Backfill — process-gap catch-up for the 4 PRs shipped earlier this session without CHANGELOG entries.

**What ships:** New routes `/api/oauth/photo-delivery/start` + `/callback`. New provider value `'drive_photo_delivery'` on `oauth_state` + `oauth_grants`. New helper lib `photo-delivery-drive.ts`. `.env.example` adds `PHOTO_DELIVERY_OAUTH_REDIRECT_URI`. See PR #153 body for the full file list.

**SPEC IMPACT:** Rolled into the 2026-05-20 PR 4 SPEC IMPACT row above (consolidated).

---

## 2026-05-20 · feat(0009): AES-256-GCM token encryption helper (PR 2 of 5)

**Commit:** PR #152 (`fcd1389`).

**What ships:** `apps/web/lib/encryption.ts` (lazy-loaded AES-256-GCM via `ENCRYPTION_KEY`, server-only). `.env.example` adds `ENCRYPTION_KEY`.

**SPEC IMPACT:** None on current behaviour — helper sits unused after the PR 3 architectural call to use `oauth_grants` plaintext. Will be reused when `oauth_grants.refresh_token` migrates to encrypted-at-rest.

---

## 2026-05-20 · feat(0009): photo-delivery schema foundation (PR 1 of 5)

**Commit:** PR #147 (`f75a462`).

**What ships:** 12 `photo_delivery_*` columns on `events` + new `photo_delivery_jobs` table.

**SPEC IMPACT:** `events.photo_delivery_oauth_token_encrypted` is currently dead per the PR 3 architectural call (using `oauth_grants` plaintext instead). Will be re-evaluated in the future harmonization PR.

---

## 2026-05-20 · feat(0005): LED background schema foundation — configs + renders (PR 1 of 5)

**Commit:** PR #150 (`3b105bc`).

**What ships:** `led_background_configs` (10-template enum, one-default-per-event) + `led_background_renders` (1080p/4k/8k/custom resolution guard, master loop length 300/600/1800/5400 s).

**SPEC IMPACT:** SKU seed deferred — the spec's 2026-05-08 pricing table at `0005_led_background_maker.md` shows 8K ₱99 cheaper than 1080p ₱249 which reads like a transposed typo; owner reconciliation needed before live SKUs ship. See `COWORK_INBOX.md` 2026-05-20 entry "0005 LED pricing table sanity check".

---

## 2026-05-19 · feat(0015): wire 8 PH coverage-map city photo tiles

**Commit:** to be filled after commit.

**Context:** Continues the placeholder sequence (PRs #130 hero/portraits, #132 add-ons/covers). The coverage-map section was an SVG silhouette + 6 city chips reading as abstract dots-on-a-map. Adding a small photo-tile grid below the SVG turns the section into a "real places, real coverage" visual without overwhelming the map itself. Two new cities added (Tagaytay + Bohol) since Tagaytay is a key PH wedding destination and Bohol's Chocolate Hills are an iconic regional marker.

**What ships:**

- `apps/web/public/coverage/{manila,tagaytay,baguio,iloilo,cebu,bohol,cagayan-de-oro,davao}.avif` — 8 city vignettes from Higgsfield `soul_location` (1:1 at 2048×2048, AVIF q=65, total 1.0 MB).
- `apps/web/app/page-sections/_CoverageMap.tsx`:
  - `PIN_PLACEHOLDERS` gains `image: string` field on each entry + 2 new pins (Tagaytay, Bohol). Reordered geographically (north-to-south).
  - Chip strip replaced with a 2-col mobile / 4-col desktop photo-tile grid (each tile = `aspect-square` AVIF + city label below). Subtle `hover:scale-[1.04]` for the photos. Photo tiles are decorative — `alt=""`, hover-scale obeys `prefers-reduced-motion: reduce` (transition disabled by the global Phase 1 reduce-motion block).
- `apps/web/public/coverage/README.md` (new) — file mapping, source notes, replacement contract, privacy invariant per 0015 § Section 10 (city-level only — never barangay, never identifiable couples).

**SPEC IMPACT:** None on schema/SKU/policy. Two new cities surfaced on the marketing-site coverage map (Tagaytay, Bohol); the privacy invariant (city-level only) is preserved. Iteration `0015_main_website.md` § Section 10 already calls for a `city-pins` overlay — the new tiles below the map don't change that contract.

---

## 2026-05-19 · feat(0015): wire 11 add-ons tile photos + 2 dashboard cover placeholders

**Commit:** to be filled after commit.

**Context:** PR #130 landed the hero + portrait placeholder set. This continues the placeholder sequence the owner requested ("create placeholders for all items on our website"). Section 7 of the homepage (`_InAppServices.tsx`) was 11 icon-only cards reading as a generic feature list — adding a per-card hero image transforms the section into a product showcase. Couple-dashboard cover photos land as ready inventory pending the 0021 cover-slot wiring.

**What ships:**

- `apps/web/public/add-ons/{papic,panood,pamahiya,pakulay,pailaw,pareto,custom-monogram,pro-invitation-widgets,ai-video,photo-delivery,supplies-marketplace}.avif` — 11 AI-generated 16:9 tile banners (Higgsfield `z_image`, AVIF q=65, total 1.10 MB).
- `apps/web/public/dashboard/{cover-couple-venue,cover-reception-table}.avif` — 2 wide-frame cover placeholders for the eventual couple-dashboard event-header cover slot. Not yet wired; sample wiring snippet in `public/dashboard/README.md`.
- `apps/web/app/page-sections/_InAppServices.tsx` — Added `image: string` field to the `SERVICES` type + array (11 paths). Refactored each card to render a 16:9 `<Image>` banner at the top (rounded-xl `overflow-hidden`, `aspect-[16/9]`, `object-cover`). First 3 cards lazy-load eagerly; remaining 8 use default lazy behavior so below-fold cards don't compete for bandwidth on first paint.
- `apps/web/public/add-ons/README.md` (new) — mapping table, source notes, replacement contract.
- `apps/web/public/dashboard/README.md` (new) — wiring instructions for when 0021 adopts the slot.

**SPEC IMPACT:** None. Placeholder imagery only. Real photography lands via the same `image: '/add-ons/<slug>.avif'` pointers once Setnayan books real events.

---

## 2026-05-19 · feat(0015): commit Higgsfield AI placeholder hero + 11 portrait/variant placeholders

**Commit:** to be filled after commit.

**Context:** Phase 5 of the recent responsive/UX audit landed the `<HeroBackdrop>` infrastructure with an env-var-driven photo slot (PR #128), and Phase 4 added the aurora motion behind it (PR #129). Both shipped with no real asset — the homepage rendered the aurora + cream gradient. This PR commits the AI-generated placeholder set requested by the owner.

**What ships:**

- `apps/web/public/hero/hero-couple.avif` — Take 1 of the "forehead-touch / golden hour / left-third composition" prompt set. Generated via Higgsfield `z_image` (16:9, 2048×1152), AVIF q=65, ~62 KB on the wire.
- `apps/web/public/hero/variants/` — 5 alternate compositions (forehead-touch take 2, walking 1+2, ring-detail 1+2). Available for instant swap via `NEXT_PUBLIC_HERO_IMAGE_URL`.
- `apps/web/public/portraits/` — 6 cinematic solo-character portraits (3 grooms, 3 brides) for use as vendor-card / testimonial-avatar placeholders until the verified vendor cohort onboards (Dec 2026 launch). Generated via Higgsfield `soul_cast`.
- `apps/web/app/_components/hero-backdrop.tsx` — `src` default changed from `process.env.NEXT_PUBLIC_HERO_IMAGE_URL` (which could be undefined → gradient fallback) to `process.env.NEXT_PUBLIC_HERO_IMAGE_URL ?? '/hero/hero-couple.avif'`. Env var still wins when set; the committed file is now the deterministic default.
- `apps/web/public/hero/README.md` rewritten — documents what's live, what variants are on deck, swap procedure, and the brief for the eventual real photoshoot.
- `apps/web/public/portraits/README.md` (new) — usage pattern for vendor-card fallbacks (hash `public_id` → portrait), with a hard rule against captioning these AI faces with real names/businesses/testimonials.

**Conversion pipeline:** PNG 2048×1152 source from Higgsfield CDN → AVIF q=65 effort=6 via `sharp@0.34.4`. Total committed weight: 1.34 MB across 12 files (avg ~110 KB).

**SPEC IMPACT:** None. Placeholders only — no schema, no SKU, no copy, no feature surface changes. The eventual real photoshoot (an owner-action item flagged in the responsive/UX audit) will replace `hero-couple.avif` with a real Filipino wedding moment; that swap is also documented in `public/hero/README.md`. The portrait set is explicitly marked as **not for use with real names** — when verified vendors land they'll provide real photos via the upload pipeline (iteration 0006 + 0023).

---

## 2026-05-16 · feat(0012): Google Drive OAuth + Papic storage-choice setup (V1 scope expansion)

**Commit:** to be filled after commit.

**Context:** Sibling PR to the YouTube/Panood slice from earlier today (PR #95, SHA `565e79c`). Iteration 0012 Papic is V1.5+ deferred in the spec corpus, but per the 2026-05-16 decision-log row "OAuth wiring for V1.5+ scaffold setup pages shipped early" the owner expanded V1 scope so couples can connect their BYO Google Drive at setup time. This PR is the Papic/Drive slice of that decision. The shared `oauth_grants` foundation already shipped in PR #95 (`20260516260000_oauth_grants_per_couple.sql`); this PR adds the per-event `papic_storage_target` column + the Drive OAuth round-trip + a rewritten Papic setup page that surfaces the storage choice as a radio.

**What this rewrites:** the Papic setup page at `apps/web/app/dashboard/[eventId]/add-ons/papic/page.tsx` previously framed Papic as purely a V1.5+ surface with mock data. This rewrite preserves all the existing sections (seat status, DSLR bridge, gestures, gallery preview, settings) and adds a new **Section 1: "Where your photos go"** containing two radio cards:
- **Setnayan storage** (recommended default) — fast and reliable, Setnayan keeps a secure copy.
- **Use my Google Drive only** — narrower scope, no Setnayan copy, but quota + reliability tradeoffs on the couple.

**Spec deviation from earlier T+30d transfer model (LOCKED 2026-05-16):** the prior 0012 spec contemplated Setnayan keeping photos for 30 days then bulk-pushing to Drive. The new model is **real-time DURING the event for BOTH options** — R2 is the primary by default; couples who opt out get Drive throttling + their own quota constraints as a deliberate tradeoff. No bulk-transfer pipeline ships in V1. Spec corpus catch-up queued in COWORK_INBOX.md.

**Why it's safe to ship today:** every Drive surface is wrapped in a graceful-fallback check — if `GOOGLE_DRIVE_OAUTH_CLIENT_ID` is unset (the expected state until Google Cloud verified-app review completes, 1-4wk) the Drive radio renders disabled with an italic "coming soon — admin setup pending" caption and the start route returns 503 with a structured error. The Setnayan-R2 default option remains fully functional. Couples don't see broken buttons; the V1 launch isn't blocked on the owner-side OAuth timeline.

**New migration `supabase/migrations/20260516280000_events_papic_storage_target.sql`:**
- `ALTER TABLE events ADD COLUMN papic_storage_target TEXT NOT NULL DEFAULT 'setnayan_r2' CHECK (papic_storage_target IN ('setnayan_r2', 'google_drive_only'))`. TEXT + CHECK rather than ENUM to match the `oauth_grants.provider` pattern already in PR #95 — easier to extend later without enum-in-transaction friction.
- `COMMENT ON COLUMN` documents the V1 contract: `'google_drive_only'` requires an active `oauth_grants` row with `provider='drive'` for the same event_id; the disconnect route flips the column back to `'setnayan_r2'` to keep the capture pipeline from being left in a broken state.

**New helper module `apps/web/lib/papic-drive.ts`** (mirrors `lib/panood-youtube.ts`):
- `getDriveOAuthConfig()` — env-driven config status with `ready: false, missing[]` branch for graceful fallback.
- `buildDriveAuthorizeUrl()` — Google OAuth consent URL with `access_type=offline` + `prompt=consent` + scope `drive.file` (narrowest possible — only files Setnayan creates in the couple's Drive, NOT full Drive access).
- `exchangeDriveCodeForToken()`, `refreshDriveAccessToken()`, `revokeDriveToken()` — Google token endpoint wrappers.
- `fetchDriveUserInfo()` — userinfo endpoint call for `external_account_display` (best-effort).
- `bootstrapPapicDriveFolders()` — creates `Setnayan/[Event display_name]/{00_Cover, 01_Pre-event, 02_Ceremony, 03_Reception, 04_Auto-Recap}` via parallel Drive API folder creates; returns the root folder id to store in `oauth_grants.metadata.drive_folder_id` so the V1.5+ capture pipeline knows where to write.
- `generateDriveStateToken()` — 24-byte hex CSRF nonce, same scheme as YouTube/Patiktok so the shared `oauth_state` table sees uniform-looking values.
- `PAPIC_DRIVE_SUBFOLDERS` exported as a constant so the connected-panel UI can render the structure preview even when metadata is empty for any reason.

**New OAuth routes (all guard env-missing → 503 / coming-soon caption):**
- `apps/web/app/api/oauth/drive/start/route.ts` — couple-membership check, inserts oauth_state row with `provider='drive'`, 302 to Google.
- `apps/web/app/api/oauth/drive/callback/route.ts` — validates state, exchanges code, fetches userinfo, bootstraps the Drive folder tree (failure here redirects with `?drive_error=folder_bootstrap_failed:...` so we never persist a grant without a folder id), upserts oauth_grants (onConflict: `event_id,provider` so a re-consent replaces in place and recreates the folder structure). Redirects to `/dashboard/[eventId]/add-ons/papic?drive_connected=1` or `?drive_error=<reason>`.
- `apps/web/app/api/oauth/drive/disconnect/route.ts` — POSTs Google's revoke endpoint best-effort, flips `revoked_at` locally, AND resets `events.papic_storage_target` back to `'setnayan_r2'` (paired updates run via `Promise.all`) so the capture pipeline can't be left pointing at a disconnected grant.

**New server actions `apps/web/app/dashboard/[eventId]/add-ons/papic/actions.ts`:**
- `setPapicStorageR2(formData)` — always safe; flips `events.papic_storage_target` to `'setnayan_r2'`.
- `setPapicStorageDrive(formData)` — defensive re-check that an active oauth_grants row exists for (event_id, 'drive') before flipping the column. If no grant, redirects with `?storage_error=connect_drive_first`. The UI also gates the button on connection state but the server checks again so a stale form submission can't leave the capture pipeline pointed at a phantom grant.

**Token-refresh worker extension `apps/web/app/api/cron/oauth-refresh/route.ts`:**
- Replaced the `provider !== 'youtube'` early-skip block with a per-provider dispatch (`youtube` → `refreshYoutubeAccessToken`, `drive` → `refreshDriveAccessToken`). Both providers call the same Google OAuth token endpoint but use SEPARATE env-driven client credentials so they can be rotated independently. The TikTok grants still live in `patiktok_oauth_grants` and skip with `provider_not_yet_implemented`.

**Papic setup page rewrite:** preserves all 5 existing scaffold sections (now renumbered 2-6 — seat status, DSLR bridge, gestures, gallery preview, settings) and inserts a new **Section 1: "Where your photos go"** above them. The new section renders:
- Two radio cards (Setnayan R2 with "Recommended" pill / Drive with quota-warning caption).
- Each radio is its own form submitting to the server action; clicking switches the storage target server-side and revalidates the path.
- Below the Drive radio: either the "coming soon" caption (env-missing), the Connect Drive CTA (env-ready, no grant), or the connected panel with disconnect form + bootstrapped folder structure preview (env-ready, grant present).
- Status banners surface `?drive_connected=1` / `?drive_disconnected=1` / `?drive_error=<reason>` / `?storage_set=r2|drive` / `?storage_error=<reason>` from the query string.

**Env vars added to `.env.example`:**
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` with owner-action notes explaining the dual-purpose Google Cloud client (YouTube + Drive can share the same OAuth 2.0 client; the redirect URI distinguishes them).
- No new cron secret — the Drive refresh sweep reuses `OAUTH_REFRESH_CRON_SECRET` from PR #95.

**Tests:** no test runner exists in `apps/web` today. The integration cases called out in the brief (radio default = R2; Drive radio disabled when env unset + "coming soon" visible; `/start` 503-when-unset → 302-when-set; `/callback` state-mismatch rejection; bootstrap creates 5 sub-folders; `setPapicStorageDrive` rejects when no active grant) are noted as `TODO(0012): integration tests` at the bottom of the Papic page so the next iteration that lands a test runner picks them up automatically.

**Files:**
- `supabase/migrations/20260516280000_events_papic_storage_target.sql` — NEW.
- `apps/web/lib/papic-drive.ts` — NEW.
- `apps/web/app/api/oauth/drive/{start,callback,disconnect}/route.ts` — NEW.
- `apps/web/app/dashboard/[eventId]/add-ons/papic/actions.ts` — NEW.
- `apps/web/app/dashboard/[eventId]/add-ons/papic/page.tsx` — REWRITE (Section 1 added; sections 2-6 preserved with renumbering).
- `apps/web/app/api/cron/oauth-refresh/route.ts` — EDIT (drive branch wired; existing youtube branch unchanged).
- `.env.example` — appended Iteration 0012 Drive OAuth section.

**SPEC IMPACT:** **YES** — four pending Cowork updates queued in `COWORK_INBOX.md`:
1. `~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md` — add storage-choice flow section + the new `events.papic_storage_target` schema + flag the deviation from the T+30d transfer model.
2. `~/Documents/Claude/Projects/Setnayan/App_Build_Status.md` — flip iteration 0012 row from "🟡 V1.5+" to "⚠️ Partial — Drive OAuth + storage-choice setup shipped V1; capture pipeline still V1.5+".
3. `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` — append a decision-log row dated 2026-05-16 capturing the Papic V1 scope expansion + the spec deviation + the dual-purpose Google Cloud client.
4. `~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md` — add § 5.6 (or extend § 5.3) for the Drive OAuth scope; flag the dual-purpose YouTube+Drive OAuth client.

---

## 2026-05-16 · feat(0011): YouTube OAuth wiring + Panood setup rewrite (V1 scope expansion)

**Commit:** to be filled after commit.

**Context:** Iteration 0011 Panood is V1.5+ deferred in the spec corpus, but per the 2026-05-16 4th decision-log row the owner authorized OAuth wiring on the V1.5+ scaffold setup pages so couples can connect their BYO accounts at setup time. This PR is the YouTube slice of that decision; sibling Agent B (Papic / Drive, iteration 0012) and Agent C (Patiktok / TikTok, iteration 0017 — already shipped via PR #92) close the rest. The PR also introduces the shared `oauth_grants` foundation that all three providers will eventually share (TikTok still uses the older `patiktok_oauth_grants` for V1; consolidation is a follow-up).

**What this rewrites:** the Panood setup page at `apps/web/app/dashboard/[eventId]/add-ons/panood/page.tsx` reflected the composite-era model (Cloudflare Stream Live + Setnayan-owned master YouTube channel). Per the 2026-05-16 BYO-YouTube pricing pivot Panood now broadcasts on each couple's own channel. This rewrite adds a Step 1 "Connect your YouTube channel" panel and reframes the existing sections around BYO ownership while preserving the existing SKU display + visual language.

**Why it's safe to ship today:** every Connect surface is wrapped in a graceful-fallback check — if `YOUTUBE_OAUTH_CLIENT_ID` is unset (the expected state until Google Cloud verified-app review completes, 1-4wk window) the page renders a disabled "coming soon — admin setup pending" placeholder and the start route returns 503 with a structured error. Couples don't see broken buttons; the V1 launch isn't blocked on the owner-side OAuth timeline.

**New migration `supabase/migrations/20260516260000_oauth_grants_per_couple.sql`** (NOT the originally-assigned 230000 slot — that slot was already taken by the iteration 0017 Patiktok migration that landed earlier today; bumped to 260000 to keep the lexical chain consistent on this date):
- `public.oauth_grants(grant_id, event_id → events, provider IN ('youtube','drive','tiktok'), scopes TEXT[], refresh_token, access_token, access_token_expires_at, external_account_id, external_account_display, granted_at, revoked_at, last_refreshed_at, metadata JSONB)` with `UNIQUE(event_id, provider)` and three indexes (event+provider, active partial, expiry).
- RLS: `event_member_reads_oauth_grants` for couples (uses `public.current_event_ids()`), `admin_manages_oauth_grants` for admin. Writes go through service-role routes only — no couple-write policy.
- `public.oauth_state(state_token PK, event_id, provider, initiated_by, created_at)` CSRF nonce table with admin-only read RLS.
- `TODO(security):` annotated in the migration body — refresh_token + access_token are TEXT for V1 (Supabase Postgres at-rest encryption only); a pgcrypto column-level encryption wrapper is a follow-up once a project-wide helper lands.

**New helper module `apps/web/lib/panood-youtube.ts`:**
- `getYoutubeOAuthConfig()` — env-driven config status with `ready: false, missing[]` branch for graceful fallback.
- `buildYoutubeAuthorizeUrl()` — Google OAuth consent URL with `access_type=offline` + `prompt=consent` + scopes `youtube` + `youtube.upload`.
- `exchangeYoutubeCodeForToken()`, `refreshYoutubeAccessToken()`, `revokeYoutubeToken()` — Google token endpoint wrappers.
- `fetchYoutubeChannel()` — channels API call for the display label (best-effort, failure doesn't block grant persistence).
- `generateYoutubeStateToken()` — 24-byte hex CSRF nonce.

**New OAuth routes (all guard env-missing → 503 / coming-soon redirect):**
- `apps/web/app/api/oauth/youtube/start/route.ts` — couple-membership check, inserts oauth_state row, 302 to Google.
- `apps/web/app/api/oauth/youtube/callback/route.ts` — validates state, exchanges code, fetches channel info, upserts oauth_grants (onConflict: event_id,provider so a re-consent replaces in place), redirects to `/dashboard/[eventId]/add-ons/panood?youtube_connected=1` or `?youtube_error=<reason>`.
- `apps/web/app/api/oauth/youtube/disconnect/route.ts` — POSTs Google's revoke endpoint best-effort, flips `revoked_at` locally.

**New cron worker stub `apps/web/app/api/cron/oauth-refresh/route.ts`:**
- Auth via `x-cron-secret` header (constant-time compare against `OAUTH_REFRESH_CRON_SECRET` env).
- Walks `oauth_grants` rows with `access_token_expires_at < now() + 24h AND revoked_at IS NULL`, refreshes each YouTube grant, updates the row in place.
- `TODO(0011):` scheduling itself is owner-side (Cloudflare Cron Trigger or Supabase pg_cron). Recommended cadence: hourly during PHT 06:00-23:00.
- `TODO(0012, Agent B):` Drive branch left as `provider != 'youtube' → skipped`; will be filled when Agent B lands.

**Panood setup page rewrite:** five sections — Step 1 connect (NEW), Step 2 SKU summary (preserved from scaffold), Step 3 broadcaster + cameras (preserved), Step 4 add-on packs (preserved), Step 5 viewer info (rewording: "Setnayan's master channel" → "your own channel"). Status banners surface `?youtube_connected=1` / `?youtube_disconnected=1` / `?youtube_error=<reason>` from the query string. Replaced the `Youtube` lucide icon (not in the pinned lucide-react@1.14.0) with `Tv` to match the existing icon vocabulary.

**Env vars added to `.env.example`:**
- `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI` (Google Cloud project + verified-app review owner action).
- `OAUTH_REFRESH_CRON_SECRET` (shared with the future Drive refresh sweep).

**Tests:** no test runner exists in `apps/web` today (`package.json` exposes lint + typecheck only). The integration cases called out in the brief (`/start` 503-when-unset → 302-when-set; `/callback` state-mismatch rejection; setup page coming-soon vs Connect render) are noted as `TODO(0011): integration tests` at the bottom of the Panood page so the next iteration that lands a test runner picks them up automatically.

**Files:**
- `supabase/migrations/20260516260000_oauth_grants_per_couple.sql` — NEW.
- `apps/web/lib/panood-youtube.ts` — NEW.
- `apps/web/app/api/oauth/youtube/{start,callback,disconnect}/route.ts` — NEW.
- `apps/web/app/api/cron/oauth-refresh/route.ts` — NEW.
- `apps/web/app/dashboard/[eventId]/add-ons/panood/page.tsx` — REWRITE (Step 1 added, Step 5 reworded; rest preserved).
- `.env.example` — appended Iteration 0011 section.

**SPEC IMPACT:** **YES** — three pending Cowork updates queued in `COWORK_INBOX.md`:
1. `~/Documents/Claude/Projects/Setnayan/App_Build_Status.md` — flip iteration 0011 row from "🟡 V1.5+" to "⚠️ Partial — OAuth setup flow shipped V1; broadcaster surface still V1.5+".
2. `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` — append a decision-log row dated 2026-05-16 capturing the V1 scope expansion + the graceful-fallback pattern + the verified-app-review dependency.
3. `~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md` § 5.3 — flip the YouTube Data API per-couple OAuth row from "V1.5+ activation" to "V1 wiring shipped; owner-side Google Cloud setup is the remaining blocker".

---

## 2026-05-16 · feat(0022): Boosted Ads ladder + Sponsored Boost Quarterly/Annual tier

**Commit:** to be filled after commit.

**Context:** Iteration 0022 § 5b (locked 2026-05-16 — eighth row of the 2026-05-16 decision log). Replaces the retired single ₱1,499/wk Sponsored Boost SKU with a two-tier marketing ladder: (1) **Boosted Ads** weekly by radius (5km ₱5,000 / 10km ₱8,000 / 20km ₱15,000) and (2) **Sponsored Boost** long-commit, 30km, verified-only (Quarterly ₱250,000 / Annual ₱800,000). The five new SKUs were already seeded in `service_catalog` by the existing `20260516000000_v1_sku_lock_service_catalog.sql` migration (lines 333–390) and the old `sponsored_boost_weekly` row was flipped to `is_active=FALSE` (lines 478–492). This PR ships the missing **per-vendor subscription ledger** + **vendor marketing surface** + **admin queue** + **DIY-browse badge / sort impact** that turn the seeded prices into a shippable feature.

**What shipped:**
- `supabase/migrations/20260516220000_vendor_ad_subscriptions.sql` — new table tracking per-vendor purchases. Columns: `vendor_profile_id`, `sku_code` (FK to `service_catalog`), `radius_km` (5/10/20/30 check), `gross_centavos`, `payment_method_key`, `order_id`, `started_at`, `expires_at`, `auto_renew`, `cancelled_at`, `cancel_reason`, `refund_centavos`, `cancelled_by_user_id`, `notes`. Three indexes: `vendor_idx`, `sku_idx`, partial active-only `active_idx`, and partial expiring-only `expiring_idx`. **RLS:** vendor self-read of own rows (matches `vendor_tool_bundles` pattern) + admin read-all; service-role writes only (no policied INSERT/UPDATE/DELETE for users). Also creates the `vendor_active_ads` view which collapses overlapping rows to the single most-permissive active subscription per vendor (Sponsored > Boosted; larger radius > smaller; latest expiry wins). Idempotent.
- `apps/web/lib/vendor-ads.ts` — typed TS mirror of the 5 SKUs with the per-tier metadata the UI needs (radius, term days, use-case copy, verified-only flag, auto-renew default). Helpers: `findAdOption()`, `fetchVendorAdSubscriptions()`, `fetchAllAdSubscriptionsForAdmin()`, `isActiveAdSubscription()`, `daysRemaining()`, `fetchActiveAdLookups()` (the marketplace bulk lookup), `adPriceDisplay()`, `effectiveMonthlyPesos()` (for the Sponsored Boost amortization copy). Graceful degradation: every fetch swallows `42P01` "relation does not exist" so the app keeps rendering on pre-migration environments.
- `apps/web/app/vendor-dashboard/marketing/page.tsx` — new vendor-facing route. Sections: (i) flash banner (started / cancelled / error), (ii) verified gate callout (V1 reads `vendor_profiles.public_visibility = 'verified'`; degrades gracefully if a parallel agent's `vendors.verification_state` enum ships, see Verification handoff below), (iii) "Currently running" card per active tier with cancel form + auto-renew indicator + days-remaining, (iv) Boosted Ads picker (3 cards, terracotta accent), (v) Sponsored Boost picker (2 cards, gold/amber accent, "≈ ₱X/mo effective" sticker), (vi) static stacked-cost worked example matching the spec, (vii) 20-row history list with cancel-reason annotations.
- `apps/web/app/vendor-dashboard/marketing/actions.ts` — two server actions: `startAdSubscription(formData)` validates the SKU + verified gate, enforces V1 "one active per tier" guard (a Boosted + a Sponsored row can coexist; a second Boosted or a second Sponsored while one is live is rejected), inserts the subscription row, audit-logs the start (`vendor_ad_subscription_start`), and revalidates `/vendor-dashboard/marketing` + `/admin/ads` + `/vendors`. `cancelAdSubscription(formData)` is the vendor self-serve cancel — confirms authority via `vendor_profile_id`, idempotent on already-cancelled rows, audit-logs `vendor_ad_subscription_cancel`.
- `apps/web/app/vendor-dashboard/layout.tsx` — adds the new **Marketing** subnav tab (Megaphone icon) between Earnings and Notifications. Match `prefix` so deep links / future sub-routes stay highlighted.
- `apps/web/app/admin/ads/page.tsx` + `actions.ts` — new admin queue. Status tabs (Active / Cancelled / Expired / All), per-row card showing vendor (with `/v/{slug}` link), SKU + radius + term + gross, days-remaining or expiry date, auto-renew + refunded amount when present, cancel form with required reason + optional `refund_centavos` (capped at the gross). Admin cancel writes `vendor_ad_subscription_admin_cancel` to `admin_audit_log` with before/after JSON and the actor's user_id. Refund payment movement runs through the existing `/admin/payments` rail; this surface is the queue marker.
- `apps/web/app/admin/layout.tsx` — adds the **Ads** tab to the admin top-nav between Receipts and Reviews.
- `apps/web/app/vendors/page.tsx` — public marketplace now: (1) calls `fetchActiveAdLookups()` on the visible rows in a single round-trip, (2) sorts boosted/sponsored vendors to the top of the page within each existing sort key (Sponsored > Boosted > unboosted), (3) renders a gold **Featured Sponsor** pill on Sponsored cards and a terracotta **Boosted** pill on Boosted cards (cards also get a subtle border accent matching the badge), and (4) preserves the verified-only toggle + coming-soon dimming behavior from PR #56.

**Pricing centralization:**
- All amounts stored in PHP centavos (1 peso = 100 centavos) matching `service_catalog`. Display via `formatCentavosPhp()` from `lib/sku-catalog.ts`. No new pricing constants outside the typed `AD_TIER_OPTIONS` mirror in `lib/vendor-ads.ts` — the migration's snapshot is the source of truth. `detectAdPriceDrift()` helper exists for future test coverage.
- Sponsored Boost Quarterly: ₱250,000 = 25,000,000 centavos. Annual: ₱800,000 = 80,000,000 centavos. Boosted Ads: ₱5,000 / ₱8,000 / ₱15,000 (500,000 / 800,000 / 1,500,000 centavos). Verified-only flag set TRUE on all 5 rows per the locked spec.

**Verification handoff (graceful degradation):**
- Spec calls out that a parallel agent is wiring `vendors.verification_state` enum; until that column lands, the marketing surface reads `vendor_profiles.public_visibility === 'verified'` as the V1 proxy (semantically equivalent per 0022 § 2.1c). The actions code checks for a `verification_state` field on the raw vendor row first; if present (post-other-agent landing — see the verification-flow PR landing in the same batch) it uses that; otherwise it falls back to `public_visibility`. No conflict either way.

**Out of scope (intentional V1 boundaries):**
- Real payment flow. V1 keeps the apply-then-pay rail: vendor opts in → subscription row goes live → Setnayan admin reconciles the corresponding order via `/admin/payments` → admin cancels (via `/admin/ads`) if payment fails within 7 days. The vendor sees this in the "Started" flash banner copy on the marketing surface.
- Per-pin gating. Spec § 5b allows a multi-pin vendor to see the boost available per-zone (locked in some pins, available in others). V1 is single-radius; multi-pin will land alongside iteration 0006's Extended Pins extended work.
- Density gate (≥20 vendors in same service category within 20km). The view hides the boost below threshold per spec — V1 doesn't implement the daily cron that computes `vendors_in_20km_per_category`; the gate ships when iteration 0023 admin console adds the relevant settings surface.
- Featured Vendor / Category Sponsor / Showcase Spotlight future boost types are deferred to V1.5.

**Test plan:**
- [x] `pnpm --filter @setnayan/web typecheck` — passes
- [x] `pnpm --filter @setnayan/web lint` — clean
- [x] `pnpm --filter @setnayan/web build` — clean (new routes `/vendor-dashboard/marketing` + `/admin/ads` listed in the build output)
- [ ] Owner: `supabase db push` to apply `20260516220000_vendor_ad_subscriptions.sql` (joins the existing pile of pending migrations)
- [ ] After deploy, eyeball `/vendor-dashboard/marketing` for a verified vendor shows the two pickers, the started-flash, the one-active-per-tier gate, and the stacked-cost example
- [ ] After deploy, `/vendors` marketplace shows the **Featured Sponsor** gold pill on Sponsored vendors and **Boosted** terracotta pill on Boosted vendors; boosted vendors appear at the top of every sort key
- [ ] After deploy, `/admin/ads` shows the active queue, cancel form persists, and `admin_audit_log` carries a `vendor_ad_subscription_admin_cancel` row

**SPEC IMPACT:** None — implements 0022 § 5b verbatim, including the retire of `sponsored_boost_weekly`, the 5-row ladder, the verified-only gate on Sponsored, and the stacked-cost example. The migration's table + view names match the spec's `sponsored_boosts(...)` block ergonomically while extending it to cover both the weekly Boosted ladder and the long-commit Sponsored tier in one table (a deliberate V1 simplification — the spec's table-per-tier hint was for documentation, not a schema requirement).

---

## 2026-05-16 · feat(0026): BIR Form 2307 quarterly auto-fill — per-vendor PDF + pg_cron + admin queue

**Commit:** to be filled after commit.

**Context:** Iteration 0026 § 5.4 ("Form 2307 quarterly generation") + the V1 SKU lock decision row from 2026-05-16 — "BIR 2307 generation, vendor_payouts table" was the last engineering item left open against the V1 launch-blocker list for iteration 0034 Payments. This PR closes that gap end-to-end: one PDF per (vendor, year, quarter), generated automatically on the 1st of every Jan/Apr/Jul/Oct at 02:00 PHT via Supabase pg_cron, with an admin-side manual trigger + per-row regenerate button for backfills and corrections.

**What shipped:**
- `supabase/migrations/20260516100000_iteration_0026_bir_2307_filings.sql` — adds `vendor_2307_filings` (one row per vendor per quarter, with monthly breakdown + totals JSONB + audit log + PDF storage ref), BIR identity columns on `vendor_profiles` (`tin_number`, `tin_type`, `registered_business_name`, `registered_address`, `registered_zip`, `bir_service_category`) and the matching Setnayan-side payor columns on `platform_settings` (`bir_payor_name`/`_address`/`_zip` + `bir_authorized_rep_name`/`_tin`/`_title`). Migration enables `pg_cron` + `pg_net` extensions (guarded — silently skipped on environments where the extensions aren't available) and schedules the `quarterly_2307_generation` cron job to POST to `/api/admin/cron/generate-2307` on the 1st of Jan/Apr/Jul/Oct at 02:00 PHT (18:00 UTC). RLS allows self-read by the owning vendor + full read by admin; no vendor writes.
- `apps/web/lib/bir/atc-mapper.ts` — pure `mapVendorToATC(vendor)` that returns `{ atc_code, rate_bps, description }`. Wires the V1 ruleset: WC158 (2%) for any corporation, WI151 (5%) for professional individuals, WI080 (5%) for talent individuals, WI158 (2%) for default service-supplier individuals under the Top Withholding Agent rule. Includes a `centavosToPesoString` helper used by every PDF surface.
- `apps/web/lib/bir/filings.ts` — server-side data access. `buildQuarterFilings(admin, period)` walks `vendor_payouts.bir_withholding_centavos` (post-#68 Setnayan Pay reprice column) for the quarter, groups by vendor + month-index within quarter, runs the ATC mapper, returns the aggregated filing inputs. Also exposes `quarterThatJustEnded(now)`, `quarterToPeriod(year, q)`, `deadlineForQuarter(year, q)` (Apr 30 / Jul 31 / Oct 31 / Jan 31), `fetchFilingByVendorAndPeriod`, `listFilingsForVendor`, `listAllFilings`.
- `apps/web/lib/bir/2307-pdf.ts` — `generate2307PDF({filing, period, payor})` using pdf-lib. Two strategies: (A) load `apps/web/public/bir-forms/2307-2018-ENCS.pdf` and fill AcroForm fields by name (`Payee_TIN` / `Field2` / `Payor_TIN` / `Field6` / `ATC_1` / `M1_1` / etc. — multiple naming variants per slot so a BIR template refresh doesn't drop fields silently) then flatten; (B) when no AcroForm fields exist on the template, overlay text at calibrated coordinates; (C) fallback when the template file is absent — draws a from-scratch single-page Letter portrait layout with all BIR-required sections (period header, Part I Payee, Part II Payor, Part III monthly breakdown table with ATC rows, grand totals row, signature block). All three paths emit `Uint8Array` PDF bytes for upload.
- `apps/web/lib/bir/storage.ts` — `upload2307Pdf({pdfBytes, vendor_profile_id, tax_year, tax_quarter})` writes to R2 bucket `setnayan-bir-2307` (env `R2_BUCKET_BIR_2307`), with auto-fallback to Supabase Storage bucket `bir-2307` when R2 envs are unset. Object key: `vendors/{vendor_profile_id}/{year}_Q{quarter}.pdf` — matches the spec § 5.4 layout (minus the bucket-name prefix, which is the bucket itself).
- `apps/web/lib/bir/generator.ts` — orchestration. `generateQuarter({admin, year, quarter, triggered_by_admin_id})` aggregates filings → renders PDFs → uploads → upserts the `vendor_2307_filings` row (idempotent — regenerating UPDATEs in place, bumps `regenerated_count`, appends to `audit_log`). Per-vendor failures are recorded as `status='error'` rows but don't abort the batch. Also exports `regenerateVendor(...)` for the admin manual button.
- `apps/web/app/api/admin/cron/generate-2307/route.ts` — `POST` handler with two auth paths: (1) `X-Cron-Secret` header matched against `process.env.CRON_SECRET` (used by Supabase pg_cron via `net.http_post`), (2) admin session cookie via `createClient()` + `users.account_type/is_internal/is_team_member` check (used by the manual trigger button on `/admin/bir/2307`). Accepts `?year=&quarter=` for backfills; defaults to the quarter that just ended. Returns a JSON summary `{vendor_count, generated, skipped_no_ewt, errors, filings}`. `GET` returns metadata so an operator can sanity-check the wiring without firing a real run.
- `apps/web/app/api/admin/bir/2307/regenerate/route.ts` — `POST` handler for single-row regeneration. Validates admin session, then calls `regenerateVendor(...)` and returns the upserted row.
- `apps/web/app/vendor-dashboard/tax-documents/page.tsx` + `actions.ts` — vendor surface showing per-quarter filings with download link + "Mark as filed" toggle for the vendor's own record-keeping. Top card shows the vendor's BIR identity (TIN / registered name / address / ZIP / TIN type / BIR service category) with red-tone callouts for unset fields and an inline reminder that TIN edits require re-verification (per spec § 7.3). Banners: amber "ready to download" for new filings, red "past the filing deadline" for ones still un-actioned past the BIR deadline.
- `apps/web/app/admin/bir/2307/page.tsx` + `_components/manual-trigger.tsx` + `_components/regenerate-button.tsx` — admin queue. Period filter dropdown, summary stats (filings count, gross paid, EWT, generated/downloaded/filed/error counts), per-row table with View + Regenerate. Manual trigger card at the top lets admin pick `{year, quarter}` and POST to the cron endpoint.
- `apps/web/app/admin/layout.tsx` — wired new "BIR 2307" tab into the admin sub-nav (between Receipts and Reviews).
- `apps/web/app/vendor-dashboard/layout.tsx` — wired new "Tax docs" tab into the vendor sub-nav (after Earnings, before Notifications).
- `.env.example` — added `R2_BUCKET_BIR_2307=setnayan-bir-2307` + `CRON_SECRET=` with comments documenting the owner-side setup (Supabase Dashboard ALTER DATABASE for `app.cron_secret` + `app.app_url`).
- `apps/web/public/bir-forms/.gitkeep` — placeholder that documents the BIR template owner-action.
- `apps/web/package.json` — adds `pdf-lib ^1.17.1`.

**Cron strategy:** Supabase pg_cron + pg_net. Avoids an external scheduler (Vercel Cron / GitHub Actions / Cloudflare Workers) — pg_cron ships with Supabase Postgres, runs free, and authenticates via a database-side `app.cron_secret` GUC so the secret never leaves Postgres. The cron's `net.http_post` calls `/api/admin/cron/generate-2307` with `X-Cron-Secret` and a JSON body so the same endpoint also handles admin manual triggers.

**Verify:**
- `pnpm --filter @setnayan/web typecheck` ✅
- `pnpm --filter @setnayan/web lint` ✅
- `pnpm --filter @setnayan/web build` ✅ (new routes present: `/admin/bir/2307`, `/api/admin/bir/2307/regenerate`, `/api/admin/cron/generate-2307`, `/vendor-dashboard/tax-documents`)

**Owner action required:**
1. **Download the official BIR Form 2307 (January 2018 ENCS) PDF** from https://www.bir.gov.ph/index.php/bir-forms/certificates.html and check it into the repo at `apps/web/public/bir-forms/2307-2018-ENCS.pdf`. Until this file lands, the generator falls back to a from-scratch layout that contains every BIR-required field but isn't a pixel-perfect facsimile.
2. **Provision the R2 bucket** `setnayan-bir-2307` in the Cloudflare R2 dashboard (PH region; lifecycle: retain 10 years per BIR audit window; no public access — URLs are emitted server-side and shared only with the owning vendor + admin).
3. **Enable Postgres extensions** in Supabase Dashboard → Database → Extensions: `pg_cron` and `pg_net` (both ship pre-installed; just flip the toggle).
4. **Set cron + URL GUCs** in Supabase SQL Editor (one-time):
   ```sql
   ALTER DATABASE postgres SET app.cron_secret = '<openssl rand -hex 32>';
   ALTER DATABASE postgres SET app.app_url    = 'https://www.setnayan.com';
   ```
5. **Paste `CRON_SECRET`** (the same value from step 4) into Vercel env (Production + Preview).
6. **Fill `platform_settings.bir_payor_*` + `bir_authorized_rep_*`** via the admin settings surface once the legal-name + BIR Permit + authorized-signatory are confirmed (these populate Part II of every 2307 PDF).
7. **Backfill vendor BIR identity** (`vendor_profiles.tin_number`, `tin_type`, `registered_business_name`, `registered_address`, `registered_zip`, `bir_service_category`) — currently nullable; without them the mapper defaults to individual + service_supplier → WI158 at 2%.
8. **Spec corpus** (do NOT edit in this worktree): note in `0026_bir_tax_compliance.md` § 5.4 that the actual repo implementation reads `vendor_payouts.bir_withholding_centavos` (post-#68) rather than the spec's `service_orders.bir_withholding_centavos` placeholder. Mention also that `vendor_profiles` carries the BIR identity columns rather than the `vendors` table named in the spec.

**Out of scope (deferred to V1.5+):**
- Email notification when a 2307 is generated (0028 hooks pending — vendor surface already shows it).
- Multi-ATC per vendor — V1 mapper emits a single ATC code per vendor, even if the vendor delivered services across multiple BIR categories in a quarter. Once a future migration adds `vendor_services.bir_atc_override` we can group by service.
- 2307 PDF e-signature via 0027 — V1 prints `payor.authorized_rep_name` on the signature line; physical signing is admin-side, offline.
- Form 1601-EQ remittance return CSV export — covered by iteration 0026 § 6.2 as a follow-on under the `/admin/finance/tax-reports` surface.

**SPEC IMPACT:** Iteration 0026 § 5.2 + § 5.4 schema names diverge slightly from the live code (live: `vendor_profiles` + `vendor_payouts`; spec: `vendors` + dedicated `form_2307_issuances`). Engineering followed the live schema to avoid renaming tables that #68 just landed. Spec corpus update — call out the column-location reality in 0026 — is owner-side per `feedback_setnayan_edit_first_and_safety` (no spec-folder edits from this worktree).

---

## 2026-05-16 · feat(0006,0034): Vendor Payout model — verified T+1 + coming_soon 20/60/20

**Commit:** to be filled after commit.

**Context:** Spec lock 2026-05-16 in `0006_vendors_management.md` § "Vendor Payout model" and `0034_payments_and_cart.md` § 6.7 — verified vendors receive an immediate full payout T+1 (less gateway + BIR 0.5% withholding; Setnayan absorbs the ₱15-25 disbursement fee); coming_soon (and demoted) vendors release in three milestone stages (20% on booking confirmation, 60% T+7 from event start, 20% T+7 from event end) with T-14 + T+7 dispute windows; vendors auto-demote on 3+ disputes in any rolling 30-day window. The build-status grid row "Vendor Payout model (NEW 2026-05-16)" flips from 🟡 pending → 🟢 V1 web ready post-merge.

**What shipped:**
- `supabase/migrations/20260516210000_vendor_payout_model.sql` — adds the canonical `payout_stage` ENUM (`immediate_full`, `stage_1_confirm`, `stage_2_event_start`, `stage_3_event_end`); ALTERs `vendor_payouts` to add audit-trail columns (`payout_stage`, `gross_centavos`, `gateway_fee_centavos`, `vendor_net_centavos`, `scheduled_at`, `paid_at`, `dispute_window_ends_at`, `payment_method`, `audit_log JSONB`); ALTERs `orders` (this repo's `service_orders`) with `setnayan_fee_bps` / `gateway_fee_centavos` / `bir_withholding_centavos` / `vendor_net_centavos` / `disbursement_fee_centavos` / `payment_method_key` / `vendor_profile_id`; new `vendor_disputes` table + `count_vendor_disputes_30d()` SQL helper for the cron. Idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO blocks for the ENUM). RLS preserved.
- `apps/web/lib/payouts.ts` — payout dispatcher. `computePayoutBreakdown` does integer-centavo gross→net math (Setnayan fee + gateway + BIR 0.5% deducted; disbursement fee tracked-not-deducted). `planPayoutStages` returns 1 row (verified) or 3 rows (coming_soon 20/60/20) with correct `scheduled_at` + `dispute_window_ends_at`. `dispatchVendorPayouts` writes the rows idempotently keyed on `(order_id, payout_stage)`. `markPayoutPaid` + `holdPayout` append audit-log entries on every transition.
- `apps/web/app/api/admin/cron/dispute-counter/route.ts` — POST-only daily cron. Authenticates via `Authorization: Bearer $CRON_SECRET`; rolls 30 days of `vendor_disputes` rows; flips any verified vendor with 3+ disputes to `public_visibility = coming_soon` + bumps `demotion_count` + writes `admin_audit_log` row with `action='vendor_demoted_by_dispute_threshold'`. Falls back gracefully when the parallel `verification_state` column / `last_demoted_at` / `demotion_count` columns are absent at apply time (since both migrations land in the same `supabase db push`).
- `apps/web/app/admin/payouts/page.tsx` + `actions.ts` — new admin queue at `/admin/payouts` with filter tabs (Pending / Paid / On hold / All) + stage tabs (Immediate / Stage 1 / 2 / 3) + vendor-ID search + scheduled-date range. Each row exposes "Mark paid" (records payment method + reference + appends audit-log entry) and "Place on hold" (records reason). KPI row shows pending + paid + on-hold totals scoped to the filter selection.
- `apps/web/app/admin/layout.tsx` — added "Payouts" tab to the admin top nav (between Payments + Receipts).
- `apps/web/app/admin/page.tsx` — added a Vendor payouts tile to the overview grid.
- `apps/web/app/vendor-dashboard/earnings/page.tsx` — vendor-side surface now reads `vendor_payouts` for the signed-in vendor and renders the confirmed-but-not-paid / in-stage / paid split, including BIR + gateway per-stage breakdown and an explanatory blurb that swaps between the verified-T+1 and coming_soon-20/60/20 narratives based on the vendor's `public_visibility`. RLS on `vendor_payouts` already gates this read to the vendor's own rows.
- `apps/web/app/admin/payments/actions.ts` — `approvePayment` now invokes `schedulePayoutsForOrder` after promoting an order to `paid`. Computes the breakdown, writes it back onto the order row (so receipts can read it), and calls `dispatchVendorPayouts` (verified → 1 stage T+1; coming_soon → 3 stages 20/60/20). No-op when the order isn't a vendor booking (`vendor_profile_id` NULL). Failures are caught + logged but never block payment approval.
- `apps/web/lib/vendor-profile.ts` — `fetchOwnVendorProfile` now selects `public_visibility` so vendor surfaces can render the payout-model copy that matches their state.

**Coordination with PR #80 (vendor verification flow, merged just before):** The verification PR introduced the `verification_state` ENUM + `last_demoted_at` / `demotion_count` columns this PR's cron writes. `lib/payouts.ts::resolveVendorVerificationState` prefers `verification_state` when present and falls back to `public_visibility` so this code is order-independent at the migration level. The dispute counter cron also catches missing-column errors and retries the UPDATE with the safe column subset.

**Dispute counter cron infra (owner action):**
- No `vercel.json` exists in the repo, so the cron is implemented as a POST-only API route protected by `CRON_SECRET`. Until Vercel Cron Pro is enabled in V1.5 (per spec Maya Business gateway timeline), the owner triggers it from an external scheduler (cron-job.org, GitHub Actions, etc.) hitting `POST /api/admin/cron/dispute-counter` with `Authorization: Bearer $CRON_SECRET` once a day. When `vercel.json` lands, add `"crons": [{ "path": "/api/admin/cron/dispute-counter", "schedule": "0 4 * * *" }]` (04:00 UTC = noon Manila).

**SPEC IMPACT:** None — implements an existing 2026-05-16 spec lock without modifying the spec corpus. The build-status grid row will be flipped by the owner from 🟡 to 🟢 (V1 web ready) post-deploy.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `pnpm --filter @setnayan/web lint` ✅ · `pnpm --filter @setnayan/web build` ✅. Migration is additive-only; existing `vendor_payouts` rows (none today) keep their legacy `stage`/`trigger_type`/`payout_method` columns and gain a populated `payout_stage` via the migration's `UPDATE`.

**Out of scope:**
- Real Maya Business gateway integration (V1.5+ per § 6.6).
- BIR Form 2307 PDF generation (V1.5; columns reserved).
- Two-admin gate on payout release (V1.5 per § 9.1).
- Per-method config wiring through to per-order `payment_method_key` (column added; cart-side wiring is a follow-on).

---

## 2026-05-16 · feat(0006,0023): vendor verification flow + admin queue + SKU aliases

**Commit:** to be filled after commit.

**Context:** Spec corpus 2026-05-16 locked the full Vendor Verification flow: FREE initial / ₱1,500 annual renewal / ₱2,500 post-demotion re-verification, 12-document checklist, all-or-nothing approval, 3–5 BD SLA, `setnayan-vendor-verification` R2 bucket (90-day rolling raw + 7-year audit per BIR § 235). PR #56 shipped the admin queue shell + the marketplace `public_visibility` state machine; this PR completes the workflow side: a new `verification_state` ENUM on `vendor_profiles`, an `application` intake table, a `tier_history` audit table, the vendor-facing 12-doc upload page, and the admin Approve / Reject / Demote / In-review action set.

**Schema (`supabase/migrations/20260516040000_iteration_0006_vendor_verification_flow.sql`):**
- New ENUM `vendor_verification_state('unverified','pending_review','verified','demoted','rejected')`.
- New column `vendor_profiles.verification_state` default `'unverified'` (idempotent ADD COLUMN IF NOT EXISTS); + `last_verified_at`, `next_renewal_due_at`, `demotion_count`, `last_demoted_at`. Backfill: rows already at `public_visibility='verified'` from PR #56 lift to `verification_state='verified'` so live listings retain their perk-unlock signal on deploy.
- New table `vendor_verification_applications` — application/intake rows. Tracks `application_type` (`initial` / `annual_renewal` / `post_demotion`), `fee_php_centavos`, `status` (`draft` / `pending_review` / `in_review` / `approved` / `rejected` / `withdrawn`), `doc_uploads` JSONB (12-doc checklist + R2 keys), `docs_complete`, `submitted_at`, `sla_due_at`, `admin_user_id`, `decision`, `decision_reason`, `decided_at`, `notes`. RLS: vendor sees + writes their own draft rows; admin (service-role) has full access.
- New table `vendor_tier_history` — state-transition audit (`from_state` / `to_state` / `application_id` / `admin_user_id` / `reason` / `metadata`). RLS: vendor sees their own timeline; admins see everything.
- Two SKU alias rows in `service_catalog` (`verification_annual_renewal` ₱1,500 + `verification_reverification` ₱2,500) coexist with the canonical `vendor_verification_*` codes from the 2026-05-16 SKU lock so call sites that follow either naming convention resolve.
- All inserts use `ON CONFLICT (sku_code) DO UPDATE`; all DDL is `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`; no drops.

**Environment + R2:**
- `.env.example` gains `R2_BUCKET_VENDOR_VERIFICATION=setnayan-vendor-verification` (90d rolling raw + 7yr audit retention per BIR § 235; owner provisions the bucket separately).
- `apps/web/lib/r2.ts` exports `vendorVerification: 'setnayan-vendor-verification'`.
- `apps/web/app/api/upload/route.ts` whitelists `vendor-verification` / `vendorVerification` as a bucket alias with a 15 MB per-file cap.
- `apps/web/app/_components/file-upload.tsx` adds `'vendor-verification'` to the `FileUploadBucket` union.

**Vendor surface (`apps/web/app/vendor-dashboard/verify/`):**
- New tab `Verify` in the vendor-dashboard subnav (`layout.tsx`).
- `page.tsx` — single-page workflow:
  - Status card (current `verification_state` + latest application reference).
  - "Start application" picker for `initial` / `annual_renewal` / `post_demotion` (recommended type pre-selected from `recommendedApplicationType` heuristic).
  - Progress bar (`completeCount`/12) + per-slot card grid for the 12 checklist items. Each card carries the spec hint (e.g. "auto-validated via DTI lookup once integration ships") and per-slot input UI:
    - Upload slots → `FileUpload` with R2 `vendor-verification` bucket + per-vendor path prefix.
    - `social_media` → URL input.
    - `google_meet` / `phone_email_otp` / `amlc_screening` → admin-run notice ("Setnayan flips this after submission").
    - Portfolio-samples + client-references accept multi-file uploads (up to 10).
  - Submit gate: requires ≥ 8 of 12 items to submit (the 4 admin-run slots — Persona ID, Google Meet, OTP, AMLC — are flipped post-submit).
  - Pending / Approved / Rejected status cards render once a decision lands.
- `actions.ts` — server actions `ensureDraftApplication`, `updateDocUpload`, `submitApplication`, `withdrawApplication`. Submit stamps `submitted_at` + `sla_due_at` (5 business days), bumps `verification_state` → `pending_review`, and writes an `admin_audit_log` row.
- `apps/web/lib/vendor-verification.ts` — shared types + helpers (`DOC_SLOTS`, `VERIFICATION_STATES`, `APPLICATION_FEE_CENTAVOS`, `countCompleteSlots`, `addBusinessDays`, `computeSlaTone`, `formatSlaCountdown`, `fetchLatestApplication`, `fetchTierHistory`, `recommendedApplicationType`).

**Admin surface (`apps/web/app/admin/verify/`):**
- `page.tsx` — refactored into two surfaces switched by `?surface=`:
  - `applications` (default) — Vendor Verification queue with tabs `pending` / `in_review` / `approved` / `rejected` / `demoted` / `all`. Each row shows the vendor, application type + fee, SLA badge (on_track / warning amber after 3 BD / overdue red after 5 BD / closed), tier badge, status badge, decision reason, and a 12-doc checklist `<details>` expander. Action row: `Mark in review` / `Approve → Verified` / `Reject…` (textarea reason required, min 5 chars) / `Demote…` (for approved rows, textarea reason required).
  - `visibility` — the marketplace `public_visibility` queue from PR #56, preserved 1:1.
- `actions.ts` — adds server actions `approveApplication`, `rejectApplication`, `demoteVendor`, `setApplicationInReview`. Each writes the application row's `decision` + `admin_user_id` + `decided_at`, transitions `vendor_profiles.verification_state` (and side-effects: `last_verified_at` / `next_renewal_due_at` on approve · `last_demoted_at` + `demotion_count++` on demote), inserts a `vendor_tier_history` row, and writes an `admin_audit_log` row.

**Webhook stubs (owner-action pending):**
- `apps/web/app/api/webhooks/persona/route.ts` — accepts POST + GET, logs the payload to console + Sentry breadcrumb, returns 200. No signature verification yet (Persona dashboard signup is owner-action pending per App_Build_Status.md). TODO comment block in the file documents the wire-up steps.
- `apps/web/app/api/webhooks/veriff/route.ts` — same pattern; parallel stub for the Veriff provider.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅ (zero warnings) · `build` ✅ (`/vendor-dashboard/verify` + `/admin/verify` + `/api/webhooks/persona` + `/api/webhooks/veriff` all listed in the route table).

**Owner action required:**
- `supabase db push --db-url "$SUPABASE_DB_URL"` to apply the migration.
- Provision Cloudflare R2 bucket `setnayan-vendor-verification` (90-day rolling lifecycle on `raw/` prefix · 7-year retention on `audit/` prefix per BIR § 235).
- Sign up for Persona / Veriff / Onfido + AMLC; populate `PERSONA_API_KEY` / `PERSONA_TEMPLATE_ID` / `AMLC_API_KEY` in Vercel; then wire signature verification + the post-submit handler into the webhook stubs.

**SPEC IMPACT:** None — implements 0006 § "Vendor Verification flow (locked 2026-05-16)" + 0023 § 3.2a as written. Two minor spec-side notes to surface to Cowork separately: (1) the spec's `verification_state` ENUM lists `('coming_soon','verified','demoted','revoked')` while the engineering task brief locked `('unverified','pending_review','verified','demoted','rejected')`; this PR follows the task brief because the workflow needs distinct `unverified` (no app started) vs `pending_review` (app submitted) vs `rejected` (admin said no, vendor must re-apply) states the spec wording elides. (2) The spec's `vendor_verification_applications` schema is satisfied 1:1; the spec ENUM mismatch is the only deviation.

---

## 2026-05-16 · feat(infra): graceful Supabase Storage fallback when R2 env vars are unset

**Commit:** to be filled after commit.

**Context:** The R2 migration shipped in PR #18 — all production uploads write to one of the four Cloudflare R2 buckets (`setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`). Today's change closes a dev/staging gap: if a deployment is missing `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, the server-side upload helper (`lib/storage.ts → uploadPublicAsset`) used to throw at the first `getR2Client()` call, which propagated as a 500 to the user. The fallback now writes to Supabase Storage `platform-assets` (the pre-PR-#18 path) and logs a one-shot warning so the operator sees the gap without users seeing an error. Reads of legacy Supabase Storage URLs already pass through `parseStoredAsset → legacy_url` unchanged — that side of the round-trip didn't need to change.

**What shipped:**
- `apps/web/lib/r2.ts` — added `isR2Configured()` predicate, converted `getR2Client()` to return `S3Client | null` instead of throwing, added `requireR2Client()` for code paths that have no fallback, added named helpers `r2Upload` / `r2SignedGet` / `r2PublicUrl` per the R2 migration spec's public surface. Top-of-file docblock now spells out the graceful-degradation contract (which call sites fall back, which surface a 503).
- `apps/web/lib/storage.ts` — `uploadPublicAsset` now checks `isR2Configured()` and routes to the new `uploadViaSupabaseFallback` helper when R2 env vars are unset. Fallback writes to `platform-assets` with the same `${timestamp}-${random}.${ext}` key scheme the legacy V0 code used (so URLs are recognisable to anyone debugging old + new in the same trace). `deletePublicAsset` learned to route by URL shape — R2 URLs go to `DeleteObjectCommand`, Supabase Storage URLs go to `storage.remove()`, and anything else is a no-op. The R2 branch tolerates a missing client (logs a warning and skips, so a delete during a fallback window doesn't crash).
- `apps/web/app/api/upload/route.ts` — presigned-PUT route returns a clean 503 + log when R2 isn't configured (no Supabase equivalent of "browser PUTs the bytes directly", so we can't gracefully degrade this surface — we surface a clear operator-facing error instead).
- `apps/web/lib/uploads.ts` — switched `presignDisplayUrl` / `presignUploadUrl` to use the new `requireR2Client` helper. These two functions sign URLs and have no fallback path.

**Why not a wider migration:** All four call-site categories named in the migration spec (vendor logos, payment screenshots, thread attachments, vendor contracts) were already on R2 as of PR #18 — `git grep` for `supabase.storage` and `.upload(` returned zero matches. This entry is purely about hardening the fallback so dev/staging environments without R2 credentials don't 500.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ (zero errors) · `pnpm --filter @setnayan/web lint` ✅ (no ESLint warnings or errors) · `pnpm --filter @setnayan/web build` ✅ (production build succeeds). No new dependencies — `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` were already in the lockfile from PR #18.

**Owner action items:**
- **None for production** — `R2_ACCESS_KEY_ID` / `R2_ACCOUNT_ID` / `R2_SECRET_ACCESS_KEY` are already set in Vercel and uploads continue to write to R2.
- For local dev / preview deployments without R2 credentials: uploads will silently fall through to Supabase Storage `platform-assets` and you'll see a `[r2] R2 env vars unset` warning in the function logs. Set the three env vars in `.env.local` to exercise the R2 path.

**SPEC IMPACT:** None — codifies the "fall back when env unset" requirement from the R2 migration spec. No spec edits required.

---

## 2026-05-16 · feat(0005): LED Background Maker — scaffold-level launch

**Commit:** to be filled after commit.

**Context:** Iteration 0005 spec (`0005_led_background_maker.md` + `0005_ffmpeg_lottie_reference.md`) defines a couple-facing 8K LED loop generator with USB delivery for venue playback — the "Pailaw" surface in live-site framing. Per the 2026-05-16 decision-log row (12th entry that day), the six V1.5+ deferred add-ons were unlocked for scaffold-level Web V1 launches today; this is the LED entry of that unlock. V1 SKUs/pricing remain locked, so this scaffold carries no new prices and no wallet UI. Master loop durations (5 / 10 / 30 / 90-min Custom tier) follow the 2026-05-08 spec decision row.

**What shipped:**
- `apps/web/lib/led-background.ts` — V1 catalogue of all 10 spec-locked templates (Filigree Bloom, Capiz Shimmer, Sampaguita Drift, Gold Particles, Ethereal Mist, Bokeh Lights, Watercolor Wash, Slow Pulse, Constellation, Velvet Sweep) plus the loop-duration option list with file-size + repeat-count copy.
- `apps/web/app/dashboard/[eventId]/add-ons/led/page.tsx` — RSC entry that loads the event, renders the Pailaw eyebrow + "8K loop · USB delivery" trio strip (Sparkles / Tv / Usb cards), and mounts the maker.
- `apps/web/app/dashboard/[eventId]/add-ons/led/_components/led-background-maker.tsx` — client component for the interactive flow: 10-template gallery (gradient placeholder thumbnails sourced from each template's palette + motif overlay), sticky right-rail customization panel with loop-duration radio group (90-min option visibly disabled with a Lock icon + "Custom tier" hint), Photo Pool blend toggle with explainer copy about rotating photos per loop iteration, output-spec readback, and the Render & queue CTA. Render submission shows a success card with a mock job ID (`LED-2026-XXXXXX`), template + loop + Photo Pool summary, render-time estimate, USB-delivery handoff copy ("We'll email you when your USB master is ready"), and a back-to-Orders link.
- `apps/web/app/dashboard/[eventId]/add-ons/page.tsx` — flipped the `led` entry's `status` from `'coming_soon'` to `'web_v1'` so the card on the add-ons grid is clickable and pills as "Web V1". Touched nothing else in the file.

**What's stubbed (`// TODO(0005):` comments in place):**
- FFmpeg + Lottie 8K render pipeline — `puppeteer-lottie` / `@lottiefiles/lottie-renderer-cli` → PNG sequence → FFmpeg filtergraph composite with particle/light-leak overlays → H.264 MP4 at 8K with 4K + 1080p downsamples.
- Cloudflare Queues render-worker — currently the `Render` button just sets local state to a mock job; production needs the `/api/led-background/render` endpoint, queue insertion, and a polling status surface.
- Photo Pool blend logic — selects N photos per loop iteration from the event's photo pool, composites at 30% opacity behind the monogram.
- USB master fulfillment — physical delivery via iteration 0018 Supplies Marketplace, per the spec's "auto-delivery to LED tech" + pre-event checklist sections.
- Real looping `thumb.mp4` template previews — gallery cards currently render solid gradient placeholders with motif-overlay copy.

**Out of scope (deferred):**
- Real 8K rendering — needs the FFmpeg + Lottie worker container.
- Live preview canvas with concurrent animation layers — spec § "Live preview" needs to wait for the production pipeline + browser preview shim.
- Hosted Live Playback URL add-on (₱99 SKU) — V1 surface is offline-USB-first per spec § "Offline safety".
- Drive push integration — depends on iteration 0009 photo-delivery shipping first.
- Pricing display — V1 SKUs/pricing remain locked; checkout is order-and-pay via Setnayan team handoff for now (mirrors Save-the-Date pattern).
- DB migration — scaffold is pure mock client state, so no `led_render_jobs` table was added in this PR. A migration named `20260516400000_iteration_0005_led.sql` (with RLS via `current_event_ids()`) ships when the render worker lands.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ (zero errors) · `pnpm --filter @setnayan/web lint` ✅ (no ESLint warnings or errors).

**SPEC IMPACT:** None — this implements the scaffold layer for iteration 0005 per the locked spec; no spec edits required.

---

## 2026-05-16 · feat(marketing): surface 0009 Photo Delivery + 0018 Supplies Marketplace on www.setnayan.com

**Commit:** to be filled after commit.

**Context:** Per the 12th 2026-05-16 decision-log row (V1.5+ unlock), six previously-deferred iterations are landing as scaffold-level routes under `/dashboard/[eventId]/add-ons/`. The public marketing surface (homepage `_InAppServices` + `/features` `_DayOfApparatus`) already advertised four of them (Panood, Papic, Pamahiya = 0017 Patiktok in marketing copy, Pailaw) but the two new V1.5+ surfaces — **0009 Photo Delivery** and **0018 Supplies Marketplace** — had no marketing presence at all. Owner asked for these to be visible on www.setnayan.com so couples discovering the site can see the full feature surface, not just the V1 cluster.

**What shipped:**
- `apps/web/app/page-sections/_InAppServices.tsx` — added two cards to the homepage in-app-services grid: **Photo Delivery** (CloudUpload icon, "Full-res handoff after the day" tagline, 30-day compression-grace explainer) and **Supplies Marketplace** (ShoppingBag icon, "Wedding-day supplies, one bill" tagline, vetted-PH-vendors framing). Both tagged `quote` consistent with the rest of the apparatus catalog (no PHP figures on marketing pages per iteration 0015's pricing-hide rule).
- `apps/web/app/features/_sections/_DayOfApparatus.tsx` — mirrored the two new cards in the `/features` deep-dive section, sized + framed to match the existing seven service entries (Panood / Papic / Pamahiya / Pakulay / Pailaw / Pareto / Custom Monogram Pack).

**Cross-cutting:**
- Both files already used `lucide-react` icons; this entry only adds `CloudUpload` + `ShoppingBag` to the imports.
- No new components, no new sections, no new SEO metadata changes — the additions slot into the existing grids and inherit the page-level metadata + JSON-LD blocks.
- Mobile-first layout unchanged; existing Tailwind `sm:` / `lg:` grid breakpoints absorb the two extra cards.
- Pricing-hide rule respected: tag is `quote` on both cards, no PHP figures shown on the public marketing surface.

**Out of scope (per task constraints):**
- Did NOT touch `brand.config.ts`.
- Did NOT introduce new pricing UI, wallet UI, or commission-routing framing (apparatus rule + locked SKU surface untouched).
- Did NOT touch `apps/web/app/dashboard/...` — the dashboard scaffolds for these features ship via the per-iteration PRs from the 2026-05-16 V1.5+ unlock cluster.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅. Both files compile clean with the two added icon imports.

**SPEC IMPACT:** None — this is a marketing-side reflection of the existing locked iteration scopes (0009, 0018). No spec edits required.

---

## 2026-05-16 · feat(0009): Photo Delivery — scaffold-level launch

**Commit:** to be filled after commit.

**Context:** Iteration 0009 ([spec](../Setnayan/0009_photo_delivery/0009_photo_delivery.md)) was deliberately deferred to V1.5+ until 2026-05-16, when the owner unlocked all six pending iterations (decision log row 12 on 2026-05-16 in `/Users/icecasasola/Documents/Claude/Projects/Setnayan/CLAUDE.md`). This entry replaces the `IterationPlaceholder` shim at the `photo-delivery` add-ons key with a real, responsive surface and flips the grid status from `coming_soon` → `web_v1`. The 30-day post-download compression rule (per the 2026-05-09 decision log entry) is the canonical UI moment for that policy and is surfaced visibly here.

**What shipped:**
- `apps/web/app/dashboard/[eventId]/add-ons/photo-delivery/page.tsx` — server component shell. Auth-gates the route, reads the event display name + date for the folder-name preview, renders the iteration eyebrow + headline + a top-level 30-day compression-rule callout, then mounts the interactive panel.
- `apps/web/app/dashboard/[eventId]/add-ons/photo-delivery/_components/photo-delivery-panel.tsx` — client component encoding the 3-state lifecycle:
  - **Not connected** — hero card with "Connect Google Drive" CTA (stubbed: shows a 2-second "Drive connection in progress…" spinner, then transitions to connected). Permission-disclosure copy explaining `drive.file` scope. 3-step explainer grid (Connect → Vendors deliver → Download or share).
  - **Connected** — green connection card showing the folder name (`Setnayan · {display_name} · {YYYY-MM-DD}`) + masked account email + Disconnect button. Below it: a 4-item vendor-deliveries list (Lead photographer · 1,247 photos, Second shooter · 612 photos, Drone team · 198 photos + 14 clips, Cinema team · 312 clips) with per-folder size + received date metadata and a "Download all" CTA.
  - **Downloaded** (per-folder) — folder card swaps the CTA for a `Downloaded {relative}` confirmation + a "Re-download originals" secondary action, AND shows a `Originals compress in 28 days` countdown badge (recomputed from `Date.now() - downloadedAtMs` so it stays accurate). When any folder is downloaded, a bottom-of-page amber explainer card surfaces the "you've downloaded — compression in 30 days" copy with re-delivery guidance.
- `apps/web/app/dashboard/[eventId]/add-ons/page.tsx` — flipped the `photo-delivery` ADD_ONS entry from `status: 'coming_soon'` to `status: 'web_v1'`. No other field touched. The `[addon]/page.tsx` placeholder router still has the `photo-delivery` entry in `ADD_ON_META`; it's now unreachable from the grid (the grid links straight to `/add-ons/photo-delivery`) but kept as dead code per the work order.

**What's stubbed (live work for V1.5+ proper):**
- Real Google Drive OAuth (PKCE + `drive.file` scope) — the Connect button is a 2-second `setTimeout` today. Marked `// TODO(0009):` at the call site.
- Real Drive API list/download — the 4-folder mock list is a hard-coded constant in the panel. The shape mirrors the spec's vendor-deliveries section so the swap-in is a fetch-shaped substitution.
- 30-day compression cron worker — UI surfaces the countdown but no server-side timer is scheduled. Marked `// TODO(0009):` on the download handler.
- R2 storage tier transitions (full-res originals → web-quality JPEG after 30 days) — purely a backend concern; the UI explainer prepares couples for it but no transition runs today.
- DB migration intentionally NOT added — local React state is enough to demonstrate the flow at scaffold level. The `photo_delivery_connections` shape is described in the 2026-05-09 result doc and can land alongside the real OAuth wiring without UI churn.

**Out of scope:**
- Real Google OAuth credentials, Google Cloud Project setup, Drive API verification (~6-week Google review for `drive.file` scope per the spec's notes section).
- Server actions / database / background workers — this is intentionally a presentational scaffold so the real iteration can drop in the Drive client without touching the layout.
- Other cloud providers (Dropbox / OneDrive / iCloud) — spec keeps these deferred indefinitely.
- Mobile-specific affordances like a sticky-bottom Connect CTA — the responsive Tailwind grid handles the breakpoints, but a dedicated mobile shell is V1.5+ proper.

**30-day rule visibility (work order requirement):**
- Top-of-page `<aside role="note">` amber callout describes the rule before any download happens — visible the moment the page loads, both desktop and mobile.
- Per-folder countdown badge (`Originals compress in {N} {day|days}`) appears the instant a folder is marked downloaded.
- Post-download explainer card surfaces the rule again with re-delivery guidance once at least one folder has been downloaded.
- All three rule surfaces use the same amber tone (`bg-amber-50` / `text-amber-950` / `bg-amber-200/80`) so the visual association reads as "policy notice".

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ (zero errors) · `pnpm --filter @setnayan/web lint` ✅ (no ESLint warnings or errors). No new dependencies added — Lucide icons (`CloudUpload`, `Camera`, `Plane`, `Video`, `HardDrive`, `Download`, `CheckCircle2`, `ShieldAlert`, `ShieldCheck`, `Loader2`) reused from existing imports.

**SPEC IMPACT:** None — this implements iteration 0009 § Frontend per the locked spec at scaffold level. Stubs map directly to the spec's "must work end-to-end" list (OAuth, Drive API, background job, manifest, notifications) and are inventoried above for the V1.5+ proper follow-up.

---

## 2026-05-15 · feat(0015): /for-vendors landing page (vendor-side acquisition)

**Commit:** to be filled after commit.

**Context:** Iteration 0015 § Routes lists `/for-vendors` as a "vendor-side deep dive (verification, payouts, marketing benefits)" page; per CLAUDE.md decision log 2026-05-15 the page should be at LEAST as polished as the homepage and follow the Airbnb host-page convention (lead with merchant outcomes, Shopify pattern). The pre-existing `/for-vendors` page was the SEO-foundation v1 — covered the basics but lacked vendor-side ops storytelling, comparison framing, transparent pricing, and a sticky mobile CTA.

**Page rewrite (in place):**
- `apps/web/app/for-vendors/page.tsx` — composes the new sections, owns SEO metadata + JSON-LD (BreadcrumbList, Organization, WebPage, plus two `Offer` blocks: free listing and Pro ₱499/wk subscription), renders the shared `SiteHeader` (already context-aware for `as=vendor` per PR #52), and mounts the sticky mobile CTA outside the `<main>` so it floats above the page.

**New section components under `apps/web/app/for-vendors/_sections/`:**
- `hero.tsx` — outcome-led hero ("Run your wedding business in one app"), dual CTA (`List your business · free` → `/signup?as=vendor`, `Talk to a human →` → `/help#contact`), trust strip ("Free to list · No monthly fee until Pro · BIR receipts handled"), and a Mariposa-Bloom dashboard mock card mirroring the homepage's couple-side mock pattern.
- `comparison.tsx` — six-row "5 apps vs Setnayan one app" outcome table (mobile: card stack; desktop: 3-column table with semantic `<th scope="col">` / `<th scope="row">`). Pulls the Shopify outcome-led pattern; mirrors the homepage chaos-panel beat for the vendor side.
- `operating-system.tsx` — six tool cards mapping iteration 0022 § 1's six surfaces (Calendar, Pipeline, Chat, Proposals, Payments, Reviews).
- `pricing.tsx` — exception to the homepage hide-prices rule (per CLAUDE.md 2026-05-15: vendors decide on cost; couples don't yet). Two-tier comparison (Free vs Pro ₱499/week), feature-by-feature checks, primary CTA on Pro.
- `what-you-keep.tsx` — payouts split, BIR receipts, EWT/2307, branding-on-contracts. Sourced from iteration 0022 § 5c (vendor-controlled final price + payment routing).
- `sponsored-boost.tsx` — 10km → 30km visibility extension (iteration 0022 § 5b), certified-vendor gate, density gate, ₱1,499/wk pricing visible.
- `verification.tsx` — 4-step Setnayan Team review process, 3-business-day SLA, DTI/SEC/Mayor's Permit + portfolio-review fallback for solo creatives, `coming_soon` → `verified` state-machine handoff (iteration 0022 § 2.1c).
- `testimonials.tsx` — empty placeholder slots at V1; populate post-launch with real vendor quotes (matches the iteration 0015 § Open Questions stance for couple testimonials, applied to vendor side).
- `closing-cta.tsx` — final dual CTA repeating the hero buttons, framed inside a burgundy-bordered conversion card.
- `sticky-mobile-cta.tsx` — fixed bottom-of-viewport CTA on `sm:` and below. 48px tap target, respects `env(safe-area-inset-bottom)`, hidden at `sm:` breakpoint and above. Page bottom padding (`pb-24 sm:pb-0`) prevents the sticky bar from masking the footer.

**Cross-cutting standards honored:**
- Mobile-first single-column → multi-column grid at `sm:` / `md:` / `lg:`.
- Sticky thumb-zone CTA on mobile per Heyflow / Apple HIG / WCAG 2.2 SC 2.5.8.
- WCAG 2.2 AA: visible focus rings inherited from `.button-primary` / `.button-secondary` (already styled with `focus-visible:ring-2`); `aria-hidden` on decorative icons; `role="region"` + `aria-label` on the sticky CTA bar.
- Burgundy accent throughout (terracotta token name preserved per PR #52 — semantic value is burgundy `#7A1F2B`).
- Taglish-tolerant voice: "Set na 'yan para sa business mo." in the closing CTA eyebrow; "Hi po!" in the demo inquiry; "chineck mo na po" in the comparison table.
- Header `Create account` button already routes to `/signup?as=vendor` on `/for-vendors` paths via `SiteHeader`'s `isVendorContext()` helper — confirmed in `apps/web/app/_components/site-header.tsx`. No header change needed.

**Out of scope (per task constraints):**
- Did NOT touch `apps/web/app/page.tsx` or any homepage section component.
- Did NOT touch `apps/web/app/_components/site-header.tsx`.
- Did NOT add new dependencies — all icons reused from existing `lucide-react`.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅ (no warnings or errors) · `build` ✅ (`/for-vendors` listed as ○ static prerendered, 1.52 kB / 165 kB). Prerendered HTML inspected: all section copy present, both Offer schemas in JSON-LD, sticky CTA markup rendered, `/signup?as=vendor` and `/help#contact` CTAs wired.

**SPEC IMPACT:** None — this implements iteration 0015 § Routes (`/for-vendors`) per the locked spec; no spec edits required.

---

## 2026-05-15 · docs: PR auto-merge is the standing default

**Commit:** to be filled after commit.

**Context:** Owner asked 2026-05-15 to "always merge once ready to merge" — no manual click between PR creation and production ship. Repo-level `allow_auto_merge` was flipped on the same day; this commit makes the workflow rule visible to every future Claude Code session by writing it into `CLAUDE.md` directly.

**What changed:**
- `CLAUDE.md` — new "PR workflow — auto-merge is the default" section. Documents `gh pr merge <PR#> --auto --merge` as the immediate follow-up to `gh pr create`, locks the merge method to `--merge` (matching existing history), and clarifies that `build (windows-latest)` is non-blocking so auto-merge can fire while it's still running.

**Verify:** Doc-only change. No code touched.

**SPEC IMPACT:** None. This is a workflow rule for the implementation repo, not a product or spec decision.

---

## 2026-05-15 · feat(0000,0015): replace placeholder S badge with new Setnayan logo SVG

**Commit:** `5c479ea` (merged via [#61](https://github.com/iscasasola/setnayan-platform/pull/61) as `ebdf686`).

**Context:** Owner-provided brand mark (the spark-and-tail glyph) finally replaces the placeholder "S in a terracotta circle" that had been shipping since iteration 0000. PWA + Tauri icons now survive a circular mask without clipping.

**What changed:**
- `apps/web/app/_components/logo.tsx` — new server `<Logo />` component. Inlines the dark path data, renders via `currentColor`, exposes `height`/`withWordmark`/`title` props. Two files in `apps/web/app/v/[slug]/page.tsx` and `apps/web/app/vendors/page.tsx` import it as `BrandLogo` to avoid colliding with their local vendor-logo helper.
- `apps/web/public/brand/setnayan-logo.svg` + `setnayan-mark.svg` — raw provided artwork + a `currentColor` extract for inline use.
- `apps/web/public/icon-192.svg`, `apps/web/public/icon-512.svg`, `src-tauri/icons/icon.svg` — regenerated on a `1664x1664` square canvas with the tall 808x1298 mark centered + padded. Mark uses ~77% of the inscribed circle's radius so Android adaptive icons and iOS rounded-corner masks don't crop the emblem or the tail.
- `src-tauri/shell/index.html` — redirect splash now renders the inline SVG mark instead of the placeholder `S` div.
- Marketing chrome + footers: `apps/web/app/_components/site-header.tsx`, `page.tsx` footer, `for-vendors/page.tsx` (footer), `vendors/page.tsx`, `download/page.tsx`, `help/page.tsx` (header + footer), `privacy/page.tsx`, `terms/page.tsx`. Login + signup pages now show the mark above the existing terracotta kicker.
- Dashboards: `dashboard/layout.tsx`, `vendor-dashboard/layout.tsx` ("Setnayan · Vendor"), `admin/layout.tsx` ("Setnayan · Admin").
- Public pages: `[slug]/page.tsx` invitation header, `v/[slug]/page.tsx` vendor profile header.

**Verify:** `pnpm typecheck` ✅ (both `@setnayan/shared` and `@setnayan/web`). Vercel preview + production CI checks green on [#61](https://github.com/iscasasola/setnayan-platform/pull/61).

**SPEC IMPACT:** None — asset-level rebrand, no product/scope change. Tauri raster icons (`.png`/`.ico`/`.icns`) regenerate automatically from the new SVG via `pnpm tauri:icons` (part of `tauri:build`); no manual export step needed.

---

## 2026-05-14 · feat(0025+0028): EN/TL locale toggle + 2 more email templates

**Commit:** to be filled after commit.

**Context:** Phase 2 polish work — wire a Tagalog dashboard chrome for the FilipinoFirst feel locked in `02_Specifications/Brand_Voice.md`, and bring the email-wired event count from 7 (post-PR-20) to 9 with the two transactional templates that have been outstanding since iteration 0028 first landed.

**Locale (0025):**
- New `apps/web/lib/i18n/dashboard.en.json` and `apps/web/lib/i18n/dashboard.tl.json` — ~31 dashboard-chrome strings each (nav labels, common CTAs, status pills, time-of-day greetings, common buttons).
- `apps/web/lib/i18n/index.ts` — `getLocale()` server helper reads `users.locale` (existing Postgres enum `locale_code`, values 'en'/'tl'/'ceb'). `t(key, locale?)` and `makeT(locale)` translate a known key. Anything other than 'tl' falls back to English.
- `apps/web/app/dashboard/profile/page.tsx` — new "Display language" section just above Theme. EN / TL radio. Persists to `users.locale` via the new `updateLocalePreference` server action.
- `apps/web/app/dashboard/profile/actions.ts` — `updateLocalePreference(formData)` validates against `('en','tl')` and writes the `users.locale` column.
- `apps/web/app/dashboard/[eventId]/layout.tsx` — fetches locale alongside event + unread count; passes nav labels into `<BottomNav>`; replaces hard-coded `aria-label="Profile"` and notification labels.
- `apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx` — accepts an optional `labels` prop with translated tab strings; falls back to English when omitted.
- `apps/web/app/dashboard/[eventId]/page.tsx` — section headings (Plan, Next up, Recent activity, Guided planner) plus time-of-day greeting now go through `tr(key)`; tile labels reference `TranslationKey`s.

**Emails (0028):**
- `apps/web/lib/notifications.ts` — added `help_ticket_replied` and `vendor_inquiry_received` to `NotificationType` plus matching entries in `NOTIFICATION_TYPE_LABEL` and `NOTIFICATION_TYPE_TONE`.
- `supabase/migrations/20260514010000_notification_type_additions.sql` — new migration that adds three `ALTER TYPE … ADD VALUE IF NOT EXISTS` statements: the two new types AND `rsvp_received`, which the codebase had been emitting since the iteration 0028 RSVP feature but was missing from the DB enum (the emits had been failing silently inside `emitNotification`'s try/catch).
- `apps/web/app/admin/help/actions.ts` — `setHelpMessageStatus` now fetches prior `admin_notes` before the update; when the admin posts a substantive new reply (content changed, non-empty), fires `help_ticket_replied` to the signed-in submitter (anonymous submitters have no `user_id` and are unreachable). Title `"Setnayan replied to your help ticket"`, body = first 200 chars of the reply, `relatedUrl` `/help`.
- `apps/web/lib/chat-actions.ts` — `sendChatMessage` now counts existing messages on the thread *before* inserting the new one. When `senderRole === 'couple'` AND the existing count is zero, fires `vendor_inquiry_received` (title `"New booking inquiry from <event name>"`, body = first 200 chars, `relatedUrl` `/vendor-dashboard/messages/<threadId>`). All subsequent messages still fire the regular `chat_message` notification.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅ · `build` ✅ (43 routes, no errors).

**SPEC IMPACT:** Two specs touched.
- `02_Specifications/Brand_Voice.md` (or equivalent) — V1 dashboard now ships Tagalog chrome; please record the EN/TL toggle and the locked translation set in the spec via Cowork.
- `02_Specifications/0028_email_notifications.md` — event-wired list goes from 7 to 9 (add `help_ticket_replied` and `vendor_inquiry_received`). Please update via Cowork.

---

## 2026-05-14 · feat(0036): event-day pre-load — couple + vendor day-of resilience

**Commit:** to be filled after commit.

**Context:** day-of venue WiFi is unreliable. Owner asked for a proactive pre-load that downloads the full event bundle into the client cache so the dashboard works offline when it matters most. This iteration adds the pre-load infrastructure on the couple and vendor sides; the underlying TanStack-Query persistence layer ships separately as PR #10 (caching foundation).

**What landed:**
- [apps/web/lib/event-preload.ts](apps/web/lib/event-preload.ts) — new `server-only` module. `prefetchEventBundle(eventId)` fetches guests + tables/assignments + schedule + vendors + budget + mood-board palette + last-50 messages per couple/vendor thread, packaged under canonical TanStack-Query keys. RLS gates the read.
- [apps/web/app/_components/event-day-prep-actions.ts](apps/web/app/_components/event-day-prep-actions.ts) — `'use server'` action `prepareForEventDay` (couple side) + `prepareVendorEventDay` (vendor side). Returns a discriminated union so the client surfaces retry-able errors instead of throwing.
- [apps/web/app/_components/event-day-prep-cta.tsx](apps/web/app/_components/event-day-prep-cta.tsx) — couple-side banner CTA. Visible T-3 days to T+1 day. On click: hydrates the Query cache section-by-section + posts `{ type: 'PRELOAD_ASSETS', urls }` to the SW for asset warm-up. Phases: idle → loading → done (`"Ready for event day — works offline"`) or error with retry.
- [apps/web/app/_components/auto-preload-on-event-day.tsx](apps/web/app/_components/auto-preload-on-event-day.tsx) — silent client component on the dashboard. Auto-fires the action when the event is T-24h to T+12h, deduped to once per 60 minutes via `localStorage`.
- [apps/web/app/_components/vendor-event-day-prep-cta.tsx](apps/web/app/_components/vendor-event-day-prep-cta.tsx) — vendor-side analogue. Scoped per chat thread (one card per upcoming couple).
- [apps/web/app/dashboard/[eventId]/page.tsx](apps/web/app/dashboard/[eventId]/page.tsx) — renders both new components above the welcome strip. Minimal edit.
- [apps/web/app/vendor-dashboard/page.tsx](apps/web/app/vendor-dashboard/page.tsx) — renders a `<VendorEventDayPrepCta>` per upcoming event (filtered to the T-3/T+1 window server-side).
- [apps/web/public/sw.js](apps/web/public/sw.js) — added a `message` listener that handles `PRELOAD_ASSETS` by `fetch + cache.put`-ing each URL. Stub-level today; the iteration 0010 (Workbox + route-scoped expiration) handler will continue to honor the same message shape.

**Dependency:** PR #10 (`claude/caching-foundation`) is being worked on in parallel and adds the runtime side — `@tanstack/react-query`, `getQueryClient()`, the providers wrapper, persisted IndexedDB cache. This PR uses local gitignored stubs (`apps/web/lib/query-client.ts`, `apps/web/app/providers.tsx`, `apps/web/lib/use-tracked-mutation.ts`, excluded via `.git/info/exclude`) so typecheck + lint pass before merge. Stubs vanish once #10 lands.

**SPEC IMPACT:** New iteration **0036_event_day_preload**. The owner needs to add this to the spec corpus via Cowork — see `COWORK_INBOX.md` for the entry.

---

## 2026-05-14 · repo public + free-tier security hardening pass

**Commit:** to be filled after commit.

**Context:** flipped the GitHub repo from private to public (CI Actions were getting metered against a low spending limit; public repos get unlimited free minutes). Before/during the flip, ran a credential audit on the committed files.

**Incident found and resolved:** [HANDOFF.md:233](HANDOFF.md:233) had the real Supabase pooler URL including the database password (`postgresql://postgres.<ref>:<password>@…`). The line was added back when the repo was private and treated as an internal handoff doc. The password was rotated in the Supabase dashboard immediately upon detection; the file is now scrubbed to a redacted template that points at Vercel env vars / `.env.local` for the actual value. No code uses `SUPABASE_DB_URL` at runtime (only `supabase db push` migrations from CLI), so the rotation did not require a redeploy.

**What landed in this commit:**
- [LICENSE](LICENSE) — added GNU AGPL-3.0 (verbatim from gnu.org). Anyone may read and fork; any derivative offered as a hosted service must also be open-sourced. Maximizes commercial-fork friction while keeping the code legitimately open.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — added a `gitleaks` job using `gitleaks/gitleaks-action@v2`. Future commits introducing credentials will fail CI before merge. Free for public repos.
- [HANDOFF.md](HANDOFF.md) — DB connection string + password scrubbed; replaced with redacted template.
- [STATUS.md](STATUS.md) — Supabase project URL + dashboard direct link replaced with "see Vercel env vars" / generic dashboard root. Project ref is not strictly secret (it's transmitted in every client request), but trimming it from docs slows down automated scraping.

**GitHub-side settings flipped via `gh api` (no code change, recorded here for the audit trail):**
- Dependabot vulnerability alerts → enabled
- Dependabot automated security updates → enabled
- Secret scanning → enabled
- Secret-scanning push protection → enabled (rejects future commits containing recognized credential patterns)
- Wiki → disabled
- Projects → disabled
- Discussions → already disabled

**Owner follow-ups (UI-only flips, not REST-accessible):**
- Settings → Actions → General → set "Require approval for first-time contributors" to **All outside collaborators**. Prevents drive-by fork PRs from auto-triggering paid workflows.
- Optional: enable required PR review on `main` branch — deferred since solo dev; revisit if/when a second contributor joins.

**SPEC IMPACT:** None on locked product decisions. The license choice (AGPL-3.0) is a new project-level fact worth noting in the spec corpus' `CLAUDE.md` decision log — please update `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` via Cowork to reflect: *"Repo is public and AGPL-3.0 licensed as of 2026-05-14; downstream forks that host the code as a SaaS must also be AGPL-3.0."*

---

## 2026-05-14 · feat(routing): short URLs for the couple dashboard

**Commit:** to be filled after commit.

**What landed:** `apps/web/middleware.ts` now redirects `/<event-uuid>/<anything>` &rarr; `/dashboard/<event-uuid>/<anything>`. So `setnayan.com/57159614-47aa-…/guests/quick` works the same as the full `setnayan.com/dashboard/57159614-…/guests/quick`. Couples can bookmark or share short URLs and skip the `/dashboard/` prefix when typing by hand.

**Why it's safe:**
- UUIDs are 36 chars (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Slugs are validated at 3&ndash;32 chars `[a-z0-9-]+`. The two patterns cannot collide &mdash; a UUID can never be mistaken for a slug, and vice versa.
- The redirect fires before the `[slug]` catch-all gets a chance to 404. Slugs continue to resolve via `/<slug>` as before.
- The destination `/dashboard/[eventId]/...` already enforces auth in its layout. If a non-authenticated user types a UUID URL by accident, they're bounced to `/login` exactly the same way they would be on the full URL.

**SPEC IMPACT:** None &mdash; URL aliasing only; no schema, RLS, or product-decision change.

---

## 2026-05-14 · COWORK_INBOX.md handoff channel + caching strategy queued

**Commit:** to be filled after commit.

**What landed:**
- New `COWORK_INBOX.md` at the repo root — active worklist of pending spec-corpus updates the owner must apply via Cowork. Distinct from `CHANGELOG.md` (full history): the inbox is a `[PENDING]` / `[DONE]` worklist that shrinks as items are actioned, so the owner doesn't have to scan changelog history to find what still needs Cowork's attention.
- `CLAUDE.md` documentation contract expanded from three files to four (adds `COWORK_INBOX.md`). New step inserted into "Rules for every session": after any code change with non-`None` spec impact, append a `[PENDING]` entry to the inbox alongside the changelog entry. The Cowork-boundary section also references the inbox as the standard handoff channel.
- Seeded the inbox with the first real entry: **Caching & Offline Strategy** — a new cross-cutting infra section (100 MB per-install budget, TanStack Query + IndexedDB + service-worker `CacheExpiration`). Inbox entry offers the owner two placement options (section in platform-foundation spec, or new mini-iteration `0036_caching_strategy/`).

**Operational note:** No code in `apps/` or `packages/` touched. This is repo-doc housekeeping only — the caching implementation itself is parked until the spec is locked via Cowork and the owner explicitly green-lights the implementation plan.

**SPEC IMPACT:** Indirect. The inbox itself is a repo-internal mechanism — no spec change needed. But the seeded *content* (caching strategy) does have spec impact: the owner must apply it via Cowork to either the platform-foundation spec or a new `0036_caching_strategy/` iteration folder at `~/Documents/Claude/Projects/Setnayan/`. The pending entry in `COWORK_INBOX.md` carries the full draft content.

---

## 2026-05-14 · admin merchant-QR uploads: auto-detect + square crop

**Commit:** [2b8f0cc](https://github.com/iscasasola/setnayan-platform/commit/2b8f0cc) (PR #2)

**What landed:**
- New client component [apps/web/app/admin/settings/_components/qr-upload-form.tsx](apps/web/app/admin/settings/_components/qr-upload-form.tsx). When an admin picks a QR file on Platform Settings, the component decodes it via `createImageBitmap`, runs `jsQR` to locate the QR's four corners, computes a square bounding box (plus a ~12% quiet-zone margin), renders a 512×512 PNG crop on a white-background canvas, then submits that blob to the existing `uploadMerchantQr` server action via a manual FormData (so we don't depend on the `DataTransfer` file-swap trick, which has known iOS Safari quirks).
- Three resolved states surface inline:
  - **Detected** — green confirmation + cropped preview.
  - **Fallback** — couldn't find a QR in the source, center-square crop is used; amber warning asks the admin to review the preview before clicking Upload.
  - **Raw passthrough** — `createImageBitmap` couldn't decode the source (e.g. HEIC on Chrome/Firefox); the original file is queued for upload unchanged so behavior matches what shipped before.
- New `jsqr@^1.4.0` dep in [apps/web/package.json](apps/web/package.json) (~50 KB, pure JS, bundled types). No native deps.
- [apps/web/app/admin/settings/page.tsx](apps/web/app/admin/settings/page.tsx) helper copy now explains the auto-crop behavior and the 512×512 output, and replaces the prior inline `<form>` with `<QrUploadForm>`.

**SPEC IMPACT:** None on any locked decision. The merchant-QR upload contract (Iteration 0034 payments) is unchanged at the schema / server-action / storage layer — `platform_settings.{bdo_qr_url,gcash_qr_url}` still points at whatever Supabase Storage URL `uploadPublicAsset` returns. This is a pre-upload UX enhancement: admins can drop a phone screenshot or photo of their merchant QR and the system normalizes it to a clean square instead of forcing them to hand-crop in another app.

---

## 2026-05-14 · feat(guests): quick-add list — Enter-driven bulk entry

**Commit:** to be filled after commit.

**Why:** Adding guests one at a time through `/guests/new` (or CSV import) is too heavy for the most common case &mdash; the couple sitting at their laptop, brain-dumping every name they want at the wedding. The owner asked for an Excel-feel: type first name &rarr; Enter &rarr; last name &rarr; Enter &rarr; the row is committed and a fresh row appears, focused.

**What landed:**

- `apps/web/app/dashboard/[eventId]/guests/quick/page.tsx` &mdash; new public route at `/dashboard/<eventId>/guests/quick`. Server-component wrapper that handles auth + error-banner state, embeds the client component.
- `apps/web/app/dashboard/[eventId]/guests/quick/_components/quick-add-list.tsx` &mdash; the heart of the feature. Client component:
  - Auto-focus First Name on mount.
  - `Enter` on First Name moves focus to Last Name. Empty + Enter when there are already finalized rows triggers the bulk upload.
  - `Enter` on Last Name finalizes the row, clears both inputs, refocuses First Name.
  - Last name is optional (some guests go by one name).
  - Each finalized row shows with a green check + click-to-edit (combined first/last in a single editor) + remove X.
  - The submit auto-finalizes whatever's in the live row at click time so a half-typed name isn't silently dropped.
  - `useFormStatus()` driven Upload button shows the spinner + "Uploading&hellip;" during the server action.
- `apps/web/app/dashboard/[eventId]/guests/quick/actions.ts` &mdash; `bulkAddGuests(eventId, formData)` parses a JSON array, validates (max 500 per upload), and bulk-inserts via a single Supabase `insert(rows)`. Defaults each row to `side: both`, `group_category: other`, `role: guest`, `rsvp_status: pending`, `invited_to_blocks: [ceremony, reception]`. Redirects to `/guests?added=N` so the couple sees a confirmation toast.
- `apps/web/app/dashboard/[eventId]/guests/page.tsx`:
  - New header CTA "Quick add list" alongside Import CSV / + Add guest.
  - `pickFlash()` now reads the `?added=N` count and renders "Added 12 guests." instead of the generic "Guest added."

**Tradeoffs (called out for owner / spec reconciliation):**
- Quick-add intentionally **drops every name into "Other (uncategorized)"** with default side/role. The couple is expected to refine each row from the full guest list later. This is the right tradeoff for the brain-dump phase &mdash; forcing role/side at entry-time kills momentum.
- Plus-ones are NOT supported in quick-add. If a couple wants a +1, they use `/guests/new` (which has the full plus-one model).
- Single-word names work (last name is optional). Multi-word last names work. Mid-word Enter cleanly moves to the next field.

**SPEC IMPACT:** 0001 Guest List:
- Add a new sub-feature "quick-add list" to the iteration doc. It supplements the existing add-one-at-a-time flow and the CSV import &mdash; it does NOT replace either.
- Note the defaults: side `both`, group `other`, role `guest`. The spec's role hierarchy and sponsor tiers are unaffected (couples refine post-entry).
- Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0001_guest_list.md` via Cowork.

---

## 2026-05-14 · fix(invitation): monogram QR thumbnails clipped in fixed-size boxes

**Commit:** [3d37ae7](https://github.com/iscasasola/setnayan-platform/commit/3d37ae7) (PR #1)

**What landed:**
- `apps/web/app/dashboard/[eventId]/invitation/page.tsx` — added `[&_svg]:h-full [&_svg]:w-full` to the three QR-thumbnail wrappers (the monogram preview card, the desktop guest-table cell, and the mobile guest-card row). The `qrcode` library bakes `width="256"` into its SVG output, so when the SVG was embedded in `h-32 w-32` / `h-16 w-16` / `h-20 w-20` containers with `overflow-hidden`, only the top-left corner of the 256-px QR was visible. The arbitrary-variant rule forces the inner `<svg>` to fill its constrained parent, matching the pattern the print sheet already uses (`.print-qr svg { width:100%; height:100% }`).
- Public landing page (`apps/web/app/[slug]/page.tsx`) unaffected — it wraps the QR in an `inline-block` with no fixed dimensions, so the SVG renders at its natural 256 px.

**SPEC IMPACT:** None — purely visual bug fix, no schema, RLS, or product-decision change.

---

## 2026-05-14 · transaction-receipt rename + /download 404 fix + remaining form-button sweep

**Commit:** to be filled after commit.

**Three things landed:**

**1. Receipts are not BIR Official Receipts — clarified app-wide.**
The system was labeling the auto-generated receipt as "Official Receipt" and citing "BIR Revenue Regulations". That overclaims: these are app **transaction receipts** for the customer's records. The actual BIR Official Receipt (where applicable) is issued separately, offline. Renames + disclaimers landed in:

- `apps/web/lib/receipts.ts` — `formatOrNumber` → `formatReceiptNumber`. The numbering prefix changed from `SR-YYYY-XXXXXX` to `TXN-YYYY-XXXXXX`. The DB column `or_serial` is unchanged (it's an internal serial; a rename would have required a migration).
- `apps/web/app/receipts/[receiptId]/page.tsx` — page title metadata "Official Receipt" → "Transaction Receipt"; the header badge says "Transaction Receipt"; the "BIR-Registered" label is removed (TIN stays, optional); footer rewritten: *"This is a system-generated transaction receipt for your records. It is NOT a BIR Official Receipt. The corresponding BIR Official Receipt is issued by Setnayan separately."*
- `apps/web/app/admin/receipts/page.tsx` — page heading "Transaction receipts"; explainer says *"not BIR Official Receipts — cross-reference with your BIR-side OR records before filing"*; table column "OR number" → "Transaction No."
- `apps/web/app/admin/settings/page.tsx` — wording on the business-identity section + TIN help text updated.
- `apps/web/app/admin/payments/actions.ts` — code comment + `maybeIssueReceipt` comment.
- `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` — "BIR-compliant OR" banner rewritten to "Transaction receipt issued — Not a BIR Official Receipt".
- `apps/web/app/terms/page.tsx` — legal text rewritten to remove BIR-compliant Official Receipt claim and explain that quoted amounts are pre-VAT base.

**2. /download was 404'ing for anonymous visitors.**
The download flow was redirecting to a GitHub Release asset URL. The repo is **private**, so anonymous downloads got 404 from GitHub. Fixed by:
- Copied the DMG into `apps/web/public/downloads/Setnayan_0.0.1_aarch64.dmg`. Vercel serves `/downloads/...` publicly with no auth.
- `apps/web/lib/desktop-release.ts` updated: `mac.aarch64.url` now points at `/downloads/Setnayan_0.0.1_aarch64.dmg` (relative).
- `apps/web/app/api/download/mac/route.ts` re-implemented as a runtime route (the previous `force-static` directive couldn't reconcile relative URLs at static-export time). Now it resolves the target URL from `request.url` and 302-redirects.
- Removed the now-broken "Release notes →" link from `/download` (the GitHub release page is also private).

**3. Form-button audit — final sweep + login-pending visibility.**
Spawned a parallel agent to do a multi-pass audit. It identified + fixed:

- Couple notifications page: "Mark all read" + "Mark read" now use `SubmitButton`.
- `/help` page contact form: "Send message" now uses `SubmitButton`.
- Vendor notifications + vendor home: equivalent buttons swept.
- `apps/web/app/globals.css`: `.button-secondary` got `disabled:cursor-not-allowed disabled:opacity-60` (matching `.button-primary` which already had it).

**SubmitButton itself was hardened** so the pending state is unmistakable, especially for fast actions like sign-in where the redirect lands ~200ms after click:
- Added `data-pending` attribute (useful for hooks + Cypress later).
- Added `cursor-wait` while pending so the cursor changes immediately on click.
- Bumped Loader2 stroke from 1.75 → 2.25 for a heavier-looking spinner.
- Empty `pendingLabel` (e.g. icon-only Send buttons) now still announces "Working…" to screen readers via `sr-only`.

**Background agent caveat:** the audit agent stalled at ~Pass 9 due to a stream watchdog timeout. Its committed-but-not-reported changes are good; the things it diagnosed but didn't yet fix were rolled into this commit (SubmitButton enhancements + the cursor-wait + sr-only fallback).

**SPEC IMPACT:** 0026 BIR receipts:
- The spec described the auto-issue as an "Official Receipt" — that wording is incorrect for V1. Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0026_bir_tax_compliance.md` via Cowork:
  - Rename "Official Receipt" → "App transaction receipt" throughout the iteration doc.
  - Add a callout: V1 does NOT issue BIR-compliant ORs; the platform records a transaction reference for the customer, while the actual BIR OR is issued by Setnayan via its accountant / POS receipt book.
  - The OR numbering prefix changed from `SR-YYYY-NNNNNN` to `TXN-YYYY-NNNNNN`; legacy receipts (if any) keep their SR- numbers since they were already issued.
  - The math (pre-VAT base + 12% VAT added on top = gross) stays correct.

---

## 2026-05-14 · VAT direction fix + sweep of every mutating form for double-submit prevention

**Commits:** to be filled after commit.

**Two issues from the live testing pass:**

1. **VAT math was inverted.** Receipts treated the quoted order total as **VAT-inclusive gross** (back-calculating pre-VAT = total / 1.12). The actual contract is the PH B2B convention: the quoted price is the **pre-VAT base**, and VAT is **added on top**. So a ₱10,000 quote should bill the customer ₱11,200, and the OR shows pre-VAT ₱10,000 + VAT ₱1,200 + gross ₱11,200.

2. **Many submit buttons could double-fire.** During Flow A testing, a double-click on the payment-log button created two duplicate payments at +2s apart. The fix from earlier (a single `<SubmitButton>` reusable component that hooks `useFormStatus`) was applied only to the payment-log surface. Today we swept every mutating form across the app.

**What landed:**

- **VAT math (`apps/web/lib/receipts.ts`):** renamed `computeVatBreakdown(grossPhp)` → `computeVatFromBase(basePhp)`. New math: `vat = base * rate / 100; gross = base + vat`. Order's `*_total_php` columns now semantically mean **pre-VAT base** (not gross). Existing receipts in the DB are unchanged — only new receipts use the new math.
- **`apps/web/lib/orders.ts:computeOrderTotals`:** exposes `base`, `vat`, `vatRatePct`, `gross`. `headlineTotal` is now the gross (what the couple actually pays). `remaining` runs on gross.
- **Couple order detail (`/dashboard/[eventId]/orders/[orderId]`):** stat row now reads **Pre-VAT base → + VAT (12%) → Total to pay → Remaining**. Explanatory line: *"Confirmed base = ₱X. PH BIR-compliant VAT (12%) is added on top — what you actually pay is ₱X·1.12."*
- **Couple orders list (`/dashboard/[eventId]/orders`):** each card now shows the **gross** with an "incl. VAT" subscript, so couples never wonder why the line in payment-instructions is higher.
- **New-order form (`/dashboard/[eventId]/orders/new`):** field re-labeled "Your proposed budget (PHP, pre-VAT)" with explainer text.
- **Admin quote prompt (`/admin/payments` → "Orders needing a quote"):** shows the requested pre-VAT base + computed gross side-by-side: *"Requested (pre-VAT): ₱10,000 · buyer pays ₱11,200 incl. 12% VAT"*. Input now reads "Confirmed pre-VAT total (PHP)" with the same buyer-pays hint below.
- **Receipt auto-issue (`/admin/payments/actions.ts:maybeIssueReceipt`):** uses `computeVatFromBase(base)`. Pre-VAT and gross now diverge correctly; the BIR-compliant OR shows the proper breakdown.

**Form double-submit sweep — every mutating action now uses `SubmitButton`:**

| Surface | Action |
|---|---|
| `/signup`, `/login` (password + magic link) | Sign up / Sign in / Send magic link |
| `/join/[eventId]` | RSVP / Join event |
| `/[slug]` (public guest), `/[slug]/welcome` | Save RSVP / Confirm plus-one |
| `/dashboard/create-event` | Create event |
| `/dashboard/[eventId]/guests/{new,[guestId],import}` | Create / Update / Delete / Import guests |
| `/dashboard/[eventId]/messages` (couple + vendor) | Start thread / Send chat message |
| `/dashboard/[eventId]/orders/{new,[orderId]}` | Submit / Cancel order |
| `/dashboard/[eventId]/invitation` | Save monogram / Re-issue token |
| `/dashboard/[eventId]/schedule` | Add / Toggle / Delete block |
| `/dashboard/[eventId]/vendors` | Add / Update status / Delete vendor |
| `/dashboard/[eventId]/budget` | Add line item / Delete line item / Log payment / Delete payment |
| `/dashboard/[eventId]/seating` | Add table / Delete table / Assign / Unassign guest |
| `/dashboard/[eventId]/services/save-the-date` | Request template |
| `/dashboard/profile` | Save personal info / Change password / Delete account |
| `/dashboard/api-keys` | Create key / Revoke key |
| `/admin/users` | Restore / Toggle team pool / Confirm email / Reset password |
| `/admin/help` | Update status |

Each button now disables itself + shows a "Saving…" / "Logging…" / contextual pending label between click and redirect. The `useFormStatus()` hook unblocks once the server action resolves.

**Skipped intentionally** (low-risk / idempotent): Apply/filter buttons on search pages, sign-out buttons (idempotent), planner step toggles, theme/mode switchers, slug-availability checker, restart-tour, the few action toggles in profile that are pure boolean flips.

**SPEC IMPACT:** Receipts (Iteration 0026 BIR compliance):
- The spec's VAT chapter described the math without nailing direction. Today's flip is the production-correct PH B2B reading: "The quoted price is exclusive of VAT; VAT is added on top." Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0026_bir_tax_compliance.md` via Cowork to reflect:
  - Order/quote totals are stored pre-VAT
  - The amount the customer pays is `pre_vat * (1 + vat_rate/100)`
  - The receipt always shows three lines: pre-VAT base, VAT amount, gross total
  - Receipts issued under the old math (before today) are not retroactively adjusted

---

## 2026-05-14 · public macOS download page + GitHub Release v0.0.1

**Commit:** to be filled after commit.

**What landed:**
- Published the locally built desktop bundle as **GitHub Release v0.0.1**: https://github.com/iscasasola/setnayan-platform/releases/tag/v0.0.1 (asset `Setnayan_0.0.1_aarch64.dmg`, 1.4 MB, Apple Silicon).
- New `apps/web/lib/desktop-release.ts` — single source of truth for the currently shipped desktop release (version, tag, file URL, size, publish date). Future version bumps only touch this file.
- New `apps/web/app/api/download/mac/route.ts` — 302 redirect to the GitHub Release asset. Lets the website link `/api/download/mac` indirect through this route so the underlying URL can rotate without touching every page.
- New `apps/web/app/download/page.tsx` — public install page at `setnayan.com/download`. Hero with "Download for Mac" CTA + file metadata card, 4-step install guide, Gatekeeper-warning explainer card, system-requirements card. All Apple-Silicon-only messaging; Intel Mac users get routed back to the web app.
- Homepage updated: small "On a Mac? Download Setnayan for macOS" inline link below the hero CTAs, plus a footer link.

**Operational note:** the in-app/desktop **auto-updater** is **not** wired yet. Users who download v0.0.1 will need to revisit `/download` and reinstall to get future releases. The auto-update plumbing (Tauri updater plugin + signing keypair + manifest endpoint) is a separate task — best done after Apple Developer enrollment so the signed updates flow cleanly past Gatekeeper.

**SPEC IMPACT:** None on locked decisions. The download page itself is new public surface but doesn't change any V1 contract — it just exposes the desktop wrapper Iteration 0023 already shipped (now distributable via the website instead of buried in a GitHub Actions artifact).

---

## 2026-05-14 · desktop local-build fixes (tauri scripts + Cargo.lock)

**Commit:** to be filled after commit.

**What landed:**
- `package.json` tauri scripts were passing `--manifest-path src-tauri/Cargo.toml` to `cargo tauri build` / `cargo tauri dev`. Tauri CLI doesn't accept that flag (it's a `cargo` flag, not a `cargo tauri` flag) — Tauri auto-discovers `src-tauri/`. Scripts now run plain `cargo tauri build` / `cargo tauri dev`. CI was unaffected because `.github/workflows/build-desktop.yml` invokes `tauri build` directly, not via the npm script.
- Added a `tauri:icons` script (`cargo tauri icon src-tauri/icons/icon.svg`) and chained it into `tauri:build`. Generated icons are gitignored on purpose (CI regenerates from `icon.svg`); the chain ensures the local build doesn't fail with *"failed to open icon … 32x32.png: No such file or directory"* on a fresh clone.
- Committed `src-tauri/Cargo.lock` for the first time. App crates (vs library crates) should pin transitive deps via the lockfile so every machine compiles identical bytecode.

**Verified locally:**
- `pnpm tauri:build` produced `src-tauri/target/release/bundle/dmg/Setnayan_0.0.1_aarch64.dmg` (1.4 MB) and `bundle/macos/Setnayan.app` (2.9 MB) on Apple Silicon. Ad-hoc codesigned, opens cleanly, native window loads `https://setnayan.com`.

**SPEC IMPACT:** None — packaging fix only.

---

## 2026-05-14 · desktop shell points at setnayan.com

**Commit:** to be filled after commit.

**What landed:**
- `src-tauri/shell/index.html` now redirects to `https://setnayan.com` instead of the old `setnayan-platform-web.vercel.app`. Three call sites updated (the `<meta http-equiv="refresh">`, the `<noscript>` anchor, and the JS `window.location.replace`). No other Tauri config changes — bundle identifier (`com.setnayan.desktop`), product name, and window chrome stay the same.

**Operational note (not a code issue):** the last 4 desktop builds on GitHub Actions failed with *"recent account payments have failed or your spending limit needs to be increased"*. The fix is on the GitHub billing side — see `OWNER_ACTIONS.md` (or settings at https://github.com/settings/billing/spending_limit). Once billing is unblocked, the next push will produce a `.dmg` + `.msi` pointing at the real domain.

**SPEC IMPACT:** None — Tauri shell URL change only; the spec corpus doesn't pin the redirect target.

---

## 2026-05-14 · admin payments PGRST201 fix — page was silently returning empty (backfilled)

**Commit:** [954def3](https://github.com/iscasasola/setnayan-platform/commit/954def3)

**What broke:** `/admin/payments` showed *"Nothing to reconcile"* even when the DB had 2 pending payments. Supabase quietly returned an empty array. Root cause: PostgREST error `PGRST201` — the `payments` table has two FKs to `users` (`user_id` for the buyer + `reviewed_by_user_id` for the admin reviewer), and the embedded join `user:users(email, public_id)` was ambiguous. PostgREST returned a 300-class error and the data fell through to `[]`.

**Fix:** Disambiguate the embed with the explicit FK constraint name on every Supabase select that joins through these two FKs:

- `user:users!payments_user_id_fkey(email, public_id)` on the payments query
- `user:users!orders_user_id_fkey(email, public_id)` on the orders-needing-quote query

Verified via `curl` with the service-role key — both pending payments + their joined buyer rows came back as expected.

**SPEC IMPACT:** None — implementation defect only; the spec's data model is correct.

---

## 2026-05-14 · pending-state SubmitButton + payment screenshot file upload (backfilled)

**Commit:** [07e301c](https://github.com/iscasasola/setnayan-platform/commit/07e301c)

**Two UX issues from the live Flow A test:**

1. *"When I press the Log Payment button I don't know if it is loading. Seems like I can double-click on it."* → Two duplicate `payments` rows inserted at +2 seconds apart.
2. *"Screenshot URL is not a link — it should be an upload photo."*

**What landed:**

- New reusable client component `apps/web/app/_components/submit-button.tsx`. Hooks `useFormStatus()` from `react-dom` to:
  - Disable the button while the server action is pending (`disabled + aria-busy`).
  - Swap content for a `Loader2` spinner + customizable `pendingLabel` ("Logging…", "Approving…", "Saving…", etc.).
- Wired into the payment-log, approve, reject, confirm-quote, settings-save, QR-upload, QR-remove, and create-order surfaces immediately.
- Payment screenshot input flipped from `<input type="url">` to `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif">`. Form now uses `encType="multipart/form-data"`. Server action `logPayment` parses the file from FormData and uploads via the existing `uploadPublicAsset()` helper to the `platform-assets` bucket under `payment-screenshots/<order_id>/`. Returns the public URL into `payments.screenshot_url`.
- Raised Supabase bucket size cap + added HEIC MIME (iPhone Live-Photo default).
- Raised Next.js `experimental.serverActions.bodySizeLimit` to `'6mb'` so iPhone screenshots survive the multipart hop.

**SPEC IMPACT:** None on locked decisions. UX hardening only.

---

## 2026-05-14 · manual password reset workflows — Phase 2 (Resend) bypass (backfilled)

**Commit:** [b556a6c](https://github.com/iscasasola/setnayan-platform/commit/b556a6c)

**Why:** The owner chose to skip Resend email setup pre-launch (cost/quota concerns). Without a transactional email provider, the Supabase magic-link / password-reset emails don't go out. To unblock users, two manual workflows were added.

**What landed:**

- **Admin-initiated:** new server action `resetUserPassword(formData)` in `apps/web/app/admin/users/actions.ts`. Calls `supabase.auth.admin.updateUserById(targetUserId, { password: tempPassword })` with a freshly-generated 12-char alphabet (Crockford-style; no 0/O/1/I/l). Redirects to `/admin/users?temp_password=<...>&for_email=<...>` so the admin sees the password once in an amber banner.
- **User self-service:** new section on `/dashboard/profile` ("Change password") with two `<input type="password">` fields. Server action `changePassword` validates the match, calls `supabase.auth.updateUser({ password })`. Session stays alive; new password takes effect on next sign-in.
- `OWNER_ACTIONS.md` updated: Phase 2 (Resend) marked DEFERRED. Phase 2A documents the admin reset path. Phase 2B is the "wire Resend later" note.

**SPEC IMPACT:** None on platform contract — both flows use existing Supabase Auth primitives. The deferred Resend integration only blocks the *self-service* email-based reset; admin-initiated reset is fully functional.

---

## 2026-05-14 · admin mobile polish

**Commit:** to be filled after commit.

**What landed:**
- `/admin/users`: hid the Account ID column below `lg` (`hidden lg:table-cell`) and the Created column below `md`; updated the empty-state `colSpan` from 6 → 4 to match the visible-on-mobile column count.
- `/admin/events`: hid Venue + Slug below `md` and the internal Event ID below `lg`; updated the empty-state `colSpan` from 6 → 3.
- `/admin/receipts`: hid the Issued date below `md` and the Pre-VAT + VAT columns below `lg`. (Stat tiles already use `grid-cols-2 sm:grid-cols-4` and the OR-number / Customer / Gross columns stay visible on mobile.)
- `apps/web/app/admin/layout.tsx`: kept the tab nav scrollable horizontally and added `shrink-0` to each `AdminTab` plus `whitespace-nowrap` on the nav so tabs don't squish/wrap on narrow viewports. Native scrollbar is hidden on WebKit/FF/MS for a cleaner look.

No DB changes. No behavior changes beyond responsive styling. All other admin surfaces (`/admin`, `/admin/payments`, `/admin/vendors`, `/admin/help`, `/admin/settings`) already used card-grid layouts and already responded to viewport width.

**SPEC IMPACT:** None — this is pure responsive styling; no schema, no contract, no copy changes. The admin console is still V1 MVP (Iteration 0023 surface).

---

## 2026-05-13 · PRE-LAUNCH SPRINT COMPLETE — 19 iterations + 2 polish rounds

**Summary commit reference:** see git log on `main` for the per-iteration commits. New consolidated handoff at `HANDOFF.md`.

This session shipped, in order:

| Iteration | Surface | Migration |
|---|---|---|
| 0021 | Couple dashboard rework: 4 themes, Lucide icons, new Home, Guided Planner | `20260513070000_iteration_0021_planner.sql` |
| 0015 | Public marketing landing at `/` (hero + features + roadmap + footer) | — |
| 0010 | Mood Board with venue/couple/role palette families | `20260513080000_iteration_0010_mood_board.sql` |
| 0008 | Seating chart (tables + assignments + drag-place floor plan) | `20260513090000_iteration_0008_seating.sql` |
| 0006 | Vendors couple-side tracker (28-category enum + 6-stage status) | `20260513100000_iteration_0006_vendors.sql` |
| 0007 | Budget & expenses (line items + payments + `.ics` export) | `20260513110000_iteration_0007_budget.sql` |
| 0022 | Vendor sign-up + profile editor (Pattern A RLS) | `20260513120000_iteration_0022_vendor_dashboard.sql` |
| 0019 | Couple↔vendor 1:1 chat with identity masking | `20260513130000_iteration_0019_communications.sql` |
| 0023 | Admin console (Overview · Users · Events · Vendors) | — |
| 0025 | Profile settings (editable info + RA 10173 export + soft-delete) | `20260513140000_iteration_0025_profile_settings.sql` |
| 0034 | Orders + payments + manual reconciliation queue | `20260513150000_iteration_0034_payments.sql` |
| 0028 | In-app notifications with cross-action emits | `20260513160000_iteration_0028_notifications.sql` |
| 0029 | Help Center FAQ + contact form + admin inbox | `20260513170000_iteration_0029_help_center.sql` |
| 0030 | Guided welcome tour (couple + vendor slide carousels) | `20260513180000_iteration_0030_guided_tour.sql` |
| 0031 | Day-of-guest event schedule + live "happening now" widget | `20260513190000_iteration_0031_schedule.sql` |
| 0033 | Public API foundation (api_keys + bearer auth + stubs) | `20260513200000_iteration_0033_api_gateway.sql` |
| 0024 | Save the Date 12-template gallery → orders flow | — |
| 0026 | BIR-compliant auto-issued Official Receipts | `20260513210000_iteration_0026_bir_tax_compliance.sql` + `20260513220000_iteration_0026_drop_or_number.sql` |

Plus 2 polish rounds: empty states, mobile compaction, navigation tightening, header bell, vendor subnav hoist, admin "restore deleted account".

**SPEC IMPACT (consolidated):**

Most of the SPEC IMPACT callouts in earlier per-iteration changelog entries still stand — please walk the spec corpus at `~/Documents/Claude/Projects/Setnayan/04_Iterations/` via Cowork and reconcile each affected file:

- `0006_vendors_management.md` — lock the 28-entry `vendor_category` enum, record the 6-stage flow + flag the payment-milestones / crew-meals deferrals
- `0007_budget_expenses.md` — V1 ships add+delete only (no edit), per-vendor line items are couple-defined (not the spec's "3-line template"), `.ics` is one-shot download (not subscribable feed yet)
- `0008_seating_chart_editor.md` — V1 = list + drag-place; ring auto-fill + publish-QR still deferred
- `0010_mood_board.md` — Reception 3-6, Bride/Groom palettes added, role palettes conditional on guest presence, 20-theme library deferred, Setnayan Guide rule engine deferred
- `0015_main_website.md` — EN-only V1, no Event Palette preview yet, copy is starter draft
- `0019_communications.md` — V1 = 1:1 page-refresh chat with identity masking. Realtime, group, video (Daily.co), file viewers, coordinator-join all deferred. **Identity masking rule locked**: vendors see event.display_name + event_date only — never couple email or personal name
- `0021_couple_dashboard_fully_purchased.md` — record the 4 theme palette RGB triplets (Setnayan Default `#FAF7F2`/`#1A1A1A`/`#C97B4B`, Victorian `#F5EBD9`/`#2E1A1A`/`#8B1E3F`, Classy `#F4F4F2`/`#0F0F0F`/`#A38560`, iOS `#F2F2F7`/`#000000`/`#007AFF`); 9 planner step keys (set_date, pick_venue, build_guests, customize_invite, set_slug, send_invites, book_vendors, finalize_seating, after_event)
- `0022_vendor_dashboard.md` — V1 ships 1 of 6 surfaces (profile editor only). Logo upload, public vendor page at `/v/[slug]`, bookings linkage to couple-side event_vendors, chat identity masking (waits on 0019 ✅ now shipped), settings/payouts all deferred
- `0023_admin_console.md` — V1 ships 3 of 7 surfaces (Users, Events, Vendors). Two-admin approval queue, audit log, system health, settings, reports all deferred. Document the `notFound()` (not `redirect`) pattern for non-leakage of admin URL existence
- `0024_save_the_date.md` — V1 ships gallery + order request flow (manual production via 0034); Remotion render pipeline + LUT grading + customer clip uploads to R2 all deferred. 12 templates shipped, 30 in spec
- `0025_profile_settings.md` — V1 ships Personal info edit + RA 10173 export + soft-delete. Hard delete + face-data revocation (waits on 0012 Papic) + payment methods (waits on 0034) deferred
- `0026_bir_tax_compliance.md` — VAT-inclusive math (12% default), `or_serial` BIGINT from atomic sequence (display string `SR-YYYY-NNNNNN` composed at read-time), one OR per order. Hard-coded `TIN: 000-000-000-000` placeholder in receipt header **must** be replaced before any real receipts go out — see `HANDOFF.md` § Owner action items
- `0028_email_notifications.md` — V1 = in-app only; email delivery via Resend deferred. Schema is ready; a notification-to-email worker is a small follow-on once Resend SMTP is wired
- `0029_help_center.md` — 22 FAQ articles hardcoded in `apps/web/lib/help.ts`; CMS, AI search, multi-language all deferred. Anyone (anon + authenticated) can INSERT a `help_messages` row
- `0030_guided_tour.md` — V1 = 4–6 slide carousel per role (couple + vendor); element-highlighting tour deferred. Restart via Profile
- `0031_day_of_guest.md` — schedule blocks + live widget shipped; message wall + photo wall + live broadcast banner all defer to R2 wiring
- `0033_public_api_foundation.md` — gateway + key management + 2 stub endpoints (`/api/v1/health` public, `/api/v1/me` auth-gated). Scopes, rate limiting, OAuth, webhooks all deferred. **Public contract** — additions to `/me` response shape need SPEC IMPACT review since they become a stability contract
- `0034_payments_and_cart.md` — V1 ships single-order request flow (no cart) + 4-tier fuzzy SQL matcher replaced with simple substring-reference check; BDO/GCash QR images deferred (instructions only)

**Outstanding (genuinely blocked on owner action):**
- `0032_contract_intelligence.md` — LLM API key + R2 upload not yet provisioned
- `0035_observability.md` — Sentry, PostHog, Better Stack accounts not yet provisioned

See `HANDOFF.md` for the full owner action checklist and verification path.

---

## 2026-05-13 · 0023 admin console MVP — overview + users + events + vendors

**Commits:** to be filled in once committed.

**What landed:**
- No schema changes — admin uses the existing `users.is_internal` / `users.is_team_member` flags (set in Sprint 0) plus the service-role client to read across all tables regardless of RLS.
- New `/admin` route tree:
  - **Layout** (`apps/web/app/admin/layout.tsx`) — auth-gates the entire subtree. Allows users where `is_internal=TRUE OR is_team_member=TRUE OR account_type='admin'`. Non-admins get `notFound()` (404) rather than a redirect, so the admin URL doesn't leak its existence. Header shows a badge (🟣 Internal · 🟢 Team Pool · Admin) per the user's flag.
  - **Overview** (`/admin`) — 8-tile stats strip (all users · couples · vendor users · events · vendor profiles · chat threads · 🟣 internal · 🟢 team pool) from service-role `count: 'exact', head: true` queries. Below: 4 navigation cards (Users · Events · Vendors · disabled Approval queue placeholder).
  - **Users** (`/admin/users`) — server-rendered table, latest 200 rows. Search by email/display_name/public_id (single `or(…ilike…)` query). 5-way filter (all / customer / vendor / internal / team pool). Each non-internal row gets an "Add to pool" / "Remove from pool" button that flips `is_team_member` via `requireAdmin()`-guarded server action. Internal accounts (e.g., the owner) show a locked label — they shouldn't be flipped by admins.
  - **Events** (`/admin/events`) — 200-row table sorted by event_date ascending, with a live guest count per event (single secondary query that batches by `IN`), search across display_name/slug/public_id, optional "include archived" toggle.
  - **Vendors** (`/admin/vendors`) — vendor profile cards in a 3-col grid: avatar (logo URL or initials), published-vs-draft pill, tagline, contact_email, location, first three services, public_id. Search across name/slug/email/public_id + 3-way filter (all / published / draft).
- New `requireAdmin()` helper in `apps/web/app/admin/users/actions.ts` — checks the calling user's flags via the regular Supabase client (under RLS) before doing service-role writes.
- Profile page (`/dashboard/profile`) gains an "Admin console ↗" button that only renders for `is_internal || is_team_member || account_type='admin'`. The button is the canonical entry point to `/admin`.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0023_admin_console.md` — record V1 MVP scope (3 of 7 surfaces) and flag deferred sub-scopes:
  - **Approval queue:** spec calls for a **two-admin approval workflow** for sensitive actions (refunds, account deletes, etc.). V1 doesn't define the underlying state machine — needs spec on which actions require two-admin approval and the queue UX (request → approve → execute).
  - **Audit log:** an `audit_log` table that records who did what when. Needed before any "approval queue" can resolve disputes. Schema-design + trigger plumbing is a follow-on.
  - **System health:** Supabase / R2 / Vercel metrics dashboard. Waits on iteration 0035 (observability) which wires Sentry / PostHog / Better Stack.
  - **Settings:** platform-wide configuration (Setnayan brand strings, default theme, feature flags). Currently those live in `brand.config.ts` and env vars; admin-editable settings would need a `settings` table.
  - **Reports:** GMV / vendor activity / payment reconciliation. Waits on iteration 0034 (Payments & Cart) for the underlying data.
- The `requireAdmin()` pattern is intentionally **not** an RLS helper. The admin console reads via the service_role client and bypasses RLS; authorization is enforced at the route layer. Document this in `02_Specifications/RLS_Policy_Pattern.md` — service-role usage outside scripted/server-side flows should be the exception, not the rule. The admin console is a deliberate exception.
- **Non-leakage choice (record explicitly):** the admin route uses `notFound()` for unauthorized users, not `redirect('/dashboard')`. This keeps the existence of `/admin` invisible to the public. Future admin-only routes should follow the same pattern.

**Deferred:**
- Two-admin approval queue (needs state-machine spec)
- Audit log (`audit_log` table + triggers on sensitive tables)
- System health / observability surface (waits on 0035)
- Settings / feature flags surface
- Reports / GMV / vendor performance dashboards
- Bulk operations (mass-archive, mass-delete, etc.) — V1 admin is read-mostly + per-row flag flip
- Impersonation ("view as user X") — a future debug aid

---

## 2026-05-13 · 0019 communications MVP — couple↔vendor 1:1 chat + identity masking

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513130000_iteration_0019_communications.sql`:
  - **New helper** `public.current_vendor_profile_ids()` — `SECURITY DEFINER STABLE` SETOF UUID of the calling user's vendor_profile_ids. Mirrors `current_couple_event_ids()` for vendor-side RLS.
  - **chat_sender_role** enum: `couple` · `vendor` · `coordinator` (third value reserved for the future "coordinator-join" feature).
  - **chat_threads** — `thread_id` PK, `public_id` (`S89H-…`), event FK + vendor_profile FK with **UNIQUE(event_id, vendor_profile_id)** so re-tapping "Start thread" resumes the same conversation. `created_by_user_id` FK to users (SET NULL on delete). Dual-side RLS: either party can read + write.
  - **chat_messages** — `message_id` PK, thread + event + vendor_profile + sender FKs, `sender_role`, body (1–4000 chars), `created_at`. RLS allows SELECT for either party but only INSERT (no UPDATE/DELETE policy ⇒ messages are append-only).
  - **Trigger** `on_chat_message_inserted` bumps `chat_threads.updated_at` to the new message's `created_at` — keeps thread lists ordered by recency without explicit writes from the app.
- New `apps/web/lib/chat.ts` — types + `fetchCoupleThreads` (joins `vendor_profiles` for business_name/logo) + `fetchVendorThreads` (joins `events` for the masked display_name+date) + `fetchThreadById` + `fetchMessages` + `formatChatTimestamp` (same-day vs older).
- New shared server action `apps/web/lib/chat-actions.ts:sendChatMessage` — looks up whether the current user is the couple or the vendor on the thread, tags the message with that role, and inserts. One action serves both `/dashboard/[eventId]/messages/[threadId]` and `/vendor-dashboard/messages/[threadId]`.
- Couple-side surfaces:
  - `/dashboard/[eventId]/messages` — thread list (avatar from vendor logo OR initials fallback) + start-by-vendor-email form. The form upserts on `(event_id, vendor_profile_id)` and redirects to the thread.
  - `/dashboard/[eventId]/messages/[threadId]` — header with vendor name + tagline, message stream (right-aligned terracotta bubbles for the couple's own messages, left-aligned ink bubbles for the vendor's), composer with Send button.
- Vendor-side surfaces (identity masking):
  - `/vendor-dashboard/messages` — thread list showing **only the event's display_name + event_date** — never the couple's email or personal name. Empty state nudges the vendor to fill in their contact_email so couples can find them.
  - `/vendor-dashboard/messages/[threadId]` — mirrored thread detail; sender label shows "You" for vendor messages, the masked event name for couple messages.
  - Small Profile / Messages subnav on both vendor pages.
- New `MessageSquare` tile on the couple Home grid (4×2 layout: Guests · Invitation · Vendors · Budget · **Messages** · Seating · Mood Board · Services).

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0019_communications.md` — record V1 MVP scope and flag deferred sub-scopes:
  - **Realtime delivery (Supabase Realtime):** V1 = page refresh on send. The schema is Realtime-ready (chat_messages has a simple insert pattern); a follow-on client component subscribing via `supabase.channel(...)` ships when needed.
  - **Group chat / multi-vendor threads:** V1 is strict 1:1. A follow-on would add a `chat_thread_members` join table.
  - **Video meetings (Daily.co):** spec calls for video. Daily.co integration requires API keys + a room-creation server route + an embed UI. Deferred — needs owner sign-off on Daily.co account.
  - **File attachments + viewers:** spec calls for PDF / image viewers in-thread. Waits on R2 upload UI (also a 0022 follow-on).
  - **Coordinator-join:** spec calls for a coordinator (3rd party) joining a thread. Schema reserves `'coordinator'` in `chat_sender_role` enum; no UI plumbing yet.
- **Identity masking rule (record explicitly):** vendors **MUST NOT** see couples' emails or personal names. They see the event's `display_name` + `event_date` only. The couples deliberately controlled what they put in `events.display_name` — for some couples that's "Maria & Juan", for others it's "Event #12". This is the user choice that V1 respects. Future surfaces (e.g., the BookingsSurface in 0022) should follow the same rule.
- The `current_vendor_profile_ids()` helper joins `current_couple_event_ids()` as a load-bearing canonical helper. Both should be documented in `02_Specifications/RLS_Policy_Pattern.md` § 4.

**Deferred:**
- Supabase Realtime subscription (currently page-refresh after send)
- Group / multi-party threads
- Video meetings (Daily.co)
- File attachments + in-thread viewers
- Coordinator-join
- Read receipts, typing indicators, push notifications
- Search across threads
- Linking from `event_vendors` (couple's tracked vendor row) to a `chat_threads` (still requires email-based lookup)

---

## 2026-05-13 · 0022 vendor dashboard MVP — sign-up + profile editor

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513120000_iteration_0022_vendor_dashboard.sql`:
  - `vendor_profiles` table — one row per vendor user. `vendor_profile_id` PK, `public_id` (`S89B-…` — B for business), `user_id` FK to public.users UNIQUE, business_name + business_slug (case-insensitive UNIQUE partial index), tagline, logo_url, services TEXT[], location_city, website, contact_email/phone, is_published, timestamps. Pattern A RLS (owner-only).
  - **Updated** `handle_new_auth_user()` trigger function: reads `NEW.raw_user_meta_data->>'account_type'`; if set to 'customer' or 'vendor', uses that enum value. Default stays 'customer'. The trigger itself isn't recreated — CREATE OR REPLACE FUNCTION updates the body in place.
  - **New** `handle_new_vendor_user()` trigger on `public.users` AFTER INSERT — when account_type='vendor' lands, auto-create a starter `vendor_profiles` row so the dashboard never opens to a missing record.
- Signup form (`apps/web/app/signup/page.tsx`) gains a Couple / Vendor radio choice at the top of the form (defaults to Couple).
- Signup action (`apps/web/app/signup/actions.ts`) now passes `data: { account_type }` to `supabase.auth.signUp()` so the trigger picks it up from `raw_user_meta_data`.
- Couple dashboard (`/dashboard`) layout reads `account_type` along with theme; if vendor, redirects to `/vendor-dashboard`.
- New `/vendor-dashboard` route tree:
  - Layout (`apps/web/app/vendor-dashboard/layout.tsx`) — auth-gated, redirects non-vendors out, mirrors the dashboard chrome (brand mark, name, sign-out). Theme honors the same `users.theme_preference` setting.
  - Page (`apps/web/app/vendor-dashboard/page.tsx`) — profile editor: completion progress bar with missing-field hint, mandatory-logo warning when no logo URL, all fields (business name + slug + tagline + logo URL + services CSV + city + website + contact email/phone), published checkbox, save button.
  - Action (`apps/web/app/vendor-dashboard/actions.ts`) — `saveVendorProfile`. Validates slug format, splits services on commas (≤ 12 items, each ≤ 48 chars), writes to vendor_profiles.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0022_vendor_dashboard.md` — record V1 MVP scope and flag deferred sub-scopes:
  - **Six surfaces:** spec calls for 6 vendor-side surfaces. V1 ships **1** (profile editor). Follow-ons:
    - Portfolio gallery (needs R2 upload UI)
    - Public vendor profile at `/v/[slug]` (needs marketplace surface)
    - Bookings — events where couples have added you to their `event_vendors` (needs link between `event_vendors.vendor_name` and `vendor_profiles.user_id` — currently no FK, vendor name is free-form on couple side)
    - Communications (waits on iteration 0019)
    - Settings · payouts (waits on 0034 payments)
  - **Mandatory logo:** spec calls for required logo. V1 only warns + flags in the completion bar; doesn't block save. When the public vendor surface ships, `is_published=true` should require a `logo_url`.
  - **Chat identity masking:** spec calls for vendors seeing couples as anonymous identities. Belongs in iteration 0019 (communications); no plumbing yet.
  - **Couple ↔ vendor linkage:** spec implies vendors can see events they're working. Currently `event_vendors` (couple-side, iteration 0006) stores `vendor_name TEXT` with no FK to `vendor_profiles`. A follow-on should add `event_vendors.vendor_profile_id UUID NULL` so couples can "tag" a tracked vendor as an existing Setnayan vendor.
- The `account_type` enum stays `('customer', 'vendor', 'admin')`. "customer" remains the codename for couples (Sprint 0 choice).

**Deferred:**
- Logo + portfolio file upload (R2)
- Public vendor profile page (/v/[slug])
- Bookings surface
- Chat with couples (waits on 0019)
- Settings / payouts
- Vendor marketplace / search
- Couple-side "claim this vendor" flow

---

## 2026-05-13 · 0007 budget MVP — line items + payment log + .ics export

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513110000_iteration_0007_budget.sql`:
  - `event_vendor_line_items` — `line_item_id` PK, event/vendor FKs, `label` (1–64 chars), `amount_php` NUMERIC(12,2) ≥ 0, `due_date` DATE nullable, `sort_order`, timestamp.
  - `event_vendor_payments` — `payment_id` PK, event/vendor FKs, optional `line_item_id` FK (SET NULL on delete so a deleted line item doesn't nuke its payment history), `amount_php` > 0, `paid_at` DATE default `CURRENT_DATE`, optional `method`/`reference`/`notes` TEXT.
  - Pattern B RLS on both tables via the canonical `current_couple_event_ids()` helper.
- New `apps/web/lib/budget.ts` — types, `fetchBudgetSnapshot` (joins vendors + line items + payments per event), per-vendor + global totals (budget, paid, remaining, "due in 30 days"), and `renderBudgetIcs` that emits RFC 5545 `VCALENDAR` with CRLF line endings, proper TEXT escaping (`\\` / `\\;` / `\\,` / `\\n`), `DTSTART;VALUE=DATE:` for all-day events, and skips line items that are already fully paid.
- New server actions in `apps/web/app/dashboard/[eventId]/budget/actions.ts`: `addLineItem`, `deleteLineItem`, `logPayment`, `deletePayment`. All validate money / date / label format on the server before the DB write.
- New `/dashboard/[eventId]/budget` page replaces the placeholder. Top: stats strip (4 tiles) and the "Export upcoming dates (.ics)" button. Body: one card per vendor with a per-vendor stats row (budget · paid · remaining), a Line items column with inline add form, a Payments column with inline log form (defaults to today, can attribute to a specific line item or be generic).
- New `GET /api/budget/[eventId]/ics` route handler — authenticated via Supabase cookie; returns `Content-Type: text/calendar` with `attachment` disposition (`setnayan-<event-slug>-budget.ics`). Calendar clients (Google Calendar, Apple Calendar) ingest this directly.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0007_budget_expenses.md` — record V1 MVP scope:
  - **Line items:** spec mentioned "3 line items per vendor (Package · Crew Meal · Transportation)" as the suggested default. V1 lets couples create *any number* of line items per vendor with *any label*; the schema doesn't bake in the 3-line template. The spec doc should be updated to reflect this flexibility, or — if the owner prefers — V1 should be amended to constrain to 3 items.
  - **Calendar feed vs download:** spec calls for ".ics calendar export". V1 ships a **one-shot authenticated download** rather than a subscribable feed. A subscribable feed requires a per-event public token + a public route that bypasses the auth cookie; that's a follow-on (would land alongside the public-API gateway in 0033).
  - **Setnayan platform costs auto-populate:** the spec called for in-app purchases from 0034 (Payments & Cart) to flow into the budget automatically as a "Setnayan" vendor. V1 leaves this manual — couples can create a "Setnayan platform" vendor and log Setnayan transactions there. Auto-population lands when 0034 ships.
- The `current_couple_event_ids()` helper is now load-bearing for **SEVEN** surfaces (event_members, event_journey_steps, event_tables, event_seat_assignments, event_vendors, event_vendor_line_items, event_vendor_payments). Definitively canonical.

**Deferred:**
- Editing line items / payments (V1 supports add + delete only)
- Receipt / proof-of-payment file upload (would land alongside R2 wiring for vendor contracts)
- Multi-currency
- Subscribable .ics URL with per-event token
- Auto-import from iteration 0034 payments
- Charts / visualizations / month-over-month spending

---

## 2026-05-13 · 0006 vendors MVP — couple-side tracker (28 categories, 6-stage readiness)

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513100000_iteration_0006_vendors.sql`:
  - `public.vendor_category` enum — **28 canonical PH wedding service categories** straight from the spec (venue, catering, photographer, videographer, florist, cake_maker, host_emcee, band_dj, string_quartet, choir, officiant, planner_coordinator, makeup_artist, hair_stylist, gown_designer, suit_designer, rings, invitations_stationery, transportation, lights_and_sound, led_screens, photobooth, mobile_bar, church_fees, reception_decor, security, gifts_and_giveaways, misc).
  - `public.vendor_status` enum — 6-stage readiness flow: `considering` → `shortlisted` → `contracted` → `deposit_paid` → `delivered` → `complete`.
  - `event_vendors` table — `vendor_id` PK, `public_id` (`S89V-…`), event FK, category, vendor_name, contact_email/phone, status, total_cost_php (NUMERIC 12,2), deposit_paid_php, notes, timestamps. CHECK constraints enforce non-negative money + deposit ≤ total.
  - Pattern B RLS: couples on the event read + write.
- New `apps/web/lib/vendors.ts` — types, label/tone maps, `fetchEventVendors`, `computeVendorStats`, `formatPhp` PHP formatter (no decimals for clean display).
- New server actions: `createVendor`, `updateVendorStatus`, `deleteVendor`.
- New `/dashboard/[eventId]/vendors` page replaces placeholder:
  - **Stats strip** — 4 tiles: Vendors / Total cost / Deposits paid / Remaining. Remaining tile goes terracotta when > 0.
  - **Add a vendor** (collapsed `<details>` block) — full form: name, category, email, phone, total cost, deposit paid, notes.
  - **Status filter chips** — All + 6 status chips with live counts, query-string driven (`?status=contracted`).
  - **Vendor cards** (2-col on lg+) — name + category, status pill, contact links (mailto/tel with Lucide icons), money breakdown (Total / Deposit / Remaining color-tinted), notes block, status updater dropdown + delete.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0006_vendors_management.md` — record V1 MVP scope (couple-side tracker only) and flag deferred sub-scopes:
  - **Payment milestones (3-line spec):** the spec calls for 3 itemized payments per vendor (e.g., deposit, balance, tip). V1 collapses this to `total_cost_php` + `deposit_paid_php`. A follow-on migration would add an `event_vendor_payments` table.
  - **Crew meals:** spec calls for tracking how many staff meals each vendor needs (caterer needs to plate them). Add a `crew_meals` integer column in a follow-on.
  - **Vendor-side profiles:** the vendor's own dashboard (logo, portfolio, chat identity masking) is iteration 0022.
  - **Public vendor catalog/marketplace:** searchable vendor list with reviews — out of V1 scope.
- The 28-entry `vendor_category` list should be **locked** in the spec — once couples have data tied to these enum values, renaming any is a breaking migration. Confirm with owner via Cowork that these match the canonical PH wedding-vendor taxonomy.

**Deferred:**
- Payment milestones (3 line items per vendor)
- Crew meals tracking
- Meeting/contact log per vendor
- Contract upload (R2)
- Communications thread (waits on 0019)

---

## 2026-05-13 · 0008 seating chart MVP — tables + assignments (list-based, not drag-place)

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513090000_iteration_0008_seating.sql`:
  - `public.table_type` enum with **13 catalog entries** straight from the spec: `round_8`, `round_10`, `round_12`, `rectangle_6`, `rectangle_8`, `rectangle_10`, `long_12`, `long_16`, `sweetheart_2`, `head_table`, `crescent_8`, `crescent_10`, `custom`.
  - `event_tables` — `table_id` PK, `public_id` (`S89T-…` via generator), `event_id` FK, `table_label`, `table_type`, `capacity` CHECK 1..32, `x_pos`/`y_pos` reserved nullable for the future drag editor, `sort_order`, timestamps. Pattern B RLS: couples on the event read + write.
  - `event_seat_assignments` — `(event_id, guest_id) UNIQUE` so a guest can only be at one table; cascades from both events and guests. Pattern B RLS.
- New helpers in `apps/web/lib/seating.ts` — `TABLE_TYPE_CATALOG` (single source of truth for labels + default capacities), `fetchTables`, `fetchAssignments`, `computeSeatingStats`.
- New server actions in `apps/web/app/dashboard/[eventId]/seating/actions.ts`: `createTable`, `deleteTable`, `assignGuest` (upsert with `onConflict: 'event_id,guest_id'`), `unassignGuest`.
- New page at `/dashboard/[eventId]/seating` replaces the placeholder. Layout:
  - **Stats strip** — 4 tiles (tables / total capacity / assigned / unassigned). Unassigned tile goes terracotta when > 0.
  - **Add table form** — label + 13-option type picker + capacity (1–32), one Add button.
  - **Table cards** (2-col grid on sm+) — each card has label, type, fill counter (`5 / 10`, green at full, rose if overfilled), delete button, assigned-guests list with per-row remove button, and an inline guest picker that only shows when there's capacity left and unassigned guests exist.
  - **Unassigned guests** — chip list (first 60, then +N more) at the bottom.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0008_seating_chart_editor.md` — record V1 MVP scope (list-based editor) and flag three deferred sub-scopes:
  - **Free-placed editor:** drag-place tables on a stage canvas. Schema reserves `x_pos`/`y_pos` columns so this becomes a UI-only follow-on.
  - **Role-tier ring auto-fill:** algorithm that suggests assignments based on role hierarchy (head table = wedding party + parents; ring 1 = principal sponsors; ring 2 = family; etc.). Needs algorithm spec.
  - **QR-on-publish print pack:** publish flow that snapshots assignments and generates a per-table QR + a printable seat chart for the venue. Needs publish-state model (current seating is always "live").
- Pattern B helper `current_couple_event_ids()` is now load-bearing for FIVE surfaces (event_members write, event_journey_steps, role_palette indirectly via events, event_tables, event_seat_assignments). Should be promoted from "fix" to "canonical" in `02_Specifications/RLS_Policy_Pattern.md` § 4 helper list.

**Deferred:**
- Drag-place stage canvas
- Auto-fill ring algorithm
- Publish snapshot + per-table QR + printable seat chart
- Seat-level assignments (current model assigns to table, not seat number — `seat_number` column is reserved nullable)
- Bulk assign (e.g., "seat the whole maid_of_honor cohort at Table 2")

---

## 2026-05-13 · 0010 mood board MVP — per-role palette only

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513080000_iteration_0010_mood_board.sql` adds `events.role_palette` (JSONB, default `'{}'`) and `events.mood_board_updated_at` (timestamptz). The JSONB shape is `{ <role_group>: "#RRGGBB" }` with six allowed keys: `wedding_party`, `principal_sponsors`, `secondary_sponsors`, `bearers_flower_girl`, `officiants`, `other_roles`. App-side validation in `apps/web/lib/mood-board.ts` (`sanitizeRolePalette`) drops unknown keys and bad hex.
- New page at `/dashboard/[eventId]/services/mood-board` (takes precedence over the catch-all `[service]` placeholder for this slug only). Renders six labeled rows, each with a native `<input type="color">` and a swatch preview. Save submits to `saveRolePalette` server action which sanitizes, writes `role_palette` + `mood_board_updated_at`, and revalidates the event layout.
- The Guest List role chips now consume `event.role_palette`: when a palette entry exists for the role's group, the chip renders a 2-px ring-bordered colored dot before the role label. Falls back to the existing Tailwind-tinted chip backgrounds when no palette is set. Both desktop table and mobile card list pass the palette down.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0010_mood_board.md` — record MVP scope (per-role hex palette only) and flag three deferred sub-scopes that need spec input before they can ship:
  - **20-theme curated library:** named themes (e.g., "Cebu Sunrise", "Manila Old World", "Mountain Lodge") and their per-role palettes — needs design + content from owner.
  - **Setnayan Guide rule engine:** cohesion / contrast / temperature / saturation / cultural-defaults scoring algorithm — needs algorithm spec (formulas, thresholds, what gets flagged at what score).
  - **Venue palette extraction:** auto-derive a palette from venue photos via color quantization — needs upload pipeline + heuristics spec.
- The chip dot is a "visual signal" choice, not a "replace the chip tint" choice — kept the existing Tailwind tints so the page doesn't depend on dynamic class generation. Record this trade-off in the spec so a later revision can intentionally swap to dynamic-class chip tints if desired.

**Deferred:**
- Save palettes as named "moods" the couple can swap between (no separate `event_moods` table yet)
- Live preview of palette applied to a sample invitation
- Export palette as a downloadable swatch sheet for vendors

---

## 2026-05-13 · 0015 main website MVP — public landing rebuilt

**Commits:** to be filled in once committed.

**What landed:**
- `/` was a 45-line placeholder; it now renders a full single-page marketing landing:
  - **Top nav** with brand mark, Sign in (text), and Create account (primary button).
  - **Hero** with the `Set na 'yan.` tagline, a longer-form subhead, dual CTAs (Start planning / I already have an account), and a device mock on the right that previews the actual couple-home design (greeting, stage strip, NEXT UP card, mini nav grid). The device mock uses the same Tailwind tokens as the real Home page, so when 0021 themes change the home, the mock changes with it (couples checking the landing while logged in see brand defaults because the redirect catches them first).
  - **Shipping section** — six feature cards covering what's actually live (Guest List, QR invitations, RSVP, 4-theme system, Guided Planner, 6-stage strip + countdown). Lucide-icon lockups.
  - **Roadmap section** — six cards for Vendors / Seating / Budget / Papic / Panood / Photo Delivery, each with a "when" badge (Coming next / 2026 H2). Dashed borders to signal "not shipped yet" without making them look broken.
  - **Closing CTA** — short-form repeat ask with both Sign in and Create account links.
  - **Footer** — brand mark, "Made in the Philippines", quick links.
- Signed-in users still get redirected to `/dashboard` before the marketing layout renders.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0015_main_website.md` — record the V1-shipped MVP scope: English-only single-page landing. Two sub-scopes remain deferred and should stay flagged in the spec:
  - **i18n (EN / TL / CEB):** locale switcher and translated copy not yet implemented. When this lands, the page will need a top-nav locale picker and translation files; the visual structure should stay intact.
  - **Event Palette interactive preview:** the spec's "Event Palette" section (interactive palette previewer for the 4 themes) is replaced with a static device mock in this MVP. The interactive version is a follow-on.
- The shipped feature copy in `apps/web/app/page.tsx` (Hero / Shipping / Roadmap / Closing) is a **starter draft** — owner should refine via Cowork for the luxurious-Filipino-modern voice. Until then, the page is honest about what's live vs. what's coming and gives visitors a clear sign-up path.

**Deferred:**
- Locale infrastructure (EN/TL/CEB) — moved into a follow-on
- Event Palette interactive theme preview — moved into a follow-on
- Pricing page (no charm-pricing matrix locked yet for non-token model)
- Marketing pages beyond `/` (about, features detail, blog) — not in scope yet

---

## 2026-05-13 · 0021 transversal slice — themes, Lucide icons, new Home, Guided Planner

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — 4-theme system:** New CSS-variable theme blocks for Setnayan Default · Victorian · Classy · iOS in `apps/web/app/globals.css`. Tailwind `cream`, `ink`, and `terracotta` (incl. -600/-700) now resolve to `rgb(var(...) / <alpha-value>)`, so every `bg-cream/95`, `text-ink/40`, `border-terracotta` utility re-skins instantly. The dashboard layout reads `users.theme_preference` once per request and wraps its tree in `<div data-theme=…>`. Public invitation site at `/[slug]` stays on Setnayan Default (the theme picker is for the couple's admin chrome, not their guests' invitation).
- **Phase B — Lucide swap:** `lucide-react` added. BottomNav (Users / Briefcase / CalendarDays / Sparkles), Services launcher (Receipt / Palette / Camera / Tv / CloudUpload / Sparkles in tinted lockups), invitation slug status badges (Check / X / AlertTriangle / Loader2), and the guests-page Share/Clear chips now render Lucide strokes instead of emoji.
- **Phase C — New Home:** `/dashboard/[eventId]` was a redirect to `/guests`; it now renders a real home: warm welcome with time-of-day greeting + days-to-go, 6-stage strip (Dreaming → Booking → Inviting → Finalizing → Wedding Day → After) derived from event_date + guest count, NEXT UP card with branching logic (add first guests / set slug / send invites / lock seating / review), 8-tile nav grid (Guest List · Invitation · Vendors · Budget · Schedule · Seating · Services · Profile) with a guest-count counter on the Guest List tile, and a 6-row activity feed of recent guest additions.
- **Phase D — Guided Planner:** New migration `20260513070000_iteration_0021_planner.sql` adds `users.planner_mode` enum (`guided` | `diy`, default `guided`) and `event_journey_steps` table with Pattern B RLS (couple read + write via `current_couple_event_ids()`). New `apps/web/lib/planner.ts` defines 9 steps, derives 5 from existing event/guest state (date set, venue, guests, monogram/palette, slug), keeps 4 manual (send invites, book vendors, finalize seating, thank-yous), and exposes `resolveStepStatuses` + `plannerProgress`. New server action `toggleJourneyStep` upserts/deletes manual completions. New Checklist component on Home shows progress bar + 9 rows with hint text and links. Profile page gains a guided/DIY toggle that hides the checklist for couples who want to roam free.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0021_couple_dashboard_fully_purchased.md` — record the four-theme palette values (RGB triplets) and the 9-step planner key list since they will be referenced by iterations 0006 (Vendors), 0007 (Budget), 0008 (Seating), and 0025 (Profile Settings full surface). Specifically:
  - Theme palettes: Setnayan Default (`#FAF7F2 / #1A1A1A / #C97B4B`), Victorian (`#F5EBD9 / #2E1A1A / #8B1E3F`), Classy (`#F4F4F2 / #0F0F0F / #A38560`), iOS (`#F2F2F7 / #000000 / #007AFF`).
  - Planner step keys: `set_date`, `pick_venue`, `build_guests`, `customize_invite`, `set_slug` (all auto-derived), `send_invites`, `book_vendors`, `finalize_seating`, `after_event` (all manual).
  - Pattern B helper `current_couple_event_ids()` is now load-bearing for two surfaces; document in `02_Specifications/RLS_Policy_Pattern.md` § 5 mapping table as an established helper.

**Deferred (still gated on later iterations):**
- QR Hub, Gallery sub-page, Vendors / Budget / Schedule / Seating real surfaces — placeholder pages remain.
- Activity feed currently only shows guest additions; scan-event + RSVP-response items are a follow-on (data model exists, UI not yet wired).

---

## 2026-05-13 · 0002 deferral close-out — TBA onboarding, 6 widgets, limited +1 lock, real-time slug check

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — +1 TBA onboarding flow:**
  - New `/[slug]/welcome` route that captures a TBA +1's first + last name. Spec § +1 onboarding flow (lines 121–161).
  - Redeem handler detects TBA placeholders (`plus_one_of_guest_id IS NOT NULL && first_name='TBA' && plus_one_name_confirmed_at IS NULL`) and routes to `/welcome` instead of the personal invitation site.
  - Confirmation submit updates `guests.first_name`, `guests.last_name`, `guests.plus_one_name_confirmed_at = NOW()`, then records a scan_events row with `context.entry='plus_one_onboarded'` so the couple's admin can see the onboarding moment distinctly, then redirects to the standard personal invitation site.
  - "This isn't me" link clears the cookie via the existing sign-out flow.
  - `/[slug]` page also gates: if a guest re-arrives with an unconfirmed TBA cookie (clicked away mid-onboarding), they're re-routed to `/welcome`.
- **Phase B — 6 additional widgets** added to the personal invitation site:
  - **Countdown** (client component, ticks every second, auto-hides past the event date) — 4 boxes for D / H / M / S
  - **Venue** card with Google Maps deep-link "Get directions"
  - **Dress Code** with 5-swatch palette + Do/Don't grid using locked copy
  - **Photo Moments** 3-card grid (Bridal Walk · The Kiss · First Entrance) with locked spec copy
  - **Your Photos** placeholder + profile-photo card + "Add more via Shutter" (deferred to Phase 2)
  - **Public vs Registered tier comparison** with Sign-up free CTA
- **Phase C — Limited +1 full lock variant:**
  - When `plus_one_mode='limited'`, the tier comparison widget renders BOTH cards visually disabled (dashed borders, 55% opacity) and replaces the "Sign up free →" CTA with a "Learn more about Setnayan" link to the marketing site.
  - "Your photos" widget hides the "Add more via Shutter" card and replaces it with a "Your photos will be visible in your inviter's gallery" notice.
- **Phase D — Real-time slug availability check:**
  - New `/api/slugs/check` route handler returns `{ status: 'available' | 'taken' | 'current' | 'invalid_format' | 'reserved' }` with 3 suggested alternatives on `taken`.
  - New `SlugField` client component on the invitation admin uses 300ms debounce + `useTransition` for the save action. Visual states: `⋯` checking, `✓` available, `✗` taken, `⚠` invalid format. Suggestion chips populate inline; clicking one fills the field.
  - Save button is disabled until the current value is `available` AND differs from `initialSlug`.

**Build verification:** 6 new routes (`/[slug]/welcome`, `/api/slugs/check`, plus the previously-shipped 4) all compile and serve correctly.

**SPEC IMPACT:** None new this pass. The 2 spec impacts flagged in the previous 0002 entry remain pending Cowork update.

**Still deferred (genuinely blocked or out of V1 scope):**
- Branded QR with monogram-in-center compositing + 25-frame library (complex SVG work; not blocking)
- Per-role palette QR colors (waits on iteration 0010 palette finalization)
- 3-day photo retention enforcement for public guests (no photos yet)
- Post-download conversion screen (no photo download yet)
- Native-app scanning stubs (Phase 2/3 explicitly)
- Apple/Google Wallet pass generation (V1.5)
- Schedule widget (waits on iteration 0004 invitation widgets)

---

## 2026-05-13 · Iteration 0002 — QR Invitation System (MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513050000_iteration_0002_invitation.sql`:**
  - `events.slug` + format CHECK + case-insensitive UNIQUE index; `events.palette_finalized_at`
  - `guests.profile_photo_url` + `profile_photo_set_at` + `profile_photo_segment`
  - `guests.plus_one_name_confirmed_at`, `guests.scan_tracking_opt_out`, `guests.download_completed_at`
  - `scan_events` table with `scan_source` enum; IP anonymized to first 3 octets per RA 10173
  - `slug_change_log` for 90-day SEO redirects
  - RLS: couples read their event's scan_events; guests read their own; service-role writes
- **Phase B — slug auto-generation** in `apps/web/lib/slugs.ts`. Wired into `createWeddingEvent` so every new event gets a unique slug on creation. Reserved-slug pool (admin, api, dashboard, login, etc.) blocked from claim.
- **Phase C — public guest invitation route at `/[slug]?invite=[token]`:**
  - Token validated via admin client (visitor isn't authed). On valid: signs HS256 JWT cookie (60-day expiry covers the 30-day post-event window), records a `scan_events` row, redirects to clean `/[slug]` URL.
  - Personal invitation site MVP: Hero with monogram placeholder · Greeting · QR card · RSVP form · Event details · sign-out
  - Limited +1 sees inline disclosure block (full Limited variant deferred)
  - Invalid token / wrong-event session → public landing with friendly message
- **Phase D — RSVP submission via `submitRsvp` server action** writes through admin client (visitor isn't authed). Sets `rsvp_responded_at` when status is attending or declined. Revalidates `/dashboard/[eventId]/guests` so couple sees changes immediately.
- **Phase E — Couple admin at `/dashboard/[eventId]/invitation`** (replaces 0000's placeholder):
  - Public-landing URL display + slug editor
  - Server-rendered QR thumbnails (qrcode npm, error correction level H, quiet zone 4)
  - Per-guest "Re-issue" button rotates `qr_token` (16 random bytes hex); old printed QRs become invalid immediately
  - Slug changes write to `slug_change_log` for the 90-day SEO redirect window
- **Phase F — Print sheet at `/dashboard/[eventId]/invitation/print`** with A4 `@page` rules + 3-column QR grid; direct-browser-print works.

**New libs:** `lib/slugs.ts`, `lib/qr.ts`, `lib/guest-session.ts` (JWT cookie helpers).
**New env var:** `GUEST_SESSION_SECRET` (32-byte hex). Falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset.
**Backfill:** existing demo event `S89E-17VNTRAQD8` got slug `maria-and-juan` so the public route works against the seeded data.

**Deferred (logged for future polish):**
- Branded QR with monogram-in-center compositing + 25-frame library + simplified variants for QR-center
- Per-role palette QR colors (depends on iteration 0010)
- +1 TBA onboarding screen (column exists; UI deferred)
- Limited +1 invitation site full variant (currently inline banner only)
- 9 of 14 widgets: Countdown, Venue, Schedule, Dress Code, Photo Moments, Your Photos, Public vs Registered tier, Wallet save, Registered RSVP extras
- Real-time slug availability check with 300ms debounce + `/api/slugs/check` endpoint
- 3-day photo retention enforcement for public guests
- Post-download conversion screen
- Native-app scanning stubs (Phase 2/3)
- Apple/Google Wallet passes

**SPEC IMPACT — please update via Cowork:**
1. `0002_qr_invitation_system.md` line 888 (Notes for Claude Code) says "error correction level M"; locked structural rules at line 537 say level H. Implementation uses H. Fix the notes inconsistency.
2. `0002_qr_invitation_system.md` line 263 declares route `setnayan.com/dashboard/qr-codes` (couple admin); the actual implementation follows 0000's event-scoped pattern at `/dashboard/[event-id]/invitation`. Update the route declaration.

---

## 2026-05-13 · Iteration 0001 polish — detail/edit, plus-one UI, custom tags, invited-to blocks, CSV import

**Commits:** to be filled in once committed.

**What landed:**
- **`/dashboard/[eventId]/guests/[guestId]`** detail + edit page surfacing all 27 columns:
  - Identity, Categorization (side / group / role), RSVP & events (RSVP / meal / invited-to / dietary), Contact, Tags & notes, photo consent
  - **Soft delete** via `softDeleteGuest` server action — sets `deleted_at`, RLS-gated SELECT already filters it out
  - List rows + mobile cards now link to the detail page
- **Plus-one toggle** in the add-guest flow:
  - `<details>` progressive disclosure (no client JS — pure server-rendered)
  - Sub-block exposes first/last name (or blank for TBA) + Full/Limited mode radio
  - Server action creates the primary `guests` row, then a SECOND `guests` row with `plus_one_of_guest_id`, `plus_one_mode`, own auto-generated `qr_token` (per spec § Plus-one management)
  - TBA path: blank names persist a row with placeholder `first_name='TBA'` + `last_name='+1'` + display_name `"+ TBA · brought by {primary}"`
- **Custom tags** as comma-separated input on both add + edit forms — max 50 tags, persisted into `guests.custom_tags TEXT[]`
- **Invited-to schedule-block chips** on both add + edit — 5 blocks (ceremony · reception · cocktails · after_party · rehearsal_dinner). Ceremony + reception checked by default. Uses CSS `has-[:checked]` to style without client JS
- **`/dashboard/[eventId]/guests/import`** CSV import:
  - Paste-into-textarea flow (200-row cap)
  - Inline `parseCsv` helper in `lib/csv.ts` (quoted fields, escaped quotes, CRLF/LF/CR, empty cells)
  - Per-row validation against canonical enums; failed rows surface line-numbered errors; valid rows batch-insert in one statement
  - Returns to `/guests?imported=N&skipped=M`
  - Template + accepted-columns inline on the import page

**Deferred (not in this pass):**
- Households UI (the CSV importer stashes the household column into `guests.notes` as a placeholder until households UI ships)
- Address JSONB editor
- File-upload variant of CSV import (paste-only for now)
- Mobile-specific full-screen sheet variants of add/edit (responsive forms work cross-platform)
- Bulk-edit spreadsheet mode
- Resend-invitation action on detail page (depends on iteration 0028 email templates)
- Custom-tag chip input with autocomplete from existing tags (comma-separated input works for now)

**SPEC IMPACT:** None. All choices align with spec § Functional scope.

---

## 2026-05-13 · Hotfix — RLS infinite-recursion in event_members policies

**Commit:** `19242e4` · migration `20260513040000_fix_rls_infinite_recursion.sql`

**Symptom:**
Anyone signed in hitting `/dashboard` (or any page that queried event-scoped tables) got `Application error: a server-side exception has occurred`. Vercel runtime logs showed `Error: Failed to fetch events: infinite recursion detected in policy for relation "event_members"`.

**Root cause:**
Pattern B policies on `event_members`, `events`, `event_join_tokens`, `guests`, and `households` used inline subqueries like `event_id IN (SELECT event_id FROM event_members WHERE user_id = auth.uid() AND member_type = 'couple')`. When the outer query runs against `event_members`, the SELECT policy on `event_members` fires; the policy's USING clause issues that subquery; the subquery against `event_members` re-triggers the SELECT policy on `event_members`; Postgres aborts with the recursion error. This affected every page that read couple-scoped data through the user's JWT.

**Fix:**
Added two new SECURITY DEFINER helpers that bypass RLS for the lookup:
- `public.current_couple_event_ids()` — event_ids where the caller is `member_type='couple'`
- `public.current_user_guest_ids()` — guest_ids attached to caller's event_members rows

Rewrote 10 policies (4 on event_members, 2 on events, 1 on event_join_tokens, 2 on guests, 1 on households) to use the helpers instead of inline subqueries on event_members.

**Why this matters going forward:**
Every future Pattern B policy that needs "events where I'm a couple" must use `current_couple_event_ids()`. Inline `SELECT event_id FROM event_members WHERE ...` subqueries will recurse the same way.

**SPEC IMPACT — please update via Cowork:**
`02_Specifications/RLS_Policy_Pattern.md` currently documents 4 helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`). Add the two new ones to that doc — `current_couple_event_ids` and `current_user_guest_ids` — so future iterations know to use them.

---

## 2026-05-13 · Iteration 0001-B — Seed sample guests + Join flow + next-redirect

**Commits:** to be filled in once committed.

**What changed:**
- **Migration `20260513020000_enable_pgcrypto.sql`** — enables pgcrypto in `extensions` schema (was needed for `gen_random_bytes` used by `event_join_tokens.token` and `guests.qr_token` defaults; Sprint 0 missed this).
- **Migration `20260513030000_fix_pgcrypto_qualification.sql`** — schema-qualifies all `gen_random_bytes()` calls (Supabase places pgcrypto in `extensions` schema; SECURITY DEFINER functions don't see it on the default search_path).
- **Seed** — inserted 15 canonical guests from the iteration 0001 fixtures into the owner's first event (Maria & Juan demo wedding). Done via one-off `/tmp/setnayan-seed/seed.mjs` using @supabase/supabase-js with service_role.
- **Join flow** (closes the iteration 0000 deferred work):
  - `/join/[eventId]?token=...` validates the event_join_tokens row via admin client, then asks unauthed visitors to sign in / create account, and shows the 18-role picker to authed visitors who aren't yet event members
  - `joinEventAction` server action: re-validates token, finds-or-creates a `guests` row by email match, inserts the `event_members` row via the user's own JWT (Pattern B's self-insert clause), then redirects to success page
  - `/join/[eventId]/success` confirmation page reachable by any event member, shows event name + role + dashboard CTA
- **`lib/supabase/admin.ts`** — service-role server client for operations that need to read or write data the current user can't see through RLS (e.g., validating an event-join token before the scanner has become an event_member). Strictly server-only.
- **`/login` and `/signup` actions honor `?next=/path`** so the join flow can round-trip through auth without losing the destination. Magic-link `emailRedirectTo` carries the `next` forward through `/auth/callback`. `safeNext()` validates relative-only paths to prevent open-redirect.

**SPEC IMPACT:** None. All choices align with the spec.

---

## 2026-05-13 · Iteration 0001 — Guest List (Phases A–C, MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513010000_iteration_0001_guests.sql`:**
  - Enum `public.guest_role` with all 18 Filipino-wedding roles per spec § Role taxonomy
  - 5 supporting enums: `guest_side`, `guest_group_category`, `meal_preference`, `rsvp_status`, `plus_one_mode`
  - `public.households` table (no public_id surface — internal entity)
  - `public.guests` table with all 27 columns from the spec including `plus_one_*` columns, `photo_consent` (default TRUE per RA 10173), `invited_to_blocks` (default ceremony+reception), `custom_tags`, `qr_token` (auto-generated), `deleted_at` (soft delete)
  - `public_id` on guests follows `S89G-XXXXXXXXXX` canonical format
  - RLS Pattern B on both tables — event-scoped read, couple-write, admin override
  - Bonus policy: a registered guest can read their own row (for iteration 0002's invitation site rendering)
  - Retroactive FK: `event_members.guest_id → guests(guest_id) ON DELETE SET NULL`
- **Phase B — `/dashboard/[eventId]/guests` list view** (replaces the iteration 0000 placeholder):
  - Stats strip with 5 cards: Invited / Attending (emerald) / Pending (amber) / Declined (rose) / Plus-Ones (terracotta) — each card is a clickable filter
  - URL-based filter: `?rsvp=attending|pending|declined|maybe`
  - URL-based search: `?q=...` — fuzzy match on name + display name + email + custom tags
  - Desktop table (≥640px): avatar + name + plus-one hint + role + side pill + RSVP pill + contact
  - Mobile card list (<640px): avatar + name + role + RSVP pill
  - Empty states for both "no guests yet" and "no matches for filters"
  - Side-coded avatars (rose / sky / amber for bride / groom / both)
- **Phase C — `/dashboard/[eventId]/guests/new` add-guest form:**
  - 7-field MVP version: first/last name · side · group · role (all 18 options) · email · mobile · meal · RSVP · photo consent (default true) · notes
  - Server action `createGuest` with full validation against every enum value
  - On success → `revalidatePath` the list + redirect back to `/guests?added=1`
  - Plus-one model, address JSONB, custom tags, invited_to blocks UI — deferred to a follow-up
- `apps/web/lib/guests.ts` helper module — fetch/stats/labels/initials utilities + type unions for all enums

**Deferred from iteration 0001 (out of session scope):**
- Detail drawer (click row → side drawer with edit/delete)
- Plus-one toggle + TBA / Full / Limited modes UI (schema is ready, UI deferred)
- CSV import (200-row max)
- Households UI (create + assign)
- Custom-tag chips input with autocomplete
- Invited-to schedule-block toggles per guest
- Address JSONB editor
- Mobile-specific full-screen add-guest sheet (currently uses the same form)
- Bulk-edit spreadsheet mode

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/`:**

1. **`0001_creating_guest_list.md` line 48** — declares route `setnayan.com/dashboard/guests`. Iteration 0000's locked URL pattern is `setnayan.com/dashboard/[event-id]/guests`. Update the route line to match.
2. **No retired-system references found** in the 0001 spec — good.

---

## 2026-05-13 · Iteration 0000 — App Shell & Navigation (Phases A–D)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema delta migration `20260513000000_iteration_0000_shell_schema.sql`:**
  - `users.phone`, `users.profile_photo_url`, `users.last_login_at`
  - `events.venue_name`, `events.venue_address`
  - `event_members.role` (free text for the 18-role taxonomy from 0001), `event_members.joined_via` enum (`qr_scan` / `invited` / `created_event` / `admin_added`)
  - `event_members.guest_id` + `event_members.vendor_id` nullable forward-compat columns (FKs added by iterations 0001 + 0022 respectively)
  - `public.generate_event_join_token()` + `public.handle_new_event()` trigger — auto-mints a 32-hex token when a new event is inserted
- **Phase B — `/dashboard` event picker:**
  - Auto-jump rule: 0 events → empty welcome state; 1 active event → server redirect; 2+ active events → picker with primary-first sort
  - `apps/web/lib/events.ts` — `fetchUserEvents()` helper + `EventRow` types + date formatting
  - `apps/web/app/dashboard/layout.tsx` — top-level chrome (brand + avatar + sign-out) outside event scope
  - Archived events collapsed under a `<details>` disclosure
- **Phase C — `/dashboard/create-event`:**
  - 6-tile event-type picker per spec § 2.5 — Weddings selectable, the other five visibly disabled with "Coming soon" badge
  - Wedding-only server action `createWeddingEvent` enforces `event_type='wedding'` (V1 lock)
  - Inserts: `events` row → trigger mints `event_join_tokens` row → also inserts `event_members` row with `member_type='couple'` and `joined_via='created_event'`
- **Phase D — inside-event shell `/dashboard/[eventId]/...`:**
  - Authorization check in layout: 404s if signed-in user isn't a `couple` member of the event
  - Sticky top chrome with event pill + back-to-events link + avatar
  - `BottomNav` client component with 4 tabs (Guest List · Vendors · Schedule · In-App Services) — fixed-bottom on mobile, inline on desktop, ≥44pt touch targets
  - Tab→URL mapping handles sub-pages (e.g., `/invitation` + `/seating` still highlight Guest List tab)
  - Placeholder pages for every tab (each names its owning iteration)
  - **Services launcher grid** with 6 cards — **NO wallet card** (per the Cowork update needed below). Cards: Orders (0034) · Mood Board (0010) · Papic (0012) · Panood (0011) · Photo Delivery (0009) · LED Background (0005)
  - `/dashboard/[eventId]/services/[service]` placeholder routes for each of the six
- **`/dashboard/profile`** — minimal V1 surface showing public_id, account_type, is_internal/team flags, locale, theme preference + sign-out. Full surface deferred to iteration 0025.
- **`/` landing page** — signed-in users redirect to `/dashboard`; unauthed see the existing sign-in / create-account CTAs

**Build / lint / typecheck:** all green. 14 routes compile (server-rendered, all dynamic since they read auth cookies). RLS audit query verified clean on the live database.

**Deferred from iteration 0000 (out of session scope):**
- Join flow at `/join/[event-id]?token=...` — needs the 18-role taxonomy from iteration 0001
- Unified Schedule view aggregating across `vendor_meetings`, `VendorLineItem.deadline_date`, and `invitation_widgets` — needs iterations 0006 + 0007 to ship first
- Vendor-side and admin-side role-router destinations — V1 focuses on customer surfaces (per spec § "Vendor accounts are a placeholder in V1")
- Inside-tab sub-pill row for Guest List (guests/invitation/seating) and Vendors (vendors/budget) — will land when 0001/0002/0008/0006/0007 ship real content

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/`:**

1. **`0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** — the token wallet is referenced at multiple points but was RETIRED 2026-05-11. Affected lines:
   - L21: "Wallet" listed as one of the In-App Services launcher tiles
   - L140: "Token wallet pill on the right (\"🪙 75,000\")" in the chrome
   - L197 / L213 / L220 / L387: "Wallet" / "Top up" / "0003 wallet panel"
   - Replace all with the apply-then-pay model from iteration 0034. The chrome no longer carries a wallet pill; the "Orders" entry in the Services launcher replaces the Wallet card.
2. **`0000_app_shell_and_navigation/fixtures.json`** vs **`.md`** — fixtures.json uses `users.primary_event_id` (FK on user) but the .md SQL declares `events.is_primary` (boolean on event). Sprint 0's base migration already shipped `events.is_primary`. Either reconcile fixtures to match (`is_primary` on the event row) or update the spec SQL to match fixtures (move it to users).

---

## 2026-05-12 · Sprint 0 — platform foundation

**Commits:** `394ded8` → `d93e900` (initial scaffold + 4 CI fixes + STATUS.md update).

**What landed:**
- Fresh greenfield Setnayan monorepo (full wipe of prior Tayo scaffold, rebuild from scratch).
- Next.js 15 App Router web app with `output: 'standalone'`, Tailwind locked breakpoints (sm 640 / md 768 / lg 1024 / xl 1280), ≥44 pt touch targets, brand palette (cream / ink / terracotta).
- Auth: email/password + magic-link via Supabase SSR — no OAuth popups (works in Tauri/webviews).
- `/health` route, login + signup pages responsive across the 4 canonical viewports.
- Supabase Postgres canonical schema migration `20260512000000_setnayan_base.sql`:
  - `public.generate_public_id(type_letter)` function (Crockford base 32, no I/L/O/U).
  - 5 enums (`account_type`, `event_type`, `member_type`, `locale_code`, `theme_preference`).
  - 4 base tables (`users`, `events`, `event_members`, `event_join_tokens`) with `S89X-` `public_id` defaults.
  - 4 RLS helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`) — `SECURITY DEFINER STABLE`.
  - RLS Pattern A (per-user) on `users`; Pattern B (event-scoped) on the other three.
  - `on_auth_user_created` trigger — auto-provisions `public.users` and flags `iscasasolaii@gmail.com` as `is_internal=TRUE` per § 10a.
- `apps/web/scripts/rls-audit.sql` — the merge-floor verification query per RLS spec § 9.
- PWA: `manifest.json`, service worker (`sw.js`), maskable SVG icons (192 + 512).
- Tauri 2 desktop scaffold (`src-tauri/`): `Cargo.toml`, `tauri.conf.json`, `build.rs`, `src/main.rs` + `lib.rs`, master `icons/icon.svg`. Embedded `shell/index.html` redirects to live Vercel URL — Sprint 0 minimum viable.
- GitHub Actions: `ci.yml` (typecheck + lint on every push/PR), `build-desktop.yml` (macOS + Windows matrix on push to main), `lighthouse.yml` (Lighthouse CI on PRs).
- `packages/shared` — `PUBLIC_ID_PATTERN`, `isValidPublicId`, role/event/member type unions.
- Live services wired:
  - GitHub: `iscasasola/setnayan-platform` (private)
  - Supabase: project `njrupjnvkjkitfctetvi` in Singapore
  - Cloudflare R2: 4 buckets in APAC (`setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`)
  - Vercel: `https://setnayan-platform-web.vercel.app`, auto-deploy on push to main
- CI fix commits resolved: pnpm version conflict (`pnpm/action-setup` no longer pins explicit version), phantom worktree gitlinks pruned from index, Tauri `frontendDist` pointed at embedded shell, desktop artifact upload glob corrected to include target subdirectory.

**Acceptance criteria:** all 7 provisioning steps + Phase 1A/1B/1C/1D green. Owner signed up (`S89U-KEMMF2ADCK`, `is_internal=TRUE`), PWA installed on one phone, both desktop artifacts (1.3 MB `.dmg` + 1.3 MB `.msi`) downloadable from Actions tab.

**SPEC IMPACT:** None. The scaffold mirrors the spec corpus 1:1. The Tauri prod URL strategy remains a known gap (documented in `STATUS.md`); if/when we pick a sidecar Node strategy vs static export, that's a spec impact and the owner must update `0013_platform_stack_and_sync` via Cowork.
