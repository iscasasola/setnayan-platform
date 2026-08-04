## 2026-07-11 · fix(dashboard): re-audit follow-ups — vendor chip contrast, /activity reachability, admin gates, vendor active-state, dead-code, chat-guard hardening

Second-order fixes surfaced by an adversarial re-audit of the dashboard
audit-fix PRs — several are regressions those fixes introduced.

- **Vendor "Plan" chip invisible on the dark sidebar (Finding 1 · regression).**
  The globals.css `.sn-sidebar` remap `--m-orange-2 → --m-orange-3` (the fix
  that lifted AccountSwitcher initials contrast on the obsidian panel) also
  recoloured the VendorSidebarFooter tier chip's text/icon to light champagne —
  but its fill was still the light cream `--m-orange-4`, landing ~1.34:1
  (invisible). Recoloured the chip FOR the dark panel: translucent gold fill
  (`color-mix(in srgb, var(--m-orange) 22%, transparent)`) + a gold-mix border,
  keeping the now-light `--m-orange-2` text/icon → ~6.43:1 on the tile (~7.06:1
  on obsidian). The globals.css remap is untouched.

- **/activity became unreachable in the couple UI (Finding 2 · regression).**
  #3055 removed the top-level Budget nav item, whose `activity` child was the
  only couple-UI link to `/dashboard/[id]/activity`; the docstrings claimed a
  "dashboard-body see-all link" that did not exist. Added a "See all recent
  activity →" link at the foot of the dashboard body's "Around your event"
  section (`event-dashboard.tsx`) and corrected the now-accurate docstrings in
  `customer-nav-config.ts`, `customer-sidebar.tsx`, and the `fix-nav-audit.md`
  fragment. The /activity page is unchanged and renders.

- **Ungated admin service-role reads (Finding 3 · defense-in-depth).** The three
  pages that do direct service-role (`createAdminClient`, RLS-bypassing) reads
  without their own auth gate — `admin/discount-codes/new/page.tsx`,
  `admin/background-videos/page.tsx`, and (found by sweeping every admin
  `page.tsx`) `admin/insights/page.tsx` — were **independently gated on `main` by
  PR #3073 (admin recheck)** with the identical `await requireAdmin()` as the
  first statement while this branch was in flight. This branch rebased onto that
  fix and dropped its redundant duplicate to avoid a conflict; the net state on
  the branch is that all three are gated. `admin/demand/page.tsx` was reviewed
  and correctly left ungated: its rendered data flows through the RLS-scoped
  client + an `is_console_admin()`-gated RPC; its only service-role touch is a
  throttled post-response background refresh in `after()`.

- **Vendor Services active-state broken on the wizard (Finding 4 · regression).**
  #3052 repointed the Services sidebar primary href to
  `/vendor-dashboard/attributes`; since `matchPrefix` defaults to the href
  pathname, the guided "Add a service" wizard at
  `/vendor-dashboard/services/new/[category]` no longer lit or expanded the
  Services section. Added explicit `matchPrefix: '/vendor-dashboard/services'`
  (href kept). No double-lighting: the bare `/vendor-dashboard/services`
  redirects to `/shop`, which is not under `/services`.

- **Orphaned SchedulePreview component (Finding 5 · dead-code).** Deleted
  `app/dashboard/[eventId]/_components/schedule-preview.tsx` — its only importer
  (`schedule-preview-async.tsx`) was removed in #3056, and the Overview Schedule
  card now renders inline via the `selectSchedulePreviewBlocks` lib helper (which
  stays, along with its type + tests). Verified zero remaining importers.

- **Chat-guard split-chain bypass (Finding 6 · hardening).**
  `scripts/lint-admin-chat-guard.mjs` whitelisted an entire line containing
  `chat-guard-allow` and only matched table-name tokens, so — because the
  Supabase chain splits `.from('chat_messages') // marker` from `.delete()` — a
  future edit flipping `.delete()` to `.select('body,…')` would slip past. Made
  the guard verb-aware for CHAT/ATTACHMENT tokens: it now scans the marked
  statement (line → terminating `;`) and FAILS if it contains a READ verb
  (`.select(` / `.single(` / `.limit(` / `fetchMessages`) or lacks a mutation
  verb (`.delete(` / `.update(` / `.insert(`), proving a marked exception is
  write/delete-only. FACE tokens keep the whole-line exception (their sanctioned
  uses are `count:'exact', head:true` NPC tallies that read zero vectors). Added
  an inline self-test (runs every invocation) asserting the real erasure DELETE
  passes and a hypothetical marked `.select` on chat_messages fails. The current
  `admin/users/actions.ts` erasure DELETE still passes.

Verification: `tsc --noEmit`, `next lint` (touched files), the radius /
nav-icon-source / bottom-nav / legibility / chat-guard guards, `tsx --test
lib/**/*.test.ts` (1455 pass), and `next build` all pass.

SPEC IMPACT: None (second-order fixes from the re-audit — nav-chrome contrast +
reachability, admin auth defense-in-depth, vendor sidebar active-state, dead-code
removal, and a build-guard hardening; no schema, RPC, SKU, pricing, or route
change).
