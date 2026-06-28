## 2026-06-28 · feat(admin-nav): live queue-count badges on the Work nav + one shared count source (+ sidebar re-skin)

Headline: the always-on admin nav now shows **live open-work counts** so the
95%-of-sessions "is there work in this queue?" question is answered *without
opening the page*. Plus a vocabulary re-skin of the same nav surface.

### Live queue-count badges (the throughput win)
- New `lib/admin/queue-counts.ts` → `getAdminQueueCounts()`: the **single source of truth** for every Work queue's open count (keyed by nav-item key). The same head-count `Promise.all` had been copy-pasted **three times** (`/admin/work`, `/admin` overview, per-page) and had **already drifted once** (verify counted `coming_soon` vs `pending_review`); this consolidates it.
- `app/admin/layout.tsx` fetches counts (parallel with nav slots, **fails open to `{}`** — a count error never blanks the chrome) and passes them to both nav surfaces.
- `admin-sidebar.tsx`: each Work item badges its count — **red** for SLA-critical queues (disputes · force-majeure · account-deletions · approvals · user-reports), **amber** otherwise. Uses the already-shipped `NavBadge` → `<Badge>` render path (no new UI).
- `admin-bottom-nav.tsx`: the mobile **Work** tab badges the **sum** of all queue counts.
- `app/admin/work/page.tsx` refactored to consume the helper — **net code reduction** (~75 lines of duplicated query deleted).

### Command center — urgency-ranked worklist on desktop
- `/admin/work` was a complete prioritized triage feed but `lg:hidden` (dead on desktop). It's now the **desktop command center** too — reachable via a new **"All work"** entry atop the Work nav group.
- Ranking upgraded from **volume** to **urgency**: new `getAdminQueueDigest()` returns each queue's open count **plus its oldest-open age** (one round-trip per queue: `count:'exact'` + oldest-first + `limit(1)`); `ADMIN_QUEUE_META` gives each queue a **lane** (money/trust/growth/support) + an **owner-tunable `slaHours`**; `computeDueState()` ranks **overdue → due-soon → busiest**.
- The feed now splits an **"Needs attention now"** group (anything past SLA, red) from the rest, shows a per-row **lane tag** + **age line** ("Oldest 3d · past SLA"), tints by urgency, and lays out responsively (1-col phone / 2-col desktop). Fails open to "all clear" on a query error.
- `getAdminQueueCounts()` (nav badges) and `getAdminQueueDigest()` (command center) now share **one `QUEUE_DEFS` filter table** — a queue's "open" definition is written once, so the badge count and the worklist count can never disagree.

### Real-urgency escalation — one signal, everywhere
- Badge tone now tracks **actual overdue state**, not queue identity: a queue is red only when its oldest item has passed its SLA, amber when approaching, neutral when open-but-fine. (Before, "disputes" was always red even with a fresh item.) `getAdminQueueDigest()` is now the single fetch — wrapped in React `cache()` so the layout and the `/admin/work` page share one execution per request — and feeds badges + pill + worklist off the same `deriveQueueUrgency()` summary. Removed the now-redundant `getAdminQueueCounts()`.
- **Topbar escalation pill** (`app/admin/layout.tsx`): a red "**N overdue**" / amber "**N due soon**" pill leads the topbar utility cluster, visible on **every** admin page (not just when the eye is on the Work nav), linking to the command center. Only shows when something is actually due.
- Unit tests (`lib/admin/queue-counts.test.ts`) pin the overdue / due-soon / ok boundaries + the tally logic — the meaningful proof since prod is 0-open and the urgency UI can't be shown live yet.

### Morning digest email — cron-free (the "while you're away" channel)
- `runAdminDigestFlush()` (`lib/admin/digest-flush.ts`): a once-a-morning ops digest, **cron-free** — mirrors `runSocialFlush`, fired via Next 15 `after()` from the **public `/explore`** render (so it reaches an admin who isn't in the console) + the admin layout. In-memory throttle + a durable **single-row conditional-UPDATE claim** on `platform_settings` → exactly one send/day across instances. Trade-off vs a real cron: fires shortly *after* the 08:00 Asia/Manila target when the next visitor hits, not on the dot — fine for a daily snapshot (the badges + pill are the real-time channel).
- Branded email (Resend, via `lib/email-template.ts`) summarises open work by lane (Trust/Money/Growth/Support) with overdue counts + a "Open the work list" CTA. Pure content in `digest-content.ts` (unit-tested); IO/scheduling in `digest-flush.ts`.
- Migration `20270316513402_admin_digest_settings.sql`: two additive columns on `platform_settings` — `admin_digest_enabled` (**OFF by default** — no recurring email until the owner flips it on) + `admin_digest_last_sent_at` (the daily claim lock). No RLS change (existing table; service-role flush).
- **Triple-gated & safe to ship dormant:** sends nothing until (a) owner enables the toggle, (b) there's open work, (c) Resend is configured. Recipients = internal admins (`users.is_internal`).
- **UI toggle** (`/admin/settings` → "Ops notifications"): flip `admin_digest_enabled` from the dashboard instead of SQL — new `saveAdminDigest` action + checkbox, wired through `platform-settings.ts` (type + select + fallback).

### Vocabulary re-skin (secondary)
Keeps the owner-signed-off **verb axis** (act/find/tune, `Admin_Console_Nav_Redesign_2026-06-08.md`) — does **not** flip to topic-grouping — and **drops zero surfaces** / changes **zero URLs**.

- **Desktop sidebar** (`app/admin/_components/admin-sidebar.tsx`):
  - `Money & Catalog` → **Monetization** (key `money` preserved for localStorage continuity).
  - The 21-item **Platform** mega-group split into three scannable collapsibles:
    - **Data Structure** (key `content` kept — Platform's successor): Menus & icons · Taxonomy · Event Types · Refinements · Onboarding · Wedding types · Wedding traditions · AI brain.
    - **Content & Media** (new key `media`): Website · Hero video · Same-Day Edit · Reveal Studio · Real Stories · Recaps · Patiktok · Songs · Moodboard library.
    - **Settings** (new key `settings-group`): Settings · Notifications · Demo mode · My account.
  - Spine (Home · Work · Directory) and Insights unchanged.
- **Mobile parity** (`app/admin/more/page.tsx`, `app/admin/money/page.tsx`, `app/admin/_components/admin-bottom-nav.tsx`): the `/admin/more` overflow re-split into the same Data Structure / Content & Media / Settings sections; `/admin/money` landing relabelled to Monetization; bottom-nav route-matching unchanged (matches on routes, not group labels). Pre-existing mobile subset gap (menus · refinements · hero-video · sde · reveal-studio · recaps · patiktok are desktop-only) is preserved and documented, not introduced here.
- No registry-defaults change: groups are code-structure, not registry slots; every item `key` is unchanged so the `admin.sidebar.<key>` / `admin.bottom-nav.<key>` overlays and the `/admin/menus` editor are unaffected. `lint-nav-icon-source` + `lint-bottom-nav` guards pass.

SPEC IMPACT: None. Implementation-only nav relabel/regroup; no SKU, schema, price, or scope change. Verb-axis decision (2026-06-08) is respected, not overridden. Logged in `DECISION_LOG.md` for lineage.
