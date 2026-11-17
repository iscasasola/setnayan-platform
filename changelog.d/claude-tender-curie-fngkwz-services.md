## 2026-11-17 · fix(supplier-services): a refused category read never marks every card "not in what you do"

From the supplier dashboard audit (Services and card maker):
- `fetchVendorCoverages(...).catch(() => [])` read a refusal as "this shop covers nothing". As a result every service card carried "not in what you do", and "Your coverage" said "Nothing yet — pick a category above". The read is now `null` on failure, the per-card line is skipped, and the panel says "Couldn't load your categories — nothing has changed".
- The Shop's error banner decoded `search.error` a second time, and `searchParams` are already decoded. Any message with a bare `%` threw a `URIError` and broke the whole Shop page. It now decodes safely.
- Guarded by `services/a-refused-category-read-is-not-outside.test.ts`.

SPEC IMPACT: None.
