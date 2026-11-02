## 2026-07-03 · feat(admin): App Performance cockpit — PR 3 (Expenses & Receipts + platform_expenses)

Zone 2 of the cockpit (plan § 3 Zone 2 — owner: "track all our expenses and
collect receipts … websites, data, credits, claude, suno, and all digital
expenses" + "also include our expenses to business permits, and documents"):

- **Migration `20270504100000_platform_expenses.sql`** — internal money-OUT
  ledger: date · vendor · category (infra / ai_credits / domains_fees / tools /
  **permits_docs**) · amount (PESOS) · note · `receipt_r2_key` ·
  `recurs_monthly` · `next_due_on`. RLS admin-only on every verb at CREATE
  TABLE time.
- **Zone 2 UI** — monthly stacked spend by category (spend rising = inverse-
  good delta) · spend-by-service this month · **receipt coverage %** with
  "missing — collect before the BIR quarter closes" naming the vendors ·
  ledger table with per-row **Attach receipt** / **View receipt** (10-min
  signed GET) · upcoming charges off `next_due_on` (January permit cluster
  surfaces months ahead) · a no-client-JS "Log an expense" form.
- **Receipts** land in the PRIVATE vendor-contracts bucket under
  `platform-receipts/` (financial documents — never the public media bucket);
  PDF/JPG/PNG/WebP ≤ 10 MB. This is the BIR expense-substantiation trail
  (iteration 0026).
- Fetcher degrades honestly when the migration hasn't run (banner, not a
  blank page). Actions gate on internal/team/admin (mirrors admin/verify) on
  top of the RLS.

⚠ Migration needs `supabase db push` to prod after merge.

SPEC IMPACT: None (implements the committed plan).
