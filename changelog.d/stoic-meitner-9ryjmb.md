## 2026-11-11 · feat(lane-m): the feature register is kept true by a check; prices are printed, never typed (Build 6 Lane M)

Owner, 10 Nov: *"we want a documentation to list so when we try to trace the documentation of the complete
features, we can find it. As well as pricing."* The register (`FEATURE_REGISTER.md`) and the one door
(`START_HERE.md`) live in the spec corpus; this PR adds the two scripts the plan names.

- **`scripts/feature-register-check.mjs`** (+ pure rules in `scripts/lib/feature-register-core.mjs`) fails when
  a page route (`apps/web/app/**/page.tsx`, minus `/dev` labs and `/api`), a catalogue SKU key, or a
  `NEXT_PUBLIC_*` name read by source has no register row; when a row points at a file or folder that is gone;
  when a peso figure is typed in the register; or when a `START_HERE.md` link is dead. Exit 1 = out of date,
  exit 3 = corpus not found (never 0). SKU keys come from the live catalogue (SELECT only) or `--skus <file>`;
  without either that row prints SKIPPED, not ok. (A static parse of the migrations was measured and rejected:
  it missed 25 live keys.)
- **`scripts/print-prices.mjs`** prints every SKU's current price from `platform_retail_catalog_v2` +
  `vendor_billing_catalog`, beside the feature the register says it unlocks; `⚠ no register row` marks a key
  with no row. `--json`, `--out`, `--active-only`, `--from-json`.
- **`scripts/lib/read-only-db.mjs`** — the one DB door both use: one SELECT only (write words refused), wrapped
  in `begin transaction read only … rollback`, on a `default_transaction_read_only=on` session, via `psql`; the
  URL is read from `PRICES_DB_URL` / `SUPABASE_DB_URL` / `DATABASE_URL` and scrubbed from every message.
- **Wired as a test:** `scripts/feature-register-check.test.mjs` (24 cases: the rules on fixtures, six sabotage
  cases, the SELECT-only door, URL scrubbing, the printout format, and the real register when the corpus is on
  disk — it SKIPS by name in CI, which cannot read the private corpus). New install-free step in the
  `migration timestamp guard` job; preflight classifies it CHEAP.
- Measured against `origin/main` @ `142ab58fa` + the corpus after its Lane M pass: 444 routes · 92 SKU keys ·
  108 `NEXT_PUBLIC_*` names · 938 pointers · 111 START_HERE links — 0 misses.

SPEC IMPACT: Corpus edited directly (standing authorization): `FEATURE_REGISTER.md` (172 → 175 rows; new 9c route
ledger and 9d settings/flags; section 7 Prices now key-only, numbers from `print-prices.mjs`; statuses for #7460
#7463 #7417 #7457; rows renamed to Seat Plan · Live Watch · Music Maker · Logo Maker per DECISION_LOG 2026-11-11
"THE WEBSITE USES THE APP'S SHIPPED NAMES"), `START_HERE.md` (doors for any page, flags, the check, the
printout), `Pricing.md` + `.docx` (pointer to the printout), `plans/supplier_build_6_2026-11-10/00-BUILD-6-PLAN.md`
(register line in the house contract; Lane M status). No DECISION_LOG row: no product decision changed.
