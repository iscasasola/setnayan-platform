### Anniversary "on this day" re-engagement emails (PR-G)

The emailed half of the memory-home retention hook (the in-app version is PR-D): a daily job emails couples on their wedding anniversary — "N years ago today, you said 'I do' — relive your day" → links to their Account › Photos.

- **Migration `20270219853101_anniversary_email_log`** — `anniversary_email_log(event_id, anniversary_year)` idempotency lock (PK, sends yearly but never twice) + a `SECURITY DEFINER` RPC `couples_with_anniversary_today(date)` that does the candidate query + idempotency + reachability gate in one call. **Applied to prod via the Supabase MCP; the security advisor flagged that the RPC (which returns couple emails) was anon/authenticated-callable — fixed with an explicit `REVOKE … FROM anon, authenticated, PUBLIC` so only `service_role` can call it.**
- **`lib/anniversary-emails.ts`** — branded HTML + plaintext, RFC-8058 one-click unsubscribe headers. Treated as a relationship/service email (about the couple's OWN memories), not gated on `marketing_opt_in` (which would kill it), but honors soft-delete + unsubscribe.
- **`app/api/cron/anniversary-digest/route.ts`** — fail-closed auth (`Bearer`/`x-cron-secret` vs `CRON_SECRET`, timing-safe), computes "today" in Asia/Manila, claims the lock before sending (releases on failure to retry), bounded batch.
- **`apps/web/vercel.json`** — daily cron `0 0 * * *` (08:00 PH).

⚠️ ACTIVATION: needs `CRON_SECRET` set in the Vercel project env (the endpoint fails-closed — 403 — until then, so it's safe to merge). Verify the cron fires after the next deploy.

SPEC IMPACT: iteration 0028 gains an 11th email template (anniversary) — to document in the North-Star follow-up.
