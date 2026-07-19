## 2026-07-02 · feat(vendors): inline-editable My Shop Business Profile panel

The My Shop → Profile panel was a read-only checklist where every row deep-linked
to the full `/vendor-dashboard/profile` form. It's now a self-contained management
surface: each of the 8 profile-surface rows expands IN PLACE into a one-field
editor and saves without leaving the panel.

**Interaction** — one row open at a time (mirrors the ManageTiles one-open rule a
level down); the row grows into the same `Field` + control primitives the full
form uses (text / tel / email / number / `FileUpload` for the logo /
`ServicesPicker` for services); Save/Cancel + a success/error toast; Esc cancels;
focus moves into the editor on expand and back to the trigger on a self-initiated
collapse. The completeness bar + % sweeps forward as gaps close — the one animated
element on the surface. The 9th item (business documents) stays a deep-link — it's
a genuinely separate multi-file verification flow.

**New server action** `updateVendorProfileField(prevState, formData)` — a narrow
single-field patch (the full-form `saveVendorProfile` would null the other eight
columns). It writes ONLY the target column (+`updated_at`), never touches
`is_published`, is `.eq(user_id)`-scoped, and re-runs ONLY that field's
side-effects, matching `saveVendorProfile` exactly:
- `hq_address` → best-effort Nominatim geocode of `hq_latitude/longitude`
- `in_business_since_year` → clear DTI experience-verification when the year
  actually changed (flag-gated)
- `services` → writes `services[]` only; deliberately does NOT sync `event_types`
  (coverage-owned, owner-locked 2026-07-02)
- `logo` → no repost-hash (scope excludes logos)
It returns a value (never redirects) so the client toasts + collapses in place,
then `revalidatePath` refreshes the row check + completeness bar. `business_name`
rejects blank (never blanks a required field). `saveVendorProfile` is untouched.

**Refactor** — the ~75-line service-picker vocabulary block (admin-taxonomy labels
+ tradition/specialty leaves) moved from `profile/page.tsx` into a shared
`lib/vendor-service-vocab.ts` so the full form and the inline editor build the SAME
picker vocabulary from one place (no drift).

Reviewed with a 5-lens adversarial pass (data-loss/parity · React-RSC · security ·
a11y/mobile · extraction parity) + independent verify: one focus-management bug
found and fixed (opening an earlier row while a later one was open could steal
focus back to the collapsed row); data-loss/parity lens clean. Verified `tsc`,
`next lint`, and a production `next build`.

SPEC IMPACT: None — code-only UX rework of a shipped surface. No schema, no
migration, no pricing/SKU change; all nine items still map to the same columns /
verification flow. `saveVendorProfile` + the full `/profile` form are unchanged.
