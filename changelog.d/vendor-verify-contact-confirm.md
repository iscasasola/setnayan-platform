## 2026-07-03 · feat(vendor-verification): contact-confirmation stamps + admin-managed VALIDATE contacts

Backend substrate (Lane B, PR B1) for the redesigned My Shop verification flow
(owner-approved 2026-07-02): alongside the required docs, the vendor sends a
literal `VALIDATE <shop name>` email AND text to Setnayan-owned contacts, and
an admin marks each one as received.

- Migration `20270503417266_vendor_contact_confirmation_validate.sql`:
  - `vendor_verification_applications` gains four nullable stamp columns —
    `contact_email_confirmed_at/_by` + `contact_phone_confirmed_at/_by`.
  - `platform_settings` gains two admin-managed VALIDATE destinations —
    `vendor_validate_email` (default `verify@setnayan.com`) +
    `vendor_validate_phone` (NULL = "number coming soon"), same pattern as
    `repost_watch_hamming_threshold`.
  - New admin-only SECURITY DEFINER RPC
    `mark_vendor_contact_confirmed(p_application_id, p_channel)` — guarded by
    `is_admin()`, idempotent (first stamp wins), rejects unknown channels;
    EXECUTE granted to `authenticated` only.
- `lib/vendor-verification.ts`: `VendorVerificationApplicationRow` extended
  with the four columns; `fetchLatestApplication` merges them via a soft probe
  (`fetchContactConfirmations`) so a pre-migration database degrades to null
  instead of crashing. New `expectedValidateToken()` helper.
- `lib/platform-settings.ts`: `fetchVendorValidateContacts()` soft probe kept
  OUT of the main `PlatformSettingsRow` select so pre-migration envs don't
  degrade receipts/brand/payment reads.
- `/admin/verify` (applications surface): each application card gains a
  "Contact confirmation" block showing the exact expected token
  `VALIDATE <business_name>` + where the vendor sends it, with "Mark email
  received" / "Mark text received" buttons (server action → RPC) that flip to
  stamped timestamps once confirmed.
- `/admin/settings`: two new business-identity fields so the owner can edit the
  VALIDATE email/number without code; saved in a separate update so a
  pre-migration database fails only that pair with a specific message.

SPEC IMPACT: None yet — the vendor-side verification redesign (docs + VALIDATE
send + 15-min Google Meet + verified profile lock) lands in follow-up PRs; the
decision is already logged corpus-side.
