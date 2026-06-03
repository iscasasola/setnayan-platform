# Cowork Inbox — Pending Spec Updates

> Worklist of spec-corpus updates the owner needs to apply via Cowork.
>
> **Read this** at the start of any Cowork session. **Action** each `[PENDING]` item by editing the indicated spec file at `~/Documents/Claude/Projects/Setnayan/`. When done, change `[PENDING]` to `[DONE <YYYY-MM-DD>]` (or delete the entry if you'd rather keep the file short).
>
> **Maintained by:** Claude Code sessions append new `[PENDING]` items here whenever a code change has spec impact. This is the single bridge between repo work and the spec corpus — `CHANGELOG.md` is the full history; this file is the active worklist.

---

## [PENDING] 2026-06-03 — Drive-copy layer keystone (R2 = system of record · 6-artifact Drive copy)

**Why:** Code shipped Phase 1 (keystone) of the 2026-06-03 storage lock — the universal Google-Drive copy layer (`lib/drive-copy.ts` + `drive_copy_*` schema). The architecture, retention model, and the exact per-file iteration edits are already written up in the corpus design doc; this item is the reminder to walk that worklist via Cowork.

**Spec corpus updates (owner walks via Cowork):**

1. **Apply `~/Documents/Claude/Projects/Setnayan/Storage_and_Drive_Copy_Architecture_2026-06-03.md` § 7 (Cowork worklist)** — the per-file edits: `CLAUDE.md` storage line (retire "R2 hot 90 days / IA cold 5 years" → 3-month high-res→compress + Drive copy) · **0009** rescope (photographer Drive folder → universal copy layer) · **0011** Panood carve-out (+ delete the offline-note "recording → R2 archive → Drive" line) · **0012** (retire "R2 → Drive at T+30d") · **0017** · **0036** · **0037/0004** · **0002** · pax-pricing docs (name the 6-artifact set + 3-month rule). Each `.md` edit → regen its `.docx` mirror.
2. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** — ✅ already carries the 2026-06-03 "Storage & Drive-copy architecture LOCKED" row (added when the design doc landed). No action.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]` here.

---

## [PENDING] 2026-06-03 — Site Editor: card-parity with the journey page (Phase 1 of the Website-tab flip)

**Why:** The Reels editor (`/site-editor/[eventId]`) now carries every vital surface from the journey page (`/dashboard/[eventId]/website`) as carousel cards — the prerequisite for ④ "flip the Website tab to the editor" in the 2026-06-01 flip sequence. The spec corpus needs the decision-log row + a note on iteration 0021 so future sessions don't re-derive the editor's card set or the inline-buy-vs-navigation rule.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** — append a 2026-06-03 row (date order):
   > **🪟 Couple Website editor — journey-page → editor card migration (Phase ②/③ of the 2026-06-01 flip sequence).** The `/site-editor` carousels now reach card-parity with the journey page. **Settings** + Keep-your-photos/Google-Drive sync (→ 0009 photo-delivery `/add-ons/photo-delivery`) + Custom QR per guest (→ `/add-ons/custom-qr-guest`). **Event** + Monogram Hero (₱1,999 · inline buy) + Preview day-of mode (`?preview=day_of`) + Live stream Panood + Live Schedule (₱999 · inline buy) + Papic (candid + paparazzo seats, merged) + Patiktok booth + Live photo wall (coming soon). **Wiring rule honored:** only the two Pro widget upgrades (Monogram Hero `monogram_hero_upgrade` + Live Schedule `pro_widget_schedule`) are inline-buy (mirrors the journey page's `ProUpgradePanel` — catalog price via `findSku`/`formatCentavosPhp`, owned-state via `orders`, CTA → `/orders/new?service=<sku>`); every other service is a **navigation card into its `/add-ons/<key>` page, which owns its pricing + buy state** (journey.tsx docstring · V2.1 Amendment #3). The owner's earlier "full inline tools for all 5 services" was reconciled to the wiring rule to avoid duplicating the canonical buy/config flows + the V2 pax-based pricing. **Open decision:** whether to also inline the Panood/Papic/Patiktok configurators (a deliberate departure from the wiring rule) — deferred. **Pilot-safe:** journey page (PR #704) untouched; the entry-flip + journey retirement is the next PR (Phase 2). Files: `apps/web/app/site-editor/[eventId]/page.tsx` (+`ownedOrders` fetch) · `_components/site-editor.tsx` (+`ProCard`, 2 Settings cards, 6 Event cards).

2. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — note that the Website tab's canonical surface is the Reels editor card set (Settings/RSVP/Event/Editorial carousels), and that once the Phase-2 flip lands, tapping "Website" opens `/site-editor/[eventId]` rather than the journey scroll (which is retained as a fallback route).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]` here.

---

## [PENDING] 2026-06-03 — Iteration 0001: bride & groom are the event's foundation (auto-Attending · undeletable · role-locked)

**Why:** Owner directive 2026-06-03 — the couple (bride & groom) are foundational: auto-Attending, can't be deleted, renamable, and hidden from the assignable role pickers. The 0001 spec should capture these rules.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/0001_creating_guest_list.md`** — add a "Bride & Groom (foundation of the event)" rule block:
   - RSVP is **always Attending**, never Pending — enforced by DB trigger `guests_couple_force_attending` (migration `20260725000000`) + app read-coercion; excluded from the Pending count.
   - **Cannot be deleted** (single + bulk) — a "foundation of the event" guard runs before the RSVP gate; the detail page hides the Remove button.
   - **Can be renamed** — name fields stay editable.
   - **Bride/Groom hidden from the role pickers** (new-guest form, edit-form select, bulk-assign picker). The couple's own role shows read-only ("Foundation · locked"). The couple is established at event creation, never reassigned from the guest list.
   - Clicking the bride/groom opens their full detail; a richer "album / custom data" surface is a planned follow-up (pending owner spec on what the album links to).

2. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** (corpus root) — append a 2026-06-03 row: "Bride & groom = event foundation: auto-Attending (trigger 20260725000000 + read-coercion), undeletable (single+bulk guard), renamable, hidden from role pickers, role/RSVP locked on detail. Files: migration + apps/web/lib/guests.ts + guests/[guestId]/{actions.ts,page.tsx} + groups-actions.ts + new/page.tsx + _components/guest-list-multiselect.tsx."

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Iteration 0001: mobile Guests carousel — select-and-assign Customize + folded filters + side/role/group sort

**Why:** Owner directives 2026-06-03 reshaped the mobile Guests page (the lower-third 4-panel carousel). The shipped behavior now differs from how iteration 0001 describes the mobile guest-list controls, so the spec should be updated to match.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/0001_creating_guest_list.md`** — update the mobile carousel section:
   - **Customize panel** is no longer the View/Groups/Tags filters. It is now **select-and-assign**: a "Select guests" entry button → checkboxes appear on each guest card → a select-all checkbox + live "N selected" count + an **Assign** button live in the panel → Assign opens a **bottom sheet** offering **Side / Role / Group**, where Group includes a text box to **create a new group** on the spot. Backed by the existing bulk server actions (`bulkApplyRoleAndGroup`, `createGuestGroup`).
   - **Search & sort panel** now also hosts the **View / Groups / Tags filter chips** (folded in from the old Customize panel) under a "Filter" heading, plus the search box (matches name · side · role · group · RSVP) and the sort pills.
   - **Sort** options now include **Side · Role · Group** in addition to Last name / First name / RSVP / Newest.
   - **Header removed on mobile:** the "Guest list / N guests" title is desktop-only; the Summary panel carries the count on phones.
   - **Carousel chrome:** docked as a raised sheet (rounded top + soft shadow + single hairline), no doubled border.

2. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** (corpus root) — append a 2026-06-03 row: "Mobile Guests carousel: Customize → select-and-assign (Side/Role/Group + create-group bottom sheet); View/Groups/Tags filters fold into Search & sort; sort gains Side/Role/Group; mobile header removed (Summary carries count). Desktop unchanged (table + floating SelectionBar). Files: `apps/web/app/dashboard/[eventId]/guests/{page.tsx, _components/mobile-guest-carousel.tsx, guest-list-multiselect.tsx, guest-selection-store.ts}`."

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]` here.

---

## [PENDING] 2026-05-22 — Iteration 0021: tiered wedding-date precision + vendor calendar intersection (Task #39)

**Why:** Owner-confirmed V1 pilot-blocking feature (CLAUDE.md decision log Task #39, 2026-05-22). The event date model changes from "specific day required" to a 3-precision tier (year / month / day). Spec corpus needs the canonical decision-log row + iteration 0021 § 10 supersession note + new schema column documented.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/CLAUDE.md` decision log** — append a new 2026-05-22 row covering: the 3-precision tier (year / month / day), the new `events.event_date_precision` column with backfill rule, the vendor calendar intersection logic powered by `getCommonAvailableDays`, the refine-only ratchet (precision can narrow but never widen with ≥1 confirmed vendor), and a note that this supersedes iteration 0021 § 10 narrative-driven date-change negotiation for the common case (couple narrows date via vendor-availability intersection rather than negotiating a date change). Cross-reference the bundled Task #38 fix (removed `ceremony_type_locked_at = NOW()` auto-stamp from create-event action). Sequencing: extends the 2026-05-22 morning planning row + closes Task #39 from the 11-item P0 sprint list.

2. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — new sub-section under § Date row UX documenting the 3-mode picker (Year · Month + Year · Specific Day), refine-only ratchet, and `EventDatePrecision` column. Update § 10 to note that the vendor-availability intersection panel handles the common "couple narrows date" case directly on event home; the multi-party negotiation flow remains for date changes that occur AFTER day-precision is locked.

3. **Iteration 0021 schema additions section** — document `events.event_date_precision TEXT NOT NULL DEFAULT 'year' CHECK IN ('year', 'month', 'day')` + backfill rule (rows with non-null `event_date` → 'day', rows with null → 'year').

4. **`~/Documents/Claude/Projects/Setnayan/CLAUDE.md` Task #38 note** — confirm bundled fix in CLAUDE.md: the `ceremony_type_locked_at = NOW()` auto-stamp from PR #301 was a bug; the religion CTA on event home reads `ceremony_type_locked_at` to gate the "Set wedding type" CTA state, and auto-stamping at create-time bypassed the CTA entirely for new events. Fix removes the auto-stamp; new events land with NULL lock and surface the CTA correctly.

**When done:** flip `[PENDING]` → `[DONE 2026-05-XX]` here.

---

## [PENDING] 2026-05-20 — Iteration 0009 Photo Delivery: architecture deviations from spec

**Why:** Iteration 0009 was promoted V1.5+ → V1 on 2026-05-18; PRs 1-4 shipped end-to-end this session (#147 schema, #152 encryption helper, #153 OAuth routes, **PR 4** release producer + sweep tick). The spec at `~/Documents/Claude/Projects/Setnayan/0009_photo_delivery/0009_photo_delivery.md` predates a few architectural realities in the repo — five concrete deviations need to be reflected so future Claude sessions don't re-derive them from the spec.

**Spec corpus updates (owner walks via Cowork):**

1. **`0009_photo_delivery/0009_photo_delivery.md`** — § OAuth flow: replace the `apps/web/lib/encryption.ts` + `events.photo_delivery_oauth_token_encrypted` design with the shipped pattern:
   > "Refresh tokens are persisted in the shared `oauth_grants` table with `provider='drive_photo_delivery'`, matching the Papic (0012) pattern shipped 2026-05-16. Plaintext for V1; the in-schema `TODO(security)` on `oauth_grants.refresh_token` anticipates a future migration to pgcrypto via the `apps/web/lib/encryption.ts` helper landed in PR #152. The events column `events.photo_delivery_oauth_token_encrypted` ships as schema waste until that harmonization."

2. **`0009_photo_delivery/0009_photo_delivery.md`** — § Routes: rename the OAuth route paths:
   > "OAuth start: `/api/oauth/photo-delivery/start?event_id=...` (not `/api/oauth/google/start`)."
   > "OAuth callback: `/api/oauth/photo-delivery/callback?code=...&state=...` (not `/api/oauth/google/callback`). Google Cloud OAuth client must register this URI alongside Papic's `/api/oauth/drive/callback`; the redirect URI is what distinguishes the two iterations server-side."
   > "Surface URL: `/dashboard/[eventId]/add-ons/photo-delivery` (the shipped add-ons path, not the spec's earlier `/services/photo-delivery` or root `/dashboard/photo-delivery` references)."

3. **`0009_photo_delivery/0009_photo_delivery.md`** — § Data model: deprecate the "Extensions to `photos`" subsection. Replace with:
   > "**`photo_delivery_artifacts` (new join table, PR #154)** — `photos` (unified) does not exist in the V1 schema; what shipped via PR #151 is iteration-specific `papic_photos`. Photo Delivery per-photo state therefore lives in a join table keyed by `(event_id, source_table='papic_photos', source_photo_id)`. Columns: `drive_file_id`, `uploaded_at`, `attempt_count` (cap 5), `last_error_text`, `last_error_at`. Re-releases UPSERT by the unique index and skip rows where `drive_file_id IS NOT NULL`."

4. **`0009_photo_delivery/0009_photo_delivery.md`** — § Release pipeline (the upload job): replace the Cloudflare Queues + Workers architecture with the Vercel-native pattern:
   > "**Producer:** `POST /api/photo-delivery/release` — couple-auth, creates a `photo_delivery_jobs` row + UPSERTs `photo_delivery_artifacts` from `papic_photos` (filtering `hidden_at IS NULL`), flips `events.photo_delivery_status='releasing'`."
   > "**Worker:** `POST /api/cron/photo-delivery-tick` — `x-cron-secret`-guarded sweep, picks up to 5 events with status ∈ {'releasing','uploading'} per tick, processes 6 artifacts per event via Drive multipart upload. Token refresh handled inline via `refreshDriveAccessToken` from `papic-drive.ts`. Cron cadence 1-2 minutes (external scheduler — Cloudflare Cron Triggers or Vercel Cron). No `apps/workers/` package ships in V1."

5. **`App_Build_Status.md`** — find the iteration 0009 row (today: "🟡 V1 build pending (promoted from V1.5+ 2026-05-18)"). Update to:
   > "⚠️ Partial — schema (PR #147), encryption helper (PR #152 unused pending harmonization), OAuth routes (PR #153), release producer + sweep tick (PR #154) all shipped. Pending: status polling + redeliver/disconnect routes + email templates (PR 5)."

6. **`CLAUDE.md` decision log** — append a new row dated `2026-05-20`:
   > `| 2026-05-20 | **0009 Photo Delivery V1 architecture set (oauth_grants over encrypted-events column · papic_photos as the source-of-truth join target via new photo_delivery_artifacts table · Vercel routes + cron tick over Cloudflare Workers).** PRs #147/#152/#153/#154. Encryption helper kept ready for a future oauth_grants pgcrypto harmonization. | apps/web/lib/photo-delivery-{drive,release}.ts · supabase/migrations/202605200{00,20,30}000_*.sql |`

---

## [PENDING] 2026-05-20 — Iteration 0005 LED Background: pricing table sanity check

**Why:** PR #150 shipped the LED schema foundation (`led_background_configs` + `led_background_renders`). SKU seed was deliberately skipped because the spec's 2026-05-08 pricing table at `0005_led_background_maker.md` § "Pricing" reads:
> | 1080p HD | ₱249 |
> | 4K UHD | ₱399 |
> | 8K cinematic | ₱99 |

8K being cheapest is implausible (8K render is the most compute-intensive output). Likely transposed: 8K should be ₱999, not ₱99. Owner must confirm correct pricing before PR 1b seeds live SKUs.

**Spec corpus updates (owner walks via Cowork):**

1. **`0005_led_background_maker/0005_led_background_maker.md`** — § Pricing: confirm or correct the 1080p / 4K / 8K row prices. Pro Bundle's "All 10 templates · ₱99" also worth a sanity check (₱99 for unlimited drafts reads low if individual renders are ₱99-249).
2. **`0005_led_background_maker/0005_led_background_maker.md`** — § Pricing: if prices change, log a 2026-05-20 decision-log row at `CLAUDE.md` documenting the correction.

After owner confirmation, follow-up PR seeds the SKUs into `service_catalog` (PR 1b for 0005).

---

## [PENDING] 2026-05-16 — Iteration 0012 Papic: Google Drive OAuth + storage-choice setup (V1 scope expansion)

**Why:** Per the 2026-05-16 V1 scope expansion (sibling to PR #95 which shipped the YouTube slice for Panood), Papic now ships OAuth-wired setup at V1 even though the capture pipeline itself (cameras + face detection + transfer) remains V1.5+. PR `feat(0012): Google Drive OAuth + Papic storage-choice setup` shipped today and adds a new storage-choice radio (Setnayan R2 default vs Google Drive only) plus the full Drive OAuth round-trip with bootstrapped folder structure. Four spec files need to catch up so the spec corpus matches the shipped reality.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md`** — add a new section near the top called **"Storage choice (V1)"** documenting the radio:
   > "Couples pick where Papic writes photos via a radio on `/dashboard/[eventId]/add-ons/papic`. **Setnayan R2** (default, recommended): fast, reliable, no quota for the couple. **Google Drive only**: writes directly to the couple's Drive via OAuth (drive.file scope), no Setnayan copy. Stored on `events.papic_storage_target` (`'setnayan_r2' | 'google_drive_only'`, default `'setnayan_r2'`). On first Drive connect, Setnayan bootstraps `Setnayan/[Event display_name]/{00_Cover, 01_Pre-event, 02_Ceremony, 03_Reception, 04_Auto-Recap}` inside the couple's Drive; the root folder id lands in `oauth_grants.metadata.drive_folder_id`."
   >
   > **Deviation from earlier 'T+30d transfer' model (LOCKED 2026-05-16):** the prior spec contemplated Setnayan keeping photos for 30 days then bulk-pushing to the couple's Drive. The new model is **real-time DURING the event for BOTH options** — R2 is the primary by default; couples who opt out get Drive throttling + their own quota constraints as a deliberate tradeoff. No T+30d transfer pipeline ships in V1.

2. **`~/Documents/Claude/Projects/Setnayan/App_Build_Status.md`** — find the iteration 0012 (Papic) row. Today it reads roughly "🟡 V1.5+" (deferred). Flip it to:
   > "⚠️ Partial — Drive OAuth + storage-choice setup shipped V1 (couples can connect their BYO Google Drive at setup time + pick R2 vs Drive-only target); capture pipeline (native app pairing, face detection, transfer) still V1.5+. Graceful fallback to 'coming soon' on the Drive radio until Google Cloud verified-app review completes."

3. **`~/Documents/Claude/Projects/Setnayan/CLAUDE.md`** — append a new row to the decision log dated `2026-05-16` (after the PR #95 row already queued in this inbox). Suggested text:
   > **2026-05-16 — Papic V1 scope expansion: Drive OAuth + storage-choice radio (Setnayan R2 recommended default vs Drive-only opt-in with quota warning).** Couples now pick where Papic photos land at setup time. `events.papic_storage_target` (`'setnayan_r2' | 'google_drive_only'`, default `setnayan_r2`) is the hard toggle the V1.5+ capture pipeline reads to branch upload destinations. Drive connect flow bootstraps `Setnayan/[Event]/{00_Cover, 01_Pre-event, 02_Ceremony, 03_Reception, 04_Auto-Recap}` inside the couple's Drive via the narrowest `drive.file` scope. **Spec deviation from earlier T+30d transfer model:** new model is real-time during the event for BOTH options; no bulk-transfer pipeline in V1. **Graceful-fallback pattern reused:** when `GOOGLE_DRIVE_OAUTH_CLIENT_ID` is unset, the Drive radio renders disabled with "coming soon — admin setup pending"; the Setnayan-R2 option stays fully functional, so the V1 launch isn't blocked on the Google verified-app review timeline.

4. **`~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md`** — add a new **§ 5.6 Google Drive API v3 (per-couple OAuth)** (or extend § 5.3 if you'd rather keep all Google scopes in one row):
   > "**V1 wiring shipped 2026-05-16** (PR `feat(0012)`). Routes live at `/api/oauth/drive/{start,callback,disconnect}` + refresh handled by the shared `/api/cron/oauth-refresh` worker (now dual-provider, youtube + drive). **Scope requested:** `https://www.googleapis.com/auth/drive.file` (narrowest — only files Setnayan creates in the couple's Drive). **Remaining owner-side blocker:** Google Cloud project (CAN reuse the YouTube one — Drive and YouTube can share the same OAuth client since the redirect URI distinguishes them) → enable Drive API v3 → add `drive.file` scope to consent screen → if not already verified, submit for Google verification (1–4 wk) → paste `GOOGLE_DRIVE_OAUTH_CLIENT_ID` / `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` / `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` into Vercel env. Until this is done, the Papic setup page renders a 'coming soon' caption under the Drive radio per the graceful-fallback rule, and the Setnayan-R2 default still works."
   >
   > Also flag the dual-purpose nature: **the same Google Cloud project / OAuth client now powers both YouTube (Panood) and Drive (Papic)**. Splitting later is a config-only change (separate client_id / secret env vars already in place).

**Owner action checklist (separate from the spec edits above):**
- [ ] Confirm Google Cloud project is reused (vs separate Drive project).
- [ ] Enable Google Drive API v3 in the same Google Cloud project.
- [ ] Add `https://www.googleapis.com/auth/drive.file` to the OAuth consent screen scopes (alongside the YouTube scopes from PR #95).
- [ ] If not already verified, submit for Google verification (1-4 wk).
- [ ] Add `https://www.setnayan.com/api/oauth/drive/callback` as an authorized redirect URI on the OAuth 2.0 Web client (same client as YouTube or a new one).
- [ ] Paste `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` into Vercel env; redeploy.
- [ ] Run `supabase db push` to apply `20260516280000_events_papic_storage_target.sql` (adds the `events.papic_storage_target` column with R2 default).
- [ ] No new cron secret needed — the Drive refresh worker reuses `OAUTH_REFRESH_CRON_SECRET` from PR #95.

---

## [PENDING] 2026-05-16 — Iteration 0011 Panood: YouTube OAuth wiring (V1 scope expansion)

**Why:** Per the 2026-05-16 4th decision-log row, the owner expanded V1 scope to wire real OAuth on the V1.5+ scaffold setup pages so couples can connect their BYO accounts at setup time. PR `feat(0011): YouTube OAuth wiring + Panood setup rewrite` shipped the YouTube slice + the shared `oauth_grants` foundation today. Three spec files need to catch up so the spec corpus matches the shipped reality.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/App_Build_Status.md`** — find the iteration 0011 (Panood) row. Today it reads roughly "🟡 V1.5+" (deferred). Flip it to:
   > "⚠️ Partial — OAuth setup flow shipped V1 (couples can connect their BYO YouTube channel at setup time); broadcaster + SFU + RTMP relay surface still V1.5+. Graceful fallback to 'coming soon' until Google Cloud verified-app review completes."

2. **`~/Documents/Claude/Projects/Setnayan/CLAUDE.md`** — append a new row to the decision log dated `2026-05-16` (after the existing four rows from today). Suggested text:
   > **2026-05-16 — OAuth wiring for V1.5+ scaffold setup pages shipped early.** Couples can connect their YouTube channel (0011 Panood — shipped this date) and will be able to connect Google Drive (0012 Papic — Agent B follow-up) and TikTok (0017 Patiktok — already shipped via PR #92) at setup time, even though the full broadcaster / Drive sync / TikTok render pipelines remain V1.5+ deliverables. Shared substrate: `public.oauth_grants(event_id, provider, scopes, refresh_token, access_token, …)` with per-provider OAuth start/callback/disconnect routes under `/api/oauth/<provider>/*`. **Graceful-fallback pattern (LOCKED):** when `<PROVIDER>_OAUTH_CLIENT_ID` is unset the Connect CTA degrades to a disabled "coming soon — admin setup pending" placeholder and the start route returns 503. This decouples shipping the V1 surface from the owner-side OAuth verified-app review (1-4 wk window per provider). Doesn't break V1 launch.

3. **`~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md`** § 5.3 — find the YouTube Data API per-couple OAuth entry. Currently framed as "V1.5+ activation". Reframe to:
   > "**V1 wiring shipped 2026-05-16** (PR `feat(0011)`). Routes live at `/api/oauth/youtube/{start,callback,disconnect}` + refresh worker at `/api/cron/oauth-refresh`. **Remaining owner-side blocker:** Google Cloud project setup → YouTube Data API v3 enable → OAuth consent screen (External, Production) → submit for Google verification (review window 1–4 wk) → paste `YOUTUBE_OAUTH_CLIENT_ID` / `YOUTUBE_OAUTH_CLIENT_SECRET` / `YOUTUBE_OAUTH_REDIRECT_URI` into Vercel env. Until this is done, the Panood setup page renders a 'coming soon' placeholder per the graceful-fallback rule."

**Owner action checklist (separate from the spec edits above):**
- [ ] Provision Google Cloud project for Setnayan (if not already).
- [ ] Enable YouTube Data API v3.
- [ ] Configure OAuth consent screen (External, Production); add scopes `https://www.googleapis.com/auth/youtube` + `https://www.googleapis.com/auth/youtube.upload`.
- [ ] Submit for Google verification (1-4 wk).
- [ ] Create OAuth 2.0 Web client; add `https://www.setnayan.com/api/oauth/youtube/callback` as an authorized redirect URI.
- [ ] Paste `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI` into Vercel env; redeploy.
- [ ] Generate + paste `OAUTH_REFRESH_CRON_SECRET` (`openssl rand -hex 32`) — shared with the future Drive refresh sweep.
- [ ] Schedule the cron worker (Cloudflare Cron Trigger or Supabase pg_cron) to POST `/api/cron/oauth-refresh` hourly with the `x-cron-secret` header — see the `TODO(0011):` block in that route.

---

## [PENDING] 2026-05-14 — Iteration 0042: Industry Events & B2B Vendor Marketing

**Spec doc CREATED at:** `~/Documents/Claude/Projects/Setnayan/0042_industry_events_b2b/0042_industry_events_b2b.md`

This is a **NEW B2B layer** on top of Setnayan's existing consumer marketplace. Owner spotted today that wedding fairs (GMBF at SMX Manila, ~134 exhibitors), vendor expos, and industry networking events have no good aggregator platform in PH — Setnayan can fill that distribution gap AND turn it into a revenue surface.

**What's LOCKED:**
- Industry events are a **SEPARATE concept from consumer events** in 0041 — different audience (vendors, not couples), different schema (`industry_events` table, not `events`), different RLS, different monetization
- **7 industry event types:** bridal_fair, wedding_expo, vendor_networking, industry_conference, certification_workshop, trade_show, setnayan_event
- **Wedding fair organizers = special vendors** with `is_industry_event_organizer = TRUE` flag (admin-verified)
- **3 surfaces:** public `/industry-events`, vendor `/vendor-dashboard/opportunities`, organizer-side event management
- **Setnayan as organizer:** Setnayan can host its own Wedding Connect-style events (à la Bridestory Singapore)

**Real-world precedent (from research):**
- Bridestory hosted "Wedding Connect Singapore" — 300+ vendors at one networking event
- Getting Married Bridal Fair (GMBF) — recurring at SMX Convention Center Manila
- US wedding-expo industry has proven monetization model (Jenks Productions, Florida Wedding Expo): tiered booth packages with premiums 2-5x base fees
- B2B event tech moving to AI matchmaking (Bizzabo 2025)

**Spec corpus updates owner should walk via Cowork:**
- Read `~/Documents/Claude/Projects/Setnayan/0042_industry_events_b2b/0042_industry_events_b2b.md` end-to-end
- Resolve the 10 open questions in spec § 9 (audience question § 9.1 is blocking; Phase 3 commission model still affects this too)
- Decide: pursue GMBF partnership as launch deal? (spec § 9.4)
- Decide: Setnayan-organized event at launch? (spec § 9.2 — recommended yes)

**Strategic context:** When 0040 + 0041 + 0042 all ship, Setnayan becomes the only PH platform doing all five: couples plan any life event · vendors serve multiple event types · vendors discover business opportunities · fair organizers reach curated vendors · Setnayan organizes its own marketplace events. Real moat against TheKnot, HoneyBook, Bridestory, Eventbrite.

**Once spec is refined and ready to implement, tell Claude Code:** "Iteration 0042 spec is locked — sweep the implementation against `tests.md` and spawn parallel agents per the resume checklist in spec § 10."

---

## [PENDING] 2026-05-14 — Iteration 0041: Multi-Event Vendor Catalog (LOCKED architecture)

**Spec doc CREATED at:** `~/Documents/Claude/Projects/Setnayan/0041_multi_event_support/0041_multi_event_support.md`

This is a **major V1.5 expansion** that lifts Setnayan from wedding-only to all Filipino life events (baptism, debut, birthday, anniversary, corporate, religious gatherings). Owner reviewed competitive research (Toast, Square, Thumbtack, WeddingWire, TheKnot, Zola, Shopify, Google Product Taxonomy) and locked the architecture this session.

**What's LOCKED:**
- **Architecture:** Hybrid 3-layer hierarchy + cross-cutting tags. Layer 1: Cluster (8). Layer 2: Category (38). Layer 3: Service (vendor-defined free naming). Cross-cutting tags handle event_types, settings, delivery_type, pricing_model, synonyms, specializations, languages, travel_zones.
- **8 clusters:** Reception & Foundation · Ceremony & Religious · Media & Documentation · Music & Entertainment · Decor & Production · Attire & Beauty · Logistics & Support · Print & Gifts
- **38 categories** (29 → 38; +9 new, 7 renamed/relabeled, 1 cross-listed, 1 deprecated). Full table in the spec doc § 5.
- **7 event types for V1.5:** wedding, baptism, debut, birthday, anniversary, corporate, religious_event. Funeral deferred to V2 (sensitive marketing).
- **2-step vendor service creation UX:** Choose Cluster → Identify Service → Configure (Step 3 hands off to iteration 0040 Catalog Studio).

**Spec corpus updates owner should walk via Cowork:**
- Read `~/Documents/Claude/Projects/Setnayan/0041_multi_event_support/0041_multi_event_support.md` end-to-end and refine wording, especially the 11 sections
- The "28 canonical categories" locked decision in HANDOFF.md is now superseded — 38 categories
- Resolve the 9 open questions in spec § 10 (Phase 3 commission model is the BLOCKING one)
- Confirm or push back on the per-category event-types assignments in § 5
- Confirm the bartending/bar-equipment split with 3-5 real Filipino bar vendors before implementation (spec § 10.5)

**Why this is a [PENDING] not [DONE]:**
The spec is drafted but unrefined. Implementation has NOT started. Spec lives in the corpus; owner refines via Cowork; then implementation iteration begins.

**Once spec is refined and ready to implement, tell Claude Code:** "Iteration 0041 spec is locked — sweep the implementation against `tests.md` and spawn parallel agents per the resume checklist in spec § 11."

---

## [PENDING] 2026-05-14 — Iteration 0006: vendor marketplace + reviews system

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0006_vendors_management/` — capture the new `/vendors` public marketplace surface (category/city filters, search, sort by most_reviews/highest_rated/newest, paginated grid).
- Same iteration — capture the reviews subsystem on the existing public vendor landing page `/v/[slug]`: 5-category-star aggregate + paginated review list with one-time vendor reply per review.

**Schema (migration `20260514100000_vendor_reviews.sql`):**
- New `vendor_reviews` table (event_vendor_id → event_vendors, couple_user_id → users, 5 category star ratings 1–5, free-text body, vendor_reply, created_at, replied_at)
- Materialized `vendor_review_stats` view (per vendor_profile_id: review_count, avg_overall, avg per category)
- RLS: public read, couple INSERT only after `event_vendors.status` is `delivered` or `complete`, vendor one-time UPDATE for `vendor_reply`
- New notification type `review_request` — fires from `emitNotification` when admin flips `event_vendors.status` to delivered (in-app row + Resend email)

**New routes:**
- `/vendors` — public marketplace
- `/dashboard/[eventId]/vendors/[eventVendorId]/review` — couple review form (5 category stars + free-text body)
- `/vendor-dashboard/reviews` — vendor sees their reviews + one-time reply form per review
- `/v/[slug]` — new Reviews section appended to the existing public vendor landing page (avg/count/star breakdown + paginated list)

---

## [PENDING] 2026-05-14 — Iteration 0022: vendor dashboard expansion (services + bookings + team + earnings)

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0022_vendor_dashboard/` — extend with the 4 new tabs that replaced the Phase 1 placeholders.

**4 new surfaces under `/vendor-dashboard/*`:**

| Surface | What |
|---|---|
| **Services editor** | Vendor picks from the locked 28 categories, sets starting price, crew size, crew meal required. Toggle `is_active` to hide without losing pricing history. |
| **Bookings inbox** | List existing chat threads from couples, prioritized by `event_date` proximity, read/unread + stale flags. Routes through to the existing `/messages/[threadId]`. |
| **Team** | 4 role tiers (Owner / Admin / Agent / Viewer) via new `vendor_team_members` table. RLS scopes reads/writes to Owner+Admin. Self-invites disabled. |
| **Earnings** | Read-only paid-order rollup, monthly subtotals, year-to-date running total, 3% Setnayan Pay convenience fee line per row. |

**Schema (migration `20260514010000_iteration_0022_vendor_dashboard_expansion.sql`):**
- New columns on existing `vendor_services` table: `starting_price_php BIGINT`, `is_active BOOLEAN DEFAULT TRUE`
- New `vendor_team_members` table (vendor_profile_id, user_id, role enum)
- RLS on team table: Owner+Admin read/write; Agent/Viewer scoped to own row

---

## [PENDING] 2026-05-14 — Iteration 0019: force-majeure flow + admin queues + funnel analytics

**Spec target — owner picks one:**
- Add a **§ Force Majeure Flow** subsection inside `~/Documents/Claude/Projects/Setnayan/03_Iterations/0019_communications/` (since disputes ride on chat-thread context), OR
- Create new mini-iteration folder `~/Documents/Claude/Projects/Setnayan/03_Iterations/0019b_force_majeure/` if force-majeure should be its own spec doc.

**Schema (migration `20260514110000_force_majeure_flags.sql`):**
- New `force_majeure_flags` table (5 flag types · 8 statuses · evidence URL array · 7-day auto-resolve timer · admin handler `user_id`)
- RLS: couple-scoped to their own event flags; admin sees all
- `updated_at` trigger on the new table

**Couple side `/dashboard/[eventId]/disputes`:**
- File a flag with type, description, optional vendor scope, evidence file upload (multi-file → R2 via existing `uploadPublicAsset`)
- List existing flags with status timeline

**Admin side `/admin/force-majeure`:**
- Filterable queue, take-ownership flow, 6 resolution paths, notifications back to couple on resolve

**Funnel analytics `/admin/funnels`** (new admin surface, separate from force-majeure but landed in same PR):
- 3 Supabase-side funnels: signups → first event → first paid order; vendor signups → profile complete → first booking; week-over-week
- 4 PostHog-side funnels linked out: Save-the-Date, Papic, Pro upgrade, Guided Planner adoption

---

## [PENDING] 2026-05-14 — Iteration 0033: read-only public API (V1 Phase A + C)

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0033_public_api/` — capture the read-only endpoints + scope model that shipped in V1. Note that rate limiting and the developer portal styling are deferred to V1.5+.

**Endpoints:**

| Method | Path | Auth | Scope |
|---|---|---|---|
| GET | `/api/v1/events` | Bearer `sk_live_*` | `events.read` |
| GET | `/api/v1/events/:id` | Bearer `sk_live_*` | `events.read` |
| GET | `/api/v1/events/:id/guests` | Bearer `sk_live_*` | `guests.read` |
| GET | `/api/v1/vendors` | public (no auth) | — (filter by category/city/q, paginated) |
| GET | `/api/v1/vendors/:id` | public (no auth) | — (single profile by `public_id`) |

**Schema (migration `20260514010000_iteration_0033_api_scopes.sql`):**
- New `api_keys.scopes TEXT[] NOT NULL DEFAULT ARRAY['me.read']` column (additive `ALTER` — default avoids the NOT-NULL backfill issue)
- New public-read RLS policy on `vendor_profiles` for the unauth marketplace endpoints

**Scope wiring:**
- `lib/api-keys.ts` recognizes `events.read` / `guests.read` / `vendors.read` in addition to the existing `me.read`
- `/dashboard/api-keys` form gets opt-in scope checkboxes per key
- `lib/api-auth.ts`: new `requireScope()` helper

**Docs surface:** new `/api/v1` page lists endpoints + example curls. Rate limiting deferred to V1.5 — flagged on the docs page.

---

## [PENDING] 2026-05-14 — Iteration 0025: EN/TL locale toggle landed

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0025_profile_settings/` — capture the new "Display language" row in the Appearance tab. EN / TL only (the DB enum `locale_code` still has 'ceb' reserved for a future Cebuano dictionary).
- `~/Documents/Claude/Projects/Setnayan/02_Specifications/Brand_Voice.md` (or wherever the i18n strategy lives) — note that V1 ships dashboard CHROME ONLY in Tagalog (nav labels, common CTAs, status pills, time-of-day greetings, section headings). Guest-entered, vendor-entered, and marketing/landing content stay in whatever language they were authored in.

**Locked set of ~31 strings translated (see `apps/web/lib/i18n/dashboard.tl.json`):**

| Key | EN | TL |
|---|---|---|
| nav.guests | Guests | Mga Bisita |
| nav.vendors | Vendors | Mga Vendor |
| nav.budget | Budget | Budget |
| nav.messages | Messages | Mga Mensahe |
| nav.seating | Seating | Pagkakaupuan |
| nav.add_ons | Add-ons | Mga Karagdagan |
| nav.notifications | Notifications | Mga Abiso |
| cta.save | Save | I-save |
| cta.cancel | Cancel | Kanselahin |
| cta.add | Add | Magdagdag |
| cta.remove | Remove | Tanggalin |
| cta.sign_out | Sign out | Mag-sign out |
| status.pending | Pending | Naghihintay |
| status.done | Done | Tapos na |
| status.coming_soon | Coming soon | Malapit na |
| greeting.morning | Good morning | Magandang umaga |
| greeting.afternoon | Good afternoon | Magandang hapon |
| greeting.evening | Good evening | Magandang gabi |
| common.help | Help & support | Tulong at suporta |

**Storage:** Re-uses the existing `users.locale` `public.locale_code` column (no new migration). The toggle constrains the UI surface to `('en','tl')`; the DB enum's `'ceb'` value is preserved for a future Cebuano addition.

---

## [PENDING] 2026-05-14 — Iteration 0028: two more transactional email events

**Spec target — owner should update:**
- `~/Documents/Claude/Projects/Setnayan/03_Iterations/0028_email_notifications/0028_email_notifications.md` — extend the event-wired table from 7 to 9 entries.

**New events:**

| Type | Trigger | Recipient | Title | relatedUrl |
|---|---|---|---|---|
| `help_ticket_replied` | Admin saves a substantive `admin_notes` reply on `/admin/help` (content changed, non-empty) | Signed-in help-ticket owner (anonymous submitters have `user_id` NULL and are skipped) | "Setnayan replied to your help ticket" | `/help` |
| `vendor_inquiry_received` | Couple sends the FIRST message in a chat thread (message count was zero pre-insert) | Vendor user attached to the thread's `vendor_profile_id` | "New booking inquiry from <event display name>" | `/vendor-dashboard/messages/<threadId>` |

**Email path:** Both fire through the existing `emitNotification` helper — in-app notification row + Resend transactional email (subject = title, body = title + first-200-chars of source + Open-Setnayan link). The fire-and-forget pattern is preserved; failures never roll back the primary write.

**DB migration:** `supabase/migrations/20260514010000_notification_type_additions.sql` adds the two new enum values via `ALTER TYPE … ADD VALUE IF NOT EXISTS`. The migration also lazily adds `rsvp_received` — that value was being emitted by `apps/web/app/[slug]/actions.ts` since the RSVP feature shipped but had never been added to the DB enum, so the inserts were failing silently inside `emitNotification`'s try/catch.

---

## [PENDING] 2026-05-14 — Iteration 0036: Event-Day Pre-Load (couple + vendor)

**Spec target — owner should create:** new iteration folder
`~/Documents/Claude/Projects/Setnayan/03_Iterations/0036_event_day_preload/` with
the standard five files (`0036_event_day_preload.md`, `.html`, `.docx`,
`tests.md`, `fixtures.json`). Sits alongside the caching-strategy entry below —
the caching foundation is the platform infra, 0036 is the first feature on top
of it.

**Scope to capture (Locked 2026-05-14):**

> **Goal.** Day-of resilience for both couple and vendor against bad venue WiFi.
> Proactively pre-load the full event bundle into the client cache so every
> screen serves from local storage and revalidates in the background.
>
> **Visibility window — couple.** "Prepare for event day" banner CTA visible
> T-3 days through T+1 day on the dashboard home. Auto-preload (silent, no UI)
> fires inside T-24h to T+12h, deduped to once per 60 minutes via localStorage.
>
> **Visibility window — vendor.** Same T-3 / T+1 visibility window, per chat
> thread the vendor has with an upcoming event. One CTA card per upcoming
> event on the vendor dashboard.
>
> **Couple bundle contents (under TanStack-Query keys).** Event meta · guest
> list with RSVP + role + table assignment · tables + seat assignments ·
> schedule blocks · vendors · budget snapshot (line items + payments) · mood
> board palette · last 50 messages per open chat thread · asset URLs handed
> to the SW for cache warm-up.
>
> **Vendor bundle contents.** Their service slot in the schedule · masked
> couple contact (event display name + date) · last 50 messages with the
> couple.
>
> **Service worker contract.** Page posts `{ type: 'PRELOAD_ASSETS', urls: [...] }`
> to the active SW. SW fetches each URL with `mode: 'no-cors'` and stashes the
> response in the shell cache. Unknown message types are silently ignored.
>
> **RLS scoping.** No new policies — the existing couple-read + vendor-read
> policies already gate the underlying fetches. The server action runs under
> the user's session.
>
> **Out of scope for V1.** Native iOS/Android offline. Photo gallery archive
> downloads. Pre-load of guest invitation sites (those have their own
> per-guest offline path via the QR token).

**Why this is a spec change:** new feature not currently in any iteration spec. Implementation has landed in the repo (PR `claude/event-day-preload`) and depends on the parallel caching-foundation PR (`claude/caching-foundation`).

**Once the spec is created, tell Claude Code:** "Iteration 0036 spec is locked — sweep the implementation against `tests.md`."

---

## [PENDING] 2026-05-14 — Caching & Offline Strategy (new cross-cutting infra)

**Spec target — owner picks one:**

- **Option A (recommended, lighter):** Add a new section **§ Caching & Offline Strategy** inside the existing platform-foundation spec at `~/Documents/Claude/Projects/Setnayan/02_Specifications/` (whichever file holds the foundation decisions — e.g. `Platform_Foundation.md` or equivalent).
- **Option B (heavier):** Create a new mini-iteration folder `~/Documents/Claude/Projects/Setnayan/03_Iterations/0036_caching_strategy/` with just `0036_caching_strategy.md` + `tests.md`. Skip `.html`, `.docx`, `fixtures.json` since there's no UI prototype.

**Section content to drop in (Locked 2026-05-14):**

> **Goal.** Fast perceived load and tappable-instantly UI on return visits, without consuming user device storage unbounded.
>
> **Storage budget.** **100 MB total per user / per install**, gated by `navigator.storage.estimate()` at startup. If the browser reports < 100 MB headroom, the budget drops to 50% of available. Allocation inside the 100 MB:
> - **~75 MB images** (cover photos, vendor portraits, mood-board thumbnails, save-the-date previews, monograms)
> - **~20 MB JSON/data** (guest lists, vendor profiles, schedule, budget, mood board metadata)
> - **~5 MB headroom**
> - Splits are soft — whichever layer fills first triggers LRU eviction in *that* layer.
>
> **Two-layer architecture.**
> - **Data layer.** TanStack Query + `persistQueryClient` to IndexedDB. Stale-while-revalidate. Per-query TTL. Hard `maxAge` + buster key prevents the persisted blob from growing unbounded across schema changes.
> - **Asset layer.** Service worker (`apps/web/public/sw.js`) extended with route-scoped `CacheExpiration` (`maxEntries`, `maxAgeSeconds`) for images, JS chunks, fonts.
>
> **What MUST be cached.** App shell, JS chunks, fonts, public-read data (events list, guest list, vendor profiles, mood board, schedule, budget, save-the-date assets).
>
> **What MUST NEVER be cached.** Auth tokens, Supabase session, payment intents, BIR receipts, contract files (sensitive), API gateway responses bound to a per-request key, live chat messages (use Supabase realtime, never the cache).
>
> **Cache invalidation discipline.** Every mutation MUST invalidate its query key. Enforced via a thin wrapper around `useMutation` so it's hard to bypass.
>
> **Stale-time defaults** (overridable per query):
> - Hot lists (guests, schedule on day-of): 60 s
> - Warm data (vendor profiles, mood board): 5 min
> - Cold/immutable (BIR receipts metadata, finalized invitation themes): 1 hr
>
> **Eviction policy.** LRU within each layer. Asset layer evicts oldest images first. Data layer evicts queries by `dataUpdatedAt`.
>
> **Out of scope for this section.** Native iOS/Android offline (Phase 2). Photo gallery archive downloads (handled by 0009 photo-delivery via direct R2 + native share, not the PWA cache).

**Why this is a spec change:** New cross-cutting architectural decision touching the platform foundation. Not currently in any iteration spec. Affects how all future iterations think about data freshness and offline behavior.

**Once the spec is updated, tell Claude Code:** "Caching strategy is locked in the spec — proceed with implementation plan." Claude will then write the implementation plan, get your approval, and only then touch code.

---

## [PENDING] 2026-05-14 — RECONCILE: SEO Playbook §11 boost-service vs Iteration 0042 Industry Events & B2B

Two specs landed in the corpus on the same day covering the **same product area** (bridal-fair / wedding-expo organizer onboarding + the surfaces couples and vendors see for those events). They need to be reconciled into a single canonical iteration before any code implementing either ships.

**The two artifacts:**

1. **`02_Specifications/17_SEO_and_AI_Discoverability_Playbook.md` §11** (locked 2026-05-14, 1,142 lines total playbook). Multi-audience extension: vendor-acquisition SEO at `/for-vendors` (this PR ships it), `/fairs/[fair-slug]` page template for boosted bridal fairs, homepage featured-fairs strip (hard cap 3, 60-day window per §11.3.1), Model A (free/barter) + Model B (cash tiers) boost-service pricing framework (§11.7), launch gate at 500 verified vendors AND 10,000 active couple accounts (§11.7.1), `/for-event-creators` as a pre-gate waitlist surface. Three [SPEC CHANGE] flags raised in §11.6 for new iteration `0036_bridal_fair_boost_service` + 0015 amendment + 01_Contracts/.
2. **`0042_industry_events_b2b/0042_industry_events_b2b.md`** (referenced in the prior [PENDING] entry above — drafted 2026-05-14 the same day). B2B layer on top of consumer marketplace: 7 industry event types (bridal_fair, wedding_expo, vendor_networking, industry_conference, certification_workshop, trade_show, setnayan_event), wedding-fair organizers as special vendors with `is_industry_event_organizer = TRUE`, 3 surfaces (public `/industry-events`, vendor `/vendor-dashboard/opportunities`, organizer-side event management), Setnayan-as-organizer option.

**The overlap:** Both specs cover bridal fair organizers as a Setnayan-served audience. Both describe public surfaces where couples and vendors discover fairs. Both propose schema for an industry-event entity. Both reference Themes & Motifs and the GMBF bridal-fair circuit.

**The conflicts to resolve:**

- **Iteration number:** §11.6 proposes new iteration `0036_bridal_fair_boost_service`. The team locked `0042_industry_events_b2b` for what is functionally the same feature. **Pick one number; merge the other's content into it.** Recommendation: keep `0042` (locked first, broader scope including all 7 event types not just bridal fairs).
- **URL routing:** §11 specs `/fairs/[fair-slug]` + `/fairs` index + homepage featured-fairs strip. 0042 specs `/industry-events`. **Pick one URL pattern.** Recommendation: `/industry-events` is more accurate semantically (covers all 7 event types); `/fairs` could be a redirect or alias for SEO.
- **Pricing model:** §11.7 specs Model A (free/barter — major sponsor + free booth + announcements + Setnayan-driven discount codes) AND Model B (cash tiers, ₱3K–₱20K/cycle inverse-listing range). 0042 references "tiered booth packages with premiums 2-5x base fees" from US wedding-expo precedent. **Pick one canonical pricing structure.** Recommendation: keep §11.7's framework (it's more developed and PH-anchored); add to 0042.
- **Launch gate:** §11.7.1 specs hard gate at 500 verified vendors AND 10,000 active couple accounts before boost-service signups open. 0042 doesn't mention a gate. **Decide if the gate applies** (recommended yes — preserves audience-density guarantee for early fair-organizer partners).
- **Capacity cap:** §11.3.1 specs hard cap of 3 concurrent boosted fairs with 60-day featured windows. 0042 doesn't mention concurrency limits. **Decide if cap applies** (recommended yes — it's the supply ceiling that underpins Model B pricing leverage).
- **Audience question §9.1 (in 0042 spec):** still open per the prior [PENDING] above. §11 implicitly answers it (vendor-acquisition surface for vendors looking to be listed; bridal-fair surfaces for fair organizers as B2B service customers). Worth importing the answer.

**Recommended Cowork sequence:**

1. Open both specs side by side.
2. Decide canonical iteration number (recommend 0042).
3. Merge §11 content INTO 0042 — `/industry-events` URL pattern, but keep §11's pricing/gate/capacity/discount-code rules.
4. Update playbook §11.6 + §10 cross-reference to point at 0042 instead of the proposed 0036.
5. Update `02_Specifications/00_Iteration_Connection_Map.md` if needed.
6. Update `Cowork_Pending_Items.md` at the corpus root (which this session created) — Section A item #4 should reference 0042, not the proposed 0036.
7. Resolve 0042 §9 open questions while you're in there.

**Why this is a spec change:** Two specs locked on the same day cover the same product surface. Implementation can't proceed against both. Need one source of truth.

**Once reconciled, tell Claude Code:** "Iteration 0042 absorbs SEO playbook §11 boost-service content; ship per the unified spec." Claude will then plan the implementation against the merged spec.
