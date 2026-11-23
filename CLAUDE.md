# Setnayan Platform: the shared brain

> Every Claude Code session loads this file automatically, local or cloud. It is short on purpose.
> The long history, traps and dated hand-overs it used to hold now live in [`docs/HISTORY.md`](docs/HISTORY.md),
> which is still true and still worth a grep, but no longer the first read.
>
> **Read order for any task:** this file → [`.claude/rules/design-and-wiring.md`](.claude/rules/design-and-wiring.md)
> (auto-loaded) → the `think-and-build` skill (`.claude/skills/think-and-build/SKILL.md`) → the specs
> corpus files the skill names. Controller sessions also read [`docs/CONTROLLER_BRAIN.md`](docs/CONTROLLER_BRAIN.md).
>
> The guardrails are imported here so every session loads them even where `.claude/rules/` is not read:
> @.claude/rules/design-and-wiring.md
>
> **Where the truth lives (owner ruling 22 Nov 2026: one source, never two copies).**
> The product decisions live in the **specs corpus**, repo `iscasasola/Setnayan-specs`, checked out at
> `~/Documents/Claude/Projects/Setnayan`. Read it with `git -C <corpus> fetch -q origin && git -C <corpus> show origin/main:<file>`,
> because the local checkout lags. A cloud session without it runs `gh api repos/iscasasola/Setnayan-specs/contents/<file>`.
> This file only summarises the corpus and points into it. **If this file and the corpus disagree, the corpus wins.** Fix this file in the same PR.
> The **code** truth is the code plus its guard tests, and the connection map is generated from code (see §4).

---

## 1 · What Setnayan is (North Star)

**Setnayan is the home of every Filipino celebration: plan it · live it · keep it.**
Source: corpus `North_Star_Home_of_Every_Filipino_Celebration_2026-11-19.md`.

- **Planning is free and is the way in. The guest moment is the growth engine. The lifetime Memories record is the moat.** Charge for the day, not for planning.
- **The USP:** the only place where the host, the guests and the suppliers share one event, from the first idea to the memories.
- **Zero friction:**
  - A host starts an event with **no account**. The account is asked for at save.
  - A guest **never logs in**: one Event Hub link plus a QR pass.
  - Everything a guest needs works from that link.
- **Roles:**
  - Host (and co-hosts and helpers)
  - Guest
  - Supplier, with team roles: Shop Manager · Branch Manager · Account Manager
  - Coordinator
  - Photographer
  - Admin
- **Money is ₱ PHP, read, never typed.**
  - Couples' prices come from `platform_retail_catalog_v2`; suppliers' from `vendor_billing_catalog`. Both are admin-managed.
  - Never write a price into code, a comment, a doc or a drawing.
  - Format money only through `apps/web/lib/php.ts` (`formatPhp`, `formatPhpRounded`).
  - A failed read shows "Couldn't read", never ₱0, "Free" or empty.
- **Plans:**
  - Suppliers: **Free · Plus · Pro · Ultra**. Verified is part of Free. Code tiers: `free · verified · solo(=Plus) · pro · enterprise(=Ultra)`, in `apps/web/lib/vendor-tier-caps.ts`. Special tools are on Pro and Ultra only (`lib/specialized-tools-access.ts`).
  - Couples: **Free · Event Plus · Event Pro · Event Ultra** (`apps/web/lib/event-plans.ts`).
  - No "Max", no "Enterprise" and no "Supplier Plus" in any word a person reads.
- **Words:**
  - **Supplier**, never "vendor". **Event Hub**, never "website".
  - The app says "event"; brand lines say "celebration".
  - Email only, no SMS.

## 2 · Who does what (owner rulings, 20–22 Nov 2026)

| Session | Does | Never |
|---|---|---|
| **Controller** ("Setnayan controller setup") | Decides what gets built, gives builders non-overlapping scopes, combines related work into fewer PRs, answers the owner, gives migration GOs (only after Ship's SHIP, pinned to a blob). Protocol: `docs/CONTROLLER_BRAIN.md`. | Merges; builds features itself. |
| **Ship controller** | The ONLY PR watcher. Reviews, fixes CI and FIX-FIRSTs, regenerates baselines once per batch, batches, merges, deploys, confirms live. | Starts features. |
| **Builders** (local or cloud) | Build one scope, run the full preflight, hand over (local: SendMessage `#N @ sha · what we did · overlapping files`; cloud: one PR comment `STATUS: handed-over` + `gh pr ready`), then never touch that PR again. | Merge, regenerate baselines (`screens.generated.json`, `*.baseline.txt`, exposure surface), touch another builder's files. |

- **Models.** Fable (`claude-fable-5-2`) only designs and plans: drawings, prototypes, specs. **Opus 5.5 (`claude-opus-5-5`) builds and fixes everything.** Owner, 22 Nov.
- **Order:** suppliers + payments → couples + guests → admin. Build and fix only; nothing new without the owner's word.
- **"Live"** means `curl -sL https://setnayan.com/api/health` shows the commit. Merged is not live.

## 3 · The canonical design system: one of each, extend, never re-make

Full values: corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (it outranks anything here on values) plus `HOUSE_TEMPLATES.md`,
`MOTION_STANDARD_2026-11-18.md`, `DARK_MODE_STANDARD_2026-11-20.md`. Token map: [`docs/design-token-map.md`](docs/design-token-map.md).

| Job | The one piece (path from `apps/web/`) | Rule |
|---|---|---|
| Page shell | `app/_components/frontdoor/app-rail-shell.tsx`; the event layout's single `<main class="sn-vt-page">` | One shell, one `<main>`. The guest Event Hub (`app/[slug]`) is the only self-styled surface. |
| Page title | `app/_components/page-masthead.tsx` (`PageMasthead`) | Every page; held by `lint:masthead`. |
| Top bar | `app/_components/frontdoor/front-door-account-bar.tsx` | One top bar (`one-top-bar.test.ts`). |
| Bottom nav | `app/_components/nav/bottom-nav.tsx` | All four wrappers delegate to it (`lint:botnav`). At most 5 cells. |
| Button | `components/action-button.tsx` (`ActionButton`); `actionButtonClass()` for a link | Icon + word, 40 px paint in a 44 px press, `tone` required. One main verb per screen. `.button-primary` and per-page `.btn` are legacy: do not add more. |
| Card / frame | `.sn-frame` (`bg-frame shadow-sn-frame`); `.sn-tile` / `.sn-row` inside it; `collection-card.tsx` for collections | No hand-typed `rounded-* border` frames (`lint:no-card`). |
| Floating surface | `app/_components/sheet.tsx` (`Sheet`); `RiseScreen` for full screen | Opens at half on a phone. No new hand-rolled `aria-modal`. Confirm only for the irreversible. |
| Form row / input | `form-row.tsx` + `.input-field` | `.sn-input` and `shopInputClass` are legacy. Buttons live inside the box. |
| Choices | `PickMenu` (3+), `PillSelector` (2–3 views), switch (yes/no) | Any set of choices is a dropdown. |
| Tools at the thumb / search | `components/thumb-row.tsx` (`ThumbRow`), `search-add` / `search-box`, `SortFace` | Search is an icon until tapped. |
| Empty / error | `app/_components/states/empty-state.tsx`, `error-state.tsx`, `ReadFailed` | Empty, loading and failure never look alike. |
| Loading | `components/skeletons/index.tsx` (`Sk`, `Ghost`) | The skeleton draws only what the page draws. No `animate-pulse`, no spinners. |
| Toast | `app/_components/toast` | Success is a small toast; failure gives a plain reason plus Try again. |
| Icons | `lucide-react` only; topics via `lib/topic-icons.ts` | One icon per topic. Sort is `SlidersHorizontal`. |
| Colour | `--color-*` "ONE COLOUR SET, BY JOB" in `app/globals.css` | Never a hex, `rgb(`, `bg-white`, or a numbered palette class in a component. Light and dark are paired. |
| Type | `text-sn-*` scale: 9 · 10 · 11 · 12 · 13 · 14 · 15 · 17 · 19 · 22 · 30 | Never `text-[Npx]`, never half pixels. |
| Spacing / radius | 4 · 8 · 12 · 16 · 24 / `--m-r-*`: 4 · 8 · 14 · 22 · 999 | `--sn-r-*`, `rounded-tile`, `rounded-card` and `rounded-[..]` are legacy. |
| Motion | 5 speeds (100 · 200 · 280 · 320 · 700 ms) + one 1400 ms loop, 2 easings | Transform and opacity only. Controls don't dance. |

**Legacy counts may only go down.** Ratchet guards hold raw hex, typed px sizes, hand-made frames and the other legacy forms.
A build that touches a file moves it to the canonical piece. Nobody restyles the whole app in one go.

## 4 · The master connection graph

**The machine-checked map is the Ugat graph:** `apps/web/lib/ugat/graph.ts` (`UGAT_TYPES`, `UGAT_JOINTS` with `claims`)
plus the generated `apps/web/lib/ugat/screens.generated.json` (every screen's reads, writes and doors).
CI (`pnpm ugat:screens:check`, the root-map ratchet, `ugat-both-ends`, `ugat-schema-claims`, `ugat-concept-coverage`) fails a page with
no door, a broken door, a table with no writer or reader, or a new subsystem with no home. The draft audit is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Below is the human summary. **Every number shown to a person comes from the ONE reader named here.** A second reader is a bug.

| Entity (tables) | One reader / writer | Feeds |
|---|---|---|
| **Event** (`events`, `events_host`, `event_members`) | `app/onboarding/_shared/commit-event.ts` creates it | Every page under `/dashboard/[eventId]`, the guest Event Hub `/[slug]`, the supplier's client view `/vendor-dashboard/clients/[eventId]`, admin. |
| **Guest** (`guests`, `guest_groups`, `guest_checkins`) | `lib/guests.ts`: `countsTowardEvent`, `computeGuestStats`, `headcountForBasis` | RSVP (`app/[slug]/actions.ts`) → seat plan → door check-in (`lib/checkin.ts`) → caterer sheet → supplier pax (`events.headcount_basis`) → after-summary → Memories audience. **Check-in "expected" = attending only.** Pending guests hold seats until a person releases them. |
| **Seat** (`event_tables`, `event_seat_assignments`, `event_floor_*`) | `lib/seating.ts`, `lib/seat-plan-engine/` | Guests view (`guests?gview=seats`, 2D and 3D), `/[slug]/seat` and `find-seat`, caterer export, Spaces (shared plan maker). A decline frees the seat (`free_seat_on_decline`). |
| **Budget** (`events_host.estimated_budget_centavos` = target; `event_vendors` + `event_vendor_line_items` = agreed; `event_vendor_payments` = paid; `event_costs`, `orders`) | **`lib/budget-truth.ts` → `resolveEventMoney`** (committed + overpaid = paid + stillOwed). Amounts only via the `event_vendor_money_read` RPC (`lib/event-vendor-money.ts`) | Budget page, Home budget tile, checklist, preparation, AI snapshot, supplier client view, a year's budgets. A hidden amount draws "—". |
| **Supplier booking / quote** (`event_vendors`, chat cards, `event_vendor_payment_plan`) | Booked = **`BOOKED_EVENT_VENDOR_STATUSES`** (`lib/vendor-funnel.ts`; SQL twin `booked_event_vendor_statuses()`). Chat cards: `lib/chat-cards.ts`. Lock: `lib/chat-lock-booking.server.ts` | Budget agreed and paid, the coordinator's seat (opens on every way into booked), supplier Event Details ("Your booking": its own money only), badges, trust (served together), reviews, compare (`/explore/compare`). **Only a host books or pays.** |
| **Payment** (`payments`, `orders`, receipts) | `app/pay/[reference]`, Maya (`lib/maya-checkout.ts`; the webhook is only a hint, approval comes from asking Maya's API), ₱0 codes go to admin confirmation | Receipts, the admin payments desk, the owner's paid notice, entitlements. |
| **Photo credit** (`papic_event_pool_config`, `papic_event_point_grants`, `papic_event_pool_usage`) | `lib/papic-event-pool.ts` (one event pool; the per-camera hand-out is retired) | Papic cameras, live wall, Memories (Papic block on top), recap, the guest's own Memories. |
| **Plan tier** (`vendor_profiles.tier_state`; plan SKUs in `vendor_billing_catalog` / `platform_retail_catalog_v2`) | Suppliers: `lib/vendor-tier-caps.ts` (`VENDOR_TIERS`, `TIER_CAPS`; SQL twin `vendor_tier_limit`). Couples: `lib/event-plans.ts` (`PLAN_PRICE_CODES`) | Every 🔒 gate, special tools, active cards and members limits, plan pages, `/for-suppliers` table, checkout doors (`every-plan-has-a-checkout-door.test.ts`). |
| **Navigation** | Couple: `lib/customer-menu.ts` (`buildEventMenuSections`). Supplier: `app/vendor-dashboard/_components/vendor-nav-destinations.ts` + `lib/supplier-console-routes.ts`. Admin: `app/admin/_components/admin-destinations.ts`. Names and icons: `lib/nav-registry-defaults.ts`. Route builders: `lib/routes.ts` | A new page is registered in its area's menu AND reachable (the Ugat no-door check). |

## 5 · Hard rules (each has cost real time; detail in `docs/HISTORY.md`)

1. **RULE 0: find it before you build it.**
   - Grep the shipped component, the corpus design file (`Design_*`, `prototypes/`) and `DECISION_LOG.md`.
   - Then check work in flight: `gh pr list --state open`, `git worktree list`, `git log origin/main -15`.
   - State in one line each: **exists · missing · delta**. Extend; never re-draw.
   - A flag or column flip beats new schema. Never ask the owner what the corpus answers.
2. **An anchor is a string, never a number.** Cite a greppable symbol, not a line number or a count.
3. **Never guess a number that governs money.** Find its home (a catalog, `platform_settings`, `papic_event_pool_config`) or stop.
4. **Honest states.** A failed read never renders as zero, empty or success. The measurement must reach the render. Copy `lib/guests-read-is-honest.test.ts`. (`actions.ts` failing closed is correct.)
5. **Migrations.**
   - Allocate with `pnpm migration:new`.
   - The pipeline applies them with `supabase db push --include-all`, so a low prefix still applies. Order matters only for the PGlite replay.
   - **Never apply a migration to prod by hand** (no local `db push`, MCP `apply_migration` or raw SQL). It orphans the ledger and stalls every deploy.
   - **Never run `migration repair`**; that is the owner's.
   - Prod is SELECT-only for sessions. RLS is on at `CREATE TABLE`, using the 8 patterns and 4 helpers only.
   - A PR touching `supabase/migrations/` keeps the Ugat map honest: add a `UGAT_TYPES` node or a reasoned line in `apps/web/tests/db/ugat-concept.baseline.txt`.
6. **Merging.**
   - Merge commits only. No rebase, force-push, `git stash` or `pkill`.
   - A PR merges only after every required check passes. Never `--admin`, even if asked.
   - Migration PRs carry `do-not-auto-merge`.
   - Server actions are capped (fold, never raise the ceiling).
7. **CI and cost.**
   - Push once, when green.
   - Only `preview/*` branches build a Vercel preview. The bill is build minutes, and GitHub Actions is free.
   - CI runs at most 40 jobs. A CONFLICTING PR runs no CI.
   - Read every failure in one run before pushing a fix.
8. **Machine.**
   - 16 GB Mac, at most 4 builders plus Ship.
   - **Never read code from `/Users/icecasasola`** (a stale checkout). Use a worktree of `origin/main`.
   - Prune a worktree once its PR merges. Clear `.next`.
   - `grep` is a ugrep shim: quote bracketed paths.
   - Run unit tests from `apps/web`.
9. **Changelog.** One new fragment `changelog.d/<branch-slug>.md` per PR, with a `SPEC IMPACT:` line. Never edit `CHANGELOG.md` or `STATUS.md` in a feature PR. When SPEC IMPACT is not None, edit the corpus directly (DECISION_LOG row first) and surface load-bearing changes to the owner.

## 6 · Locked decisions (who checks each: see `docs/HISTORY.md` § Locked decisions)

- Web-first, one Next.js codebase: Vercel web + Tauri desktop + installable PWA.
- Apply-then-pay. The token wallet is retired.
- IDs are `S89<TYPE>-<10 Crockford>` from `public.generate_public_id`.
- Brand is SETNAYAN, domain `setnayan.com` (we do NOT own `setnayan.ph`).
- No manual video editor. No SMS. No public API endpoints in V1.

## 7 · Deployment surfaces

- **Web:** Vercel. `deploy-prod.yml` publishes merged `main` in batches (cron every 2 h + dispatch). `/api/health` reports the served commit.
- **Database:** Supabase Singapore, migrations only through the pipeline.
- **Object storage:** 5 Cloudflare R2 buckets in APAC: `setnayan-media` (public, served from its r2.dev URL) · `thread-files` · `vendor-contracts` · `vendor-verification` · `samples` (private, presigned). Cloudflare is storage only: DNS is GoDaddy, nothing is proxied.
- **Desktop:** `.github/workflows/build-desktop.yml` builds `.dmg` and `.msi`.

## 8 · Living docs in this repo

| File | Job |
|---|---|
| `changelog.d/` → `CHANGELOG.md` | Per-PR fragments; the changelog is generated (`scripts/changelog-collect.mjs`). |
| `STATUS.md` | A snapshot, refreshed on its own, never per PR. |
| `docs/HISTORY.md` | The old CLAUDE.md: dated hand-overs, every trap, the full locked-decisions audit. |
| `docs/ARCHITECTURE.md` | Draft wiring audit and folder jobs. |
| `docs/CONTROLLER_BRAIN.md` | The controller's operating protocol. |
| `docs/SETNAYAN_MASTER_BRIEF.md` | The portable brief to upload into Claude Chat for planning. |
| `.claude/rules/design-and-wiring.md` | The guardrails every build obeys (auto-loaded). |
| `.claude/skills/think-and-build/SKILL.md` | The mandatory 4-step thought process. |
