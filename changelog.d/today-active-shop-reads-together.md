## 2026-10-23 · fix(today): main is green again — the role read takes ownership from the active-shop resolver

`lib/the-supplier-today-reads-together.test.ts` (#6813) went red on main after #6802 (one active-shop resolver):
supplier Today measured **9** trips deep against its limit of **8**. Cause, from the harness's own steps:
`resolveVendorRole` now waits for `resolveActiveShop` (trip 2), then reads the shop's memberships (3), and for a
founding owner with no membership row — the common case — then asked `vendor_profiles … vendor_profile_id = X AND
user_id = <login>` (4): a second read of the very fact `resolveActiveShop` had just proven (`owned`, from its own
`vendor_profiles … user_id = <login>` read).

- `lib/vendor-role.ts`: `resolveVendorRole` hands `resolveVendorRoleForProfile` the resolver's `{ ownsIt: active.owned }`;
  with it, the founding-owner fallback answers from that proof instead of re-reading. Same answer, one read fewer.
  Callers that pass no proof (the per-action scoped checks) read exactly as before.
- Today: **9 → 8** deep (limit unchanged). `the-active-shop-is-resolved-once.test.ts` holds the hand-off (re-pointed,
  same property: the role is read for the resolver's shop, with the resolver's ownership).

SPEC IMPACT: None.
