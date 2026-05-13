# Setnayan — Project Status

> Living checkpoint. Updated as work progresses.

**Last updated:** 2026-05-13
**Current sprint:** Iteration `0019_communications` MVP shipped — couple ↔ vendor 1:1 chat with identity masking. New `chat_threads` (`UNIQUE(event_id, vendor_profile_id)` — one thread per pair), `chat_messages` (append-only with `body` ≤ 4000 chars), and `chat_sender_role` enum. New `current_vendor_profile_ids()` helper. Dual-side RLS: either the couple on the event OR the vendor on the profile can read + insert. Trigger bumps `chat_threads.updated_at` on every new message. Couple side: `/dashboard/[eventId]/messages` (thread list + start-by-vendor-email) + `/dashboard/[eventId]/messages/[threadId]` (message stream + composer). Vendor side: `/vendor-dashboard/messages` (thread list showing the **event display_name + date** — never the couple's email or personal name) + thread detail. Shared `sendChatMessage` action auto-determines `sender_role` from the user's membership. Video meetings (Daily.co), file attachments, Realtime delivery, group chat, and coordinator-join remain deferred.
**Owner's wedding (deadline anchor):** December 2026

---

## Where we are right now

**Sprint 0 closed; iteration 0000 mostly shipped; iteration 0001 MVP slice shipped.** Schema deltas applied to live Supabase. The full couple lifecycle works end-to-end on the deployed app:

1. Sign in → event picker
2. Create-event (Weddings-only) → inside-event shell with 4-tab bottom nav
3. **Guest List tab now has real content** — stats strip, list view, add guest, search, RSVP filter
4. Services launcher grid → placeholder service pages

Deferred from iteration 0000: join flow at `/join/[event-id]`, unified Schedule view (waits on 0006+0007), vendor/admin role-router destinations.

Deferred from iteration 0001 (MVP slice only): detail drawer + edit + delete, plus-one toggle UI (schema ready), CSV import, households UI, custom-tag chips, invited-to schedule-block toggles, address JSONB editor, mobile full-screen sheet, bulk-edit spreadsheet mode.

Next likely sessions: complete iteration 0001 (detail drawer, plus-one UI, CSV import) → iteration 0002 (QR invitation system).

---

## Sprint 0 build — the code (DONE)

| Phase | Description | State |
|---|---|---|
| 1A | Setnayan rename + Next.js 15 base + Tailwind breakpoints + `output: 'standalone'` | ✅ |
| 1B | Canonical schema migration (S89X- generator, 4 RLS helpers, 4 base tables, RLS policies, on_auth_user_created trigger) | ✅ |
| 1C | Auth wiring (email/password + magic-link, no OAuth popups), login/signup pages, `/health` route, internal-flag trigger | ✅ |
| 1D | Tauri 2 desktop scaffold, GitHub Actions (CI + build-desktop + lighthouse), PWA manifest + service worker + icons | ✅ |

49 files committed as `394ded8 — iter(0013): Sprint 0 platform foundation`. `pnpm install`, `pnpm typecheck`, `pnpm lint`, and `pnpm --filter @setnayan/web build` all pass clean.

---

## Sprint 0 provisioning — the live services

| # | Step | State | Where |
|---|---|---|---|
| 1 | GitHub repo + main branch | ✅ | `https://github.com/iscasasola/setnayan-platform` (commit `394ded8`) |
| 2 | Supabase project + canonical schema | ✅ | `https://njrupjnvkjkitfctetvi.supabase.co` · Singapore region · migration `20260512000000` applied |
| 3 | Cloudflare R2 buckets | ✅ | 4 buckets in APAC: `setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples` |
| 4 | Vercel deploy | ✅ | `https://setnayan-platform-web.vercel.app` · Hobby plan · auto-deploy on push to `main` |
| 5 | Owner sign-up + `is_internal=TRUE` confirmed | ✅ | Row `S89U-KEMMF2ADCK` · email admin-confirmed via API |
| 6 | PWA install on phone | ✅ | 1 phone installed and logged in |
| 7 | CI produces `.dmg` + `.msi` artifacts | ✅ | Run `25751565765` — both 1.3 MB, downloadable from Actions tab |

---

## Verification probes that have already passed

- `GET /health` → `200 {"ok": true, "ts": ...}`
- `GET /` → 200 with `<title>Setnayan</title>`
- `GET /login` → 200
- `GET /manifest.json`, `/sw.js`, `/icon-192.svg`, `/icon-512.svg` → all 200
- `users`, `events`, `event_members`, `event_join_tokens` tables → exist, RLS denies anon (`[]` response)
- `supabase migration list` → `20260512000000` confirmed on remote
- `generate_public_id('U')` → produces valid `S89U-[Crockford 10]` IDs
- R2 `ListBuckets` → all 4 buckets present

---

## Sprint 0 acceptance criteria (from kickoff)

### Phase 1A — Infrastructure foundation
- [x] Vercel project connected to `setnayan-platform` GitHub repo
- [x] Supabase project in Singapore region with `auth.users` table
- [x] 4 Cloudflare R2 buckets (PH-aligned `apac` location)
- [x] `.env.example` committed with all expected keys
- [x] Next.js 14+ App Router skeleton with `output: 'standalone'`
- [x] Tailwind with locked breakpoints (sm 640 / md 768 / lg 1024 / xl 1280)
- [x] PWA manifest + service worker scaffolded
- [x] Deploys to Vercel without errors

### Phase 1B — Schema + RLS
- [x] Base Postgres migration creating `users`, `events`, `event_members`, `event_join_tokens` (all with `S89X-` public_id)
- [x] `generate_public_id(type_letter CHAR(1))` Postgres function (Crockford base 32)
- [x] 4 RLS helper functions: `is_admin()`, `current_event_ids()`, `current_vendor_ids(role)`, `current_thread_ids()`
- [x] RLS enabled on all 4 base tables with Pattern A / B policies

### Phase 1C — Auth + first deploy
- [x] Supabase Auth wired for email/password + magic-link (no OAuth popups)
- [x] Login + signup pages built with Tailwind, responsive across 4 viewports
- [x] `/health` route returns 200
- [x] Owner (`iscasasolaii@gmail.com`) signed up via Supabase Auth on deployed URL
- [x] Owner row in `public.users` confirmed with `is_internal = TRUE` (`S89U-KEMMF2ADCK`)

### Phase 1D — Multi-platform "don't go back" insurance
- [x] Tauri 2 scaffold at `src-tauri/`
- [x] GitHub Actions `build-desktop.yml` matrix (macOS + Windows) producing artifacts
- [x] PWA install works on phone (1 device verified, both flows ready)
- [ ] Lighthouse audit ≥ 90 on Perf / A11y / Best / SEO / PWA (will fire on first PR in iteration 0000)
- [x] Four showcase viewports verified in browser dev tools (responsive Tailwind, mobile-first)

---

## What's outstanding RIGHT NOW

Nothing for Sprint 0 — fully closed. Next session: **iteration 0000 (App Shell & Navigation)**.

For future sessions:
- Lighthouse audit will fire on the first PR opened (when iteration 0000 ships its first changes via PR)
- Old `iscasasola/Setnayan-App` repo can be deleted via `gh repo delete iscasasola/Setnayan-App --yes` once you're sure nothing depends on it
- Supabase Auth URL config in the dashboard is still optional but recommended — sets `Site URL` to `https://setnayan-platform-web.vercel.app` so future email flows (password reset, magic link) work cleanly

---

## Known gaps / followups (not blocking Sprint 0)

| Item | Notes |
|---|---|
| Tauri prod URL strategy | `tauri.conf.json` points at `apps/web/out` for `frontendDist` and `localhost:3000` for `devUrl`. Production wrap-around (sidecar Node server vs static export vs deployed URL load) is a Phase 2 polish. The build artifact existing is the Sprint 0 contract. |
| Tauri icons | Only `icon.svg` is committed; CI converts via `tauri icon`. Local dev needs one-time `pnpm add -g @tauri-apps/cli@^2 && tauri icon src-tauri/icons/icon.svg`. |
| `next lint` deprecation | Works for now; Next 16 will require migration to `eslint .` flat config. |
| Observability SDKs | Env vars are placeholders in `.env.example`. Sentry / PostHog / Better Stack wiring is iteration 0035. |
| Local `main` branch in main repo | At `/Users/icecasasola/Setnayan-App`, local `main` still points at old Tayo state. Not blocking; can sync any time with `git fetch origin && git reset --hard origin/main`. |
| Old `iscasasola/Setnayan-App` GitHub repo | Still exists with Tayo history + a copy of Sprint 0. Delete later via `gh repo delete iscasasola/Setnayan-App --yes` once you've confirmed the new repo is everything you need. |
| `pnpm` global PATH | `pnpm setup` appended `PNPM_HOME` to `~/.zshrc` mid-session. New terminal windows will have `pnpm` globals on PATH; existing shells need `source ~/.zshrc`. |

---

## What comes after Sprint 0

Per `CLAUDE_Code_Session_1_Kickoff.md` build order, the next 21 iterations in numeric order:

| # | Iteration | Approx scope |
|---|---|---|
| 1 | `0000_app_shell_and_navigation` | Login → role router · event picker · `/dashboard/[event-id]/[section]` · 4 bottom-nav tabs · services launcher · event join QR |
| 2 | `0001_creating_guest_list` | Guest table · CSV import · role tiers · plus-ones · RSVP state machine · spreadsheet bulk-edit |
| 3 | `0002_qr_invitation_system` | Personal invitation site renderer · branded QR · scan_events table |
| 4 | `0021_couple_dashboard_fully_purchased` | 9 surfaces · 4-theme system (Setnayan Default / Victorian / Classy / iOS) |
| 5 | `0015_main_website` | Public marketing site · Event Palette · luxurious-Filipino-modern voice (EN / TL / CEB) |
| 6 | `0010_mood_board` | Palettes · Setnayan Guide rule engine |
| 7 | `0008_seating_chart_editor` | 13-entry table catalog · free-placed stage · role-tier ring auto-fill · QR on publish |
| 8 | `0006_vendors_management` | 28 canonical service categories · 6-stage readiness tracker · flexible payment milestones · crew meals |
| 9 | `0022_vendor_dashboard` | 6 surfaces · mandatory logo · chat identity masking |
| 10 | `0019_communications` | 1:1 + group chat (Supabase Realtime) · video meetings (Daily.co) · file viewers · coordinator-join · vendor identity masking |
| 11 | `0023_admin_console` | 7 surfaces · two-admin approval queue · 🟣 internal accounts · 🟢 Team Pool widget |
| 12 | `0024_save_the_date` | 30-template gallery · upload 3–8 video clips · render in 3 formats · ₱99 per render |
| 13 | `0007_budget_expenses` | 3-line items per vendor · payment log · `.ics` calendar export |
| 14 | `0025_profile_settings` | 6 tabs · RA 10173 data export + soft/hard delete |
| 15 | `0034_payments_and_cart` | 8-table canonical schema + reconciliation · BDO + GCash QR · 4-tier fuzzy SQL matcher |
| 16 | `0012_papic` | Web-only Papic capture · gesture shutter via touch · MediaPipe-WASM face detection · QR tagging · R2 upload |
| 17 | `0011_panood` | Cloudflare Stream Live SFU · YouTube RTMP relay · web broadcaster + camera operator · AI Highlights + SDE |
| 18 | `0017_patiktok` | Web kiosk booth · TikTok audio · ₱2,499/booth/5hr |
| 19 | `0005_led_background_maker` | 8K template render pipeline · Photo Pool blend |
| 20 | Sample Render Refresh Program rollout | Consent prompt · `template_samples` table · "Sample Curation" admin surface · guest credits gated to AIEH/SDE donors |
| 21 | Pre-launch polish | `0026_bir_tax_compliance` · `0028_email_notifications` · `0029_help_center` · `0030_guided_tour` · `0031_day_of_guest` · `0032_contract_intelligence` · `0033_public_api_foundation` · `0035_observability` |

Native iOS/Android Papic + DSLR pairing are Phase 2 (post-V1.0 launch). Per the 2026-05-12 lock, V1 ships web-only Papic.

---

## Quick links

- **Live app:** https://setnayan-platform-web.vercel.app
- **GitHub repo:** https://github.com/iscasasola/setnayan-platform
- **Supabase project:** https://supabase.com/dashboard/project/njrupjnvkjkitfctetvi
- **Vercel project:** https://vercel.com/iscasasolaii-9434s-projects/setnayan-platform-web
- **Cloudflare dashboard:** https://dash.cloudflare.com
- **Spec corpus:** `~/Documents/Claude/Projects/Setnayan/` (`CLAUDE.md` is the canonical decision log)

---

## Resume checklist for a future session

If you (or a fresh Claude Code session) need to pick up from here:

1. Read `CLAUDE_Code_Session_1_Kickoff.md` in the spec corpus
2. Read `CLAUDE.md` in the spec corpus (decision log)
3. Read `STATUS.md` (this file) for current state
4. Verify environment: `pnpm install && pnpm typecheck && pnpm lint`
5. Verify live services with the probes from the "Verification probes that have already passed" section above
6. Resume at the next unchecked item in the "What's outstanding RIGHT NOW" section
