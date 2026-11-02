## 2026-08-24 · refactor(admin): the tabbed consoles stop repeating their own tab label (2/4)

Sixteen surfaces under `/admin/pricing`, `/admin/settings`, `/admin/studio`, `/admin/ugat` and
`/admin/app-performance` render inside a tab strip that already names them — and then drew the
name again underneath, at 24–36px, with a mono eyebrow above it and a paragraph below.
The bill in `admin-page-starts-at-its-content.test.ts` goes **50 → 34**.

⚖ **The ledes split roughly down the middle, one at a time.** Rung four's rule is not "delete
every lede" — it is that a sentence a person needs in order to USE a page belongs in the page,
beside the thing it governs. Orientation went. What stayed and why is written at each site, and
three are pinned by the guard: *"these are not BIR ORs"* (a tax problem, not a layout one),
*"go live on couple sites"* (nothing else says a slider here reaches strangers' wedding pages),
and the *starter content* warning on wedding traditions.

🔒 **Deleting a header is not permission to delete what was in it.** Three things were held in
these headers and are now in `actions` or in the page: the `/admin/addons/pricing-report`
download — the **only** export path for the legacy v1 catalog, re-homed into that header on
2026-07-21 precisely so it would not be orphaned — and the two "demo data" badges, each the only
thing on its screen saying the numbers below it are illustrative. `lint-port-no-lost-controls`
catches a lost link; it has nothing to say about a lost badge, which is worse, because the numbers
stay on screen and become untrue.

SPEC IMPACT: None.
