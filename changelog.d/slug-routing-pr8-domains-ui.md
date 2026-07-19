## 2026-07-01 · feat(routing): custom-domain add/verify UI in My Shop (PR8 of 8)

The vendor-facing UI for BYO custom domains (backend shipped in PR7). Lands in
the "Your website" / My Shop tab — the page that already shows the vendor their
`/v/{slug}` address.

- `app/vendor-dashboard/website/_domain-manager.tsx` — client island: add a
  domain, see the exact DNS record(s) to create, click Verify, and remove.
- `app/vendor-dashboard/website/actions.ts` — server actions:
  - `addVendorDomain` — validates the hostname (rejects Setnayan hosts), inserts
    an **unverified** row via the vendor's own session (RLS-gated; the DB guard
    trigger forbids self-setting `verified_at`), then registers it on the Vercel
    project and returns the DNS records to add. Rolls back its row if Vercel
    registration fails.
  - `verifyVendorDomain` — re-checks ownership, asks Vercel to verify, and only
    on a confirmed `verified` stamps `verified_at` via the **admin/service
    client** (the sole writer the guard trigger allows). Ownership re-asserted in
    the `WHERE` clause.
  - `removeVendorDomain` — ownership-checked; detaches from Vercel + deletes.
- `page.tsx` — fetches the vendor's own domains (RLS-scoped) and renders the
  manager once they have a public address.

Free for all vendors (owner ruling 2026-07-01). Inert until `VERCEL_API_TOKEN` /
`VERCEL_PROJECT_ID` are set as Vercel runtime env vars — the add flow surfaces a
friendly "not enabled yet" message otherwise.

SPEC IMPACT: Completes the vendor custom-domain feature (add + verify + remove). User-profile custom-domain UI is a follow-up (backend already supports owner_type='user'). Vercel HTTP calls are runtime-verified (need the live token), not locally testable.
