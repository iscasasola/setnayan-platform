-- Setnayan AI: two prices per event type — the sign-up price and the regular price.
--
-- OWNER RULING 2026-08-12. Buying Setnayan AI while creating the event is cheaper
-- than switching it on afterwards. His ladder, sign-up → regular:
--     wedding                          ₱1,499 → ₱2,499   (tier A)
--     debut · corporate · gala_night     ₱899 → ₱1,499   (tier B)
--     standard events                    ₱499 →   ₱899   (tier C, also the default)
--     tournament · gender_reveal ·
--     date · hangout                      ₱99 →   ₱199   (tier D)
--     simple_event                    not offered        (tier E — it has no vendors)
--
-- MODELLING — `retail_price_php` BECOMES THE REGULAR PRICE.
-- The alternative (leave retail at the cheap number and add a dearer "regular"
-- column) points the whole app at the discount by default: the public pricing
-- page, the homepage, the services suite and the add-on list all read
-- `retail_price_php`, so every one of them would advertise ₱1,499 for something
-- that costs ₱2,499 the moment you are not in the sign-up flow. That is the
-- misleading DIRECTION — quote low, charge high. Storing the regular price as
-- the headline and the discount as the exception means an un-updated reader
-- over-quotes, and the customer is pleasantly surprised at sign-up rather than
-- ambushed later.
--
-- ⚠ THE TIER ROWS B/C/D ARE PRICE SOURCES, NOT SELLABLE CARDS (is_active=false,
-- by design — see lib/setnayan-ai-type-pricing.ts). Their prices are read
-- regardless of is_active. Do not "tidy" them by activating or deleting them.

alter table public.platform_retail_catalog_v2
  add column if not exists onboarding_price_php numeric(10,2);

comment on column public.platform_retail_catalog_v2.onboarding_price_php is
  'Price when this service is bought DURING event onboarding. NULL = no sign-up '
  'discount; the caller charges retail_price_php. Never read NULL as free — '
  'lib/setnayan-ai-event-pricing.ts falls back to retail, never to zero.';

-- 🔑 GRANTS ON THIS TABLE ARE TABLE-LEVEL, NOT COLUMN-LEVEL — CHECK BEFORE YOU
-- ASSUME. `relacl` reads `anon=arwdDxtm`, i.e. ALL privileges on the whole
-- table, so a new column is covered the instant it exists. The usual rule — "a
-- new column inherits no column grant, so naming it from a browser session gets
-- the whole query REJECTED" — is real, and it is what bit this project on
-- `events`; it simply does not apply here, because that rule is about tables
-- granted column by column. `information_schema.column_privileges` lists 16
-- rows per privilege either way, which is exactly what makes the two cases look
-- identical from a distance.
--
-- This GRANT is therefore REDUNDANT TODAY and kept on purpose: there is active
-- work to revoke the dead `anon` grants across the schema, and when the
-- table-level ALL on this table goes, public price reads must not go with it.
-- The catalog is deliberately world-readable — its one RLS policy is
-- `SELECT USING (true)`.
grant select (onboarding_price_php) on public.platform_retail_catalog_v2 to anon, authenticated;

-- ⚠ AND SO THE EXPOSURE BASELINE RECORDS THIS COLUMN AS anon=SIU, NOT anon=S.
-- INSERT/UPDATE arrive with the inherited table-level grant and CANNOT be
-- subtracted per column — Postgres has no way to carve one column out of a
-- table-level grant, and revoking at table level would drop the privileges for
-- all 17 columns at once (the grenade documented in DECISION_LOG 2026-08-12).
-- They are harmless: RLS on this table has NO write policy whatsoever, so every
-- write is refused regardless of grant. Identical to the 16 columns beside it,
-- and tracked with the rest of the anon-grant debt rather than pretended away.

-- The ladder. Idempotent and keyed by service_code; safe to re-run.
-- The sign-up prices are TODAY's retail values, so what a couple pays during
-- onboarding is unchanged by this migration — only the later price rises.
update public.platform_retail_catalog_v2
   set retail_price_php     = v.regular_php,
       onboarding_price_php = v.onboarding_php,
       updated_at           = now()
  from (values
          ('SETNAYAN_AI',   2499.00, 1499.00),  -- tier A · wedding
          ('SETNAYAN_AI_B', 1499.00,  899.00),  -- tier B · debut, corporate, gala night
          ('SETNAYAN_AI_C',  899.00,  499.00),  -- tier C · standard + unknown types
          ('SETNAYAN_AI_D',  199.00,   99.00)   -- tier D · light
       ) as v(service_code, regular_php, onboarding_php)
 where platform_retail_catalog_v2.service_code = v.service_code;

-- Tier E (simple_event) has no SKU and nothing to price — Setnayan AI is not
-- offered on an event with no vendors. Nothing to update.
