# #7868 · proof (BUILD_RULES §4) · 22 Nov 2026

The head merges `origin/main` `e72c4f313` (`fd5877170`), then `d6a6eb803` (the migration moves forward) and
`bb3347582` (the lab switch).

## 0 · Every old event link still redirects (the controller asked for this list)

`route-audit.txt`, next to this file, is the raw output. It ran the PR's real functions (`bareNestingRewrite`,
`oldSubPageTarget`, `publicEventPath`, `legacyUserPrefixRedirect`) for every folder under `app/[slug]` on disk
after the merge, with the switch off and with it on. The event slug is `our-wedding`, the creator's username is
`ana`, and the query is `?invite=abc`.

**Switch OFF (today):** `publicEventPath` returns `/our-wedding`, and no old link forwards. Every address is the
same as on `main`.

**Switch ON:**

| old link | what happens |
|---|---|
| `/our-wedding` | 307 → `/ana/our-wedding`. This is the page's canonical forward; the query is kept, and `?invite=` redeems first. |
| `/our-wedding/avatar` · `everyone` · `find-my-table` · `find-seat` · `hub` · `invite` · `invite/enter` · `invite/reply` · `pabuya` · `print` · `recap` · `request` · `seat` · `venue` · `welcome` | 307 → `/ana/our-wedding/<same>?invite=abc` (the `[slug]` layout's `forwardOldSubPage`). |
| `/our-wedding/hub` | main's `/hub` forwarder → `/our-wedding?tab=…` → 307 → `/ana/our-wedding?tab=…`. Two hops, and the guest lands. |
| `/our-wedding/redeem` (printed QR) · `announcement` · `icon/*` · `live-pulse` · `live-wall` · `manifest.webmanifest` · `open-as-pass` · `sign-out` | Route handlers, which the layout does not wrap. They are **still served at the old address**, so nothing breaks. `redeem` sends the guest on through `publicEventPath`. |
| `/our-wedding/cached/*` | Never forwarded, never nested. It is the internal copy and stays refused. |
| `/u/ana/our-wedding` | 308 → `/ana/our-wedding` |
| `/ana/our-wedding/<any page above>` | rendered by the internal rewrite to `/our-wedding/<page>`. No page word is ever read as a username: `misread=no` for every row. |
| `{event}.setnayan.com`, custom domains | unchanged; the forward skips a non-Setnayan host. |

None of these breaks a shared or printed link without a redirect, so this does **not** need the owner.

Two pins hold it: `lib/an-event-lives-under-its-creator.test.ts` §2, which checks the second word against the
folders on disk, and §5, which pins `/cale-ice` and `/maria-and-jose`.

## 1 · Screenshots
See the `home-*` files. They come from `/dev/bar-lab/dashboard?made=1` with `NEXT_PUBLIC_U_NESTING_CUTOVER=true`:
Home's handle line reads `…/ana-mercado`, plus the once-only "We made this from your name. Change it". These are
lab fixtures; this builder has no database and never reads prod. With the switch off, no screen changes.

**Dark:** `/dashboard` is on `DARK_READY`, but the lab route is not, so the dark shot paints light.

## 2 · Drawing parity
There is no drawing. The source is the address map `ADDRESS_MOVE_MAP_2026-11-15_fable.md`. Still not built (named
in the PR body): handing the address to a co-host.

## 3 · Ways in walked
- Every event address (§0).
- Home's handle line (shot).
- The 46 hand-built links now go through `publicEventPath`. Guard §7 fails on any new hand-typed `` `/${event.slug}` ``. Main's one new link (`site-body.tsx` → `/find-my-table`) was converted in this merge.

## 4 · Guards (from `apps/web`)
See the table below (filled in after the run).

## 5 · Files overlapping other open PRs
Mostly generated files, which the controller regenerates once per train:
- `screens.generated.json`: 17 PRs.
- `port-control-baseline.json`: 18 PRs.
- `exposure-surface.baseline.txt`: #7585, #7881, #7920, #7968, #8019, #8057, #8088, #8095.
- `user-fk-behaviour.generated.txt`: #7585, #7881.
- `no-door.baseline.txt`: #7908, #7968, #8046, #8057, #8088, #8094.

Source files:
- #7908: `lib/request-key.test.ts`, `scripts/lint-events-column-grants.mjs`.
- #7988: `lib/face-tagging-rules.test.ts`.
- #8004: `[slug]/_components/editorial/editorial-content.tsx`, `[slug]/_lib/loaders.ts`, `website/widgets/page.tsx`.

## 6 · Rules I could not follow, and why
- **Generated files were NOT regenerated** (controller rule). Each conflict hunk takes main's side, and the PR's
  non-conflicting rows are kept. The FK and exposure header counts were recomputed by hand from the merged bodies
  (303 FKs, SET NULL 220; 8,271 facts, col 5,953). If a drift guard says `screens.generated.json` or
  `port-control-baseline.json` is behind, the train regenerates it.
- **The migration was renamed** `20271350564435` → `20271357986226` (with `pnpm migration:new`). It is unmerged, so
  nothing was applied anywhere. The reason is in the migration's own comment and in the changelog fragment.
