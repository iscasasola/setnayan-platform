-- definer_search_path_hardening — pin search_path on this session's DEFINER fns.
-- ============================================================================
-- Second-pass hardening (adversarial review): the 9 SECURITY DEFINER functions
-- added for fake-inquiry protection + the cron-free primitive omitted `SET
-- search_path`, tripping Supabase's `function_search_path_mutable` advisory (the
-- repo convention — 162/197 DEFINER migrations set it). None are exploitable
-- today (every reference is schema-qualified `public.*` or a pg_catalog builtin,
-- and none call an `extensions`-schema function), but pinning the resolver is
-- defence-in-depth against a future unqualified call resolving to a shadowed
-- object. Metadata-only ALTERs — no body change; idempotent.
-- ============================================================================
ALTER FUNCTION public.unlock_vendor_event_hold(UUID, UUID, UUID)             SET search_path = public;
ALTER FUNCTION public.consume_lead_token_hold(UUID, TEXT)                    SET search_path = public;
ALTER FUNCTION public.consume_lead_token_hold_for(UUID, UUID, TEXT)          SET search_path = public;
ALTER FUNCTION public.release_lead_token_hold(UUID, TEXT)                    SET search_path = public;
ALTER FUNCTION public.sweep_ghosted_lead_holds(INTERVAL)                     SET search_path = public;
ALTER FUNCTION public.handle_vendor_lead_report(UUID, UUID, UUID, TEXT, INT) SET search_path = public;
ALTER FUNCTION public.get_lead_trust_flags(UUID, UUID[])                     SET search_path = public;
ALTER FUNCTION public.detect_inquiry_concentration(INTERVAL, INT)            SET search_path = public;
ALTER FUNCTION public.claim_periodic_job(TEXT, INTERVAL)                     SET search_path = public;
