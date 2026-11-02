## 2026-09-18 · fix(security): signed-out visitors lose their unused write grants on vendor_services (SUP-28)

- `anon` held INSERT / UPDATE / DELETE / TRUNCATE on `public.vendor_services` (the default table grant). No policy is `TO anon`, so RLS already refused every row write. TRUNCATE is not row-level, though, and RLS never applied to it.
- Before revoking, checked prod for a caller: the only SQL writers (`save_vendor_service`, `merge_canonical_service`) are SECURITY DEFINER and not executable by anon, and the table has no column-level ACLs.
- Migration `20271234196231_vendor_services_signed_out_cannot_write.sql`. SELECT is untouched.
- `supabase/security/exposure-surface.baseline.txt` regenerated. It only narrows (42 facts: the anon tpriv line goes from SIUD to S, and the per-column anon write facts drop). A re-grant would now be a widening, which fails `exposure-freeze.db.test.ts`.

SPEC IMPACT: None
