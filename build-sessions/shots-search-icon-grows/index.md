# #8091 · the thumb-row search — round icon at rest, one tap grows it to the row (hand-off, 22 Nov 2026)

Branch `claude/supplier-search-icon-grows` after merging origin/main `e72c4f313` (clean merge). Shots from `next dev`
on the dev lab `/dev/thumb-row-lab` (no sign-in, fixture list; the rows are the shipped `TodayThumbRow` and
`DiscoverThumbRow`). The root layout is pointed at a local stub (`../../build-sessions/shots-home-discover-one-layout/stub-backend.mjs`
on #7988's branch) only so it can build its Supabase client — the lab reads nothing. Playwright Chromium; `shots.cjs`.

| Shot | What it shows |
|---|---|
| `today-rest-*.png` · `discover-rest-*.png` | At rest: the search is a 44 px round icon, lower left; Show (SlidersHorizontal) on the right. |
| `today-open-*.png` · `discover-open-*.png` | 1.4 s after ONE tap: the field has grown to the row and holds the cursor. |
| `*-375-light` · `*-375-dark` · `*-desktop` | 375×812 light · 375×812 **dark FORCED** (`.dark` added; the lab is not a DARK_READY route) · 1280×860. |

Measured by the script (icon offset = the magnifier's centre minus the round's centre, px):

```
view       screen    rest: seat   icon off (x,y)   open: seat / row   focused
375 light  today     44×44        0, 0             343 / 343          yes
375 light  discover  44×44        0, 0             343 / 343          yes
375 dark   today     44×44        0, 0             343 / 343          yes
375 dark   discover  44×44        0, 0             343 / 343          yes
desktop    today     44×44        0, 0             686 / 736          yes   (Show stays beside it on desktop)
desktop    discover  44×44        0, 0             736 / 736          yes
```

A headless browser has no on-screen keyboard, so the grow here is the hold's fallback (it lets go after Rise 700
with no keyboard). The keyboard-ride path is not visible in these shots and, per the PR, not yet seen on a real iPhone.

**BUILD_RULES §2 check**
- "Search is a round icon until tapped. One tap opens the box with the keyboard up": yes — round 44 px at rest,
  dead centre; one tap focuses the field (`focused: yes`) while it grows.
- "One pinned row per page": not touched — the thumb row is the lower-third tool row, not a pinned row.
- "The sort or show control is the SlidersHorizontal icon": yes (right of the row).
- Motion values are the standard's tokens (`--sn-m-quick`, `--sn-m-settle`); no raw ms or cubic-bezier added in CSS.

**Drawing parity** (`Setnayan-specs/prototypes/search_icon_grows_2026-11-21_fable.html`, MOTION_STANDARD #11 already
records it): end states match (round icon → full-row field, words in, Show gone on phone). The in-between frames of
the grow (Move 320 · Spring, 8 px overshoot cap) were not filmed here.

## §4 proof (BUILD_RULES) — hand-off 22 Nov

1. **Shots**: above (375 light · 375 dark forced · desktop; rest and after one tap).
2. **Drawing parity**: above. In-between frames not filmed; the keyboard-ride path not seen (no on-screen keyboard headless).
3. **Ways in walked**: the thumb row is one shared part (`components/thumb-row.tsx`); walked on the supplier's Today
   row and the couple's Discover row via the lab. Clients, People, Events, Chats and admin rows use the same part and
   were not walked here (the PR measured them 0 px off in WebKit + Chromium).
4. **Preflight from `apps/web`**, full run on `8e0738f49` (wall 35m 35s, 3 files at a time):

| check | result |
|---|---|
| 45 cheap CI guards | PASS |
| Unit-test the feature register check | FAIL — environment only, see below |
| eslint on changed files (4) | PASS |
| tsc (4 changed + 34 of 34 importers) | PASS |
| tests that name or import a changed file — 152 files, 941 tests | PASS |
| whole-tree guard tests — 783 files, 5,465 tests | PASS |
| DB tests that scan source — 32 files, 206 tests | PASS |

   - **Feature register test 24** reads the specs corpus when a clone sits beside the repo (here it does; CI has none
     and skips it). It fails on main's tree too (23 routes, 18 pointers missing from `FEATURE_REGISTER.md`). This PR
     adds no route and moves no file, so it adds nothing to that list.
   - Left to CI: full typecheck, full unit suite, DB replay, build, bundle, lighthouse, e2e, secret scan.
5. **Overlapping open PRs**: none (no other open PR touches `thumb-row.*`, `search-grows.ts`, the lab or the guard).
6. **§2 rules not followed**: none found.
