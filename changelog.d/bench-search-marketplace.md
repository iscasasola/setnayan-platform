## 2026-07-10 · feat(vendors): bench search reaches the whole marketplace too

Extended the Shortlist bench search (S3) so one box searches BOTH scopes (owner 2026-07-10):

- **Via shortlist** — the existing instant client-side filter over the couple's categories + shortlisted vendors (unchanged).
- **Whole marketplace** — whenever there's a query, a one-tap "Search the whole marketplace for «query»" row deep-links to `/explore?q=<query>` (the marketplace's own text search over every published vendor). So a couple can find a vendor they haven't shortlisted without leaving the flow, and the empty-state now points there instead of dead-ending ("nothing in your shortlist matches — try the whole marketplace above").

Placeholder updated to "Search your shortlist or the whole marketplace…". Reuses the shipped `/explore?q=` search — no new query or action, safe + verifiable.

Files: `apps/web/app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx`.

SPEC IMPACT: None — adds a deep-link to the existing marketplace search; no schema, pricing, SKU, or engine change.
