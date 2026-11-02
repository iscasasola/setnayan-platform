## 2026-07-03 · feat(admin): App Performance cockpit — PR 2 (Action Center zone)

Zone 1 of the cockpit (plan: spec corpus
`0023_admin_console/App_Performance_Plan_2026-07-03.md` § 3 Zone 1 — "what to
do next"):

- **Auto cards** — all 16 admin work queues (payments · payouts · token sales ·
  subscriptions · verify · partnerships · disputes · force majeure · abuse
  reports · review flags · approvals · account deletions · payment options ·
  AI abuse · help · integrity watch) rendered as act-now cards, REUSING the
  Work command center's `getAdminQueueDigest` + `computeDueState` SLA math
  verbatim (`lib/admin/queue-counts.ts` — one filter table, zero drift).
  Sorted overdue → due-soon → in-SLA; clear queues fold into one line; each
  card links to its queue with count + oldest-item age.
- **Manual watch-list** — the credits/limits/renewals the DB can't read (Suno ·
  Claude API · OpenAI/DALL·E · Recraft · R2/Supabase tier · Vercel build
  minutes · Resend/Sentry quotas · secrets rotation · domains & certs · token
  bands), listed by NAME with what-to-check copy — no invented numbers.
  Editable logging + due-date reminders arrive with the `platform_expenses`
  migration (PR 3).
- Zone streams behind Suspense so queue digests never block the chart zones.

SPEC IMPACT: None (implements the committed plan).
