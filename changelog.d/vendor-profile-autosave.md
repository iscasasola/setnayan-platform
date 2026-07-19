## 2026-07-02 · feat(vendors): auto-save + logo thumbnail on the My Shop profile editor

Owner-directed follow-up to the inline Business-Profile editor (#2617).

**Auto-save on collapse (no more Save button).** Each of the 8 profile-field rows
now saves itself whenever the row collapses — you click Close, open a different
row, or press Enter. Each row's `<form action={updateVendorProfileField}>` stays
mounted inside the Collapsible; dirty is tracked (form `onInput` for text +
`FileUpload.onChange` for the logo + a new `ServicesPicker.onChange`), and on
collapse a `requestSubmit()` fires when dirty. **Cancel** reverts the edit
(remounts the control to its saved value via a `revertNonce` key) and closes
without saving. A required field the server rejects (blank Shop name, bad year)
**re-opens the row** with an error toast, so an invalid value is never silently
dropped. A "Saving…" indicator replaces the button; a hint tells the vendor
edits save automatically.

**Logo thumbnail + readable rows.** The logo row shows a real image thumbnail on
the collapsed row (the presigned-R2 `<img>` pattern `FileUpload` already uses),
falling back to "Uploaded"/initials when the presign is unavailable. Every other
row already echoes its saved value, so the whole panel is readable at a glance.

**`ServicesPicker` gains an optional `onChange`** (fired via a mount-skipped
effect on the selection) so the auto-save editor can detect selection changes.
Backward-compatible — the hidden input stays the source of truth, so every prior
caller is byte-identical.

**Doc slot relabel:** verification slot 1 "DTI Business Name Certificate" →
**"DTI or SEC Registration"** (sole-prop DTI *or* corp/partnership SEC), with a
matching hint. Propagates to `/verify` + the admin console (one `DOC_SLOTS`
source).

Reviewed with a 3-lens adversarial pass (state-machine · React · a11y/degrade)
+ independent verify, which caught and fixed four real issues: (1) the form now
sets `noValidate` so the on-collapse `requestSubmit()` always reaches the server
instead of being silently aborted by native constraint validation on a blank/
malformed field; (2) a rejected async save re-opens its row ONLY if the user
hasn't opened a different row meanwhile (never steals the open slot); (3) dirty-
tracking is scoped to the real field inputs so typing in the services custom-
draft box no longer triggers a spurious no-op save; (4) `updateVendorProfileField`
now validates email format server-side (compensating for the dropped browser
check under `noValidate`). Verified `tsc`, `next lint`, production `next build`.

SPEC IMPACT: DOC_SLOTS[0] relabel is a customer/vendor-facing copy change on the
0006 verification checklist (DTI→DTI/SEC) — logged in DECISION_LOG. Everything
else is a code-only UX rework of a shipped surface; no schema/migration/pricing
change. (Follow-up: the "Documents" row → full 12-doc inline is a separate PR.)
