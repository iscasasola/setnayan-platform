## 2026-08-26 · fix(admin): the price catalog stops erasing your notes, and gets a real manager

`/admin/pricing`'s single "Save all changes" bulk form has been replaced with a per-row
sell-sheet/back-room browser. Two things shipped:

- **Fixed a live data-loss bug.** The old bulk save blanked a row's description whenever its
  ⓘ disclosure panel was closed at save time (measured in prod: 32 of the last 34 bulk-edited
  rows lost their note; 0 preserved one). The new per-row card renders every field it owns
  unconditionally, so a save can no longer submit a field as blank that it never showed. Pinned
  by `lib/admin/pricing-row-diff.test.ts` (parsing/diff logic) and
  `app/admin/pricing/_components/description-field-is-never-hidden.test.ts` (the structural half
  — no per-field disclosure gate can come back).
- **Rebuilt the screen** per `WHATS_NEXT_Managing_Prices_2026-08-26.md` § 6: per-row save/retire/
  reactivate, three states (on sale / draft / retired) with a stamped reason + optional
  "replaced by" instead of typing "(superseded)" into a title, a measured "safe to remove" for
  retired customer SKUs (never sold + not in an active bundle + no live activation + not on a
  small known-code-literal-dependency list), the seven previously code-only price fields now
  editable (sign-up price, billing period, per-head pricing), drawn price history from the
  existing `admin_audit_log` (no new table), and the legacy 43-row v1 catalogue made readable
  (deliberately read-only). Deleted the "Avg margin" / "Max price" / "Min price" stat tiles.

New migration `20271171390705_pricing_manager_retirement_metadata.sql` adds nullable
retirement-metadata columns (`retired_at`, `retired_by_admin_id`, `retirement_reason`,
`replaced_by_*`) to all three catalog tables. Additive only — no existing behavior changes until
the admin actually retires something through the new screen.

SPEC IMPACT: None — this is an admin tooling change; no customer-facing prices moved.
