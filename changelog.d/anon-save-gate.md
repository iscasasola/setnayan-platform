## 2026-06-28 · feat(anon-draft): pre-emptive "save your plan" prompt at gated actions

Made the anon-draft account wall **visible before the click** instead of a
redirect-after-click. Previously an anonymous (anon-draft) user tapped a gated
action — unlock a category, checkout, message a vendor — the server action
returned `not_secured`/`needsAccount`, and the client hard-redirected to
`/signup`. Now they get a calm, point-of-action prompt up front that offers BOTH
paths (the older flow only ever sent them to signup):

- **New `app/_components/anon-gate/anon-gate-context.tsx`** — `AnonGateProvider` +
  `useAnonGate()`. Seeded once in `dashboard/layout.tsx` from `user.is_anonymous`
  so deep gated buttons read anon-state without re-fetching the user. Defaults
  `false` (used outside a provider → never gates).
- **New `app/_components/anon-gate/save-to-continue.tsx`** — `SaveToContinue`
  modal (bottom-sheet mobile / centered dialog sm+, mirrors `RequirementsModal`
  + `useModalA11y`) with two CTAs: **Create a free account** → `/signup?next=` and
  **I already have an account** → `/login?next=`. Plus `SaveGateHint`, the
  reassurance-first inline note (ShieldCheck, never a lock/paywall glyph — planning
  is free). Contextual copy per action (message / order / unlock).
- **Wired 3 gated sites:** vendor category unlock (`unlock-categories-list.tsx`,
  pre-empts the round-trip + a top hint), checkout (`inline-checkout-drawer.tsx`,
  gated at the TRIGGER so an anon buyer is asked to secure BEFORE filling payment
  details, not after), and the public vendor-page inquiry composer
  (`inquiry-composer.tsx` + `v/[slug]/page.tsx`, via a new `viewerIsAnonymous`
  prop since it lives outside the dashboard provider — preserves the existing
  `not_secured`→signup vs `not_signed_in`→login split for signed-out visitors).

Purely additive UI; the server guards stay as the real enforcement (defense in
depth). Fully **inert until the anon flag is live** — `is_anonymous` is only ever
true once `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED` + Supabase anonymous sign-ins are
on, so every secured user in prod today renders exactly as before.

SPEC IMPACT: None (UX refinement on the already-specced anon-draft model; logged
at the bottom of the corpus DECISION_LOG.md per the relaxed sync mandate).

## 2026-06-28 · fix(anon-draft): pre-launch completeness pass — close gaps before flag-on

Audited the whole anon-draft surface (12-point sweep) ahead of enabling the
feature live. Closed the gaps so it complements every surface:

- **Vendor-contact guard gap** — `connectExistingVendorProfile`
  (`lib/vendor-invite-actions.ts`) only checked `!user`, so an anon couple could
  link a marketplace vendor (follow + chat unlock) without securing. Added the
  `is_anonymous → NOT_SECURED` guard mirroring `sendVendorInvite`. The
  `invite-modal.tsx` now routes `NOT_SECURED`/`NOT_AUTHENTICATED` from both the
  invite and connect paths to `/signup?next=` instead of a dead-end error.
- **Placeholder-email leaks** — the guest join surfaces rendered raw `user.email`
  (would show `anon+…@anon.setnayan.local`). Guarded with `isPlaceholderEmail` in
  `join/[eventId]/set-password/page.tsx` and `join/[eventId]/_components/join-flow.tsx`.
- **Anon-inappropriate controls hidden** — the profile page
  (`dashboard/(account)/profile/page.tsx`) now hides the Change-password +
  Sessions (sign-out-other-devices) sections for an anon account (no password /
  no meaningful sessions; the "Not secured yet" banner already nudges them).
- **Sign-out → secure swap** — the account switcher (`get-switcher-data.ts` +
  `account-switcher.tsx`, both footer variants) replaces "Sign out" — which would
  destroy an anon user's only key to their plan — with a "Secure your plan" →
  `/signup` CTA. New `isAnonymous` field on `SwitcherData`; the 4 layout fallback
  literals (admin / account / event / vendor) set it from `user.is_anonymous`.

DB go-live step is already done: migration `20270205204166` (null-email-tolerant
`handle_new_auth_user`) is applied on prod and verified. Remaining to flip live:
enable anonymous sign-ins in Supabase Auth (owner dashboard) + set
`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED=true` (Vercel). tsc + lint green.

SPEC IMPACT: None.
