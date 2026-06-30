## 2026-07-01 · feat(vendor-claim): route claim into guided first-service setup; register service to the couple

When an off-platform vendor (added manually by a couple and handed a claim QR)
scans it and signs up, they now flow through account onboarding → a guided
first-service setup with the invite's category auto-picked → create a service →
that service is registered back to the couple's plan
(`event_vendors.service_id`) → continue to their dashboard.

Reuses the existing guided services wizard (`/vendor-dashboard/services/new/[category]`
→ `ServiceWizard` → `commitVendorService`); net-new UI is one banner + one hidden
field. The claim token is the carry-through context.

- `apps/web/app/vendor/claim/[token]/finalize/page.tsx` — after a successful
  couple/auto_share_link auto-link, reroute a FRESH claim (vendor has zero
  services, invite carries a valid vendor category) into
  `/vendor-dashboard/services/new/<category>?claim=<token>`. Established vendors
  (already have services) and admin-source claims keep the plain
  `/vendor-dashboard` redirect.
- `apps/web/lib/vendor-invite-actions.ts` — `resolveClaimContextForService`
  (admin-client banner/registration context resolver) +
  `registerClaimedServiceToCouple` (cross-actor admin write that stamps
  `event_vendors.service_id`). The write enforces a 5-link security chain
  (invite claimed BY this user · claimed TO this vendor profile · caller owns
  the profile · couple row's `marketplace_vendor_id` == this profile · service
  owned by this profile) and is idempotent (never clobbers an existing
  `service_id`; `.is('service_id', null)` guards the concurrent race too).
- `apps/web/app/vendor-dashboard/services/new/[category]/page.tsx` — reads
  `?claim=`, resolves + validates the claim against the signed-in user/profile,
  renders the "Set up your service for {couple}" banner, threads the token into
  the wizard.
- `apps/web/app/vendor-dashboard/services/_components/service-wizard.tsx` —
  optional `claimToken` prop → hidden `claim_token` form field.
- `apps/web/app/vendor-dashboard/services/actions.ts` — `commitVendorService`,
  on CREATE with a `claim_token`, calls `registerClaimedServiceToCouple`
  (best-effort, never blocks the save) then redirects to `/vendor-dashboard` so
  the vendor "continues from there".

Edge cases handled: invite already claimed (only `status='claimed'` resolves),
vendor already has services (no reroute), couple row already has a `service_id`
(no clobber), marketplace-linked / admin-source vendors (no reroute), stale or
foreign claim token (degrades to a plain "add a service" flow, never crashes).

SPEC IMPACT: None. Reuses the existing manual-vendor claim/auto-link flow,
the guided services wizard, and the `event_vendors.service_id` couple↔service
link (migration `20260604070000`). No schema change, no SKU/pricing change.
