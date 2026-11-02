## 2026-07-03 · feat(vendor-profile): verified-lock enforcement + request-a-correction

Backend substrate (Lane B, PR B2 — stacks on the VALIDATE contact-confirmation
PR) for the redesigned My Shop verification: once a shop is VERIFIED, its 8
identity fields lock server-side and changes flow through an admin-reviewed
correction queue.

- Migration `20270503892144_vendor_correction_requests.sql`: new
  `vendor_correction_requests` table (bigserial PK + `public_id` type letter
  **'Z'** — the only free letter, A–Y all taken; documented in the migration).
  Columns: vendor_profile_id → vendor_profiles, field_key (CHECK: the 8
  identity keys), current_value, requested_value, note, status
  open/applied/declined, created_at, resolved_at, resolved_by. RLS at CREATE
  time: vendor SELECT/INSERT own (via `vendor_profiles.user_id = auth.uid()`,
  same scope as `vendor_verification_applications`), admin read/update/delete.
- New `lib/vendor-corrections.ts`: the 8 `LOCKED_IDENTITY_FIELD_KEYS` + labels,
  the canonical `VERIFIED_LOCK_ERROR` copy, defensive
  `fetchCorrectionRequests` (empty on pre-migration DB) +
  `fetchVerifiedLock` (any probe error = not locked, never bricks a save).
- Server enforcement in `app/vendor-dashboard/actions.ts`:
  - `updateVendorProfileField` returns `{ ok:false, error: 'Your shop is
    verified, so these details are locked. Request a correction instead.' }`
    when `public_visibility === 'verified'` (all 8 inline fields ARE identity
    fields).
  - `saveVendorProfile` strips the 8 locked keys from the write when verified
    (current values preserved) and proceeds — is_published, tagline,
    portfolio, opt-outs, compatibility arrays keep working — then redirects
    with an `identity_locked=1` notice. Publish gate evaluates against the
    CURRENT DB identity values; the form's hq_address no longer drives geocode
    when locked; a locked year mismatch no longer clears DTI experience
    verification.
  - New `requestProfileCorrection(prevState, formData)` action (useActionState
    shape) validating field_key against the 8 keys and inserting a request row
    with a current-value snapshot.
- New `/admin/corrections` queue (registered in the admin sidebar Work group,
  nav-icon-source lint passing): vendor · field · current → requested · note ·
  age, with Apply (typed per-field parse → writes vendor_profiles via the
  admin client + best-effort re-geocode for addresses + stamps applied) and
  Decline. Idempotent — an already-resolved request no-ops.

SPEC IMPACT: None yet — vendor-facing correction UI + the full verification
redesign spec update land with the remaining lanes; decision already logged
corpus-side.
