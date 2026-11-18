# Setnayan — Architecture & Wiring Map (DRAFT, 2026-11-18)

> **Status: DRAFT audit — nothing below has been changed in code.** Cleanup waits for the
> owner's approval, step by step. Measured on `origin/main` @ `da4a079082`. Every number has the
> command that re-measures it; numbers rot, commands do not (CLAUDE.md RULE 0 · rule 7).

## 0. The wiring standard (what "correct" means here)

This repo has no `src/`. The generic "`/src/components` · `/src/data` · `/src/services`" map
translates to:

| Job | Home |
|---|---|
| UI, presentational | `apps/web/app/**/_components/`, `apps/web/components/` |
| Page entry — reads once, passes props | `apps/web/app/**/page.tsx`, `layout.tsx` |
| Mutations | `apps/web/app/**/actions.ts` (server actions) |
| Reads, services, config, constants | `apps/web/lib/` |
| Routes | `apps/web/lib/routes.ts` builders — `routes.dashboard.event(id)`, never `"/dashboard/…"` |
| Colours | tokens in `apps/web/app/globals.css` + `apps/web/tailwind.config.ts` |
| Buttons | `ActionButton` — `apps/web/components/action-button.tsx` |
| Prices, plans, taxonomy | the database (`platform_retail_catalog_v2`, `vendor_billing_catalog`, taxonomy tables) |

Exempt everywhere: tests, `apps/web/app/dev/**`, `*.lab.tsx`.

Checks: `/verify-wiring`, `/audit` (`.claude/commands/`). Hooks: `.claude/settings.json`.

---

## 1. Disk & build bloat

| Item | Size / count | Verdict | Re-measure |
|---|---|---|---|
| `.claude/worktrees/` in the main checkout | **30 GB**, 19 worktrees, each ~2.1 GB (mostly `node_modules`) | **Corrected after step 1:** this is NOT mostly finished work. Measured per worktree: all but one belonged to a running session, an open PR, or unpushed commits made in the last hours (`motion-*` hold 13–17 local-only commits each). Step 1 removed only the one archived, clean, fully-pushed worktree (741 MB), one empty folder, and 8 dead locked entries. The rest frees itself as each PR merges and its session prunes its own worktree. | `du -sh .claude/worktrees/*` |
| Registered worktrees, whole machine | 54 → 42 after step 1 | Dead entries pruned (locks from processes long gone; branches kept) | `git worktree list` |
| `.next` inside kept worktrees | 1 folder left, ~0.5 GB, in use by a running session | Nothing to clear | `du -shc .claude/worktrees/*/apps/web/.next` |
| Root `node_modules` | 1.4 GB | Normal for this app | `du -sh node_modules` |
| `dist/`, `build/`, `.cache/` at root | none present | Nothing to do | — |

**Build configs.** One of each — no split configs: `apps/web/next.config.ts`, one
`tailwind.config.ts`, one `postcss.config.mjs`, `tsconfig.base.json` → `apps/web/tsconfig.json` +
`packages/shared/tsconfig.json`, one `turbo.json`, one `apps/web/vercel.json`, one
`src-tauri/tauri.conf.json`. One build script: root `build` = `turbo run build` → `apps/web` `build`.

**Overlapping builds — the real duplication is in CI, not configs:**

| Workflow | Trigger | Builds the app? |
|---|---|---|
| `ci.yml` | every PR + push to main | yes — `pnpm --filter @setnayan/web build` |
| `e2e.yml` | every PR + push to main | **yes, a second full build** — `pnpm --filter @setnayan/web build` |
| `release-rehearsal.yml` | manual | yes |
| `supabase-migrations.yml` | manual | — |
| `build-desktop.yml` | manual | `tauri build` |
| Vercel | `main` + `preview/*` | yes (its own) |

→ **Merge candidate:** every PR compiles the app twice in GitHub Actions (ci + e2e). Build once in
`ci.yml`, upload `.next` as an artifact, have `e2e.yml` download it. Re-measure:
`grep -n "web build" .github/workflows/*.yml`.

---

## 2. Folder & file disorganization

Scope: `apps/web` + `packages`, labs (325 files) excluded. `apps/web/lib/` alone holds ~5,800
entries — a flat folder that size is itself the disorganization.

**Versioned / side-by-side generations:**

| File | Finding | Action |
|---|---|---|
| `lib/v2/sku-catalog-v2.ts` beside `lib/sku-catalog.ts`, `lib/v2-catalog.ts`, `lib/v2-catalog-pure.ts` | Three catalogue generations side by side; `sku-catalog-v2` has ~14 importers | One `lib/catalog/`; first check whether v1 is still read |
| `lib/monogram-studio/markup-v2.ts` beside `markup.ts` | v2 has 2 importers; v1 importers not measured | If `markup.ts` is unread, delete it and drop `-v2` |
| `app/admin/pricing/_components/legacy-catalog.tsx` | Imported only by `pricing-surface.tsx` | Retire with the pricing refactor |
| `lib/onboarding-v2-brief-flag.ts`, `lib/verified-v84-art.ts` | Version in the name, no unversioned sibling | Rename without the version |
| `[slug]/_components/editorial/post-event-scene-views-2.tsx`, `-3.tsx`; `lib/help/user-2..4.ts`, `supplier-2.ts`, `help-admin/admin-2.ts` | Size splits, not versions — all imported | Rename by content (`-memories`, `-timeline`, by topic) |

**Same component built twice:**

| Pair | Action |
|---|---|
| `PushToggle` — `app/_components/push-toggle.tsx` (takes `audience`) vs `app/vendor-dashboard/notifications/push-toggle.tsx` | Delete the vendor copy; use the shared one with `audience='vendor'` |
| `ProgressRing` — `app/_components/progress-ring.tsx` vs `app/vendor-dashboard/performance/_components/progress-ring.tsx` | Fold into the shared one (props not compared yet) |
| `CopyButton` — `app/_components/copy-button.tsx` vs `…/studio/papic/crew/_components/copy-button.tsx` | Use the shared one |
| `PrintButton` — `components/print-button.tsx` vs `app/admin/ask/print-button.tsx` | Use `components/` |
| `plan-sheet.tsx` — `app/open-shop/_components/` vs `app/vendor-dashboard/subscription/_components/` | Review — same name, same domain, exports not compared |

**Orphans** (`lib/` + `components/`, 3,290 files scanned, 16 with no importer; 2 of those were
false — loaded by a script or `new URL(...)`):

| File | Finding | Action |
|---|---|---|
| `lib/event-ultra-gates.ts`, `lib/papic-standings.ts` | Only read as text by a test — no code imports them | Wire up or delete (owner call: may be parked work) |
| `lib/route-meta.ts`, `lib/wedding-roadmap-signals.ts` | No code importer; only CHANGELOG mentions | Likely dead — delete after a check |
| `lib/claimed-records-asking.server.ts`, `lib/keep-a-degraded-render-briefly.ts`, `lib/meeting-availability.server.ts`, `lib/service-definitions.server.ts`, `lib/stories-search-config.ts`, `lib/vendor-launch-free-window-flag.ts` | No importer; not yet read | Review one by one |
| `lib/slot-seat-reservations-flag.ts`, `lib/stewarded-accounts.ts` | Deliberately parked (owner-parked / counsel-first) | Keep |

Re-measure orphans: for each `lib/`/`components/` file, `git grep -l "<path-without-extension>['\"]" -- apps packages scripts`
(also check `new URL('./x'` and `readFileSync` reads); versioned names with
`git ls-files | grep -iE '(v2|-v[0-9]|legacy|backup|\.bak)'`.

---

## 3. Multi-layer page bottlenecks

467 pages, 25 layouts. Deepest chain is 5 layouts. Static reading only — **no timings measured**.

**Layouts that read data on every navigation under them (the real cost):**

| Layout | Awaits | Wraps |
|---|---|---|
| `app/dashboard/[eventId]/layout.tsx` | ~15 | every couple event page |
| `app/vendor-dashboard/layout.tsx` | ~10 | every supplier page |
| `app/admin/layout.tsx` | ~7 | every admin page |
| `app/dashboard/layout.tsx` | ~5 | all couple pages (and again under `[eventId]`) |
| `app/[slug]/layout.tsx` | 2 **in sequence** | every guest Event Hub page |
| `app/layout.tsx` | 2 | everything |

**Flatten candidates — only these remove real waiting:**

| Where | What | Why it is real |
|---|---|---|
| `app/[slug]/layout.tsx` | `loadEventShell` then `loadGuestLook` → one `Promise.all` | Guest-facing, two sequential reads on every hub page |
| `app/v/[slug]/page.tsx` | ~32 top-level awaits, 4,883-line page | Biggest waterfall candidate; independence not yet verified per await |
| `app/dashboard/[eventId]/vendors/page.tsx` (~27), `app/[slug]/page.tsx` (~24), `app/[slug]/seat/page.tsx` (~17) | group independent reads | Same pattern |
| Pages doing `createClient()` then `getCurrentUser()` in sequence | copy `vendor-dashboard/page.tsx`'s `Promise.all([createClient(), getCurrentUser()])` | Cheap, mechanical |
| `dashboard/layout.tsx` + `[eventId]/layout.tsx` both read the user's profile | move the profile select into one `cache()`d helper | Benefit depends on how often layouts re-render — measure first |

Already mitigated: `getCurrentUser`, `getDashboardShell`, `loadEventShell` are `cache()`d, so the
same user read in a layout and its page is one network call per request, not two.
Wrapper *components* are not the problem: no spot-checked page nests 4+ providers in its own JSX;
the stacking comes from layouts. Flattening components alone removes no await.

Re-measure: `git ls-files 'apps/web/app/**/layout.tsx'` and count `await` per file.

---

## 4. Themes, skins & buttons

**Buttons — three parallel systems:**

| System | Where | Reach |
|---|---|---|
| `ActionButton` (+ `actionButtonClass()` for links) — **the primary** | `components/action-button.tsx`, `.ab .ab-<tone>` in `globals.css` | ~524 files |
| Legacy `.btn*` / `.button-primary` / `.button-secondary` classes | `globals.css` (`btn-primary`, `btn-terra`, `btn-line`, `btn-ghost`, `btn-quiet`, `btn-gold`, `btn-ring`) | ~106 className sites |
| Raw `<button>` with ad-hoc Tailwind | everywhere | ~2,176 in ~729 files |

101 exported `*Button` components in all. Duplicated names: two `CopyButton`
(`app/_components/copy-button.tsx`, `…/studio/papic/crew/_components/copy-button.tsx`), two
`PrintButton` (`components/print-button.tsx`, `app/admin/ask/print-button.tsx`). `SubmitButton`
(~257 files) is a pending-state wrapper, not a look — it should wear `ActionButton`.

**Token sources — there is no single token file:**

| Source | Holds |
|---|---|
| `app/globals.css` (~11.5k lines) | ~1,039 custom properties, `:root` + `html.dark` repeated in ~10 places |
| `tailwind.config.ts` | ~126 colour entries — mostly `rgb(var(--…))`, ~30 literal hex |
| `lib/app-colours.ts` | admin-editable colours → `--sn-*` at runtime |
| ~20 more TS maps | `theme-colours`, `hub-theme-tokens`, `invite-themes`, `std-themes`, `site-palette*`, `palette-styles`, `feel-palettes`, `main-colours`, `side-colors`, `room-palette`, `studio-skin`, `story-theme`, `adaptive-theme`, `[slug]/_lib/theme-ground` |
| 49 CSS files (30 modules) | biggest: `home-reskin.css`, `front-door.css`, `award.module.css`, `ugat-console.css` |

Event themes (invite, save-the-date, guest site) are **product data** — couples pick them — and
should stay separate maps. The app's own chrome should read only `globals.css` tokens.

**Hard-coded colours outside token files** (non-test, non-lab):

| Kind | Count | Worst files |
|---|---|---|
| Tailwind arbitrary `bg-[#…]` etc. | 344 in 62 files | `app/tour/**` (~170 of them), `admin/connection-logs/connection-logs-client.tsx`, `monogram/public-monogram-studio.tsx` |
| Numbered palette classes (`bg-red-500`) | 333 in 93 files | `lib/notifications.ts`, `app-store/studio-card-demo.tsx`, `manpower/**` |
| hex in .ts/.tsx | 4,292 in 977 files | inflated by data dictionaries (`color-names.ts`, `color-vocabulary.generated.ts`) and canvas/3D art (`plan3d/**`, `monogram-studio/**`, `wax-seal/**`) — UI share not measured |
| hex in CSS outside globals | 939 in 28 files | `home-reskin.css`, `award.module.css`, `ugat-console.css`, `front-door.css` |
| `rgb(`/`hsl(` in .ts/.tsx | 1,521 in 470 files | `vendors/plan-budget-accordion.tsx`, `shortlist-categories.tsx` |

Guards that already exist are surface-scoped (category colours, accent, main button, supplier blue
look, guest palette, button-is-icon-and-word). **No repo-wide guard bans raw colours in
components.** Re-measure with the regexes in `.claude/commands/audit.md`.

---

## 5. Hardcoded & unwired flows

| File & symbol | Issue type | What is there | Where it should be wired |
|---|---|---|---|
| `apps/web/lib/routes.ts` (whole file) | Dead Link (system) | Claims to be "THE single source of truth for every URL" and names a guard `scripts/lint-routes.mjs` — **that guard does not exist**, and only **3** app files import `routes` | Either wire it (codemod raw paths → builders, then add the guard) or correct its docblock |
| raw paths in `apps/web/app` + `components` | Dead Link risk | ~511 `href="/…"`, ~469 `` href={`/…`} ``, ~25 `router.push('/…')`, ~1,427 `redirect('/…')` | `routes.*` builders. No dead targets checked yet — the missing guard is what would check them |
| `process.env.NEXT_PUBLIC_APP_URL` read directly | Hardcoded config | 116 files; 5 of them fall back to a literal `'http://localhost:3000'` (`auth/oauth-actions.ts`, `checkout/actions.ts`, `signup/actions.ts`, `app/layout.tsx`, `lib/event-account-link.ts`) | One helper in `lib/` (a starting point exists: `lib/app-url-path.ts`) |
| `…/website/editor/_components/main-background-panel.tsx` — `BgCard name="Your upload" onPick={() => {}}` | Unwired Flow (candidate) | A pressable "Your upload" card whose tap does nothing | Re-apply the upload as the background, or render it as not-pressable. **Verify on screen before fixing** |
| Other `() => {}` / `() => undefined` handlers (~15 product files) | — (deliberate) | Required callbacks the screen does not use (`onSwapped`, `onPicked` on a link that still navigates, a disabled filter row, an sr-only input's `onChange`) | No change — rule 5 in CLAUDE.md allows these |
| Peso figures in UI | — (already guarded) | Mostly comments; the rest are in the declared inventory `lib/public-price-literals.ts` + its test | No change |
| Placeholder text (`Lorem`, `John Doe`, `Test Product`, `mockData`) | — | **None** in product code (only in dev labs) | — |
| Inline `fetch(` in `.tsx` | — | **None** | — |

**Static data arrays inside UI files** — 96 arrays of 5+ objects in product `.tsx`. The biggest:

| File | Const | Items | Should live in |
|---|---|---|---|
| `app/(shell)/{budget,guest-list,mood-board,palogo,panood,patiktok,pawebsite,samahan,schedule,seat-plan,setnayan-ai}/page.tsx` + `papic/_papic-sections.tsx` | `SPOTLIGHTS`, one copy per page (12 pages) | ~12 each | one `(shell)/_data/spotlights/<product>.ts` set, one shape |
| `app/(shell)/papic/_papic-sections.tsx` | `EVERYTHING_ELSE` | ~20 | `_data/` beside it |
| `app/onboarding/wedding/_components/onboarding-shell.tsx` | `FREE_TOOLS`, `PICK_GROUPS_FALLBACK` | ~18, ~10 | `lib/` — the free-tools list should be the same one the app rail reads |
| `app/admin/accounts/_surfaces/venues-surface.tsx` | `VENUE_TYPE_FILTERS` | ~16 | the taxonomy (one source — owner rule) |
| `app/admin/app-performance/_components/action-center.tsx` | `QUEUE_CARDS` | ~15 | `_data/` |
| `app/dashboard/[eventId]/story/_components/editorial-editor.tsx` | `SECTIONS` | ~15 | `lib/` |
| `app/dashboard/[eventId]/launch/_components/maker-tools.tsx` | `MAKER_TOOLS` | ~13 | `lib/` |
| `app/admin/force-majeure/page.tsx` | `FILTER_OPTIONS` | ~10 | `_data/` |

---

## Proposed cleanup order (awaiting approval — nothing done)

1. **Disk — DONE 2026-11-18 (741 MB + 8 dead entries):** see section 1; the rest is live work.
   clear `.next` in the rest. (~20–28 GB back.) Machine-only, no code change.
2. **CI double build:** build once in `ci.yml`, reuse in `e2e.yml`.
3. **Routes:** decide — wire `lib/routes.ts` for real (codemod + `lint-routes` guard) or retire its
   "single source of truth" claim. Today it is a second source that nothing reads.
4. **App URL:** one `appUrl()` helper; delete the five `localhost:3000` fallbacks.
5. **Guest hub layout:** `Promise.all` in `app/[slug]/layout.tsx`; then measure `v/[slug]`.
6. **Buttons:** fold `.btn*` classes into `ActionButton` tones; a ratchet guard on raw `<button>`
   count (down only).
7. **Colours:** a ratchet guard on arbitrary `[#…]` + numbered palette classes; start with `app/tour/**`.
8. **Files:** act on the folders table above (duplicates, orphans, data arrays → `lib/`).
