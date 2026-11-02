## 2026-07-10 · feat(subdomain): subdomains are event-only (drop vendor subdomains)

Owner decision ("no x.setnayan.com for vendors. only for events.").

- Deactivated the `vendor_subdomain` SKU (`vendor_billing_catalog`, migration `20270712708406`, applied to prod).
- `middleware.ts` — removed the free vendor `*.setnayan.com` fallback rewrite. A `*.setnayan.com` label now resolves ONLY when a couple owns an active paid `EVENT_SUBDOMAIN` order; any other label falls through to normal routing. Safe: the wildcard DNS isn't configured yet, so no vendor subdomain was live.
- Removed the `vendor_subdomain` fulfillment hook; updated llms.txt ("Couples only").
- Vendors keep BYO custom domains (the separate `resolve_custom_domain` path) — unchanged.

Verified: typecheck · llms drift guard · production build (middleware compiled).

SPEC IMPACT: Logged in DECISION_LOG 2026-07-10.
