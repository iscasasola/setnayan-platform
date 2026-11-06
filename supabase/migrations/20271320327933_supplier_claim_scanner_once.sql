-- supplier claim scanner once
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🎟 THE SUPPLIER CLAIM SCANNER — slice 1: a per-service scanner + ONCE.
--
-- Owner rulings (spec corpus DECISION_LOG): 2026-09-25 "SUPPLIERS CLAIM A
-- GUEST'S SERVICE BY SCANNING…", "SUPPLIER SCAN SHOWS A COUNT ONLY", "EVERY
-- SUPPLIER SCAN GETS A SHARED SEQUENCE NUMBER", "NFC = QR IN EVERY SUPPLIER
-- MODE", "FIRST USE … SOUVENIRS FOR ALL"; 2026-10-03 "SUPPLIER SCAN …
-- APPROVED" (design of record prototypes/supplier_scan_2026-10-03_fable.html);
-- 2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE SET ONCE PER SERVICE".
--
--   1 · supplier_scan_settings — ONE row per service (a vendor_coverages row):
--       scanner on/off + its mode. Only 'once' exists in this slice; each later
--       slice widens the CHECK when its mode is really built, so no row can
--       ever hold a mode the code cannot run.
--   2 · supplier_scan_counters — the shared #0001 sequence, per supplier
--       service per event. Never read or written directly: only the claim
--       function below touches it, under a row lock, in the SAME transaction
--       that writes the claim — so two phones scanning at once get #0042 and
--       #0043, and a failed write rolls its number back (no gaps from races).
--   3 · supplier_scan_claims — one row per claim for every service that is not
--       a souvenir. Mode 'once' is UNIQUE per guest per service per event.
--   4 · guest_souvenir_claims (the couple's souvenir desk, 20270316014670) is
--       EXTENDED, not copied: a souvenir service's Once scan writes THAT row,
--       with the supplier, the service, the number and the method. The couple's
--       desk and the supplier scanner therefore read ONE record and can never
--       disagree (RULE 0 #8). A guest the couple's desk already handed a
--       souvenir is "Already claimed" at the supplier too.
--
-- 🔒 WHO MAY SCAN — every check is here, server-side, never in the page:
--   · the caller is the service's shop (owner / team member) or holds that
--     shop's live day-of grant for THIS event;
--   · that shop is BOOKED on the event (the brief's booked statuses);
--   · the service's scanner is ON;
--   · the code is a guest of THIS event (on its list, not deleted). Anything
--     else answers 'not_guest' and writes NOTHING.
-- 🔢 COUNT ONLY: nothing returned here names a guest. A coordinator the hosts
-- approved sees the name because the PAGE re-reads the guest row under the
-- caller's own RLS (host read parity) — this function never decides that.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · the per-service scanner setting ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_scan_settings (
  coverage_id        BIGINT PRIMARY KEY
                     REFERENCES public.vendor_coverages (id) ON DELETE CASCADE,
  -- Denormalised from the coverage by the trigger below — never trusted from the caller.
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  mode               TEXT NOT NULL DEFAULT 'once',
  updated_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.supplier_scan_settings DROP CONSTRAINT IF EXISTS supplier_scan_settings_mode_check;
ALTER TABLE public.supplier_scan_settings
  ADD CONSTRAINT supplier_scan_settings_mode_check CHECK (mode IN ('once'));

CREATE INDEX IF NOT EXISTS supplier_scan_settings_vendor_idx
  ON public.supplier_scan_settings (vendor_profile_id);

ALTER TABLE public.supplier_scan_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_scan_settings FROM anon;

-- The shop that owns the coverage, always — so a row can never point one shop's
-- setting at another shop's service.
CREATE OR REPLACE FUNCTION public.supplier_scan_settings_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT vc.vendor_profile_id INTO NEW.vendor_profile_id
    FROM public.vendor_coverages vc WHERE vc.id = NEW.coverage_id;
  IF NEW.vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'service_not_found' USING ERRCODE = 'P0002';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- A trigger function, never an RPC: nobody calls it by hand.
REVOKE ALL ON FUNCTION public.supplier_scan_settings_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supplier_scan_settings_owner ON public.supplier_scan_settings;
CREATE TRIGGER supplier_scan_settings_owner
  BEFORE INSERT OR UPDATE ON public.supplier_scan_settings
  FOR EACH ROW EXECUTE FUNCTION public.supplier_scan_settings_owner();

-- The shop (owner + admin team members) manages its own; console admins read all.
DROP POLICY IF EXISTS supplier_scan_settings_vendor_all ON public.supplier_scan_settings;
CREATE POLICY supplier_scan_settings_vendor_all ON public.supplier_scan_settings
  FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS supplier_scan_settings_admin_read ON public.supplier_scan_settings;
CREATE POLICY supplier_scan_settings_admin_read ON public.supplier_scan_settings
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.supplier_scan_settings IS
  'Supplier claim scanner, set ONCE per service (one vendor_coverages row) and applied to every event booked for it (DECISION_LOG 2026-10-29). enabled + mode; mode widens slice by slice. vendor_profile_id is copied from the coverage by trigger.';

-- ─── 2 · the shared number, per supplier service per event ───────────────────
CREATE TABLE IF NOT EXISTS public.supplier_scan_counters (
  event_id     UUID NOT NULL REFERENCES public.events (event_id) ON DELETE CASCADE,
  coverage_id  BIGINT NOT NULL REFERENCES public.vendor_coverages (id) ON DELETE CASCADE,
  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (event_id, coverage_id)
);

CREATE INDEX IF NOT EXISTS supplier_scan_counters_coverage_idx
  ON public.supplier_scan_counters (coverage_id);

ALTER TABLE public.supplier_scan_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_scan_counters FROM anon;
-- No browser role writes a number — the pen is taken away, not just refused by RLS.
REVOKE INSERT, UPDATE, DELETE ON public.supplier_scan_counters FROM authenticated;

-- No write policy on purpose: only supplier_scan_claim() (SECURITY DEFINER) moves a number.
DROP POLICY IF EXISTS supplier_scan_counters_admin_read ON public.supplier_scan_counters;
CREATE POLICY supplier_scan_counters_admin_read ON public.supplier_scan_counters
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.supplier_scan_counters IS
  'The shared #0001 sequence of the supplier claim scanner, per supplier service (coverage) per event. Moved only by supplier_scan_claim() under a row lock, in the transaction that writes the claim — no gaps from races.';

-- ─── 3 · the claim record (every service that is not a souvenir) ─────────────
CREATE TABLE IF NOT EXISTS public.supplier_scan_claims (
  claim_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL,
  guest_id           UUID NOT NULL,
  coverage_id        BIGINT NOT NULL REFERENCES public.vendor_coverages (id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  scan_number        INTEGER NOT NULL CHECK (scan_number > 0),
  mode               TEXT NOT NULL,
  method             TEXT NOT NULL CHECK (method IN ('supplier_qr', 'supplier_nfc')),
  scanned_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  claimed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A Once claim is received the moment it is made. The column exists from this slice on because the one guest-review
  -- writer (`vendor_guest_review_submit`, #7337) reads `state = 'received'` as soon as this table exists — without it
  -- every guest review from a guest the door never checked in fails with "column c.state does not exist" until slice 2
  -- ships. Slice 2 (ordered → received) widens this CHECK by name; its ADD COLUMN IF NOT EXISTS is then a no-op.
  state              TEXT NOT NULL DEFAULT 'received'
                       CONSTRAINT supplier_scan_claims_state_check CHECK (state IN ('received')),
  FOREIGN KEY (event_id, guest_id)
    REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

ALTER TABLE public.supplier_scan_claims DROP CONSTRAINT IF EXISTS supplier_scan_claims_mode_check;
ALTER TABLE public.supplier_scan_claims
  ADD CONSTRAINT supplier_scan_claims_mode_check CHECK (mode IN ('once'));

-- ONCE = one claim per guest per service per event. The function checks first under
-- the counter's lock; this is the belt under it.
CREATE UNIQUE INDEX IF NOT EXISTS supplier_scan_claims_once_uniq
  ON public.supplier_scan_claims (event_id, coverage_id, guest_id)
  WHERE mode = 'once';
CREATE INDEX IF NOT EXISTS supplier_scan_claims_event_idx
  ON public.supplier_scan_claims (event_id, coverage_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS supplier_scan_claims_guest_idx
  ON public.supplier_scan_claims (guest_id);
CREATE INDEX IF NOT EXISTS supplier_scan_claims_vendor_idx
  ON public.supplier_scan_claims (vendor_profile_id);
CREATE INDEX IF NOT EXISTS supplier_scan_claims_scanner_idx
  ON public.supplier_scan_claims (scanned_by_user_id) WHERE scanned_by_user_id IS NOT NULL;

ALTER TABLE public.supplier_scan_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_scan_claims FROM anon;
-- Claims are written only by supplier_scan_claim(); a browser role keeps SELECT (couple · coordinator · admin, by
-- policy) and DELETE (admin's fix, by policy) — never INSERT or UPDATE.
REVOKE INSERT, UPDATE ON public.supplier_scan_claims FROM authenticated;

-- The event's couple + coordinator READ (their desk shows names — they can already read
-- the guest list); Setnayan admin reads and fixes. A SUPPLIER has no direct read at all:
-- it sees counts through supplier_scan_tally(), never a guest id.
DROP POLICY IF EXISTS supplier_scan_claims_member_read ON public.supplier_scan_claims;
CREATE POLICY supplier_scan_claims_member_read ON public.supplier_scan_claims
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = supplier_scan_claims.event_id
         AND em.user_id = (SELECT auth.uid())
         AND em.member_type IN ('couple', 'coordinator')
    )
  );

DROP POLICY IF EXISTS supplier_scan_claims_admin_delete ON public.supplier_scan_claims;
CREATE POLICY supplier_scan_claims_admin_delete ON public.supplier_scan_claims
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.supplier_scan_claims IS
  'Supplier claim scanner: one row = this guest claimed this supplier service at the event, under the shared number scan_number. Souvenir services write guest_souvenir_claims instead (one record with the couple''s desk). Written only by supplier_scan_claim(); couple/coordinator read; admin reads + deletes (fix).';

-- ─── 4 · the couple's souvenir desk, extended ────────────────────────────────
ALTER TABLE public.guest_souvenir_claims
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_id BIGINT
    REFERENCES public.vendor_coverages (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_number INTEGER CHECK (scan_number IS NULL OR scan_number > 0);

ALTER TABLE public.guest_souvenir_claims DROP CONSTRAINT IF EXISTS guest_souvenir_claims_method_check;
ALTER TABLE public.guest_souvenir_claims
  ADD CONSTRAINT guest_souvenir_claims_method_check
  CHECK (method IN ('qr_scan', 'manual_search', 'supplier_qr', 'supplier_nfc'));

CREATE INDEX IF NOT EXISTS guest_souvenir_claims_vendor_idx
  ON public.guest_souvenir_claims (vendor_profile_id) WHERE vendor_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS guest_souvenir_claims_coverage_idx
  ON public.guest_souvenir_claims (coverage_id) WHERE coverage_id IS NOT NULL;

COMMENT ON COLUMN public.guest_souvenir_claims.vendor_profile_id IS
  'The supplier whose scanner recorded this claim (method supplier_qr / supplier_nfc); NULL = the couple''s own desk.';
COMMENT ON COLUMN public.guest_souvenir_claims.scan_number IS
  'The supplier scanner''s shared number (#0042) for this claim; NULL for a claim made at the couple''s own desk.';

-- ─── 5 · which services hand out souvenirs ───────────────────────────────────
-- The leaves under the taxonomy tile `souvenir_giveaways` (lib/taxonomy.ts), plus the
-- tile key itself. 🔒 lib/supplier-scan.test.ts fails the moment the taxonomy grows a
-- souvenir leaf this list does not name.
CREATE OR REPLACE FUNCTION public.supplier_scan_is_souvenir(p_canonical_service TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_canonical_service IN (
    'souvenir_giveaways',
    'souvenirs_giveaways',
    'pasalubong_box',
    'sponsor_token',
    'godchild_token',
    'angpao_betrothal_supplier'
  );
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_is_souvenir(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_is_souvenir(TEXT) TO authenticated;

-- ─── 6 · who is scanning: the service's shop on this event, booked ───────────
-- Returns the coverage's shop when the caller may scan for it on this event; NULL
-- otherwise. Owner / team member of the shop, or a live day-of grant for this event.
CREATE OR REPLACE FUNCTION public.supplier_scan_shop_for(p_event_id UUID, p_coverage_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID;
BEGIN
  SELECT vc.vendor_profile_id INTO v_vendor FROM public.vendor_coverages vc WHERE vc.id = p_coverage_id;
  IF v_vendor IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_vendor AND vp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.vendor_team_members tm WHERE tm.vendor_profile_id = v_vendor AND tm.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.vendor_event_access_grants g
       WHERE g.vendor_profile_id = v_vendor AND g.event_id = p_event_id
         AND g.grantee_user_id = auth.uid() AND g.revoked_at IS NULL
    )
  ) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = v_vendor
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ) THEN
    RETURN NULL;
  END IF;
  -- The SERVICE was booked: when the booking names its services (requested_service_ids →
  -- vendor_services.coverage_id), this one must be among them. A booking that names none
  -- (older bookings) admits every service of the shop — the same fallback the console's
  -- tools use (get_vendor_booked_service_categories → the booking's summary category).
  IF EXISTS (
    SELECT 1 FROM public.event_vendors ev
      JOIN public.vendor_services vs
        ON vs.vendor_service_id = ANY (ev.requested_service_ids) AND vs.vendor_profile_id = v_vendor
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = v_vendor
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND vs.coverage_id IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
      JOIN public.vendor_services vs
        ON vs.vendor_service_id = ANY (ev.requested_service_ids) AND vs.vendor_profile_id = v_vendor
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = v_vendor
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND vs.coverage_id = p_coverage_id
  ) THEN
    RETURN NULL;
  END IF;
  RETURN v_vendor;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_shop_for(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_shop_for(UUID, BIGINT) TO authenticated;

-- The services the CALLER may scan for on this event: their shop's, booked, scanner ON.
-- What the Hub's Scanner view lists. Ids and service keys only — no guest data.
CREATE OR REPLACE FUNCTION public.supplier_scan_services(p_event_id UUID)
RETURNS TABLE (coverage_id BIGINT, canonical_service TEXT, mode TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vc.id, vc.canonical_service, s.mode
    FROM public.vendor_coverages vc
    JOIN public.supplier_scan_settings s ON s.coverage_id = vc.id AND s.enabled
   WHERE vc.vendor_profile_id IN (
           SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
           UNION
           SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
           UNION
           SELECT g.vendor_profile_id FROM public.vendor_event_access_grants g
            WHERE g.event_id = p_event_id AND g.grantee_user_id = auth.uid() AND g.revoked_at IS NULL
         )
     AND public.supplier_scan_shop_for(p_event_id, vc.id) IS NOT NULL
   ORDER BY vc.created_at, vc.id;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_services(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_services(UUID) TO authenticated;

-- ─── 7 · the guests a scan counts against ────────────────────────────────────
-- "of T": the event's ATTENDING guests, with the same filters the supplier brief's
-- "coming (RSVP)" uses (get_vendor_event_brief) — one number, said the same way.
CREATE OR REPLACE FUNCTION public.supplier_scan_total(p_event_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.guests g
   WHERE g.event_id = p_event_id
     AND g.deleted_at IS NULL
     AND g.entry_source <> 'self_added_unlisted'
     AND NOT g.passed_away
     AND g.represented_by_guest_id IS NULL
     AND g.rsvp_status = 'attending';
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_total(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 8 · the count a supplier sees ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_scan_tally(p_event_id UUID, p_coverage_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor    UUID;
  v_canonical TEXT;
  v_setting   public.supplier_scan_settings%ROWTYPE;
  v_claimed   INTEGER;
  v_last      INTEGER;
BEGIN
  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;
  SELECT vc.canonical_service INTO v_canonical FROM public.vendor_coverages vc WHERE vc.id = p_coverage_id;
  SELECT * INTO v_setting FROM public.supplier_scan_settings s WHERE s.coverage_id = p_coverage_id;

  IF public.supplier_scan_is_souvenir(v_canonical) THEN
    -- The souvenir is ONE pile: whoever handed it out (this scanner or the couple's desk).
    SELECT COUNT(*)::INTEGER INTO v_claimed FROM public.guest_souvenir_claims c WHERE c.event_id = p_event_id;
  ELSE
    SELECT COUNT(DISTINCT c.guest_id)::INTEGER INTO v_claimed
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id;
  END IF;
  SELECT k.last_number INTO v_last
    FROM public.supplier_scan_counters k
   WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id;

  RETURN jsonb_build_object(
    'enabled', COALESCE(v_setting.enabled, FALSE),
    'mode', COALESCE(v_setting.mode, 'once'),
    'souvenir', public.supplier_scan_is_souvenir(v_canonical),
    'claimed', COALESCE(v_claimed, 0),
    'total', public.supplier_scan_total(p_event_id),
    'last_number', COALESCE(v_last, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_tally(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_tally(UUID, BIGINT) TO authenticated;

-- ─── 9 · THE SCAN ────────────────────────────────────────────────────────────
-- p_token: the guest's qr_token, already parsed from the QR or the NFC tag by the
-- ONE parser (lib/checkin.ts parseGuestQrPayload). p_method: 'supplier_qr' | 'supplier_nfc'.
-- Returns { outcome: 'claimed' | 'already' | 'not_guest', number, claimed, total }.
-- 'not_guest' writes nothing and says nothing about any other event.
CREATE OR REPLACE FUNCTION public.supplier_scan_claim(
  p_event_id UUID,
  p_coverage_id BIGINT,
  p_token TEXT,
  p_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor    UUID;
  v_canonical TEXT;
  v_souvenir  BOOLEAN;
  v_setting   public.supplier_scan_settings%ROWTYPE;
  v_guest     UUID;
  v_existing  INTEGER;
  v_found     BOOLEAN := FALSE;
  v_number    INTEGER;
  v_claimed   INTEGER;
BEGIN
  IF p_method NOT IN ('supplier_qr', 'supplier_nfc') THEN
    RAISE EXCEPTION 'bad_method' USING ERRCODE = '22023';
  END IF;

  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_setting FROM public.supplier_scan_settings s WHERE s.coverage_id = p_coverage_id;
  IF NOT FOUND OR NOT v_setting.enabled THEN
    RAISE EXCEPTION 'scanner_off' USING ERRCODE = '42501';
  END IF;

  SELECT vc.canonical_service INTO v_canonical FROM public.vendor_coverages vc WHERE vc.id = p_coverage_id;
  v_souvenir := public.supplier_scan_is_souvenir(v_canonical);

  -- A guest of THIS event, on its list. Anything else: refused, nothing written.
  SELECT g.guest_id INTO v_guest
    FROM public.guests g
   WHERE g.event_id = p_event_id
     AND g.qr_token = lower(btrim(COALESCE(p_token, '')))
     AND g.deleted_at IS NULL
     AND g.entry_source <> 'self_added_unlisted';
  IF v_guest IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_guest');
  END IF;

  -- 🔒 The number's lock. Every scan of this service at this event queues here, so the
  -- "already?" check and the allocation below cannot interleave.
  INSERT INTO public.supplier_scan_counters (event_id, coverage_id)
  VALUES (p_event_id, p_coverage_id)
  ON CONFLICT (event_id, coverage_id) DO NOTHING;
  PERFORM 1 FROM public.supplier_scan_counters k
    WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
    FOR UPDATE;

  IF v_souvenir THEN
    SELECT c.scan_number, TRUE INTO v_existing, v_found
      FROM public.guest_souvenir_claims c WHERE c.guest_id = v_guest;
  ELSE
    SELECT c.scan_number, TRUE INTO v_existing, v_found
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id
       AND c.guest_id = v_guest AND c.mode = 'once';
  END IF;

  IF COALESCE(v_found, FALSE) THEN
    RETURN jsonb_build_object(
      'outcome', 'already',
      'number', v_existing,
      'claimed', NULL,
      'total', NULL
    );
  END IF;

  UPDATE public.supplier_scan_counters k
     SET last_number = k.last_number + 1
   WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
  RETURNING k.last_number INTO v_number;

  IF v_souvenir THEN
    INSERT INTO public.guest_souvenir_claims
      (event_id, guest_id, claimed_by_user_id, method, vendor_profile_id, coverage_id, scan_number)
    VALUES (p_event_id, v_guest, auth.uid(), p_method, v_vendor, p_coverage_id, v_number);
    SELECT COUNT(*)::INTEGER INTO v_claimed FROM public.guest_souvenir_claims c WHERE c.event_id = p_event_id;
  ELSE
    INSERT INTO public.supplier_scan_claims
      (event_id, guest_id, coverage_id, vendor_profile_id, scan_number, mode, method, scanned_by_user_id)
    VALUES (p_event_id, v_guest, p_coverage_id, v_vendor, v_number, 'once', p_method, auth.uid());
    SELECT COUNT(DISTINCT c.guest_id)::INTEGER INTO v_claimed
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'number', v_number,
    'claimed', v_claimed,
    'total', public.supplier_scan_total(p_event_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_claim(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_claim(UUID, BIGINT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.supplier_scan_claim(UUID, BIGINT, TEXT, TEXT) IS
  'The supplier claim scanner (slice 1, Once). Caller must be the service''s shop (or its day-of grantee) BOOKED on the event, with the scanner ON; the token must be a listed guest of THIS event. Allocates the shared number under the counter row lock in the same transaction as the claim. Returns no name; the first name is asked for separately (supplier_scan_first_name), after the claim is recorded.';


-- 👤 THE GUEST'S FIRST NAME, AFTER A RECORDED SCAN (owner 2026-11-05: *"name is fine"* — the supplier sees the
-- number and the guest's first name). Never the last name, never a guest card. Answers only the shop that may scan
-- this service at this event (supplier_scan_shop_for), and only for a guest that shop has a RECORDED claim for at
-- this service — so a code can never be looked up without being claimed. Everyone else: NULL.
CREATE OR REPLACE FUNCTION public.supplier_scan_first_name(p_event_id UUID, p_coverage_id BIGINT, p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest UUID;
  v_first TEXT;
BEGIN
  IF public.supplier_scan_shop_for(p_event_id, p_coverage_id) IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT g.guest_id, g.first_name INTO v_guest, v_first
    FROM public.guests g
   WHERE g.event_id = p_event_id
     AND g.qr_token = lower(btrim(COALESCE(p_token, '')))
     AND g.deleted_at IS NULL;
  IF v_guest IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.guest_id = v_guest
  ) AND NOT EXISTS (
    SELECT 1 FROM public.guest_souvenir_claims s
     WHERE s.event_id = p_event_id AND s.guest_id = v_guest AND s.coverage_id = p_coverage_id
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(btrim(COALESCE(v_first, '')), '');
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_first_name(UUID, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_first_name(UUID, BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.supplier_scan_first_name(UUID, BIGINT, TEXT) IS
  'The supplier claim scanner: a scanned guest''s FIRST name only (owner 2026-11-05), for the shop that may scan this service at this event, and only once that guest has a recorded claim for it. Never the last name. NULL for everyone else.';

COMMIT;
