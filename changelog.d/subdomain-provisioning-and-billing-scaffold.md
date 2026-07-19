## 2026-07-10 · feat(subdomain,billing): custom-subdomain provisioning + renewal-reminder scaffold

Makes the ₱999/yr Custom Subdomain SKU deliverable and scaffolds recurring-billing renewals (manual prepaid now, gateway later). Owner-directed ("build everything now"; scaffold recurring billing + build subdomain provisioning code).

**Subdomain provisioning (paid, event-gated):**
- `resolve_event_subdomain(label)` SECURITY DEFINER RPC (migration `20270712400000`, applied to prod) — returns `/{slug}` **only** if the event owns an active, non-expired `EVENT_SUBDOMAIN` order; else NULL. Inline expiry (lazy, no sweep). Verified in prod: a real event without a paid order correctly returns NULL (no free subdomains).
- Edge resolver `resolveEventSubdomainPath` (extends `lib/custom-domain-resolve.ts`) + a `middleware.ts` branch: `{slug}.setnayan.com` → the couple's event page at bare `/{slug}` when paid; **falls through to the existing free vendor-subdomain rewrite** on a miss (vendor behavior unchanged). Sets `x-sn-u-nesting` to dodge the flag-gated `/u/` cutover redirect. Fail-open.
- Fulfillment hook (`lib/sku-activation.ts` EXACT_HOOKS for `EVENT_SUBDOMAIN` + `vendor_subdomain`) stamps `orders.expires_at = now+365d` + a `service_activated` ledger row — the billing window the resolver + reminder read.
- "Your custom subdomain: {slug}.setnayan.com" panel on the couple website hub, gated on `eventOwnsSku(EVENT_SUBDOMAIN)`.

**Recurring-billing scaffold (manual prepaid; no auto-charge yet):**
- `renewal_reminder_log` (per-order/window idempotency lock, RLS admin-only) + `subscriptions_due_for_renewal_reminder(days)` RPC (migration `20270712400100`, applied to prod).
- `lib/subscription-renewal-emails.ts` (branded "renew before {date}" builder) + `app/api/cron/renewal-reminders/route.ts` (cloned from anniversary-digest: CRON_SECRET timing-safe auth, insert-lock-first idempotency, per-candidate try/catch) + `vercel.json` daily cron `0 1 * * *`.
- **Gateway seam:** the fulfillment hook + `active window` are where a future PayMongo/Maya `payment.succeeded` webhook plugs in — manual and auto-charge grants converge on the same path.

**Owner action to finish provisioning:** add a wildcard `*.setnayan.com` CNAME → `cname.vercel-dns.com` + register `*.setnayan.com` as a Vercel project domain (the code is inert/harmless until then). Recurring AUTO-charge still needs a merchant account (separate track).

Verified: typecheck · 1388 unit tests · production build (middleware compiled) · both RPCs behave in prod.

SPEC IMPACT: Logged in DECISION_LOG 2026-07-10; `EVENT_SUBDOMAIN`/`vendor_subdomain` remain "In build" until the wildcard DNS lands.

**Flagged, not changed:** vendors already get subdomains free via the existing middleware rewrite; the new paid `vendor_subdomain` SKU is billed/tracked if sold but the free vendor-subdomain routing is left ungated (gating it would break live vendors) pending owner sign-off.
