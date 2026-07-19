-- guest_role_add_generic
-- Iteration 0053 Phase 2 — additive generic guest_role values for non-wedding
-- event types (the role set the GENERIC profile offers: host/vip/family/helper,
-- alongside the universal 'guest').
--
-- Pattern mirrors 20260530020000_guest_role_add_bride_groom.sql and
-- 20260607040000_guest_role_add_vip_family.sql: ALTER TYPE ... ADD VALUE is
-- additive and idempotent. NO BEGIN/COMMIT — a newly-added enum value cannot be
-- referenced in the same transaction it is added in, so each ADD VALUE
-- auto-commits on its own.
--
-- PURELY ADDITIVE: the 24 existing values keep their names + creation order
-- (Postgres enum sort = creation order). NO partial unique indexes (generic
-- roles are multi-instance — an event can have many hosts/vips/family/helpers).
-- The bride/groom singleton indexes, the guests_couple_force_attending trigger,
-- and the guests_extra_roles_no_singletons CHECK all key on literal
-- 'bride'/'groom' and stay unchanged + inert for generic events. No backfill.

ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'host';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'vip';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'family';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'helper';
