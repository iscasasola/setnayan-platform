# THE ONE BUILD · lane L1 (Frame + event side) — notes

FOUNDATION PUSHED: (not yet — see "Where I stopped")

Branch `claude/supplier-1build-l1` (worktree `~/Documents/Claude/Projects/wt-l1`), from `origin/claude/supplier-1build-base`.
Early-push branch for the foundation: `claude/supplier-1build-foundation`.

## Done (code written; proved = tests green + lab screenshot at 375 px)

| Item | What | Proved |
|---|---|---|
| F1 | `--sn-cat-{booked,schedule,asked,collect}` light + dark, `--sn-hair`, `.sn-pin-hair`, `--sn-pin-h: 44px`, 520 ms rise (`--sn-dur-rise`, `--sn-ease-rise`, `lib/rise-motion.ts`), Tailwind `cat.*` | tests pending |
| §10 #23 | z-scale `--sn-z-thumb: 25` < `--sn-z-nav: 30` < `--sn-z-pop: 40` ≤ `--sn-z-modal: 50`; thumb rows + dock use the tokens; guard `app/_components/the-layers-are-ruled.test.ts` | tests pending |
| F2 | `CollapsingTop` / `CollapsingTopStack` (`app/_components/collapsing-top/`), Home's band on the shared `useStuck` | tests pending |
| F3 | hairline on L1-owned sticky rows; ratchet guard lists the other lanes' rows | tests pending |
| F4 | `useChromeAway` / `useTabReselect` / `dispatchTabReselect`, bar dispatches reselect | tests pending |
| carousel | `dots` prop (default true), `advanceMs={0}` = no auto-advance, loop + guard kept | tests pending |
| F5 | `SettingsMenu` gains `portfolio` (reserved, `live: false` — C4 flips it); customers ⚙ = "Clients settings" | tests pending |
| S1 | supplier bar Today · Clients · Shop · Portfolio; `portfolio` key + `vendor.sidebar.portfolio` / `vendor.bottom-nav.portfolio` slots; on-the-day + events light Clients; moodboard-library lights Portfolio; layout drops two reads | tests pending |
| S2 | "Clients" in L1 files (tours, help, helpers line, HowItWorks en + tl) | tests pending |
| S3 | avatar sheet: tiles Help · Show me around · Sign out on every sheet; supplier sheet "You are in" card; Sign out asks (supplier, other accounts); Your collections row dropped; Your Story's door → help centre | tests pending |
| Event B1/B2 | Today · Guests · Suppliers · Memories · Hub; Home → Today (word only; key `home`) in menu, registry, page-home, route-meta | tests pending |
| Event B3 | copy sweep "on/from Home" → Today (see changelog fragment for the list) | tests pending |
| Event B4/B5 | `papicCardHref` → `/dashboard/<id>/memories?papic=open#papic`; old `/dashboard/<id>?papic=open…` forwards to Memories | tests pending |
| Event B6/B7 | the Papic card on Memories, under the keepsakes, before the grid (`papic` slot in `EventMemoriesGallery`) | tests pending |
| Event B8 | card saves land on Memories (`return_to=memories`, `papicSeatBack`; `home` still honoured) | tests pending |
| Event B9 | Today draws no card; Papic row stands down where the card is in Memories; day console row opens the card | tests pending |
| Event B10 | tours: menu tour (Today first, Memories before Hub), Memories tour gains the Papic stop | tests pending |

## NEEDS FROM OTHER LANES

- **L2 / C1 / C4** — apply `sn-pin-hair` (or `box-shadow: 0 1px 0 var(--sn-hair)`) to their own sticky rows listed as KNOWN in
  `app/vendor-dashboard/no-cut-line-under-a-pinned-row.test.ts` and delete each line from KNOWN (the list only shrinks):
  L2 `customers-pin.tsx`, `clients/[eventId]/page.tsx`; C1 `supplier-open-row.tsx`, `today-counts.tsx`; C4 `shop-segments.tsx`,
  `services/_components/canvas-maker.tsx`.
- **C4** — drop `gallery` from `SHOP_SEGMENT_ORDER` with its Portfolio row (until then `supplier-page-menu.tsx` checks Portfolio
  BEFORE Shop so `/collections` lights Portfolio); flip `SETTINGS_ENTRY.portfolio` to its live door + own line; drop the
  `runsEvents` prop from `dev/supplier-lab/coord-lab.tsx` (`CoordLabBar` still accepts it, ignored).
- **L2** — use `useChromeAway` / `useTabReselect` (`app/_components/nav/use-chrome-away.ts`), `riseFromRect` (`lib/rise-motion.ts`),
  `--sn-pin-h`; "Clients" wording in `customers-pin.tsx` / `customers/page.tsx`.
- **Every lane** — z-index only through the tokens (`z-sn-thumb` / `z-sn-nav` / `z-sn-pop` / `z-sn-modal`), never raw.

## Generated-file / Ugat needs (controller)

- `lib/ugat/screens.generated.json` (`pnpm ugat:screens`), `lib/ugat/code-map.generated.json`, no-door / broken-door baselines
  (the `/dashboard/[eventId]/refer` page lost its account-sheet tile — owner "NO NEED", DL 2026-11-07).
- `scripts/port-control-baseline.json` (`node scripts/gen-port-baseline.mjs`): Papic's controls moved Today → Memories.
- `lib/design-rules.baseline.json` only if a back/adhoc entry DROPS.
- `lib/ugat/graph.ts` hub-viewers title "… Home › Who's here" → "… Today › Who's here" (I do not edit graph.ts).

## Questions (not guessed)

- `/dashboard/[eventId]/refer` now has no door (Refer tile removed per DL 2026-11-07 "NO NEED"). Keep the page or retire it?
- Supplier "Your page" avatar row kept (A1 S3: drop only if Shop keeps a `/vendor-dashboard/website` door — C4's call).

## Deviations (reported)

- `--sn-z-pop` stays **40** (not 50): existing pop-ups keep their layer; the Sheet is `--sn-z-modal: 50`. Order holds:
  thumb 25 < nav 30 < pop 40 ≤ modal 50.
- Chrome-away attribute sits on `<html>` (the dock can live outside `.fd`).
- Supplier "Sign out of…" opens IN PLACE under the tiles, not a second house `Sheet` stacked over the account sheet.

## Risks

- R1: prod `nav_slot_override` rows can override the registry labels ("Customers", "Home") — read-only check before "live".
- Supplier dark mode stays OFF (`DARK_READY`), tokens carry dark values.

## Request counts

- Supplier layout: −2 reads per supplier page (events-you-run + event-day-today reads left with the Hub tab).
- Memories (couple): +1 read (`resolvePapicHomeTile`, in parallel with the keepsake reads). Today: unchanged (it still reads the
  tile for its Papic line).

## Where I stopped

Typecheck + unit tests of touched files not yet run (heavy-lock queue). Next: `pnpm typecheck` under the lock, fix; run the touched
tests; commit foundation, sabotage each new guard once, preflight, push both branches; then write the sha above.
