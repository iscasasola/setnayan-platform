## 2026-11-17 · fix(admin): a filter on a merged view stays on that view (audit of #7900)

The admin reorg (#7900) mounts each old page inside a merged page — Payouts at `/admin/payments?view=payouts`, Disputes
and Force majeure at `/admin/work?view=…`, Receipts at `/admin/money?view=receipts`. Their filter forms were
`<form method="get">` with no `action`, so submitting replaced the whole query and dropped `view=`: the Payouts supplier
filter opened Payments to confirm, the Disputes and Force-majeure filters opened the All list, the Receipts month opened
Everything. Each form now submits to its own old address, which the middleware forwards to the view with the fields kept.

- `force-majeure`, `disputes`, `payouts`, `receipts` pages: `action="/admin/<page>"` on the GET form.
- `lib/admin/a-mounted-filter-keeps-its-view.test.ts`: every GET form inside a mounted view names its `action`.
- Supplier refunds tip: "over ₱25,000" now reads `REFUND_TWO_ADMIN_THRESHOLD_PHP` (the same constant `refundOrder`
  enforces) instead of a typed number.
- `dev/admin-shell-lab`: the picker and rail get the full fixture, so a queue the fixture omits no longer reads
  "Couldn't count" in screenshots.

SPEC IMPACT: None
