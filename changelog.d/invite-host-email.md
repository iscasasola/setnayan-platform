## 2026-06-25 · feat(guests): host-initiated email invite (Invite/Join v2, PR3)

The couple can now email a guest a passwordless **sign-in link** straight from the
guest detail page — the second invite path alongside the shared QR/link. On click the
event is connected to the guest's Setnayan account (an `event_members` row), so it
appears in their picker and they can sign in from any device, no password.

- `app/dashboard/[eventId]/guests/[guestId]/actions.ts` — new `inviteGuestByEmailAction`:
  couple-authorized (explicit membership check — it uses the service-role client),
  reads the guest's saved email, and calls the existing `sendEventAccountMagicLink`.
  Redirects back with `?invite=sent|failed|no_email`.
- `app/dashboard/[eventId]/guests/[guestId]/page.tsx` — an "Invite by email" card below
  the edit form (kept outside the form — HTML forms can't nest — and reads the SAVED
  email), with a one-tap "Send sign-in link" button and a result flash.

Pure reuse of PR #2192's `event-account-link.ts` machinery (magic link via the admin
API + Resend, connect via `connectEventForUser`'s email-match). **No migration.**

SPEC IMPACT: Covered by `0000_ADDENDUM_invite_join_model_2026-06-25.md` §5 (email
linking → automatic account; "Host can pre-link to invite directly").
