-- 20271171390705_pricing_manager_retirement_metadata.sql
--
-- Admin pricing manager rebuild — adds the retirement metadata the redesigned
-- /admin/pricing screen needs to stop typing "(superseded)" into a product's
-- own title.
--
-- WHY (WHATS_NEXT_Managing_Prices_2026-08-26.md § 6, build unit 2):
-- "Retired" was one boolean (`is_active`). It recorded THAT a row stopped
-- selling, never WHEN, WHO, WHY, or WHAT REPLACED IT — so the only place left
-- to write "replaced by the new ladder" was the title field itself
-- (PAPIC_GUEST_TOPUP's title literally ends "(superseded)").
--
-- THREE STATES, ZERO NEW ENUM: `is_active` already gates every public read
-- path (checkout, /pricing, /vendors) — replacing it with an enum would mean
-- re-auditing every `.eq('is_active', true)` in the app. Instead the third
-- state is DERIVED from the two columns that already exist plus the one new
-- timestamp:
--   on sale  = is_active = TRUE
--   retired  = is_active = FALSE AND retired_at IS NOT NULL
--   draft    = is_active = FALSE AND retired_at IS NULL   (never launched)
-- Un-retiring (Put back on sale) clears retired_at + its metadata — if the
-- row is retired again later it gets a fresh stamp, and the full before/after
-- is still in admin_audit_log regardless.
--
-- SAFE BY CONSTRUCTION: every new column is NULLABLE and ADDITIVE. No existing
-- row changes value. `is_active` is untouched, so every public read path is
-- byte-identical to before this migration. Idempotent via `ADD COLUMN IF NOT
-- EXISTS`.
--
-- Applied to all three catalogue tables the admin screen edits. Grants are
-- TABLE-LEVEL on all three (verified live 2026-08-26: `anon`/`authenticated`
-- both hold `arwdDxtm`), so a new column inherits the existing table-level
-- grant automatically — same reasoning as `onboarding_price_php`
-- (20271139128584). No GRANT statement needed here.

alter table public.platform_retail_catalog_v2
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists retirement_reason text,
  add column if not exists replaced_by_service_code text
    references public.platform_retail_catalog_v2(service_code) on delete set null;

comment on column public.platform_retail_catalog_v2.retired_at is
  'When this row was last taken off sale via the admin retire action. NULL + is_active=false = a draft that was never launched, not a retired product.';
comment on column public.platform_retail_catalog_v2.retired_by_admin_id is
  'Who pressed Retire. NULL if never retired, or if the admin account was later deleted.';
comment on column public.platform_retail_catalog_v2.retirement_reason is
  'Optional free-text reason typed at retire time. Never required — most retirements are self-explanatory.';
comment on column public.platform_retail_catalog_v2.replaced_by_service_code is
  'Optional pointer to the SKU that replaced this one. Lets the admin screen say '
  '"replaced by Papic — add 10,000 shots" instead of the old pattern of typing '
  '"(superseded)" into this row''s own title.';

alter table public.platform_package_catalog
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists retirement_reason text,
  add column if not exists replaced_by_package_code text
    references public.platform_package_catalog(package_code) on delete set null;

comment on column public.platform_package_catalog.retired_at is
  'Mirrors platform_retail_catalog_v2.retired_at — see that column''s comment.';

alter table public.vendor_billing_catalog
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists retirement_reason text,
  add column if not exists replaced_by_sku_code text
    references public.vendor_billing_catalog(sku_code) on delete set null;

comment on column public.vendor_billing_catalog.retired_at is
  'Mirrors platform_retail_catalog_v2.retired_at — see that column''s comment.';
