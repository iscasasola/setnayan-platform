## 2026-07-10 · feat(vendors): search the Shortlist bench (PR-4 · S3)

Added a search box atop the couple **Shortlist** bench (`ShortlistCategories`) — a client-side filter over the ~53 categories and their considered vendors. Empty = the normal single-open accordion; a query filters folders to matching tiles (by category label or a shortlisted vendor's name) and shows every match **expanded** (multi-open while searching), so a couple can jump to "florist" or find where they saved a vendor without scrolling ten folders. Clearing the search restores the single-open accordion (both animate via the existing grid-rows collapse). A "no matches" line shows when nothing fits.

Purely client-side over the folders already in props — no query, no server change. A *global* vendor search would duplicate `/explore`; this is the in-bench filter that `/explore` doesn't cover.

Files: `apps/web/app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx`.

SPEC IMPACT: None — client-side filter over existing data; no schema, pricing, SKU, or engine change.
