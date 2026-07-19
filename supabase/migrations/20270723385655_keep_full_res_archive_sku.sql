-- Keep Full-Res archive SKU — owner 2026-07-11
-- (Pricing.md § 2.1 · DECISION_LOG 2026-07-11 · build plan WS3)
--
-- Revives HIGH_RES_ARCHIVE as an ACTIVE, sellable per-year SKU (₱999/yr per 50 GB).
-- Sold on the EXISTING apply-then-pay flow (manual BDO/GCash reconciliation) —
-- owner "temporary connect it to our first way of payment then we just shift them
-- when we are ready to apply the online payment system." When the online gateway
-- ships, this SKU repoints to it with no catalog change.
--
-- It is the opt-out from the 3-month full-res drop: the sweep skips any event
-- whose owner holds an ACTIVE HIGH_RES_ARCHIVE order (guard already wired in
-- lib/papic-fullres-drop.ts). Idempotent upsert.

-- saas_overhead_cost_php ≈ our storage cost for 50 GB·yr (~₱350 on R2, cheaper on
-- deep-cold later) — feeds the admin cost-watch margin view.
insert into public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_active, billing_period, description)
values
  ('HIGH_RES_ARCHIVE', 'Keep Full-Res', 999, 350, true, 'per_year',
   'Keep every full-resolution original on Setnayan, undegraded, past the free 3-month window — ₱999/year per 50 GB. Your online gallery is always kept free; this is for the pristine originals. (Storage on our own R2 for now; the couple''s own Google Drive copy is a separate free option.)')
on conflict (service_code) do update
  set title                  = excluded.title,
      retail_price_php        = excluded.retail_price_php,
      saas_overhead_cost_php = excluded.saas_overhead_cost_php,
      is_active               = true,
      billing_period          = excluded.billing_period,
      description              = excluded.description,
      updated_at               = now();
