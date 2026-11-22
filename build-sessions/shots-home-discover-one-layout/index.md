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
