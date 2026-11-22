---
description: Scan for hardcoded data, raw URLs/routes, dead handlers, and unwired form/data flows — report only
---

Verify app code is wired, not hardcoded, per `docs/ARCHITECTURE.md`. **Do NOT edit any file —
output the table first.** Read from a fresh worktree of `origin/main`, never from `~`. Scope:
`apps/web/{app,components,lib}`, `packages/*/src`; exempt tests, `app/dev/**`, `*.lab.tsx`.

1. **Hardcoded data.** Arrays of 5+ object literals inside `.tsx` (options, tiers, catalogues,
   demo rows); placeholder text (`Lorem`, `John Doe`, `Test Product`, `dummy`, `mockData`);
   prices or money numbers in UI (prices come from `platform_retail_catalog_v2` /
   vendor billing catalog — never a literal); `http(s)://` literals and `localhost:` fallbacks
   outside env/config; secrets or IDs outside `.env*`.
2. **Routes.** Every `href="/…"`, `href={\`/…\`}`, `router.push('/…')`, `redirect('/…')` that
   bypasses `apps/web/lib/routes.ts`; any path whose folder does not exist under `apps/web/app`.
3. **Handlers & flows.** `onClick={() => {}}`, `() => undefined`, `console.log` handlers; buttons
   that only set local state where the user expects a save; `<form action>` / server actions whose
   result is never shown (a failure that renders like success or like empty). Trace each flagged
   flow: trigger → handler → `actions.ts` / `lib/` service → Supabase → destination page.
   Distinguish a *deliberate* no-op prop (a required callback the screen does not need) from a
   dead control a user can press — only the second is a defect.

Output: `| File & symbol | Issue type (Hardcoded Data / Dead Link / Unwired Flow) | What is there | Where it should be wired |`
then STOP for approval.
