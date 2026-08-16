## 2026-08-16 · fix(seo): a redirect-only route stopped serving 80KB of empty page with a 200

SPEC IMPACT: None. No price, SKU, schema or product-rule change. No URL changes.

**Measured on the live site, not inferred:**

| | before | after |
|---|---|---|
| `/explore/categories` | `HTTP 200` · no `Location` · **83,797 bytes** | **`HTTP 307` · `location: /explore`** |

That route exists *only* to `redirect('/explore')`. It shipped a
`GridPageSkeleton` loading boundary, and a boundary forces STREAMING — the
response commits before the page body runs. So it painted a fake card grid,
answered 200, and redirected on the client. A crawler indexes 80KB of nothing.

🔑 **SAME FAMILY THE REPO ALREADY PAID FOR.** `app/v/[slug]/loading.tsx` was
deleted because it forced streaming, so the shell committed 200 before
`notFound()` ran and every junk shop URL told Google it had found a page.
`first-byte.test.ts` holds that shape on that route family. This is the
`redirect()` shape, one directory over. **When you fix a route-shaped bug,
sweep every route with that shape** — the sweep found 50 routes, and the two
crawlable ones are what mattered.

### 🪤 A LOADING BOUNDARY IS INHERITED BY CHILD SEGMENTS — proven, not assumed

`/explore/compare` had its own `loading.tsx` deleted and **still** returned 200.
Temporarily moving the PARENT's `app/(shell)/explore/loading.tsx` aside flipped
it to `307 · location: /explore`; restoring it flipped it back.

Two counter-intuitive consequences:
- compare's own boundary was **redundant**, and its docblock claimed the
  opposite in so many words — *"THE FILE STILL HAS TO EXIST — a dynamic route
  with no boundary prefetches an EMPTY tree"*. The parent had been supplying one
  the whole time. Deleted. **I wrote that false claim yesterday**, applying a
  per-route rule without knowing boundaries are inherited.
- compare **cannot** get a server-side redirect without taking the boundary off
  `/explore` itself, which is a busy browse page that wants one.

### Scope — narrow on purpose

50 routes call `redirect()`/`notFound()` under a boundary. Almost all sit behind
a login, where a client-side redirect harms nobody and no crawler ever arrives.
Only the crawlable ones were touched, and the guard polices exactly one claim:
a redirect-only route has no boundary **anywhere on its path**, ancestors
included — because checking only its own directory would look fixed and behave
exactly as broken.

⏭ **STILL OPEN, deliberately:** `/explore/compare` answers 200 with an empty
shell for a crawler. The honest fix is a product decision — render a real
"nothing to compare yet" state with a way back, rather than redirect — since the
alternative costs `/explore` its prefetch boundary. Not decided here.

### Guard

`app/explore/categories/redirect-is-a-redirect.test.ts` (3) — the route still
only redirects · no boundary on any ancestor · not force-static.
**Mutation-verified**: adding a boundary back (0 → 1 files on the path) takes it
from 3 pass to 1 fail.
