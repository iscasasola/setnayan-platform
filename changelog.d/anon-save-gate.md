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
