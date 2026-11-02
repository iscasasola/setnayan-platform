## 2026-06-25 · feat(chat): report + block in chat threads (App Store Guideline 1.2)

Adds the in-app UGC-safety controls Apple Guideline 1.2 requires for user-to-user
messaging — **Report** and **Block** — reachable from a kebab menu in every
couple↔vendor chat thread, on both the `/dashboard` and `/vendor-dashboard`
surfaces.

- **Report** reuses the existing `user_reports` system (`target_type='user'`) →
  the `/admin/user-reports` queue. Reason picker mirrors the `user_reports`
  reason CHECK enum. Files a real user id (fails loud if the counterparty can't
  be resolved — no mis-typed fallback).
- **Block** writes a new, additive `public.blocked_users` table. A NEW
  **RESTRICTIVE** policy `chat_messages_block_guard` ANDs onto the existing
  permissive `chat_messages_member_insert` **without modifying it** — so with
  zero block rows (launch state) it is a *structural no-op* and existing chat is
  byte-identical. Validated against the live schema in a rolled-back transaction
  before applying; confirmed the guard resolves the thread counterparty and is a
  no-op at zero rows.
- The composer is hidden + a notice shown when a block exists in either
  direction. RLS is the authoritative send block; the app layer is the surface.

Migration applied to prod (additive, no-op now). `tsc --noEmit` 0 errors;
`next lint` clean. Deployed mid App-Review so the live app the reviewer's WebView
loads has report/block reachable.

SPEC IMPACT: satisfies Guideline 1.2 for the chat surface (Papic guest photos
already had report + moderation). Iteration 0019 (communications) + 0023 admin
user-reports queue. Block is account-to-account; distinct from
`event_blocked_users` (Papic guest-upload block).
