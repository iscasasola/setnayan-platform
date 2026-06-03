# Cowork Inbox — Pending Spec Updates

> Worklist of spec-corpus updates the owner needs to apply via Cowork.
>
> **Read this** at the start of any Cowork session. **Action** each `[PENDING]` item by editing the indicated spec file at `~/Documents/Claude/Projects/Setnayan/`. When done, change `[PENDING]` to `[DONE <YYYY-MM-DD>]` (or delete the entry if you'd rather keep the file short).
>
> **Maintained by:** Claude Code sessions append new `[PENDING]` items here whenever a code change has spec impact. This is the single bridge between repo work and the spec corpus — `CHANGELOG.md` is the full history; this file is the active worklist.

---

## [PENDING] 2026-06-03 — Admin console gains one-click "Create demo vendors" (chunked seed · demo tooling)

**Why:** Demo-vendor creation was terminal-only; the owner wanted a one-click button. `/admin/demo-vendors` now has a **Create demo vendors** button that seeds the marketplace category-by-category (chunked) via a new `/api/admin/demo/seed` route, with a progress bar. Non-prod-gated (refuses prod). Demo/testing tooling in the admin console — the 0023 spec should note it alongside Cleanup / Regenerate / Demo-inquiries.

**What landed (code):** refactored `scripts/seed-demo-vendors.ts` to export `seedCategory` + helpers (CLI behavior preserved, entrypoint guarded); new chunked `POST /api/admin/demo/seed` (start + chunk, admin + non-prod gated); Create button + per-category control + progress loop in `demo-vendor-actions.tsx`.

**Spec corpus update (owner via Cowork):** `~/Documents/Claude/Projects/Setnayan/0023_admin_console/` — note the Demo Vendors tooling now includes a one-click chunked **Create** (was CLI-only). Staging-only (prod-refused).

**Not spec-impacting:** the seed-core refactor + chunk protocol are implementation.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — All event types unlocked: all 9 now creatable (0000/0041)

**Why:** Owner directive — *"unlock all events."* Wedding + Debut were the only selectable event types; the other seven (Gender Reveal · Birthday · Celebration · Travel · Corporate · Tournament · Christening) shipped as "Coming soon." Now all nine are creatable. Two code gates flipped (`EVENT_TYPES[].enabled` in event-types.ts + `ALLOWED_TYPES` in create-event/actions.ts); the `public.event_type` enum already had all nine values — no migration.

**Spec corpus updates (owner walks via Cowork):**
1. **Iteration 0000 (event-type roster) + 0041 (multi-event roster)** — the "V1: wedding + debut; rest grow one event_type at a time as Coming soon" note is superseded: **all nine event types are live/creatable.**
2. **CLAUDE.md decision log (corpus root)** — append a 2026-06-03 row: *"Unlock all events — all 9 event_type values flipped live (EVENT_TYPES.enabled + ALLOWED_TYPES); removes the one-at-a-time roadmap gate. Non-wedding planning surfaces remain wedding-tailored until V1.2+."*

**Downstream note (track, not a blocker):** non-wedding events land on the wedding-tailored dashboard/planning experience until per-type surfaces are built — the same rough edge `debut` already has. To re-gate any type, flip its `enabled` back to `false` + drop it from `ALLOWED_TYPES`.

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0000,0041): unlock all event types". No migration.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — All wedding faiths unlocked: Christian / INC / Muslim / Cultural now active (0043/0016)

**Why:** Owner directive — *"unlock all religions first."* The four faiths that shipped as "Coming Soon" in iteration 0043 (gated behind per-region vendor density via `wedding_type_launch_status`) are now **active** everywhere: the onboarding faith chips, both `ALLOWED_CEREMONIES` server constants, the create-event launch-status fallback, and the `wedding_type_launch_status` table (migration `20260803000000`, verified applied to prod). Onboarding has no tradition picker, so Muslim/Cultural commits default `ceremony_sub_type` (`general_muslim` / `other`) to satisfy the DB CHECK `events_sub_type_required_when_muslim_or_cultural`; create-event collects the specific tradition.

**Spec corpus updates (owner walks via Cowork):**
1. **The `wedding_type_launch_status` design (iteration 0043) + any "V1.1 visible faiths: catholic + civil active" note** — superseded: **all six ceremony types are active.** Record that the per-region vendor-density threshold gate is overridden (owner chose a global unlock); a future re-gate would flip rows back to `coming_soon`.
2. **`0016_step_by_step_plan_builder` / the onboarding faith step (`OnboardingFaith`)** — no longer marks four faiths "Coming Soon"; all five chips selectable. Note the onboarding-side default sub-type for Muslim/Cultural (onboarding has no tradition picker; create-event does) — couples refine the exact tradition later from the dashboard.
3. **CLAUDE.md decision log (corpus root)** — append a 2026-06-03 row: *"Unlock all religions — christian/inc/muslim/cultural flipped to active in `wedding_type_launch_status` + the onboarding/create-event hardcoded mirrors; overrides the per-region vendor-density activation gate."*

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0043,0016): unlock all wedding faiths". Migration `20260803000000` (verified applied to prod).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — In-app services nested INTO the Vendors-tab categories (0021)

**Why:** Owner (twice) — "in app services are still not inside the categories." The standalone in-app-services launcher grid in the couple Services tab was retired; Setnayan services now render INSIDE their canonical category rails (✦ Setnayan, float-to-top) per `Digital_Services_Cross_Surface_Map_2026-06-03.md` §2.

**Spec corpus updates (owner walks via Cowork):**
1. **`0021_couple_dashboard_fully_purchased.md`** — the Services tab no longer shows a separate in-app-services launcher. Save-the-Date / Papic / Panood appear inside *Photography & Video*; Patiktok inside *Photobooth*; LED (Pailaw) inside *LED Background*; Animated Monogram under a new *Design › Digital Services* rail — all as ✦ Setnayan supplementary cards floated to the top. Non-category tools (Orders / Playlist / Custom QR / Photo Delivery / Paprint / Indoor Blueprint) move to a compact "Tools & extras" strip above the recap.
2. **`Digital_Services_Cross_Surface_Map_2026-06-03.md`** — mark §2 "Customer · in-app Services tab" as IMPLEMENTED (presentation step). Record the remaining follow-ups: **§3 vendor-model convergence** (source the pre-add list from the first-party Setnayan vendor account's listings + choice-driven pre-add on onboarding category selection, retiring the hardcoded catalog) and **add Pakanta / Pro Website / Live Venue Photo Wall** to the add-ons catalog with valid setup routes so the Digital Services rail carries its full 5-member set (today only the coming-soon Animated Monogram is present).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0021,0006): nest in-app Setnayan services…".
## [PENDING] 2026-06-03 — Event-type picker is now a hero-photo carousel (0000)

**Why:** Owner ask (screenshot): *"change how events look like. we want a carousel but like hero photos. let them scroll all the possible events."* The emoji-tile event-type picker is now a swipeable scroll-snap filmstrip of full-bleed hero photos — shared by the event-switcher add-event sheet AND the full `/dashboard/create-event` page. 9 Recraft hero photos added at `public/event-types/`.

**Spec corpus update (owner walks via Cowork):**
1. **`0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** — the event-type picker / "What kind of event are you planning?" description should change from emoji tiles to the **hero-photo carousel**: horizontal swipe through all event types · live types = colour photo + "Available" badge + tap-to-continue · coming-soon types = grayscale + "Coming soon" + inert. Also update the add-event sheet subtitle to *"Weddings and debuts are live now. Swipe through to see what's on the way — more event types unlock over time."* (the old line promised a notify-on-launch flow that does not exist).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0000): event-type picker → swipeable hero-photo carousel". No migration, no SKU.

**Open follow-up (not built):** a real "notify me when this opens" action on coming-soon cards (the old copy implied it).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Admin deadline table COMPLETE — reminders read it + admin editor (PR 2+3/3)

**Why:** Finishes the 3-PR admin deadline build (owner: "ship this both" / "do both"). The Home recommended-deadline reminders now read `planning_deadlines`; admins edit the deadlines in `/admin/taxonomy`.

**What landed (code):** `lib/upcoming-items.ts` reads `planning_deadlines` (service category rows) with `PLAN_GROUPS.monthsBefore` as fallback. `/admin/taxonomy` gains a "Recommended deadlines" editor (inline offset edit · `updatePlanningDeadline` action · RLS-gated) + a category-level coverage/"missing deadline" flag.

**Spec corpus update (owner walks via Cowork):**
1. **`0023_admin_console/`** — record the `/admin/taxonomy` "Recommended deadlines" editor (admin sets the lock-by deadline per category/document · coverage flag · per-leaf overrides a noted follow-up).
2. **The planning/deadline spec** — the Home reminders' deadline source is now the admin `planning_deadlines` table (code = fallback).

**Noted follow-up (not built):** per-leaf deadline overrides + leaf-level missing-flag (needs the leaf→category map, in code `TAXONOMY_MAP`, not the DB).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

**Why:** Owner directive (mobile screenshot, both icons circled): *"remove these 2 on top nav."* The 🏪 Marketplace link and the 👤﹀ Switch View (role-switch) pill are gone from the customer **top bar** — event-scoped (`[eventId]/layout.tsx`) AND non-event routes (`outer-dashboard-header.tsx`). The desktop **left sidebar** intentionally KEEPS both (owner scope: "non-event top bar", not the desktop sidebar). Nothing orphaned (Marketplace via the home tease-strip / "Browse matched services" / plan cards / sidebar; role-switch via the event-switcher dropdown's "Switch view" rows + sidebar).

**Spec corpus updates (owner walks via Cowork):**
1. **`0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** — the "single-strip top-nav (locked 2026-05-14)" description should drop the Marketplace link + the always-visible Switch View pill from the **top strip**; note both now live only in the desktop sidebar, and role-switch is also in the event-switcher dropdown.
2. **`0021_couple_dashboard_fully_purchased/0021_*.md`** — update the couple-dashboard chrome/top-bar description to match: top bar = event-switcher monogram · Messages · Bell · Profile-monogram (no Marketplace, no Switch View pill).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "chore(0000,0021): remove Marketplace (Store) + Switch View…". No migration, no SKU.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Admin song dedup tool + compatibility build COMPLETE (0023/0006)

**Why:** PR 6 (final) — an admin surface to merge near-duplicate master songs + remove junk, keeping the compatibility overlap clean. The whole compatibility build (PRs 1–6) is now shipped.

**Spec corpus updates (owner walks via Cowork):**
1. **`0023_admin_console.md`** — add the **Songs** surface (`/admin/songs`, nav by Taxonomy): search the master catalogue, merge duplicates (re-points vendor repertoires + couple picks, deletes the dup), remove junk.
2. **`Vendor_Compatibility_and_Master_Songlist_2026-06-03.md`** — mark the build COMPLETE (PRs 1–6): foundation+seed · vendor "Your repertoire" · couple picks → event_song_picks · the overlap score+cue on the music cards · the admin dedup tool. **Open refinements** (noted in the PR 4 item): explicit Best/Next-best section-headers, the marketplace + Category-Search cue, and the **catering food-look** parallel (the catering twin of this whole subsystem).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0023,0006): admin song dedup…". Needs migration `20260731000000` pushed.

---

## [PENDING] 2026-06-03 — Admin deadline table: schema landed (PR 1/3 of the per-leaf deadline build)

**Why:** Step 1 of making the recommended-deadline reminders admin-editable (owner: "ship this both"). The `planning_deadlines` table + seed now exist; the admin UI + read-path follow.

**What landed (code):** migration `20260802000000_planning_deadlines.sql` — the unified deadline table (`kind`/`ref_key`/`scope`/`offset_value`+`offset_unit`/`applies_to`/`is_active`), admin-write + authenticated-read RLS, seeded with 26 service category defaults (from `PLAN_GROUPS.monthsBefore`) + 3 statutory documents.

**Owner action:** push migration `20260802000000_planning_deadlines.sql` (`supabase db push`).

**Spec corpus update (owner walks via Cowork):**
1. **`~/Documents/Claude/Projects/Setnayan/0023_admin_console/`** + the planning/deadline spec — record the admin-managed `planning_deadlines` table: per-category defaults + per-leaf overrides via **inheritance-with-override**, a **"missing deadline" flag**, distinct from the vendor delivery plan. Reminders read from it (PR 3); admin edits in `/admin/taxonomy` (PR 2).

**Still to build:** PR 2 (`/admin/taxonomy` deadline column + missing-flag + edit) · PR 3 (wire `lib/upcoming-items.ts` to read the table, code stays as fallback).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Music compatibility score shipped (0006/0016)

**Why:** PR 4 of the compatibility build — music vendors are ranked by song overlap with the couple's picks + cards show the match. The "≥90% Best / <90% Next-best" intent is realized via re-rank + label.

**Spec corpus updates (owner walks via Cowork):**
1. **`Vendor_Compatibility_and_Master_Songlist_2026-06-03.md`** — note the score SHIPPED on the wizard music cards: `fetchWizardVendorRecommendations` re-ranks music vendors by overlap (float-to-top, never-exclude) + the per-card "Best match · plays N of M songs" cue. Optional `matchEventId` + optional fields. **Refinements still open:** explicit Best/Next-best section-headers (vs the current re-rank+label realization), and extending the cue to the `/vendors` marketplace + the Category Search overlay (those surfaces don't go through the recommender → need separate wiring).
2. **`0006` / `0016`** — record the music matching is live end-to-end (PRs 1–4).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0006,0016): music compatibility score…". Needs migration `20260731000000` pushed.

---

## [PENDING] 2026-06-03 — "Planning reminders" on/off toggle SHIPPED (0025 Settings)

**Why:** The free recommended-deadline reminders ship on by default; couples can now turn them off in Settings (the quiet opt-out, no fork). New `users.reminders_enabled` column + a Settings toggle that gates the Home `recommended_deadline` source.

**Owner action:** push migration `20260801000000_users_reminders_enabled.sql` (`supabase db push`) so the column exists.

**Spec corpus update (owner walks via Cowork):**
1. **`~/Documents/Claude/Projects/Setnayan/0025_profile_settings/`** — record the "Planning reminders: on/off" toggle (default on · `users.reminders_enabled` · gates the Home recommended-deadline reminders). Completes the toggle follow-up flagged on the recommended-deadline reminders item.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Free recommended-deadline vendor reminders now SHIP (Today's Focus replacement)

**Why:** The retired Today's Focus wizard's "recommended deadline to book each vendor" job is now delivered free in the Home "Upcoming" stream — full vendor set, on by default, no fork/paywall (owner-confirmed model). Code is live; the planning spec should record the concrete behavior.

**What landed (code):** new `recommended_deadline` source in `lib/upcoming-items.ts` — for each plan-group category the couple hasn't LOCKED a vendor in, a reminder dated `wedding_date − monthsBefore` (the recommended LOCK-BY deadline), reusing the owner-authored `PLAN_GROUPS.monthsBefore`. Forward-looking, capped at 5, rendered with a CalendarClock/violet style.

**Spec corpus update (owner walks via Cowork):**
1. **`~/Documents/Claude/Projects/Setnayan/0016_step_by_step_plan_builder/`** (and/or the planning/deadline spec) — record that the free per-service recommended-deadline reminders ship in the Home deadline-timeline surface, sourced from `PLAN_GROUPS.monthsBefore` (the lock-by deadline), shown only for not-yet-booked categories.

**Follow-ups (designed 2026-06-03, owner: "ship this both" — building):**
- **Admin-managed per-leaf deadline table** — a unified `planning_deadlines` table (`kind` = service / milestone / document · `ref_key` = canonical_service leaf / milestone / document key · `offset_days` · optional `applies_to`), managed in `/admin/taxonomy`, **inheritance-with-override**, with a **"missing deadline" flag** on leaves lacking one. Reminders read from it once it lands; code `PLAN_GROUPS.monthsBefore` = seed + fallback. Couple's *lock-by* deadline — distinct from the vendor's *delivery plan* (Service Schedule). Spec: extend 0023 (admin) + the planning/deadline spec.
- **Settings "Planning reminders: on/off" toggle** (`users.reminders_enabled`, default TRUE) — couple opt-out; the `recommended_deadline` source skips when off.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Onboarding writes couple song picks to event_song_picks (0016)

**Why:** PR 3 of the compatibility build — the couple's onboarding music picks now persist to `event_song_picks` (the match-read source), not just the display-only `music_playlist_seed`.

**Spec corpus updates (owner walks via Cowork):**
1. **`0016_step_by_step_plan_builder.md`** (or the Onboarding Blueprint music-picker step) — note that the picker now writes `event_song_picks` (couple ↔ master songs) at commit, in addition to `music_playlist_seed`. This is the couple side of the music compatibility overlap (`Vendor_Compatibility_and_Master_Songlist_2026-06-03`).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0016,0006): couple onboarding music picks → event_song_picks". Pairs with PR 2 (vendor repertoire). Needs migration `20260731000000` pushed to function.

---

## [PENDING] 2026-06-03 — Vendor "Your repertoire" surface added (0022 spec)

**Why:** PR 2 of the compatibility build landed a new vendor-dashboard surface — music vendors build their song set list (the vendor side of the master-songlist compatibility overlap).

**Spec corpus updates (owner walks via Cowork):**
1. **`0022_vendor_dashboard.md`** — add the **"Your repertoire"** surface (`/vendor-dashboard/repertoire`, Pipeline nav): music acts (band/choir/orchestra/singer/DJ) search the master song catalogue + add existing/new songs + manage their set list. Gated to music vendors. Part of the compatibility model (`Vendor_Compatibility_and_Master_Songlist_2026-06-03`).
2. Note the open follow-up: **nav-level hiding** for non-music vendors (the page currently gates with an explainer; the sidebar shows the item to all because the vendor layout doesn't pass `services` to the sidebar).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0022,0006): vendor 'Your repertoire'…". Builds on the master-songlist foundation migration `20260731000000`.

---

## [PENDING] 2026-06-03 — Monogram chrome UPGRADED to the full framed onboarding look (supersedes "letters-forward")

**Why:** Follow-up PR to the monogram → switcher work. The owner chose the FULL framed monogram + exact fonts + the avatar-as-event-logo, superseding the "letters-forward" framing from the prior monogram COWORK item.

**Spec corpus updates (owner walks via Cowork):**
1. **`0000_app_shell_and_navigation.md`** § Monogram (left) — the chrome monogram now renders the **actual framed onboarding monogram** (gold frame webp + initials in the chosen font + ink, scaled down), NOT letters-forward. Real columns `events.monogram_frame_key` + `events.monogram_font_key` (not `monogram_svg`). The exact display faces are loaded in the dashboard chrome.
2. **`0021_couple_dashboard_fully_purchased.md`** §2.0c — the upper-right profile avatar is now the **event's logo** = the couple's framed monogram (owner "that will be the logo of the event"), replacing the initials / face-photo default when an onboarding monogram exists.
3. **`DECISION_LOG.md`** — record the upgrade (framed + exact fonts + avatar = logo), superseding the prior letters-forward note.

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0000): chrome monogram = the full framed onboarding monogram…". Supersedes the "letters-forward" part of the prior `[PENDING]` monogram item (its column-name correction still stands).

---

## [PENDING] 2026-06-03 — Commit the vendor-compatibility design lock in the corpus

**Why:** The compatibility build started (code PR 1 = the master-song-list foundation migration). Its design lock was authored directly in the corpus this session but is **uncommitted** (co-mingled with other in-progress Cowork work):
- NEW `Vendor_Compatibility_and_Master_Songlist_2026-06-03.md` (+ `.docx`) — the full design (master song list compiled from vendor submissions · compatibility score 0–100% · 90% "next best options" · never-exclude · card cue replaces fabricated social-proof · build sequence · owner-tunable knobs: threshold 90% / weights 60-30-10).
- A `DECISION_LOG.md` row ("🎵🎯 Vendor compatibility scoring + master song list — DESIGN-LOCKED").

**Action:** commit these in the corpus (your next Cowork batch). No spec CONTENT change needed — they're written; this is just the commit. Extends `Vendor_Match_Personalization_2026-06-01.md` (makes Layer B numeric).

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0006/0044): master song list … compatibility foundation (PR 1)".

---

## [PENDING] 2026-06-03 — Today's Focus wizard surface RETIRED (onboarding + deadline timeline supersede it)

**Why:** Owner confirmed the 9-card/65-card Today's Focus planning wizard is no longer the model. Couples are guided by onboarding (upfront scoping) + the per-service deadline timeline (counted back from the wedding date, `lib/upcoming-items.ts`). The paid SKU was already off (`CONCIERGE_ENABLED=false`). Code retired the couple-facing surface; the deadline logic is preserved.

**What landed (code):** `/today` now redirects to event-home; the `'today'` nav group is removed (Home preserved, moved to the top of `Plan`); `/today` references cleaned from the bottom-nav match + `/more` grid + sidebar docs. The wizard components + dormant Concierge DB/admin/SKU infra are left on disk (not yet torn down). The Filipino-wedding statutory deadlines (Pre-Cana / marriage-license / PSA-CENOMAR) are untouched — they live in `lib/upcoming-items.ts`, independent of the wizard.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** — append a dated row:
   `| 2026-06-03 | Today's Focus wizard SURFACE retired — /today redirects to event-home, nav entry removed (Home kept, moved into Plan). Superseded by onboarding (scoping) + the per-service deadline timeline (lib/upcoming-items.ts, counted back from wedding date). Filipino-wedding statutory deadlines PRESERVED there. Paid SKU was already off (CONCIERGE_ENABLED=false). Dormant infra teardown (concierge_* columns, admin abuse queue, TODAYS_FOCUS catalog SKU, wizard sequences) deliberately deferred to a later schema-cleanup pass. | apps/web/app/dashboard/[eventId]/today/page.tsx + customer-nav-config.ts |`

2. **`~/Documents/Claude/Projects/Setnayan/0016_step_by_step_plan_builder/`** — record that the couple-facing wizard surface is retired in code (route redirects, nav entry gone); the iteration's deadline logic survives in the deadline-timeline surface. The Concierge/Today's Focus SKU + trial/abuse machinery remain on disk but dormant.

**✅ RESOLVED 2026-06-03 (owner: "we keep it free"):** Today's Focus is **free** — `today_focus` pulled from onboarding's bundle maps (`onboarding-shell.tsx`: label / benefit / group / `essential` tier / `SVC`). The Essential Bundle realigns to the owner's original 2026-06-01 spec (Advanced Website + Papic for guests + Same-Day Edit, 3 items); the savings counter recomputes automatically. **No bundle-spec change needed** (code now matches spec). The free deadline + "start-looking" reminder feature is the next build.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Admin console gains a demo-vendor inquiry responder (demo-testing tool)

**Why:** To test the customer↔vendor inquiry round-trip with demo vendors (which are unclaimed, so no real vendor account receives the messages), the admin console gained a responder surface. It's demo/testing tooling that lives in the admin console, so the 0023 admin spec + the 0019 communications spec should note it.

**What landed (code):**
1. **`/admin/demo-vendors/inquiries`** (+ `/[threadId]`) — lists inquiry threads addressed to `is_demo=TRUE` vendors and lets an admin **Accept / Decline / reply as the vendor**, via the service-role client (chat tables have no admin RLS policy). Double-gated: admin-only + demo-only. Replies post as `sender_role='vendor'`; Accept fires the existing name-reveal trigger.
2. **Unique demo contact emails** — `scripts/seed-demo-vendors.ts` now sets `contact_email = {slug}@demo.setnayan.local` (was a single shared address that broke the couple's thread-start lookup).

**Spec corpus updates (owner walks via Cowork):**
1. `~/Documents/Claude/Projects/Setnayan/0023_admin_console/` — note the demo-only "Demo inquiries" responder under the Demo Vendors tooling (admin replies to demo-vendor inquiries as the vendor; service-role; never touches real vendors).
2. `~/Documents/Claude/Projects/Setnayan/0019_communications/` — note that demo-vendor inquiry threads are handled by the admin responder (unclaimed demo vendors have no owning user to receive them).

**Not spec-impacting:** the unique-email seed change is demo data.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Correct monogram→switcher spec to real column names (binding now SHIPPED)

**Why:** The onboarding free-monogram → event-switcher icon binding is now LIVE in code (the couple's chosen font + ink renders as their switcher icon). Two corrections to the corpus rows written earlier today:

1. **Column names.** The 2026-06-03 corpus `DECISION_LOG.md` row ("🪙🔀 Onboarding free auto-monogram IS the couple's switcher icon") + `0000_app_shell_and_navigation.md` § Monogram (left) + `Onboarding_Blueprint_2026-05-30.md` screen-5 all name the persisted field **`events.monogram_svg`**. The ACTUAL schema is **`events.monogram_frame_key` + `events.monogram_font_key`** (migration `20260719000000_onboarding_v2_event_columns.sql`) — there is no `monogram_svg` column. Replace `events.monogram_svg` with the two real columns in all three places.
2. **Status.** Those rows framed onboarding as "prototype HTML / V1.x build task." Onboarding is LIVE (`app/onboarding/wedding`, 2570-line flow) and the switcher binding is **shipped 2026-06-03**. Update "build target" → "shipped."

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** — the "🪙🔀 Onboarding free auto-monogram IS the couple's switcher icon" row: `events.monogram_svg` → `events.monogram_frame_key` + `events.monogram_font_key`; note SHIPPED, rendered letters-forward (initials in chosen font + ink) at icon size, ornate frame deferred (illegible at ~28px).
2. **`~/Documents/Claude/Projects/Setnayan/0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** § Monogram (left) — same column rename; the auto-generated icon = the onboarding free monogram, rendered letters-forward.
3. **`~/Documents/Claude/Projects/Setnayan/Onboarding_Blueprint_2026-05-30.md`** screen-5 — same column rename.

**Open product fork (for owner):** the switcher shows initials-in-font+ink, not the gold frame at icon size — confirm, or request the framed mini-monogram as a fast follow.

**Cross-ref:** `CHANGELOG.md` 2026-06-03 "feat(0000): onboarding free monogram → event-switcher icon".

---

## [PENDING] 2026-06-03 — Customer mobile /more de-duped (bottom-nav tabs removed from the overflow grid)

**Why:** "Less stressful" pass on the customer dashboard. The mobile `/more` overflow grid was re-listing the four permanent bottom-nav tabs (Home · Guests · Services · Website) as cards. They're now filtered out so `/more` shows true overflow only; **Today's Focus is kept** (it's the sole mobile entry to `/today` — event-home no longer links it since `WizardHero` moved out 2026-05-24). The desktop sidebar is unchanged (still shows every surface). Small nav-presentation refinement, worth a decision-log row for continuity with the other 2026-06-02/03 customer-nav rows.

**Spec corpus update (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** — append a dated row:
   `| 2026-06-03 | Customer mobile /more grid de-duped — the 4 bottom-nav tabs (Home·Guests·Services·Website) no longer repeat as cards; Today's Focus retained as the only mobile entry to /today; desktop sidebar unchanged. Copy polish: added find-date description, dropped dead orders/receipts keys, de-jargoned profile/add-ons/disputes cards. | apps/web/app/dashboard/[eventId]/more/page.tsx |`

**Not spec-impacting (no action):** the copy/jargon polish + dead-key removal are presentation-only.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Public vendor profile now renders a per-category Details section + Portfolio gallery

**Why:** Owner asked that the admin Demo Vendors seed make synthetic vendors *"provide the details and customization for each of the categories."* Implementing that surfaced that the iteration-0044 per-category attribute payloads (`vendor_service_attributes.attribute_payload`) had **no public render** at all — they only powered (future) filters/compare. To make the details visible, the public vendor profile gained two new sections. This is a small user-facing addition to the live `/v/[slug]` surface, so the specs should record it.

**What landed (code):**

1. **`/v/[slug]` Details section.** For each canonical_service the vendor offers, the profile now lists the filled per-category attributes (label → value facts; true booleans rendered as capability chips). Pricing-signal keys (`starting_price_centavos`, `price_model`, etc.) are intentionally omitted as redundant with the Packages section + the marketplace price filter.
2. **`/v/[slug]` Portfolio gallery.** Renders `vendor_profiles.portfolio_r2_keys` (resolved through the existing `displayUrlForStoredAsset` R2/legacy-URL resolver). Both fetches are best-effort and degrade to empty if the table/column is absent.
3. **Demo-data tooling (non-spec, dev/staging only).** `scripts/seed-demo-vendors.ts` now fills realistic schema-valid per-category attribute payloads + richer packages + picsum logo/portfolio images; `vendor-card.tsx`'s image guard allows the (already-whitelisted) picsum host so demo logos render on cards. These are simulation tooling, not product spec.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0044_*` (per-category schemas iteration — locate the folder/doc)** — note that a vendor's filled per-category attributes now surface publicly on `/v/[slug]` in a **Details** section (label → value + capability chips), not only in marketplace filters/compare.
2. **`~/Documents/Claude/Projects/Setnayan/0022_vendor_dashboard/0022_vendor_dashboard.md`** — record that the public vendor profile renders a **Portfolio** gallery from the vendor's uploaded portfolio images + the per-category **Details** section described above.

**Not spec-impacting (no action):** the demo-vendor seed enrichment + the picsum card-guard allowance are dev/staging simulation tooling.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Preparation items can now be TYPED (meeting + payment schedules)

**Why:** Owner follow-up to PR #845. #845 let couples + booked vendors place **generic** dated tasks on the couple's `/schedule` **Preparation** agenda. The owner asked that those items be able to be **typed** — **meeting schedules** and **payment schedules**, not only tasks. This extends the hybrid Preparation surface; it does not change the four autofill sources.

**What landed (code):**

1. **Typed items, couple + vendor.** Both the couple's "+ Add to schedule" modal and the vendor's "Add to prep schedule" modal (on each accepted booking in `/vendor-dashboard/bookings`) gain a **Task / Meeting / Payment** picker. **Meeting** items show on the agenda with the same Meeting tag/icon as the autofilled vendor meetings; **Payment** items show with the same Payment tag/icon **plus a ₱ amount** (amount required, validated > 0); **Task** items are unchanged from #845. A vendor's own added items list shows the type glyph + amount inline.
2. **Schema reason (record this — it's a deliberate design constraint).** Typed items are stored on `event_preparation_items` (the #845 table), **NOT** on `event_vendor_line_items` (budget) or `vendor_meetings`. Those two tables key to the couple's **TEXT-named** `event_vendors.vendor_id`, not the platform `vendor_profile_id`, so a platform vendor can't be RLS-scoped to write them. `event_preparation_items` already has the correct `vendor_profile_id` RLS.
3. **Limitation (record this).** A payment placed on the Preparation schedule is a **planning reminder only** — it does **NOT** post to the couple's **Budget ledger** (iteration 0007 `event_vendor_line_items` / `event_vendor_payments`). Surfacing prep-payments in the budget (or vice-versa) is a possible future enhancement.

**NEW migration — `20260730000000_event_preparation_item_kinds.sql` (owner must push):** additive `ALTER TABLE event_preparation_items ADD COLUMN kind VARCHAR(16) DEFAULT 'task' CHECK (kind IN ('task','meeting','payment'))` + `amount_php NUMERIC(12,2) CHECK (amount_php IS NULL OR amount_php >= 0)`. **No RLS change** (the #845 row policies already cover the new columns). The app **graceful-degrades** until it's applied: existing rows read as plain tasks (`SELECT *` + `kind ?? 'task'` / `amount_php ?? null`), and the whole manual source still returns empty if the #845 table itself isn't pushed.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — update the Schedule → Preparation surface: hand-added prep items can now be **typed** (Task / Meeting / Payment). Document that a couple-added Meeting renders like an autofilled vendor meeting and a couple-added Payment renders like an autofilled payment (with a ₱ amount).
2. **`~/Documents/Claude/Projects/Setnayan/0022_vendor_dashboard/0022_vendor_dashboard.md`** — record that a booked vendor (accepted chat thread) can place a **meeting** or **payment** schedule (not just a generic task) on the couple's Preparation schedule from their Bookings view, including the required amount on payments.
3. **`~/Documents/Claude/Projects/Setnayan/0007_budget_expenses/0007_budget_expenses.md`** — add a note: a payment placed on the Preparation schedule (0021) is a **planning reminder only** and does NOT appear in the Budget ledger; the two surfaces are not yet linked. Flag the link-up as a possible future enhancement.

**Cross-ref:** supersedes nothing in the #845 entry below — it's strictly additive on top of it. See `CHANGELOG.md` 2026-06-03 "typed Preparation items" for the full file list + verification.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Onboarding congrats vendor stat is now REAL marketplace counts (not "best-fit vendors from 2,400+")

**Why:** The `/onboarding/wedding` congrats screen's third stat tile previously showed a fabricated **"N best-fit vendors from 2,400+"** (`N` = picked-categories × 5, floored at 12; "2,400+" hardcoded). Owner 2026-06-03: *"30 vendors and total 2400+ vendors is not actual results. want true results only."* Code now renders REAL `vendor_market_stats` head-counts — **"{matched} that fit your wedding · from {total}"** — using the same published-pool + compatibility definition as the `/vendors` marketplace, and **auto-hides** the tile when no real count can be computed. The money + hours tiles are unchanged.

**What landed (code):** new server action `getOnboardingVendorCounts`; tile rewritten to real counts with auto-hide; fabricated `VENDORS_PER_CATEGORY` + `vendors` savings field removed (`apps/web/app/onboarding/wedding/{actions.ts, _components/onboarding-shell.tsx}`). No migration.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/Onboarding_Wedding_Flow_2026-06-01.html`** (line ~949) — the congrats stat tile reads `best-fit vendors from 2,400+` with a hardcoded `data-count="48"`. Update the prototype copy + behavior to the shipped version: **"{matched} that fit your wedding · from {total}"** sourced from real marketplace counts, and note that it **auto-hides** when uncomputable. Drop the fabricated "2,400+" platform string from this tile.
2. **`~/Documents/Claude/Projects/Setnayan/Time_and_Money_Saved_Model_2026-06-01.md`** — the "filtered N vendors for you" display wow-stat (row 1) and the "2,400-vendor pool" references should clarify that the **onboarding congrats vendor tile now uses real `vendor_market_stats` counts** (matched / total), not a per-category multiplier or the platform-pool figure. The money + hours model is untouched.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Drive surface is cron-free (0009 release + token refresh)

**Why:** Both Drive-surface crons were dormant (no scheduler wired). Capture auto-sync (Phase 2) + the "Release to Drive" action now drain via Next 15 `after()`; OAuth tokens refresh on-demand. No crons.

**Spec updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0009_photo_delivery/0009_photo_delivery.md`** — replace any "Cloudflare Queue worker / external cron runner / photo-delivery-tick" copy-mechanism language with: the release + capture auto-sync copy to Drive via Next 15 `after()` background tasks (no cron); access tokens refresh on-demand in the consumers.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Schedule Preparation is now HYBRID (couple + booked-vendor manual items)

**Why:** The manual-prep-items fast-follow that the #840 [PENDING] (below) called out as DEFERRED has now landed in code — **and** a vendor-add path was added on top. The couple's `/schedule` **Preparation** agenda is no longer read-only: it is **hybrid**. This supersedes the "manual prep items — DEFERRED" bullet in the #840 entry below (that bullet's predicted `event_preparation_items` table is exactly what shipped, except host-scope uses the canonical `current_couple_event_ids()` helper rather than `event_moderators`).

**What landed (code):**

1. **Couple can add + delete prep items.** A "+ Add to schedule" control on the Preparation agenda (and in its empty state) opens a small modal (label / date / optional notes) → inserts a `couple_manual` row. Couples can delete any `event_preparation_items` row on their own event — including dismissing vendor-added ones. (Autofill rows stay read-only, edited on their own surface as before.)
2. **Booked vendors can add items to the couple's prep schedule.** On `/vendor-dashboard/bookings`, each **accepted** booking shows an "Add to prep schedule" control + the list of items that vendor has added (each with delete). Inserts a `vendor_prep` row stamped with the vendor's `vendor_profile_id`. Vendors can only add to bookings whose chat thread is `accepted`, and can only edit/delete their own rows.

**NEW table — `event_preparation_items`** (migration `20260729000000_event_preparation_items.sql`, **owner must push**): `item_id`, `event_id`→`events`, nullable `vendor_profile_id`→`vendor_profiles` (NULL = couple-added), `due_date`, `label` (1–200), `notes`, `source_tag` (`couple_manual` | `vendor_prep`), `created_by`→`users`, timestamps. **RLS:** couple full CRUD via `current_couple_event_ids()`; vendor SELECT on accepted-thread events, INSERT only for accepted threads (own `vendor_profile_id`), UPDATE/DELETE own rows only via `current_vendor_ids()`. The aggregator graceful-degrades (autofill-only) until the migration is pushed.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — update the Schedule surface: Preparation is now **hybrid** (read-only autofill + couple-added items + booked-vendor-added items), not read-only. Document the couple add/delete flow and that couples can dismiss vendor-added items.
2. **`~/Documents/Claude/Projects/Setnayan/0022_vendor_dashboard/0022_vendor_dashboard.md`** (+ `0006`) — record that a **booked vendor** (accepted chat thread) can add dated items to the couple's Preparation schedule from their Bookings view, and manage (delete) their own additions. Note the accepted-thread gate.
3. **`0007` (budget) + `0016` (Concierge)** — keep the existing cross-ref note from the #840 entry; the four autofill sources are unchanged. Optionally note the new `event_preparation_items` table as the home for hand-entered dated steps that those surfaces don't own.

**Cross-ref:** corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED" (2026-06-03). This is the hybrid completion of the Preparation surface the owner asked for after delta #3.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]` (and you may flip/strike the "manual prep items — DEFERRED" bullet in the #840 entry below, since it's now shipped).

---

## [PENDING] 2026-06-03 — Drive-copy Phase 2: Papic auto-sync (cron-free)

**Why:** Papic captures now auto-sync to the couple's Google Drive — cron-free, via Next 15 `after()` (background copy in the capture request). The 5 other artifact feeders await their services' render/generation pipelines.

**Spec updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0012_paparazzi/0012_papic.md`** + pax-pricing docs — note Papic photos **auto-sync** to the couple's Drive on capture (background `after()` copy, no cron); the manual "Release to Drive" remains as a backfill and dedups against auto-synced photos.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Messages icon unread badge + chat read-state (delta #2 follow-up)

**Why:** The Messages icon shipped icon-only in PR #837 (chrome-redesign delta #2). This PR adds the unread badge — which required giving chat a read-state it never had. A new per-user/per-thread read marker (`chat_thread_reads`) + an unread-thread count function (`count_unread_message_threads()`) land via additive migration `20260728000000_chat_thread_reads.sql` (RLS-at-create; **owner-push**). The badge mirrors the bell and graceful-degrades to 0 until the migration is applied.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0019_communications/0019_communications.md`** — chat now has a **per-user/per-thread read marker** `chat_thread_reads (thread_id, user_id, last_read_at, PK(thread_id,user_id))` (RLS: a user manages only their own rows) and a `count_unread_message_threads()` RPC (SECURITY DEFINER) returning the count of threads with a message from someone else newer than the viewer's `last_read_at`. A thread is marked read (`last_read_at = now()`) when the user opens it (both the couple and vendor thread pages). This is the first slice of the "Read receipts / read state" item the 0019 spec previously listed as **deferred** — it's a per-thread *last-read marker* (drives the unread badge), **not** per-message receipts or per-message "seen" ticks, which remain deferred.
2. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — the couple top-bar **Messages icon now carries an unread badge** (terracotta dot, `9+` cap), alongside the existing notification bell. Server-rendered initial count + Realtime resync on new messages.

**Implementation note for the spec:** the vendor-side thread scoping in the count function uses the existing `current_vendor_profile_ids()` helper (NOT the `current_vendor_ids()` stub, which returns NULL because `vendor_team_members` is a 0022 concern). No new helper was introduced.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Schedule Preparation⇄Event Day toggle (chrome redesign delta #3)

**Why:** Delta #3 of the 2026-06-03 customer-dashboard chrome redesign landed in code. The couple's `/schedule` page now has a `Preparation | Event Day` toggle. **Event Day** = the existing editable day-of timeline (unchanged). **Preparation** = a NEW read-only, month-grouped agenda that auto-fills from existing dated data — no new table.

**Sources WIRED into the Preparation agenda (real data today):**

1. **Payment** — vendor payment due dates (`event_vendor_line_items.due_date`, fully-paid lines dropped).
2. **Paperwork** — government/parish "complete by" deadlines (`event_paperwork` + `lib/paperwork.ts`).
3. **Meeting** — vendor meetings / tastings / fittings (`vendor_meetings.starts_at`).
4. **Milestone** — statutory windows computed from the wedding date + ceremony type (PSA/CENOMAR −180d, marriage license −120d, Pre-Cana −60d for Catholic).

**Deferred / absent (so the spec records the honest gap):**

- **Manual prep items — DEFERRED (fast-follow).** Letting couples ADD their own dated prep rows (e.g. "book hair & makeup trial") needs a NEW table + write path + RLS — out of scope for this additive, no-migration PR. **This is the documented fast-follow:** when prioritized, add an `event_preparation_items` table (host-scoped RLS via `event_moderators`), a create/edit/delete server action, and merge those rows into `lib/preparation.ts` as a `manual` source. The current Preparation tab is read-only aggregation only.
- **Orders — ABSENT.** The `orders` table has no due-date column; its `expires_at` is subscription-renewal billing (already on Home + Orders), not wedding prep — intentionally omitted.
- **Concierge / Today's Focus — ABSENT.** The 0016 wizard has no per-step dated milestone; only the statutory windows feed Preparation.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — record that the Schedule surface now has a Preparation⇄Event Day toggle; document the four wired Preparation sources, that Preparation is read-only, and that manual prep entry is a deferred fast-follow needing a new table.
2. **Schedule / day-of spec note + iteration `0007` (budget) + `0016` (Concierge)** — cross-ref that vendor payment due dates (0007) and statutory milestones feed the new Preparation agenda, and that Concierge has no per-step dated milestone to surface there.

**Cross-ref:** corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED" (2026-06-03) locks the model; this records the code landing of delta #3 of the 4-delta chrome-redesign port.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — In-app add-ons surfaced inside Services tab (chrome redesign delta #4)

**Why:** Delta #4 of the 2026-06-03 customer-dashboard chrome redesign shipped — the couple's "Services" tab (`/dashboard/[eventId]/vendors`) now includes a compact "In-app services & add-ons" section (mini-card grid, reusing `lib/add-ons-catalog.ts`) below the vendor plan+budget accordion. The canonical `/add-ons` route is unchanged; this is a second entry point only.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0006_vendors_management/0006_vendors_management.md`** — note that the Services tab (Vendors route, renamed in chrome redesign) now also surfaces in-app add-ons as a compact section below the vendor accordion. The full add-ons hub at `/add-ons` remains canonical; the Services tab carries a second entry point.
2. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — record the dual-entry-point pattern: in-app add-ons are accessible both from the dedicated "Add-ons" surface (`/add-ons`) AND from within the "Services" tab (compact grid). Catalog is now in `lib/add-ons-catalog.ts` (shared between both surfaces).

**Cross-ref:** corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED" (2026-06-03) is the design authority. This is the final (delta #4) of the four chrome-redesign PRs.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Drive OAuth consolidated to one per-event connect (Phase 0)

**Why:** Phase 0 collapsed the two Google Drive connections (Papic `provider='drive'` + Photo Delivery `provider='drive_photo_delivery'`) into one. The owner-facing setup + the 0009 spec change as a result.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md`** — Google Drive OAuth now needs **one** redirect URI only (`GOOGLE_DRIVE_OAUTH_REDIRECT_URI` → `…/api/oauth/drive/callback`). **Remove `PHOTO_DELIVERY_OAUTH_REDIRECT_URI`** (retired).
2. **`~/Documents/Claude/Projects/Setnayan/0009_photo_delivery/0009_photo_delivery.md`** — note the OAuth model is now the single shared Drive connection (one consent, one grant `provider='drive'`); disconnecting Drive from either panel disconnects the shared connection.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Messages icon in dashboard top bar (chrome redesign delta #2)

**Why:** Delta #2 of the 2026-06-03 customer-dashboard chrome redesign landed in code — a `MessageSquare` icon link is now in the top bar right cluster (adjacent to the notifications bell), linking to the couple's vendor thread list (`/dashboard/[eventId]/messages`). No unread badge (V1 has no read-tracking column on `chat_messages`).

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — add to the top bar chrome description: a Messages icon (`MessageSquare`, same styling as the bell, aria-label "Messages") sits between the role-switch pill and the notifications bell. Links to the couple's thread list. No unread badge in V1; badge deferred pending a `read_at` migration on `chat_messages`.
2. **`~/Documents/Claude/Projects/Setnayan/0019_communications/0019_communications.md`** — note that the couple can access their thread list from the persistent top bar icon (not only from the sidebar nav item).

**Cross-ref:** corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED" (2026-06-03).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Home: compact "Your wedding details" card (chrome redesign delta #1)

**Why:** Delta #1 of the 2026-06-03 customer-dashboard chrome redesign landed in code — event Home now shows a compact "Your wedding details" card (Location · Venue · Guests · Budget · Style · Cuisine · Photo & video) built from onboarding data, with a "See all wedding settings →" link to `/details`. It reshapes the existing Home "Personalized" block (chips → kv card); `/for-you` keeps the chip view.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — record that Home's onboarding/"Personalized" block now renders as the compact "Your wedding details" kv card (basics + cuisine/photo) with a "See all wedding settings" link to `/details`; the full chip + "what matters" view stays on `/for-you`.

**Cross-ref:** corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED" (2026-06-03) already locks the model; this records the code landing of delta #1 (of 4 — the other deltas: Messages top-bar icon, Schedule Preparation⇄Event Day, Service+Add-ons merge).

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

---

## [PENDING] 2026-06-03 — Site Editor: Website-tab flip (Phase 2) — editor is now the page, journey scroll retired

**Why:** Phase 2 of the flip sequence shipped — tapping "Website" now opens `/site-editor/[eventId]` (mobile + desktop), and the journey route `/dashboard/[eventId]/website` redirects to the editor. The spec corpus needs this recorded so future sessions know the journey scroll is retired and the editor is the canonical Website surface.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** — append a 2026-06-03 row (date order):
   > **🪟 Website-tab flip (Phase ④ of the 2026-06-01 sequence).** The couple "Website" doorway (`customer-nav-config.ts` desktop sidebar + `customer-bottom-nav.tsx` mobile slot 4) now opens the full-screen Reels editor `/site-editor/[eventId]` directly; the journey scroll `/dashboard/[eventId]/website` (PR #704) is **retired → redirects** to the editor (bookmarks / deep-links / animated-monogram back-links / onboarding prefetch all preserved). Editor ✕ → dashboard home (`/dashboard/[eventId]`); Settings "Manage URL"/"Set your URL" + the no-slug preview CTA → the invitation editor (`/dashboard/[eventId]/invitation`, canonical shared `SlugField` + `updateEventSlug`). Now-dead (follow-up cleanup): `website/_components/{journey,pro-upgrade-panel,pro-website-panel,copy-button}.tsx` + `website/actions.ts`. Incidental: fixed `main`'s `tsc` break from PR #827 (unguarded `e.touches[0]` in `guest-list-multiselect.tsx`). Files: `customer-nav-config.ts` · `customer-bottom-nav.tsx` · `site-editor.tsx` · `website/page.tsx` (→ redirect) · `guest-list-multiselect.tsx` (touch null-guard).

2. **`~/Documents/Claude/Projects/Setnayan/0021_couple_dashboard_fully_purchased/0021_couple_dashboard_fully_purchased.md`** — update the Website-tab section: the canonical Website surface is now the full-screen Reels editor (`/site-editor/[eventId]`), reached by tapping the "Website" nav doorway on mobile + desktop; the journey-scroll hub is retired (redirects to the editor). Slug/URL management lives in the invitation editor. Supersedes the Phase-1 card-parity note.

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]` here.

---


## [PENDING] 2026-06-03 — Iteration 0001: couple detail stays simple (editorial = post-wedding /[slug], not embedded)

**Why:** Owner clarification 2026-06-03 — **supersedes** the earlier "embed a live view of their editorial page" direction (it was shipped then reverted in code). Two points: (a) the couple's guest-detail should just show **their information, like any other guest — keep it simple** (no embedded page preview); (b) "editorial" is **the same `/[slug]` page**, which only **activates as the editorial/recap view at the end of the wedding** — i.e., the existing day-of lifecycle's post/recap phase (iteration 0031). Nothing separate to build now.

**Spec corpus updates (owner walks via Cowork):**

1. **`~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/0001_creating_guest_list.md`** — under "Bride & Groom (foundation of the event)": the couple's detail page shows their standard info (like any guest), with role + RSVP locked and no Remove button. There is **no** embedded editorial/page preview on the detail. Note that "editorial page" = the couple's `/[slug]` page in its **post-wedding recap state** (handled by the day-of lifecycle, iteration 0031), which turns on at the end of the wedding.

2. **`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`** (corpus root) — append a 2026-06-03 row: "Couple guest-detail kept simple (info only, like other guests) — the briefly-shipped editorial live-view iframe was reverted. 'Editorial' = the `/[slug]` page's post-wedding recap state (day-of lifecycle, 0031), activates at end of wedding; not a separate surface, not embedded in guest-detail. File: apps/web/app/dashboard/[eventId]/guests/[guestId]/page.tsx."

**When done:** flip `[PENDING]` → `[DONE 2026-06-XX]`.

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
