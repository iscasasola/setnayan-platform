# HANDOVER — claude/supplier-ready-tomorrow (builder, 29 Oct 2026)

Worktree: ~/Documents/Claude/Projects/wt-supplier-ready · branch claude/supplier-ready-tomorrow · base origin/main cd137db2ee

## Done
- S1 · Events you run for a live co-host seat (lib/events-you-run.ts, .server.ts, -words.ts lede, customer card pill,
  supplier-lab `?s=coord-today|coord-events|coord-customer&cohost=1`). Tests green; two sabotages red (rule, read).

- S2 · name/address by request for a shop Setnayan set up (lib/vendor-corrections.ts identityLockOf /
  identityLockRefusal / rowAsks; actions.ts updateVendorProfileField; RequestOnlyRow in editable-row.tsx; ask card
  requestOnly; lab `?s=details&invited=1&asked=1`). Guard lib/a-shop-setnayan-set-up-asks-to-rename.test.ts green,
  two sabotages red.
- S3 · basic setup first (lib/basic-setup-gate.ts + app/vendor-dashboard/_components/basic-setup-hold.tsx, one mount
  in layout.tsx). Guard lib/basic-setup-gate.test.ts green, three sabotages red.

- S4 · offerProgress counts each real service once (lib/supplier-setup.ts coarse param; vendor-first-steps.server.ts
  passes VENDOR_CATEGORIES). Guard lib/what-you-offer-counts-each-service-once.test.ts; sabotages red.
- S2 row asks in place now (RequestOnlyRow has its own Send).

- S5 (report only): an EVENT stylist picks Group "Styling, flowers & lights" (design) › Category "Stylist / Decorator"
  (stylist_decorator) › Service stylist_decorator (or decorator_general). A HAIR/MAKE-UP stylist: "Attire, hair &
  make-up" (look) › "HMUA" (hmua) › bridal_hair_stylist / bridal_hmua. Labels from migrations
  20271139755588 (group labels) + 20270520996335 (tree); confirm in Admin › Categories (admin may have renamed).
- S6 · badges on /vendor-dashboard/performance (YourBadges + badgeShelf; Batch A). Rule 0: Today's earned line
  (badge-earned-line.tsx, mounted in vendor-dashboard/page.tsx) STAYS — no ruling moves it; it announces a NEW badge
  once, the performance page is where they live. The full tracker stays on Shop › Page (website/_components/badge-tracker.tsx).

- S4b · Home Limited · Full access card (lib/coordinator-access-level.ts; _components/coordinator-level-card.tsx +
  coordinator-level-ask.tsx; setDelegateArea branch `access_level`; People with access pick). Lab /dev/home-lab?level=1.
- S4c · db test proves: switch ON does NOT let a coordinator Apply (0 rows); Full (co-host seat) does. DEVIATION from the
  controller's S4c note "switch ON counts as chosen = Full": NOT done — it would hide the card from exactly the seat that
  cannot Apply. The card asks every connected coordinator with no recorded answer; pressing Full makes Apply work today,
  no migration.

- S7 · no stub bounces (guard app/vendor-dashboard/no-stub-bounces.test.ts; baselines regenerated).
- S8 (partial): notes + challenge save in place; 15 flag-carrying actions listed in the guard for the next pass.
- S9 · seat finder row on the Hub; Message everyone rows on /vendor-dashboard/events (guard the-supplier-tools-have-doors).

## State
- Draft PR #7041 (label do-not-auto-merge). No migration, no new server action (server-action ceiling untouched).
- DECISION_LOG row pushed to corpus origin/main (1bef8507) — "A SUPPLIER INVITED IN IS READIED"; badge + co-host
  rulings were already recorded by the controller (rows "BADGES LIVE ON THEIR SHOP PERFORMANCE PAGE", "ONLY TWO LEVELS").
- Walk: ~/Documents/Claude/Projects/shots-2026-10-29/supplier-ready/ (run-walk.sh takes the walk lock, one dev
  server on :3488, rm .next, release). Results in walk.log.

## Walks (shots-2026-10-29/supplier-ready/, walk.log + walk2.log)
- Walk 1: 14 lab states × 390 WebKit + 1280 Chromium × light/dark = 56 loads, all 200, no page errors, no sideways
  scroll. Walk 2: Home level card + Message everyone + seat finder, 20 loads (2 cold-compile timeouts at 390 light,
  re-taken fine in dark + 1280). Pressing Full access in the lab (dummy Supabase) → the refusal is said and the ask
  comes back. Labs render light in dark mode (the lab pages are not themed). Next dev overlay shows "3 Issues" on lab
  pages (dev console noise, not investigated).
- Full unit suite locally: 28,456 pass / 2 fail → both fixed (bind membership error; client-landing floor 27→24).

## Next
- CI on #7041 (merged origin/main e631dd51; maps regenerated). Server actions 1225 = ceiling, none added.
- S8 remainder: 15 flag-carrying actions in the-event-card-saves-in-place.test.ts STILL_NAVIGATES.
- Delete this HANDOVER file before merge if not wanted on main.
