-- Verification bypass — a supplier the platform VOUCHES for, with the paperwork owed.
--
-- ── THE DECISION (owner, 2026-09-07) ────────────────────────────────────────
-- Real verification is four documents, a two-channel VALIDATE token, and a
-- 15-minute Google Meet. Correct for a mature marketplace, and also why
-- **zero suppliers had ever completed it** — `vendor_verifications` held 0 rows
-- the day this shipped, both existing shops carried a `verified` column written
-- by a seed, and the marketplace had never carried a single inquiry as a result.
--
-- So an admin may VOUCH for a supplier they know: listed immediately, documents
-- due in six months.
--
-- ⚠ TWO OWNER RULINGS THIS IMPLEMENTS WITHOUT SOFTENING:
--   • **Same badge.** Asked directly whether a couple should see a difference:
--     *"just same."* "Verified" now means *documents checked OR the platform
--     vouched*, and only an admin can tell which.
--   • **No cap.** Asked whether to limit concurrent bypasses: *"no limit."*
--     Nothing here restricts how many may be live.
--
-- 🔑 The deadline is therefore the ONLY thing holding the badge honest.
--
-- ── WHY A TABLE AND NOT COLUMNS ON vendor_profiles ──────────────────────────
-- The first draft added five columns to `vendor_profiles`. `exposure-freeze`
-- refused it, and was right: **a new column INHERITS the table's grants**, and
-- `vendor_profiles` grants SELECT+INSERT+**UPDATE** to `authenticated`. All five
-- arrived writable — so a vendor could have pushed their own
-- `verification_bypass_expires_at` into the future and never lost the badge.
-- A column-level REVOKE against a table-level grant is a no-op, so the columns
-- could not be closed where they stood.
--
-- A separate table inherits nothing. This one carries **no grants at all**:
-- only the service role reads or writes it, the vendor sees their deadline
-- through a server component, and a couple never sees it because of the
-- same-badge ruling above.
--
-- ── ENFORCEMENT: NO CRON (owner-locked 2026-05-14) ──────────────────────────
-- Durable DB state + an on-access sweep, the same shape Live Studio and Papic
-- sessions use. `expires_at` is the whole mechanism; live traffic runs it.

CREATE TABLE IF NOT EXISTS public.vendor_verification_bypasses (
  vendor_profile_id uuid PRIMARY KEY
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  granted_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  reason            text NOT NULL,
  granted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expired_at        timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS at CREATE TABLE time, per the canonical rule.
ALTER TABLE public.vendor_verification_bypasses ENABLE ROW LEVEL SECURITY;

-- ── REVOKE IS REQUIRED. "NO GRANT" IS NOT THE DEFAULT. ──────────────────────
-- 🔑 A brand-new table in `public` does NOT arrive closed. Supabase's default
-- privileges hand `anon` and `authenticated` SELECT + INSERT + UPDATE on
-- creation, so writing no GRANT statement leaves the table WIDE OPEN — measured
-- here: `exposure-freeze` reported `anon=SIU authenticated=SIU` on all five
-- columns of a table this migration had just described as "granted to nobody".
--
-- RLS alone would not save it either: RLS gates ROWS, and with no policy the
-- reads would be refused — but the INSERT/UPDATE privileges would still sit
-- there for the next person who adds a permissive policy for some other reason.
-- Table privileges are the defence in depth behind RLS, so they are closed
-- explicitly.
REVOKE ALL ON public.vendor_verification_bypasses FROM anon, authenticated, PUBLIC;

COMMENT ON TABLE public.vendor_verification_bypasses IS
  'Admin vouches: a shop listed on Setnayan''s word while its documents are pending. '
  'DELIBERATELY ungranted and unpolicied — service-role only. Lives outside '
  'vendor_profiles because a new column there would inherit that table''s '
  'authenticated UPDATE grant, which would let a vendor extend their own deadline.';
COMMENT ON COLUMN public.vendor_verification_bypasses.expires_at IS
  'The document deadline. Past it, the on-access sweep withdraws the listing '
  '(no cron — owner-locked 2026-05-14). NULL once documents were approved.';
COMMENT ON COLUMN public.vendor_verification_bypasses.reason IS
  'Why the platform vouched. NOT NULL: a bypass with no stated reason is '
  'indistinguishable from a mistake six months later.';
COMMENT ON COLUMN public.vendor_verification_bypasses.expired_at IS
  'Stamped when a deadline passed and the listing was withdrawn, so a re-grant '
  'reads as a SECOND chance rather than a continuation.';

-- The sweep only ever asks for live, already-due deadlines.
CREATE INDEX IF NOT EXISTS vendor_verification_bypasses_due_idx
  ON public.vendor_verification_bypasses (expires_at)
  WHERE expires_at IS NOT NULL;
