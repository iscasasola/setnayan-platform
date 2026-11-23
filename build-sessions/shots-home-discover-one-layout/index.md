# #7988 · Home and Discover, signed in — hand-off shots (22 Nov 2026)

Branch `claude/home-discover-one-layout` after merging origin/main `e72c4f313`, plus the pinned-row gutter fix.
`next dev` against the **local stub backend** (`stub-backend.mjs`, `TERMS=2026-10-23`): a signed-in user with an
**empty** account, so every shelf shows its empty state and Home's "Now happening" card is the shipped EXAMPLE.
**Not production data** — the cloud session cannot reach Supabase and must not sign into production.
Playwright Chromium; script `shots.cjs`.

| Shot | What it shows |
|---|---|
| `home-375-light.png` · `discover-375-light.png` | 375×812, light. One pinned row each; both pickers start at x = 16. |
| `home-375-dark.png` · `discover-375-dark.png` | 375×812, **dark FORCED** (`.dark` added by the script). `/` and `/dashboard` are not in `DARK_READY` (`lib/appearance.ts`), so today a person sees them light. These show how this PR's parts read once they are listed. |
| `home-desktop.png` · `discover-desktop.png` | 1280×860, light. |

Measured by the script (`pickLeft` = the pinned row's picker, px from the left edge):

```
375-light home      pinnedRows 1  pickLeft 16
375-light discover  pinnedRows 1  pickLeft 16     (was 0 before this hand-off)
tap Home→Discover:  barKept true  (the marked .shell-topbar is the same DOM node after the tap)
desktop home        pinnedRows 1  pickLeft 392    (Home's row sits in its centred column, as on main)
desktop discover    pinnedRows 1  pickLeft 264    (Discover's row spans the content column)
```

**BUILD_RULES §2 check**
- One pinned row per page: Home 1, Discover 1 (Home's segments swap one `HomePinnedRow`, never two).
- Search is a round icon until tapped: Discover's search is the thumb row's round icon (lower left). Home's
  "Search events" is a full field — that is main's `HomeFindRow` (v3 row 7, "the thumb rows' search fields become
  each segment's first row"); this PR only re-points its import, so it is left as main draws it.

**For the controller.** On desktop Discover the thumb row's round search icon sits on the rail's edge (top left of
the content). That is the thumb row's placement, which open PR #8091 changes (search icon dead centre).

## §4 proof (BUILD_RULES) — hand-off 22 Nov

1. **Shots**: above (375 light · 375 dark forced · desktop). Stub data, not production — the session cannot reach Supabase.
2. **Drawing parity** (`prototypes/user_dashboard_clean_2026-11-17/…_fable.html`): one bar for both pages, kept across
   the tap (measured `barKept: true`). Differences: on desktop Home's pinned row sits in its centred column (x = 392)
   while Discover's spans the content column (x = 264) — main's Home column, not changed here. "N new" is not drawn
   (its source, New uploads, was retired 16 Nov).
3. **Ways in walked** (signed-in couple, the only role this touches): bottom bar Home ↔ Discover (bar kept); the
   Discover pinned row's picker, "upcoming" and Following (`/?following=1`); ⚙ → `/dashboard/profile`. Signed-out `/`
   is drawn by `FrontDoor` as before (guard `3a`). Notifications and admin rows were not walked: none link anywhere new.
4. **Preflight from `apps/web`**, full run on `e64255967` (wall 39m 46s, 3 files at a time):

| check | result |
|---|---|
| 44 cheap CI guards | PASS |
| Lint port keeps every control | FAIL → fixed in the next commit, re-run PASS (see below) |
| Unit-test the feature register check | FAIL — environment only, see below |
| eslint on changed files (121) | PASS |
| tsc (121 changed files; importers did not fit in 3072 MB) | PASS |
| tests that name or import a changed file — 316 files, 2,734 tests | PASS |
| whole-tree guard tests — 732 files, 5,017 tests | PASS |
| DB tests that scan source — 34 files, 219 tests | PASS |

   - **Port lint**: main's Unichat part C (`23b2c4cd2`) stopped drawing `NegotiationQuote`, `QuoteSteps`, `LineRows`,
     `Cur`; this PR's baseline key had been renamed `/` → `/(hub)`, so git could not carry that removal across. Four
     lines removed by hand in `port-control-baseline.json` (a merge resolution, not a regeneration). Re-run: 45 guards PASS.
   - **Feature register test 24** reads the specs corpus when it is on disk (a sibling `../setnayan-specs` clone here;
     CI has none and skips it). It fails on main's own tree too (23 routes, 18 pointers). This PR adds exactly two
     stale pointers there: `FEATURE_REGISTER.md` names `app/page.tsx` and `app/dashboard/(launcher)/page.tsx`, which
     move to `app/(hub)/page.tsx` and `app/(hub)/dashboard/page.tsx`. **Specs-repo edit needed after merge.**
   - Left to CI: full typecheck, full unit suite, DB replay, build, bundle, lighthouse, e2e, secret scan.
5. **Overlapping open PRs**: #7935 `front-door.tsx` (+3 copy guards) · #8041 three copy guards · #8087
   `marketplace-view.tsx` · #8094 `every-logo-plays.test.ts` · #8080 `there-is-one-info-dot.test.ts` · #7868
   `face-tagging-rules.test.ts` · #7585 `home-carries-the-cron-free-jobs.test.ts` **and `app/page.tsx`**, which this
   PR moves — whichever lands second takes a rename conflict.
6. **§2 rules not followed**: Home's "Search events" is a full field, not a round icon (main's `HomeFindRow`, only
   re-imported here). Dark: `/` and `/dashboard` are not in `DARK_READY`, so neither page is dark yet (not this PR's
   slice). "Following" is drawn filled while off — a look call for the drawing session, left as built.
