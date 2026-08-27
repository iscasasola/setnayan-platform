/**
 * The night-before supplier email — feature flag (S5, ships OFF).
 *
 * 🔴 OWNER GATE, still open: may we email a supplier automatically at an
 * address they never gave us? Today a person pressing Send is what makes an
 * email to a supplier allowed — this job would send with nobody pressing
 * anything, to whichever address a REGISTERED vendor account signed up with
 * (never `event_vendors.contact_email`, which 44 of 45 prod supplier rows
 * hold as a name the COUPLE typed with no account behind it at all).
 *
 * Server-only, not `NEXT_PUBLIC_*` — this job never runs in the browser, so
 * it takes the `PAPIC_FULLRES_DROP_ENABLED` / `CSAM_HASH_MATCH_ENABLED` shape
 * (WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md § S5), not the client
 * flag shape. Opt-in (`=== 'true'`, default OFF) because this is unproven and
 * sensitive, the same posture as the CSAM hash-match flag — never the
 * `!== 'false'` shape used for safe, already-proven cleanup jobs.
 */
export function isSupplierNightBeforeEmailEnabled(): boolean {
  return process.env.SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED === 'true';
}
