-- Subdomains are an EVENT-only feature (owner 2026-07-10: "no x.setnayan.com for
-- vendors. only for events."). Deactivate the vendor subdomain SKU. The couple-side
-- EVENT_SUBDOMAIN (₱999/yr) stays active; the middleware only resolves *.setnayan.com
-- to a paid event now (vendors keep BYO custom domains via resolve_custom_domain).
-- Applied to prod via MCP.
UPDATE vendor_billing_catalog SET is_active = false, updated_at = now() WHERE sku_code = 'vendor_subdomain';
