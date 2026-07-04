## 2026-07-05 · fix(seo): re-sync llms.txt prices to the live catalog + drift guard

Corrected stale peso figures on the AI-crawler surface `apps/web/public/llms.txt`
against the live prod retail + vendor-billing catalog, and added a `node:test`
drift guard so it can never silently diverge again:

- **Setnayan AI** — `₱499 per 28-day cycle` → `₱799 per 28-day cycle (₱499 first
  cycle)` in all ~5 places (hero, pricing model, planning tier, à-la-carte,
  two FAQ answers, footer model summary). The solitary `₱499` was the
  first-cycle rate only; recurring is `₱799`.
- **Enterprise vendor tier** — `₱49,999 / year` → `₱74,999 / year` and
  `₱4,999 / 28-day` → `₱7,499 / 28-day` (for-vendors line, tier table,
  annual-vs-cycle math line, cost FAQ).
- **Live Studio multicam** — `₱3,499 per day` → `₱3,499 one-time` (catalog +
  FAQ); single-cam livestream stays free (confirmed in code).
- **À-la-carte range** — false `₱100 to ₱4,999` endpoints replaced with
  "from ₱30 up into the low thousands" (a hard range drifts on every SKU add).
- New guard: `apps/web/lib/llms-price-drift.test.ts` (runs under `pnpm
  test:unit`) extracts every `₱…` figure from the file body and asserts the set
  equals the explicit allow-list in `apps/web/lib/llms-price-fixture.ts`. Any
  unapproved figure fails CI. The changelog footer is excluded (it carries
  historical figures by design).

SPEC IMPACT: None to the corpus files. ⚠ Flag for owner: the Enterprise vendor
tier figure on the public AI-crawler surface was corrected to **₱74,999/yr ·
₱7,499/28-day** to match the live prod `vendor_billing_catalog` — this
supersedes the ₱49,999/yr · ₱4,999/28-day figure that llms.txt had been
publishing. Ground truth was the live catalog sampled from prod; the memory
note `project_setnayan_vendor_tier_ladder` (Ent ₱4,999/28d) is stale relative
to it.
