-- ============================================================================
-- 20270918210897_chibi_avatar_foundation.sql
-- Build ② PR-1 — chibi avatar foundation (OnTheDay_App_Build_Studies
-- 2026-07-23 § 2 / Chibi_Rig_Production_Spec_2026-07-19 §§ 3/10/11).
--
-- INERT ON MERGE: zero readers, zero writers. The columns exist so the later
-- maker PR (session-verified guest server action, the submitRsvp pattern) can
-- write and the later reader PR (public_venue_scene v-bump) can read without
-- another schema change. Safe under the auto-apply-on-merge workflow.
--
-- guests RLS is deliberately UNTOUCHED: guests never authenticate (zero-
-- account subjects), the couple's event-scoped read already covers the
-- dashboard, and the future write path is a server action running through
-- createAdminClient after a readGuestSession() guard — no anon grant needed.
--
-- ⚠ PRIVACY (RA 10173): avatar_config is guest-authored preference data on a
-- zero-account subject. It rides guests' existing export/erasure lifecycle
-- (event-scoped deletion cascades); guest-initiated reset = SET avatar_config
-- = NULL. bodyType inside the JSON is an avatar COSMETIC and is NEVER read
-- from / written to / inferred from users.sex (rig spec § 3 fence).
--
-- NOTE (spec divergence, surfaced not silent): rig spec § 11.4 names an
-- account-level users.avatar_parts store. Guests are zero-account, so
-- guests.avatar_config is the store of record for the venue walk;
-- copy-on-account-claim can add users.avatar_parts in a later PR.
-- ============================================================================

BEGIN;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS avatar_config     JSONB,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- Backstop against a compromised/buggy writer stuffing megabytes into a row
-- (serialized v1 configs are ~260 bytes). Added separately so a re-run that
-- finds the columns already present still lands the constraint exactly once.
DO $$ BEGIN
  ALTER TABLE public.guests
    ADD CONSTRAINT guests_avatar_config_size_check
    CHECK (avatar_config IS NULL OR pg_column_size(avatar_config) <= 2048);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.guests.avatar_config IS
  'Guest-chosen chibi avatar parts {v, bodyType, skinTone, hairStyle, hairColor, eyes, mouth, mark, outfit, outfitColor, accessory, colorMode}. NULL -> hash-derived default look (initials-token fallback today; resolveChibiConfig defaults once the chibi flag flips). Written ONLY via the session-verified guest server action; every key sanitized server-side against the lib/chibi-config.ts whitelist. bodyType is a COSMETIC and never derives from users.sex.';
COMMENT ON COLUMN public.guests.avatar_updated_at IS
  'When the guest last saved their chibi in the avatar maker (debounced writes).';

COMMIT;
