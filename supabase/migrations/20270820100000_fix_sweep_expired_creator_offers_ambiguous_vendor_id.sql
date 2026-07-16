-- ============================================================================
-- 20270820100000_fix_sweep_expired_creator_offers_ambiguous_vendor_id.sql
-- Creator Economy P1 — HOTFIX: the expiry-refund sweep could never run.
--
-- BUG (caught by the creator-loop DB verification suite, 2026-07-17 — the
-- suite replays every migration into an embedded Postgres and exercises the
-- four walkthroughs of 20270819350491):
--
--   sweep_expired_creator_offers() ABORTS with
--     ERROR 42702: column reference "vendor_id" is ambiguous
--   the moment it processes an expired ESCROWED offer.
--
--   Root cause: the function's RETURNS TABLE declares OUT columns
--   (offer_id, vendor_id, holder_user_id, tokens), and in plpgsql those are
--   variables visible to every SQL statement in the body. The refund path's
--     INSERT INTO public.vendor_wallets AS vw (vendor_id, …)
--     ON CONFLICT (vendor_id) DO UPDATE …
--   parses the ON CONFLICT arbiter columns in expression context (they may be
--   expression-index terms), so `vendor_id` resolves to BOTH the OUT variable
--   and the table column → error under the default
--   plpgsql.variable_conflict = error. Same collision in the member-wallet
--   branch's ON CONFLICT (vendor_id, user_id).
--
--   Blast radius: the sweep has NO exception handler, so the whole call rolls
--   back — expired offers stay 'pending' forever and the vendor's escrowed
--   reach tokens are never refunded (walkthrough (c) of 20270819350491 was
--   unreachable in practice). respond_creator_offer correctly raises
--   OFFER_EXPIRED past the window (walkthrough (d)), which makes the stuck
--   state total: neither the creator nor the sweep could resolve the row.
--   Send/accept/decline paths are unaffected (no OUT params there).
--
-- FIX: same body, with `#variable_conflict use_column` so ambiguous names
-- inside SQL statements resolve to the table column (every intended variable
-- reference in the body is explicitly v_o.* / v_founder-qualified, and the
-- RETURN NEXT assignments are plpgsql assignment targets, which are always
-- variables — the pragma cannot misroute them). Signature and OUT names are
-- unchanged, so CREATE OR REPLACE is safe and callers keep working.
--
-- Idempotent. Prod apply: supabase db push --db-url "$SUPABASE_DB_URL".
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sweep_expired_creator_offers()
RETURNS TABLE (offer_id UUID, vendor_id UUID, holder_user_id UUID, tokens INT) AS $$
#variable_conflict use_column
DECLARE
  v_o       public.vendor_creator_offers;
  v_founder UUID;
BEGIN
  FOR v_o IN
    SELECT * FROM public.vendor_creator_offers o
     WHERE o.status = 'pending'
       AND o.expires_at < now()
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Flip + stamp under the row lock we already hold. The WHERE
    -- status='pending' re-check is belt-and-braces; the lock guarantees it.
    UPDATE public.vendor_creator_offers o
       SET status = 'expired',
           responded_at = now(),
           refunded_at = CASE
             WHEN o.escrowed_at IS NOT NULL
              AND o.reach_tokens_held > 0
              AND o.refunded_at IS NULL
             THEN now() ELSE o.refunded_at END
     WHERE o.id = v_o.id
       AND o.status = 'pending';

    -- REFUND the escrow (walkthrough (c) of 20270819350491): only if tokens
    -- were actually debited at send (escrowed) and never refunded. Credited
    -- back as PURCHASED (non-expiring) — per-voucher restore is impractical
    -- (see 20270819350491 header + 20270723145233).
    IF v_o.escrowed_at IS NOT NULL
       AND v_o.reach_tokens_held > 0
       AND v_o.refunded_at IS NULL THEN
      SELECT vp.user_id INTO v_founder
        FROM public.vendor_profiles vp
       WHERE vp.vendor_profile_id = v_o.vendor_id;

      IF v_o.is_founder_draw
         OR v_o.holder_user_id IS NULL
         OR v_o.holder_user_id = v_founder THEN
        INSERT INTO public.vendor_wallets AS vw (vendor_id, purchased_tokens, earned_tokens)
        VALUES (v_o.vendor_id, v_o.reach_tokens_held, 0)
        ON CONFLICT (vendor_id) DO UPDATE
          SET purchased_tokens = vw.purchased_tokens + EXCLUDED.purchased_tokens,
              updated_at = now();
      ELSE
        INSERT INTO public.vendor_member_token_wallets AS vm (vendor_id, user_id, purchased_tokens)
        VALUES (v_o.vendor_id, v_o.holder_user_id, v_o.reach_tokens_held)
        ON CONFLICT (vendor_id, user_id) DO UPDATE
          SET purchased_tokens = vm.purchased_tokens + EXCLUDED.purchased_tokens,
              updated_at = now();
      END IF;
    END IF;

    offer_id       := v_o.offer_id;
    vendor_id      := v_o.vendor_id;
    holder_user_id := v_o.holder_user_id;
    tokens         := v_o.reach_tokens_held;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.sweep_expired_creator_offers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_expired_creator_offers() TO service_role;

COMMIT;
