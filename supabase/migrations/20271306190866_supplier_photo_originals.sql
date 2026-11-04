-- supplier_photo_originals
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ═══════════════════════════════════════════════════════════════════════════
-- THE PRIVATE CLEAN COPY OF EVERY MARKED SUPPLIER PHOTO (owner-approved
-- 2026-11-04, supplier_photo_mark "Also decided": "The day a shop is verified
-- its photos are re-marked with the verified variant, and back to Setnayan only
-- if it loses verification; a private clean copy of each upload makes this
-- possible and is never shown.")
--
-- One row per PUBLIC (marked) copy:
--   public_ref    the r2:// ref every display column already stores
--                 (vendor_services.primary_photo_r2_key, showcase_photo_r2_keys,
--                 vendor_profiles.portfolio_r2_keys …). The re-mark job rewrites
--                 the bytes AT THIS KEY, so no referencing column ever changes.
--   original_ref  r2://setnayan-vendor-verification/vendor-originals/<vendor>/…
--                 — a PRIVATE bucket; the ref alone serves nothing.
--   frame         the framing the mark was stamped inside, or NULL = centre.
--                 { "focusX": 0..1, "focusY": 0..1, "zoom": 1..3, "shape": … }
--                 (Photo Frame Template, slice A1b reads/writes it.)
--   mark_kind     what the public copy currently carries — 'setnayan' or
--                 'verified' — so the re-mark job is IDEMPOTENT: it touches only
--                 rows whose mark_kind disagrees with the shop's state now.
--
-- RLS: canonical vendor-owner pattern (current_vendor_ids() / is_admin()), on at
-- CREATE TABLE. No anon or signed-in-other lane: nothing here is a public
-- surface; the server writes it after authorising the active shop.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.supplier_photo_originals (
  id                bigserial PRIMARY KEY,
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  public_ref        text NOT NULL,
  original_ref      text NOT NULL,
  frame             jsonb,
  mark_kind         text NOT NULL DEFAULT 'setnayan',
  created_at        timestamptz NOT NULL DEFAULT now(),
  marked_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_photo_originals_public_ref_key UNIQUE (public_ref),
  CONSTRAINT supplier_photo_originals_mark_kind_chk CHECK (mark_kind IN ('setnayan', 'verified')),
  CONSTRAINT supplier_photo_originals_refs_chk CHECK (
    public_ref LIKE 'r2://setnayan-media/vendors/%'
    AND original_ref LIKE 'r2://setnayan-vendor-verification/vendor-originals/%'
  )
);

CREATE INDEX IF NOT EXISTS supplier_photo_originals_vendor_idx
  ON public.supplier_photo_originals (vendor_profile_id);

ALTER TABLE public.supplier_photo_originals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_photo_originals_owner_all ON public.supplier_photo_originals;
CREATE POLICY supplier_photo_originals_owner_all
  ON public.supplier_photo_originals FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR (SELECT public.is_admin())
  );

-- Never an anonymous surface: no anon grant at all (the RLS policy is TO
-- authenticated; this closes the default table grant too).
REVOKE ALL ON public.supplier_photo_originals FROM anon;
REVOKE ALL ON SEQUENCE public.supplier_photo_originals_id_seq FROM anon;

COMMENT ON TABLE public.supplier_photo_originals IS
  'Private clean copy + framing of each marked supplier photo (Seal and plate, 2026-11-04). public_ref = the marked copy every display column stores; original_ref = the clean copy in the private verification bucket; mark_kind lets the re-mark job run idempotently when a shop gains or loses Verified.';
