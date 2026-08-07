## 2026-08-07 · chore(tokens): the leftovers the first pass missed

Follow-up to #4220. A post-merge sweep of merged `main` found six more token
surfaces — including one **dead link the first PR created**.

- **`lib/admin/work-rows.ts` still carried the "Token sales" row**, pointing at
  `/admin/token-purchases`, which #4220 deleted. 🔑 **I looked for it in
  `app/admin/work/` and concluded it did not exist.** The handoff said "a Token
  sales row in the admin work list" and was right; I checked the route folder
  instead of the library that feeds it. *Grep for the label, not the folder you
  expect it in.*
- **`lib/admin/queue-counts.ts`** still counted a `vendor_token_purchases`
  queue. A shape guard (`BASE_ROWS covers every ADMIN_QUEUE_META queue`) caught
  this the moment the work row was removed — the two lists must agree.
- **The public `/pricing` page** emitted token-pack `Product` JSON-LD as
  `InStock` and rendered a **"Token Worthy"** badge on couple SKUs. Both were
  dark only because `is_token_able` is false for every row in prod — one
  catalog flag away from advertising a currency that does not exist, to search
  engines, which cache it.
- **`route-meta.ts`** kept Token bands · Token sales · Tokens labels for
  deleted routes.
- **The admin catalog editor** showed "Token-worthy" and "N tokens" badges.
- **`tokenCost` was computed on every vendor inquiry card and rendered
  nowhere** — #4216 removed the Accept badge and left the calculation, and a
  test was still pinning the number. Its whole module,
  `lib/v2/region-token-burn.ts`, is now deleted.

⚠ **`p_addon_token_pack_sku` is still passed to `create_vendor_subscription`,
as an explicit null.** PostgREST resolves an RPC by its exact set of NAMED
arguments — dropping the key stops matching the function and every plan
purchase fails silently. The form field is gone; the argument stays.

7031 unit tests green under UTC and Asia/Manila; all 20 lint scripts pass.

SPEC IMPACT: None — the corpus was corrected in #4220.
