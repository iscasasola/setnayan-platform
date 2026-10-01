## 2026-09-30 · fix(vendor): supplier upgrade prompts obey the paywall switch

`VENDOR_TIER_FEATURE_GATE` is the owner's one switch for supplier paywalls, and it
is OFF in production — but eight supplier surfaces checked the plan directly, so
they showed a paywall no switch could turn off. They now all ask ONE helper,
`vendorPaywallApplies(hasIt)` (plus `vendorAllowance()` for counted features), in
`lib/vendor-feature-gate.ts`.

- **Switch off (production today):** no "Upgrade", no ◆ mark, and the save goes
  through — page Personalize + Page extras (editor, save action AND the public
  page render, so a save is never silently ignored), team seats (tile, Team page,
  invite action), branches (manager + create action), the availability waitlist
  (surface + settings action), payment links (form, save action, couple-facing
  display), Deep Search (runner + run action).
- **Switch on:** TRY-FIRST. Every control renders; a ◆ note (never a padlock)
  says which plan; the final action (Save / Add / Run) is where the plan is asked.
  No ◆ hint in the App Store / Play Store shell.
- **Reach:** "Your shop isn't shown in couples' searches yet" now shows only when
  `VENDOR_TIER_SEARCH_GATE` is on — while it is off, a Free shop IS findable at
  any distance, and the sentence was false.
- **Creators:** no longer a full-page paywall; every shop can browse and draft.
  ⚠ Sending still needs Pro because the DATABASE enforces it
  (`offer_creator_reach_hold` raises `TIER_BELOW_PRO_NO_REACH`, owner decision #4,
  2026-07-16) — the switch cannot lift that; a ◆ note says so at Send.
- **`LockedState` retired.** Its only mount was the payment-links padlock frame,
  replaced by the try-first ◆ note (owner: ◆ marks paid, never a padlock). The
  component and its mount test are deleted rather than left orphaned.
- **Developer text removed** from supplier screens: the attributes footer's
  schema/iteration line, "Email delivery ships once Resend SMTP is wired", "In
  production each host's palette renders here", "V1 invites existing Setnayan
  accounts only", and the retired token wording on auto-accept.
- **Guard:** `apps/web/app/vendor-dashboard/upsells-obey-the-switch.test.ts` sweeps
  every vendor-dashboard file; paywall copy must ask the switch (client components
  via their importers), `<VendorTierGate>` mounts must ask it, the reasoned
  `NOT_THE_SWITCH` list is probed for stale entries, and the helper is pinned
  with the switch off and on. Sabotage-checked four ways.

SPEC IMPACT: None in the corpus. ⚠ Owner sign-off flagged: while the switch is off,
branches (owner-locked Enterprise-only 2026-06-05) and payment links (Pro) are open
to every plan — each branch is still paid for at its own checkout.
