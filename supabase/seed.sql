-- Setnayan dev seed. Idempotent; safe to re-run.
--
-- Sprint 0 keeps the seed deliberately empty — the auth signup flow on the
-- deployed app exercises the on_auth_user_created trigger end-to-end, which
-- is the acceptance path. Iteration 0001 will add a sample wedding (Maria &
-- Juan) with the canonical fixtures.json guest list once that iteration starts.

-- Verify the base schema is present and the canonical generator works.
DO $$
DECLARE
  v_sample_user_id TEXT;
  v_sample_event_id TEXT;
BEGIN
  v_sample_user_id := public.generate_public_id('U');
  v_sample_event_id := public.generate_public_id('E');

  IF v_sample_user_id !~ '^S89U-[0-9A-HJKMNP-TV-Z]{10}$' THEN
    RAISE EXCEPTION 'generate_public_id(U) produced invalid output: %', v_sample_user_id;
  END IF;
  IF v_sample_event_id !~ '^S89E-[0-9A-HJKMNP-TV-Z]{10}$' THEN
    RAISE EXCEPTION 'generate_public_id(E) produced invalid output: %', v_sample_event_id;
  END IF;

  RAISE NOTICE 'Sprint 0 seed OK. Sample IDs: % %', v_sample_user_id, v_sample_event_id;
END $$;
