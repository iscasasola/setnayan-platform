## 2026-09-02 · fix(rls): revoke panood_rtc_can_access's stray anon grant, confirm SPF/DKIM alignment

Two small measurements from the Live Studio sweep, both closed:

- `panood_rtc_can_access` carried an EXECUTE grant to `anon` that its two
  siblings (`call_rtc_can_access`, `live_studio_guest_rtc_can_access`) do not.
  Not exploitable — the function returns FALSE for any caller without a
  session, and Realtime's own RLS policies are scoped `TO authenticated` — but
  it contradicted #5064's stated intent for this predicate family
  ("authenticated only, NOT anon"). Revoked to match; migration
  `20271190263880_revoke_anon_from_panood_rtc_can_access.sql`, applied live and
  verified via `pg_proc`/`aclexplode`. Removed the now-stale baseline line in
  `apps/web/tests/db/anon-rpc-surface.baseline.txt`.
- SPF worry checked and closed. The apex TXT (`v=spf1 include:icloud.com ~all`)
  does not cover Resend, but transactional mail sends from
  `noreply@setnayan.com` (`platform_settings.resend_from_address`, live-read)
  and the apex carries a `resend._domainkey.setnayan.com` DKIM record. DMARC
  (`p=quarantine; adkim=r; aspf=r`) uses relaxed alignment, so a passing,
  aligned DKIM signature is sufficient for DMARC to pass even though SPF
  alone would fail — mail is not heading for spam via DMARC rejection.
  Recommendation only, no DNS touched: adding Resend's SPF include
  (`send.setnayan.com` already carries `include:amazonses.com` for a
  subdomain that isn't the one actually sending) to the apex record would
  close the belt-and-suspenders gap, but nothing is currently broken.

SPEC IMPACT: None.
