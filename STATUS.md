# Setnayan — Project Status

> Living checkpoint. Refreshed 2026-05-14 (end of day).
> Anchor doc — if you're opening this repo cold in a new Claude session, start here.

**Owner deadline anchor:** December 2026 wedding

---

## Where we are right now

V1 web surface is **functionally complete**. Pre-launch sprint closed 2026-05-13 (19 iterations). 2026-05-14 then landed **28 PRs** across two waves.

**Wave 1 — launch hardening (PRs #1–#23):** landing-page conversion upgrades, full observability (Sentry + PostHog), R2 storage migration, day-of mode + event-day pre-load, account-lifecycle redesign (Delete vs Blacklist), persistent login, caching foundation, Services → Add-ons rename, Phase 1 placeholder routes, 7 of 10 V1 email templates wired through Resend, status doc refresh.

**Wave 2 — Phase 2 closed (PRs #24–#28, merged 08:40–08:43Z):** 5 background agents shipped in parallel:
- **#24** vendor marketplace at `/vendors` + reviews system (couple form, vendor reply, public profile section)
- **#25** vendor dashboard expansion — services editor + bookings inbox + 4-role team + earnings rollup
- **#26** admin force-majeure queue + couple-side dispute filing + admin funnel analytics (`/admin/funnels`)
- **#27** read-only public API (`/api/v1/events|guests|vendors`) + scope-gated `sk_live_*` keys
- **#28** EN/TL dashboard locale toggle + 2 more email templates (event-wired count 7 → 9)

Email-wired count is now **9 of 10** V1 templates. Only Phase 3 decision-gated items below remain.

> **🔴 Before next session:** run `npx supabase db push --db-url "$SUPABASE_DB_URL"` to apply 6 unpushed migrations (`blacklisted_emails`, `vendor_reviews`, `vendor_dashboard_expansion`, `force_majeure_flags`, `notification_type_additions`, `api_scopes`). The new surfaces will 500 against prod DB until pushed.

---

## 2026-05-14 — full PR run

Merged commits on `main`, newest first:

| PR | Commit | What |
|---|---|---|
| #28 | 9a966d0 | 0025+0028 — EN/TL dashboard locale toggle + 2 more email templates (`help_ticket_replied`, `vendor_inquiry_received`) |
| #27 | 0fbd6f7 | 0033 — read-only public API (`/api/v1/events|guests|vendors`) + scope-gated `api_keys` |
| #26 | 4bc0af3 | Admin force-majeure queue + couple disputes + 3 Supabase funnels + 4 PostHog funnel links at `/admin/funnels` |
| #25 | 9f44813 | 0022 — vendor dashboard expansion (services editor + bookings inbox + 4-role team + earnings rollup) |
| #24 | cfa9402 | 0006 + vendor-reviews — public marketplace at `/vendors`, couple review form, vendor one-time reply, public profile section |
| #23 | c6d45ca | docs(status): EOD 2026-05-14 refresh (anchor doc) |
| #22 | e74b169 | Phase 1 placeholder routes + nav (10 new surfaces, 2 add-ons grid entries) |
| #21 | 4833541 | Landing page conversion upgrades — split CTA, trust signals, pricing transparency |
| #20 | 4941a6f | 0028 RSVP-received email + in-app notification |
| #19 | 124b6e4 | PostHog wiring + 3-event funnel (signup_completed, event_created, order_paid) |
| #18 | 351715b | R2 storage migration (uploads off Supabase Storage) |
| #17 | 835aeef | Sentry error tracking wired |
| #16 | 7349666 | Add-ons status pills (Web V1 / Coming soon) + admin-only dev mode |
| #15 | 7dc9aa2 | CI build job — catches Next compile-time errors before merge |
| #14 | eec8fd2 | Vercel build fix — split client-safe query keys out of server-only event-preload |
| #13 | 65f8f68 | Services → Add-ons rename across the couple dashboard (308 redirects) |
| #12 | b049f99 | 0036 event-day pre-load — couple + vendor (T-3d → T+1d CTA, T-24h auto) |
| #11 | 327b489 | 0031 day-of live mode — auto-activation + 6 cards |
| #10 | c582a4d | Caching foundation — TanStack Query + persister + route-scoped SW |
| #9 | fac3e75 | Account lifecycle redesign — Delete vs Blacklist + migration |
| #8 | 865ea46 | Resend env var name fix + signup post-confirm redirect |
| #7 | 4e41f83 | Delete users from /admin/users (superseded by #9) |
| #6 | fade56a | Persistent login hardening — cookie defaults + proactive refresh + client-aware sessions |
| #5 | 8f761d6 | Auto-format BIR TIN with dashes |

Earlier 2026-05-14 work (before the PR run): public-repo flip + AGPL-3.0 + security hardening (#4), short-URL alias (#3), QR auto-crop (#2), monogram QR fix (#1).

---

## Phase 3 — decision-gated (waiting on owner)

Each of these requires a strategic call from the owner before code can ship:

| Item | The decision | Effort once decided |
|---|---|---|
| **Save-the-Date render pipeline** | Browser-canvas + MediaRecorder (free, ~1 day) OR server FFmpeg (needs Workers Paid plan + Hetzner VM pool, ~3 days) | 1–3 days |
| **Panood (live stream)** | Provision Cloudflare Stream Live + YouTube Data API + master `@SetnayanWeddings` channel | 5–7 days |
| **Marketplace commission model** | Free-listing forever / commission per booking / paid tier — pick before launch advertising | Pricing call only |
| **Daily.co video meetings (0019)** | Sign up + paste API key | 2 days code |
| **Anthropic Claude API (0032 Contract Intelligence)** | Sign up + spend cap → unblocks paid SKU | 3 days code |
| **Apple Developer Program** | $99/yr enrollment | 2-5 day approval; signed `.dmg` + future iOS Papic |
| **Render pipeline infra** | Cloudflare Workers Paid ($5/mo) + Hetzner Cloud VMs (€15/mo) — shared by 0011 / 0012 / 0017 / 0024 | 2 days code once provisioned |
| **Public website visual redesign** | Owner provides direction on what to change. Current state (post PR #21): split-CTA hero + trust signals + pricing table + compact roadmap — functional but generic. Owner queued this for a later session — needs a specific brief ("hero feels weak", "want a hero image not a device mock", "needs a how-it-works section", etc.) before code can ship | 0.5–2 days depending on scope |
| **Monogram tier system (queued for new session)** | Owner locked the 3-tier model 2026-05-14 (reference images shared). **Free / Basic**: 2 letters + `&` (e.g. `J & S`), 1-2 default fonts, simple geometric frame — presentable but not custom. **Pro**: 2 letters OR full first names (e.g. `JAMES & SAVA`), ornamental + heritage frames (laurel wreath / royal crest / sampaguita / capiz / banner-ribbon), 8+ premium fonts, placement variants. **Bespoke**: artisan letterforms — letters infused/interlocked into a single mark, not picker-driven (commissioned via Setnayan or vendor marketplace, one-off SVG upload). Replaces the existing flat `Custom Monogram Pack — remove watermark` SKU. Pricing TBD; existing 0004 spec mentions ₱99 Pro + ₱1,999 Custom but does not yet account for Bespoke as a separate tier. Implementation needs: frame catalog editor, font picker, name-mode toggle (initials vs full names), bespoke-upload flow with R2 storage (already wired), payment-gated tier unlocks via 0034 orders | 3-5 days code once tier-SKU prices are locked |

---

## Owner-side blockers (must act, no code can replace)

- **🔴 BLOCKING — `supabase db push`** — 6 migrations on disk are not yet applied to prod: `blacklisted_emails` (#9), `vendor_dashboard_expansion` (#25), `api_scopes` (#27), `notification_type_additions` (#28), `vendor_reviews` (#24), `force_majeure_flags` (#26). New surfaces will 500 until pushed. Run `npx supabase db push --db-url "$SUPABASE_DB_URL"` once to apply all in one shot.
- **Sentry / PostHog smoke test** — trigger one error in production, sign up one fresh user, confirm both show up in their respective dashboards
- **Resend domain verification** — done; just confirm a fresh signup welcome email lands at a non-account-holder Gmail
- **Supabase Sessions config** — Inactivity timeout already at "never" by default (free plan); JWT expiry can be bumped to 7-30 days when found in dashboard
- **Cowork spec reconciliation** — `COWORK_INBOX.md` now carries `[PENDING]` entries for the full Phase 2 surface: 0006 reviews, 0019 force-majeure, 0022 vendor dashboard, 0025 locale, 0028 emails, 0033 API scopes, 0036 event-preload, caching strategy. Walk each via Cowork; tick `[DONE <YYYY-MM-DD>]` as you go.

---

## Stack quick-reference

- **Repo:** https://github.com/iscasasola/setnayan-platform (public, AGPL-3.0)
- **Hosting:** Vercel (Hobby plan), auto-deploys from `main`
- **Domain:** `setnayan.com` (Vercel-managed SSL)
- **DB:** Supabase (Singapore region) — **31 migrations on main as of EOD 2026-05-14** (last 6 are unpushed to prod, see Owner-side blockers)
- **Storage:** Cloudflare R2 — 4 PH-region buckets (live writes from PR #18), plus Supabase Storage for the `platform-assets` bucket (legacy)
- **Email:** Resend — domain `setnayan.com` verified, `noreply@setnayan.com` from-address, **9 of 10 V1 transactional templates wired**
- **Observability:** Sentry (errors) + PostHog (3 funnel events) + 3 Supabase-side funnels at `/admin/funnels` (signup→event→paid order, vendor signup→profile→booking, week-over-week)
- **Native:** Tauri 2 desktop wrapper (unsigned macOS .dmg on GitHub Releases v0.0.1); iOS/Android deferred to V1.0+

---

## Quick-jump anchor docs

- **`HANDOFF.md`** — cold-start handoff with the verification flow, all live routes, locked decisions
- **`OWNER_ACTIONS.md`** — step-by-step phased launch checklist (Phase 1-7)
- **`CHANGELOG.md`** — every meaningful commit with `SPEC IMPACT` callout
- **`COWORK_INBOX.md`** — `[PENDING]` worklist of spec-corpus updates owed back to `~/Documents/Claude/Projects/Setnayan/`
- **`README.md`** — public-facing overview
- **In the Cowork corpus at `~/Documents/Claude/Projects/Setnayan/`:**
  - `CLAUDE.md` — status anchors auto-load on every Cowork session
  - `App_Build_Status.md` — spec-vs-code audit (regenerated EOD 2026-05-14)
  - `V1_Gap_Analysis_Status.md` — Tier 1/2/3 spec landing audit
  - `Installed_Stack_Inventory.md` — 10-pass audit of installed deps, migrations, env vars
  - `API_Integration_Checklist.md` — external service prereqs

---

## Sprint 0 history (closed 2026-05-13)

Sprint 0 was the platform foundation — Next.js 15 + Tauri 2 + Supabase + Cloudflare R2 + GitHub. All Sprint 0 acceptance criteria passed:

- Vercel project connected, env vars set, deploys clean
- Supabase Singapore region, base schema migration `20260512000000`, 5 RLS helpers, on_auth_user_created trigger
- R2: 4 PH-region buckets (`setnayan-media`, `-thread-files`, `-vendor-contracts`, `-samples`)
- Auth: email/password + magic-link; owner email auto-flagged `is_internal=TRUE`
- Tauri 2 scaffold, GitHub Actions matrix building `.dmg` + `.msi` artifacts
- PWA manifest + service worker scaffolded (replaced in PR #10 with the full caching foundation)

Verification probes that passed: `/health` 200, `/`, `/login`, `/manifest.json`, all icons, RLS denies anon, `generate_public_id` produces valid S89X- IDs.

Then the 19-iteration pre-launch sprint (closed 2026-05-13) shipped the couple/vendor/admin core surfaces. Then 2026-05-14 happened (see PR run above).
