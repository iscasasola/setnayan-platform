## 2026-06-24 · fix(ux): in-flight pending state on action buttons that lacked it

Follow-up to the guest-list bulk-delete fix (#2121). Audited the whole app for
the same gap — a raw `<button type="submit">` inside a server-action form with
no in-flight feedback, so it looks idle from click until the redirect lands.
`SubmitButton` (the shared `useFormStatus` button: disables + spinner +
`pendingLabel`) is already used in ~140 files; this sweep closes the remaining
real gaps. 27 buttons across 11 files, all swapped raw→`SubmitButton` (className,
`aria-label`, and children preserved verbatim; only `type="submit"` dropped):

- **Admin → Integrations** (`integrations/page.tsx`, `maya-card`, `oauth-card`,
  `secret-card`) — Save / Clear on Resend, Maya (payments), OAuth, and API-secret
  forms (9 buttons). Highest value: credential/money config where a silent Save
  or an accidental double-submit is riskiest.
- **Proposals** (`proposals/[publicId]/page.tsx`, vendor `proposals/page.tsx`) —
  Accept / Decline / Send / Delete / Save-template / Generate-draft (7).
- **Hosts** (`hosts/page.tsx`) — Invite / Revoke / Remove / budget-visibility (5).
- **Guest groups** (`groups-sidebar.tsx`) — Delete (inside `ConfirmForm`) / Create
  / Save (3).
- **Studio** (`studio/page.tsx`) — Recommend / Dismiss (2).
- **Onboarding** (`onboarding-shell.tsx`) — "Continue with Google" (→ "Redirecting…")
  + "Create account" (→ "Creating account…") (2). ⚠ Touches the protected
  onboarding port — placement/interaction unchanged, only pending feedback added.

Deliberately NOT changed: instant-toggle buttons (checklist items, planning-mode
switch, date "not ready") where the icon swap already IS the feedback; buttons
already covered by `useFormStatus`/`useActionState`/`useTransition` (budget-setter,
palette-editor, monogram studio/draft-restore, event-type-notify, site-editor);
and the photo-delivery sync-mode radio card, whose children are the entire card
(swapping them for a spinner would collapse the layout — its feedback is the
selected-state styling, not a content swap).

SPEC IMPACT: None (UX feedback consistency; no behavior/schema/pricing change).
