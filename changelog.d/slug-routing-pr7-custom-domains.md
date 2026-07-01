## 2026-07-01 · feat(routing): custom BYO domains — backend + middleware (PR7 of 8)

Lets a vendor (or user) point their own domain (e.g. `sny.theirshop.com`) at
Setnayan; once verified it serves their existing `/v/{slug}` or `/u/{slug}` page.
Owner ruling 2026-07-01: **free for all, no tier gate.** Backend + resolution
only — the add/verify UI is PR8.

- Migration `20270425396165` — `custom_domains` table (domain, owner_type
  vendor|user, owner_id, verification_token, verified_at, vercel_domain_id) with
  RLS (vendor team via `current_vendor_profile_ids()` / user via `auth.uid()` /
  admin; no public SELECT) + `resolve_custom_domain(host)` SECURITY DEFINER RPC
  that maps a verified host → the owner's **live** `/v/{slug}` or `/u/{slug}`
  (staleness-free join, no denormalized slug). Security hardening (from adversarial
  review): a `guard_custom_domain_verification` BEFORE trigger blocks a
  self-service writer from setting `verified_at`/`vercel_domain_id` (only the
  service-role verify backend may — RLS constrains rows, not columns), and the
  unique index is **partial** (`WHERE verified_at IS NOT NULL`) so an unverified
  squatter can't block a real owner. **Verified against the prod schema in a
  rolled-back transaction**: DDL applies + idempotent; RPC correct for verified
  vendor/user, case-insensitive, null for unverified/unknown; an authenticated
  user may create an unverified row but is blocked (42501) from self-verifying;
  a 2nd verified row per host is blocked (23505).
- `lib/vercel-domains.ts` — thin Vercel Domains API wrapper (add / get / verify /
  remove), reads `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` (+ optional
  `VERCEL_TEAM_ID`) from the **runtime** env.
- `lib/custom-domain-resolve.ts` + `middleware.ts` — edge host-branch: for a
  non-setnayan, non-preview host, resolve via the RPC (direct REST fetch, no
  supabase-js in the edge bundle) and rewrite to the owner's page. setnayan.com /
  .ph / previews / localhost pay zero cost (two string checks, no DB call).
  Fail-open. Inert until a verified row + `VERCEL_*` env exist.

SPEC IMPACT: New capability — vendors/users may attach their own domain (free). Backend + edge resolution only; management UI pending (PR8). Runtime env vars `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` required to activate.
