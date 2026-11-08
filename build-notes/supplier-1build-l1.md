# THE ONE BUILD · lane L1 (Frame + event side) — notes

FOUNDATION PUSHED 0d9c7c4217 (origin/claude/supplier-1build-foundation; first push 811acdb580 by the controller, this a fast-forward on top)

Branch `claude/supplier-1build-l1` (worktree `~/Documents/Claude/Projects/wt-l1`), from `origin/claude/supplier-1build-base`.
Early-push branch for the foundation: `claude/supplier-1build-foundation`.

## Done (code written; proved = tests green + lab screenshot at 375 px)

Screenshots (375 px, dummy env, `scrollWidth === 375` on every one) in `build-notes/l1-shots/`:
v113 `v113-today.png` · `v113-sheet.png` | build `build-sheet-supplier.png` (/dev/avatar-sheet-lab?who=supplier) ·
`build-sheet-couple.png` · `build-bar-supplier.png` (Today · Clients · Shop · Portfolio) · `build-bar-event.png`
(Today · Guests · Suppliers · Memories · Hub) · `build-memories.png` · `build-today-papic-in-memories.png`
(/dev/home-lab?card=1: Today draws no Papic row; the card in Memories' seat) · `build-collapsing-top.png`.
(The red "3 Issues" pill on the dev shots is Next's dev overlay for the dummy-env fetches — not part of the page.)

| Item | What | Proved |
|---|---|---|
| F1 | `--sn-cat-{booked,schedule,asked,collect}` light + dark, `--sn-hair`, `.sn-pin-hair`, `--sn-pin-h: 44px`, 520 ms rise (`--sn-dur-rise`, `--sn-ease-rise`, `lib/rise-motion.ts`), Tailwind `cat.*` | tests green (run singly) |
| §10 #23 | z-scale `--sn-z-thumb: 25` < `--sn-z-nav: 30` < `--sn-z-pop: 40` ≤ `--sn-z-modal: 50`; thumb rows + dock use the tokens; guard `app/_components/the-layers-are-ruled.test.ts` | tests green (run singly) |
| F2 | `CollapsingTop` / `CollapsingTopStack` (`app/_components/collapsing-top/`), Home's band on the shared `useStuck` | tests green (run singly) |
| F3 | hairline on L1-owned sticky rows; ratchet guard lists the other lanes' rows | tests green (run singly) |
| F4 | `useChromeAway` / `useTabReselect` / `dispatchTabReselect`, bar dispatches reselect | tests green (run singly) |
| carousel | `dots` prop (default true), `advanceMs={0}` = no auto-advance, loop + guard kept | tests green (run singly) |
| F5 | `SettingsMenu` gains `portfolio` (reserved, `live: false` — C4 flips it); customers ⚙ = "Clients settings" | tests green (run singly) |
| S1 | supplier bar Today · Clients · Shop · Portfolio; `portfolio` key + `vendor.sidebar.portfolio` / `vendor.bottom-nav.portfolio` slots; on-the-day + events light Clients; moodboard-library lights Portfolio; layout drops two reads | tests green (run singly) |
| S2 | "Clients" in L1 files (tours, help, helpers line, HowItWorks en + tl) | tests green (run singly) |
| S3 | avatar sheet — CONTENT ONLY (owner ruling 8 Nov, below): tiles Help · Show me around · Sign out on every sheet; supplier sheet "You are in" card (the shipped "Your shop" card, relabelled); Your collections row dropped; Your Story's door → help centre; Refer a couple's door → Help (`/help?refer=<event>` → "Refer a couple ›", programme on only) | G10 6/6 + reachable-without-typing 3/3 |
| Event B1/B2 | Today · Guests · Suppliers · Memories · Hub; Home → Today (word only; key `home`) in menu, registry, page-home, route-meta | tests green (run singly) |
| Event B3 | copy sweep "on/from Home" → Today (see changelog fragment for the list) | tests green (run singly) |
| Event B4/B5 | `papicCardHref` → `/dashboard/<id>/memories?papic=open#papic`; old `/dashboard/<id>?papic=open…` forwards to Memories | tests green (run singly) |
| Event B6/B7 | the Papic card on Memories, under the keepsakes, before the grid (`papic` slot in `EventMemoriesGallery`) | tests green (run singly) |
| Event B8 | card saves land on Memories (`return_to=memories`, `papicSeatBack`; `home` still honoured) | tests green (run singly) |
| Event B9 | Today draws no card; Papic row stands down where the card is in Memories; day console row opens the card | tests green (run singly) |
| Event B10 | tours: menu tour (Today first, Memories before Hub), Memories tour gains the Papic stop | tests green (run singly) |
| Guards | NEW: G1 `supplier-bar-is-today-clients-shop-portfolio` (git mv of vendor-bar-is-four), G2 `nav/the-bar-is-laid-out-by-its-tabs`, G3 `vendor-dashboard/the-tab-is-called-clients` (ratchet), G4 `no-cut-line-under-a-pinned-row` (ratchet), G5 `the-top-scrolls-up-and-locks`, G6 `the-chrome-steps-away`, G8 `the-hub-has-doors-without-a-tab`, G10 `account-switcher/the-supplier-sheet-order`, §10 #23 `the-layers-are-ruled`, `category-colours-are-tokens`. Each NEW guard sabotaged once, seen red, restored (recorded in its docblock). G9 (sheet above thumb row) is held inside `the-layers-are-ruled`. | green (run singly) |

## NEEDS FROM OTHER LANES

- **L2 / C1 / C4** — apply `sn-pin-hair` (or `box-shadow: 0 1px 0 var(--sn-hair)`) to their own sticky rows listed as KNOWN in
  `app/vendor-dashboard/no-cut-line-under-a-pinned-row.test.ts` and delete each line from KNOWN (the list only shrinks):
  L2 `customers-pin.tsx`, `clients/[eventId]/page.tsx`, `customers-calendar.tsx`; C1 `supplier-open-row.tsx`, `today-counts.tsx`; C4 `shop-segments.tsx`,
  `services/_components/canvas-maker.tsx`.
- **C4** — drop `gallery` from `SHOP_SEGMENT_ORDER` with its Portfolio row (until then `supplier-page-menu.tsx` checks Portfolio
  BEFORE Shop so `/collections` lights Portfolio); flip `SETTINGS_ENTRY.portfolio` to its live door + own line; drop the
  `runsEvents` prop from `dev/supplier-lab/coord-lab.tsx` (`CoordLabBar` still accepts it, ignored).
- **L2** — use `useChromeAway` / `useTabReselect` (`app/_components/nav/use-chrome-away.ts`), `riseFromRect` (`lib/rise-motion.ts`),
  `--sn-pin-h`; "Clients" wording in `customers-pin.tsx` / `customers/page.tsx`.
- **L2** — "Customers" → "Clients" in `customers/page.tsx` (metadata + h1), `customers-pin.tsx` (aria-label, label, button
  text), `clients/[eventId]/page.tsx` (back link); then delete each from KNOWN in
  `app/vendor-dashboard/the-tab-is-called-clients.test.ts` (it only shrinks).
- **L2** — the picked client's Hub page should link the Hub room (`/vendor-dashboard/on-the-day`, spec G8 "Today + client
  card"). Today it has no such door; G8 holds ≥2 doors (7 today) and Today's — add the client page to its required list
  when it lands.
- **Every lane** — z-index only through the tokens (`z-sn-thumb` / `z-sn-nav` / `z-sn-pop` / `z-sn-modal`), never raw.

## Generated-file / Ugat needs (controller)

- `lib/ugat/screens.generated.json` (`pnpm ugat:screens`), `lib/ugat/code-map.generated.json`, no-door / broken-door baselines
  (the `/dashboard/[eventId]/refer` page lost its account-sheet tile — owner "NO NEED", DL 2026-11-07).
- `scripts/port-control-baseline.json` (`node scripts/gen-port-baseline.mjs`): Papic's controls moved Today → Memories.
- `lib/design-rules.baseline.json` only if a back/adhoc entry DROPS.
- `scripts/port-control-baseline.json` (`pnpm -C apps/web port:baseline`) — the full preflight's "Lint port keeps every control" is red
  for exactly that move; `lib/ugat/screens.generated.json` makes "Root map is current" + `lib/ugat/screens-are-generated.test.ts` red.
- `lib/ugat/graph.ts` hub-viewers title "… Home › Who's here" → "… Today › Who's here" (I do not edit graph.ts).

## Registry requests from other lanes

- C4 (`lib/tours.ts`): Shop tour stops → `shop-details`, `shop-analytics`, `shop-badges` (page order). **DEFERRED TO
  INTEGRATION**: those anchors exist only on `claude/supplier-1build-c4`, so on L1 alone `lib/spotlight-anchors-exist.test.ts`
  would go red. Ready edit: `vendor_shop_v1.spotlight.steps` = [shop-details "Your details", shop-analytics "How it is going",
  shop-badges "Your badges"], dropping `shop-segments` / `shop-page-list` / `shop-details-row`.
- L2 (`lib/menu-settings.ts`): a `client` key — ADDED, `reserved` + `live: false` ("Client settings"). The spec (B1 step 5)
  names the picked client's ⚙ but not its rows; whoever rules them flips it live. QUESTION below.
- C3 (`lib/page-home.ts`): Form Maker sheet + Forms/Report bodies, back = Clients list — ALREADY COVERED: they render inside
  `/vendor-dashboard/clients/[eventId]` (`_pages/*`, not routes), whose home is `/vendor-dashboard/customers`. A sheet has no
  route; there is no `/vendor-dashboard/forms` page.
- C4 (`lib/menu-settings.ts`): C4 also adds the `portfolio` ENTRY + `| 'portfolio'` — at integration keep ONE of each.
- C1: keep C1's `lib/tours.ts` edits at integration (`vendor_today_v3`, re-pointed stops, `vendor_setup_tour_v1`). The
  "Today, Customers, Shop and Hub" wording C1 flagged is already swept on L1 (help `supplier-dashboard-tabs`; crew pass copy).

## Questions (not guessed)

- `/dashboard/[eventId]/refer`: its tile left (DL 2026-11-07 "NO NEED"); per spec §215 its door is now INSIDE Help — an event's
  sheet opens `/help?refer=<event>` and the help centre draws "Refer a couple ›" (programme on, signed in). Retire the page
  instead? Owner call; built as "reachable inside Help" meanwhile.
- The picked client's ⚙ (`client` key): what does its sheet hold? Spec B1 step 5 shows the ⚙ but no rows.
- Supplier "Your page" avatar row kept (A1 S3: drop only if Shop keeps a website door — that is §10 #31, held for Build 2).

## Deviations (reported)

- `--sn-z-pop` stays **40** (not 50): existing pop-ups keep their layer; the Sheet is `--sn-z-modal: 50`. Order holds:
  thumb 25 < nav 30 < pop 40 ≤ modal 50.
- Chrome-away attribute sits on `<html>` (the dock can live outside `.fd`).
- The TOP bar's away-slide keeps **no** reduced-motion stop (the bottom bar's does): the existing lock
  `vendors/find-walk-fixes.test.ts` #2 says the top bar slides for everybody, and the pinned block / category head carry no
  reduced-motion exception. My own guard (`the-chrome-steps-away.test.ts`) now asserts that instead.
- Memories now imports `../_components/open-event-settings` (side effect): the Papic card's settings open Event Settings,
  whose action answers drawn editors — without it Memories would crash exactly as Home did on 29 Oct
  (`the-settings-sheet-is-in-homes-graph.test.ts` was red, now green).
- ~~Supplier "Sign out of…" opens IN PLACE under the tiles~~ — REMOVED. **OWNER RULING 8 Nov (S3), via coordinator:** *"this menu pop up from the upper right already has a design and i like the design. only the content is what you change."* The sheet keeps the shipped look (white grouped cards, serif name header + "Profile & settings ›", round icon tiles, pill badges, Appearance pill, red Sign out tile, quiet "Sign out of all accounts" line). No styling was changed: every card/row/tile uses the shipped classes. The one non-content addition — the spec's "Sign out of…" choice card (A1 S3 item 7), which also hid the quiet line on the supplier sheet — was reverted to the shipped tile + quiet line on EVERY sheet. G10 test 4 now pins that (sabotaged: `!supplierSheet` back on the quiet line → red).

## Controller rulings (8 Nov)

- **NEW OWNER RULE — BUILD 2.** Small adjustments (moves, animations) no longer go into this build; they are collected into
  BUILD 2, which runs after this one ships. This build = v113 + spec §10 #23–#25 only.
- **§10 #30 — RESPECTED.** The account sheet keeps the SHIPPED design (owner: *"this menu pop up from the upper right already
  has a design and i like the design. only the content is what you change."*). No styling touched; the spec's "Sign out of…"
  choice card was reverted to the shipped red Sign out tile + quiet "Sign out of all accounts" line on every sheet (G10 test 4
  pins it). Content deltas kept: tiles Help · Show me around · Sign out; "You are in" card (the shipped "Your shop" card,
  relabelled); Your collections row out.
- **§10 #31 — HELD FOR BUILD 2, NOT IN THIS BUILD.** (Shop ⚙'s FIRST entry "Your page · what couples see, all your reviews
  inside" → /vendor-dashboard/website; "Your details" only in the account sheet.) It was built (421dfaef1a) and then REVERTED
  (4f0a72c258 + the changelog and the sheet reshoot) on the controller's Build-2 rule. Ready to re-apply in Build 2:
  `git revert 4f0a72c258` (adds `SHOP_SETTINGS_FIRST` in `lib/menu-settings.ts`, its row in `shop/_components/shop-settings.tsx`,
  drops the account sheet's Your page row, guard in `profile/your-details-are-one-list.test.ts` test 3).

## Risks

- R1: prod `nav_slot_override` rows can override the registry labels ("Customers", "Home") — read-only check before "live".
- Supplier dark mode stays OFF (`DARK_READY`), tokens carry dark values.

## Request counts

- Supplier layout: −2 reads per supplier page (events-you-run + event-day-today reads left with the Hub tab).
- Memories (couple): +1 read (`resolvePapicHomeTile`, in parallel with the keepsake reads). Today: unchanged (it still reads the
  tile for its Papic line).

## Where I stopped

- All L1 work items done (F1–F5, S1–S3, event side, registry requests, §10 #23; §10 #30 respected; §10 #31 held for Build 2
  and reverted — re-apply with `git revert 4f0a72c258`). Built to v113 + §10 #23 only (#24/#25 are C4's).
- `origin/claude/supplier-1build-base` (train 2A) merged in: one conflict (`the-room-is-called-the-event-hub.test.ts`) —
  kept L1's no-tab assertions under base's name "Hub"; the page-home label for `/vendor-dashboard/on-the-day` is "Hub".
- Full preflight on 79ff08adf7 had 15 red; every non-generated red is fixed in 8b17d4ee82 (each run singly, green).
  Left red, NOT L1's to fix: the two generated maps above (port baseline, ugat screens) and base-inherited
  export-coverage-guardrail, shop-name-hold, ugat-both-ends `shop_name_is_held`.
- `wt-l1-fnd` worktree pruned.
