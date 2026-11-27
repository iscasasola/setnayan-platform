## 2026-11-27 · fix(sign-in): a supplier lands on Unihome, not the old Shop section

- `landingForAccount` sent a supplier account with no `next` to `/dashboard?seg=shop` (the full old Shop section). Since Unihome v5 (DECISION_LOG 2026-11-23, #8239) Home is one page for the whole account with Shop as a part, so a supplier who also hosts — the App Review account — never saw their events after sign-in.
- Every account type now lands on `/dashboard?hub=1`. Business doors (supplier./coordinator.setnayan.com) are unchanged.
- Tests updated: a-sign-in-starts-on-the-profile-page, a-signed-in-visit-to-the-root-opens-home, sign-in-landing, the-confirm-link-works-on-any-device.

SPEC IMPACT: sign-in landing follows Unihome v5 for suppliers.
