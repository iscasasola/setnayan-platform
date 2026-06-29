-- ============================================================================
-- Right-of-Reply: re-lock vendor_reply as IMMUTABLE (owner 2026-06-29)
-- ============================================================================
-- Owner decision (Soon-benefits Wave 1, Right-of-Reply polish): a vendor gets
-- ONE public reply per review — once written it can never be edited. This
-- REVERSES the 2027-01-11 "editable" relax (20270111780655_vendor_review_response.sql
-- §1), restoring the original write-once contract from 20260514100000_vendor_reviews.sql.
--
-- We keep the vendor_reply_at auto-stamp on first write; we drop the
-- "keep vendor_reply_at in sync on edit" branch (edits are no longer possible)
-- and re-raise on any attempt to change vendor_reply / vendor_reply_at once set.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; the trigger
-- (vendor_reviews_lock_reply) is already wired from the original migration, so
-- replacing the function body is sufficient.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lock_vendor_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Immutable once set: a non-null vendor_reply can never change, and its
  -- timestamp can never be rewritten. Any such attempt is rejected so the
  -- public reply is a one-time, permanent statement.
  IF OLD.vendor_reply IS NOT NULL
     AND (NEW.vendor_reply IS DISTINCT FROM OLD.vendor_reply
          OR NEW.vendor_reply_at IS DISTINCT FROM OLD.vendor_reply_at) THEN
    RAISE EXCEPTION 'vendor_reply is locked once set';
  END IF;

  -- Auto-stamp vendor_reply_at on the FIRST write if the caller didn't supply
  -- one (the reply goes from NULL -> set).
  IF NEW.vendor_reply IS NOT NULL AND OLD.vendor_reply IS NULL
     AND NEW.vendor_reply_at IS NULL THEN
    NEW.vendor_reply_at := NOW();
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
