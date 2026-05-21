# Task #32 — TODO/FIXME/XXX/HACK sweep triage

**Date:** 2026-05-22
**Scope:** `apps/web/**/*.{ts,tsx,mjs}`
**Total findings:** 45 (45 TODO · 0 FIXME · 0 XXX · 0 HACK)

## Triage summary

| Category | Count | Action |
|---|---|---|
| PILOT-CRITICAL | 0 | None — no payment/auth/data-integrity/security TODOs |
| PILOT-NICE | 3 | Documented as marketing placeholder swap (post-design-direction) |
| V1.x DEFERRAL | 42 | Documented in CLAUDE.md decision log per iteration |
| DEAD | 0 | All comments reference real pending work |

## V1.x DEFERRAL — by iteration (42 total)

| Iter | Count | Files | Status |
|---|---|---|---|
| 0005 LED | 1 | `add-ons/led/_components/led-background-maker.tsx:315` | Worktree `0005-led-background-maker` per CLAUDE.md 2026-05-19 row |
| 0009 Photo Delivery | 1 | `add-ons/photo-delivery/page.tsx:44` | Worktree `0009-photo-delivery` · Google Drive verified-app pending (#19g) |
| 0011 Panood | 13 | `add-ons/panood/setup/page.tsx` (×8) · `broadcast/page.tsx` (×3) · `_components/copy-link.tsx:17` · `api/cron/oauth-refresh/route.ts:27` | Worktree `0011-panood` · YouTube verified-app Phase 2 pending (#17a) |
| 0012 Papic | 14 | `add-ons/papic/page.tsx` (×14) | Worktree `0012-papic` · Apple/Google/DSLR SDKs (#20d/e/g) |
| 0017 Patiktok | 7 | `lib/patiktok.ts` (×5) · `api/internal/patiktok/process-job/route.ts:86` · `api/cron/oauth-refresh/route.ts:32` | Worktree `0017-patiktok` · TikTok verified-app pending (#20f) |
| 0018 Supplies | 6 | `add-ons/supplies-marketplace/_components/cart-drawer.tsx` (×2) · `_data/products.ts` (×4) | Worktree `0018-supplies-marketplace` · Setnayan-sourced resale model lock 2026-05-19 |

All 42 are documented as in-flight engineering work in `App_Build_Status.md` (engineering-in-flight bucket) and CLAUDE.md 2026-05-19 row "Parallel engineering kickoff". Comments are load-bearing seam-markers for those worktrees — they intentionally stay in code.

## PILOT-NICE — design placeholder swaps (3)

| File:line | Comment | Owner |
|---|---|---|
| `apps/web/app/page.tsx:81` | swap placeholder visuals — chaos collage, hero photographic background, coverage SVG basemap, readiness tile covers, dashboard preview — for Filipino-luxe photography per owner's art direction | `0015_main_website` |
| `apps/web/app/page-sections/_MariaJuan.tsx:19` | replace placeholder dashboard preview with real interactive Maria & Juan preview (stage strip, vendor-side peek toggle, theme picker including Forest Theme + burgundy Setnayan Default) | `0015_main_website` |
| `apps/web/app/page-sections/_AvailableEverywhere.tsx:22` | query `platform_availability` table; show tiles only where `is_visible AND store_url IS NOT NULL`. Web tile always renders | `0015_main_website` (Section 12, locked 2026-05-15 row) |

These map to the public marketing site (`setnayan.com`) and are tracked in:
- CLAUDE.md 2026-05-15 row (Section 12 platform-tiles hide-until-live) — `platform_availability` schema exists; query wiring pending
- CLAUDE.md 2026-05-19 row 1 "Live-site snapshot" drift findings (Drift #1 broken `/apply` CTA already fixed via PR; visual swap remains)
- 0015 spec § Section 6 (Maria & Juan demo) and § Section 12 (platform tiles)

**Why not fix now:** all 3 require non-engineering inputs (photography direction · live Maria & Juan demo build · platform store URLs as native apps go live per 2026-05-15 V1 platform expansion). Comments stay as load-bearing markers until those external inputs arrive.

## PILOT-CRITICAL — none

Sweep confirms no TODO/FIXME comments touch payment flow (Setnayan Pay 5% inbound · BIR withholding · OAuth refresh for active providers · order reconciliation), auth (Supabase session · `users.account_type` role router), data integrity (`comp_grants` schema · `event_moderators` foundation · `feature_policy`/`event_feature_policy_override` resolution), or security (RLS policies · encrypted token storage via `ENCRYPTION_KEY`).

The 4 crypto/cron/internal-worker secret-gated endpoints (`/api/cron/oauth-refresh` · `/api/admin/cron/*` · `/api/internal/patiktok/process-job`) all have shipped guard logic; the 2 TODO markers inside `oauth-refresh/route.ts` and `process-job/route.ts` describe future Panood/Patiktok job-pickup work, not security gaps.

## Conclusion

**No code changes shipped this PR.** All 45 comments are either documented V1.5+ deferrals (42) tied to in-flight worktrees with external blockers, or design-placeholder markers (3) waiting on non-engineering inputs. This PR is the triage artifact for the record.

If V1.5+ unblocks any of the 6 iteration worktrees, the corresponding TODO clusters will close as their PRs land (one cluster per worktree). The 3 design placeholders close when (a) photography lands, (b) Maria & Juan interactive demo ships in the V1.1 wave, and (c) the first native-app store URL goes live.
