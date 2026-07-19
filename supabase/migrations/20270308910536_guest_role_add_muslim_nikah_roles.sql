-- guest_role_add_muslim_nikah_roles
-- Muslim wedding track — the Nikah principal roles. A valid Islamic marriage
-- contract (nikah) has structural participants the existing Catholic/Civil
-- wedding roles don't cover: the bride's guardian (wali), the two required
-- witnesses (witness), the solemnizing imam/qadi (imam), and an optional
-- groom's proxy (wakil). These surface ONLY for muslim weddings, via the
-- ceremony-aware MUSLIM_ROLE_SET (lib/role-sets.ts) routed through
-- resolveRoleSetForEvent — a catholic wedding never sees them.
--
-- Pattern mirrors 20260607040000_guest_role_add_vip_family.sql and
-- 20270220984328_guest_role_add_generic.sql: ALTER TYPE ... ADD VALUE is
-- additive + idempotent. NO BEGIN/COMMIT — a newly-added enum value cannot be
-- referenced in the same transaction it is added in, so each ADD VALUE
-- auto-commits on its own. The wali/imam/wakil singleton indexes live in the
-- SEPARATE next migration (20270308998862) so they run in a later transaction
-- where these values are already committed.
--
-- PURELY ADDITIVE: existing values keep their names + creation order (Postgres
-- enum sort = creation order). No backfill. The bride/groom singleton indexes,
-- the guests_couple_force_attending trigger, and the
-- guests_extra_roles_no_singletons CHECK all key on literal 'bride'/'groom' and
-- stay unchanged + inert here.

ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'wali';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'witness';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'imam';
ALTER TYPE public.guest_role ADD VALUE IF NOT EXISTS 'wakil';
