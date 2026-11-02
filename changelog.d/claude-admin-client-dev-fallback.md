## 2026-07-15 · fix(dev): createAdminClient falls back to the anon key in `next dev` when the service key is unset

`SUPABASE_SERVICE_ROLE_KEY` is marked Sensitive on Vercel, so `vercel env pull`
returns it empty — no local checkout has it. Any page with an unconditional
`createAdminClient()` call (the couple Merkado, `/admin`, ~495 importers)
hard-crashed to the error boundary on every local dev server, while only some
call sites had their own graceful-degrade wrappers.

Consistent local-dev story, fixed at the single choke point
(`lib/supabase/admin.ts`): in `NODE_ENV === 'development'` only, a missing
service key falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` with a one-time
`console.warn`. Construction succeeds; RLS applies, so admin-only reads come
back empty and privileged writes fail as ordinary Supabase errors the existing
call-site error paths absorb — pages render with degraded data instead of dying.

Production behavior unchanged: `next build` / `next start` / CI / Vercel
(NODE_ENV=production) keep the hard throw, verified by an isolated
NODE_ENV=production check. Browser-verified on a keyless dev server: the couple
vendors page and `/admin` both render (previously both crashed).

SPEC IMPACT: None (dev-environment ergonomics only; no product surface, pricing, or schema change).
