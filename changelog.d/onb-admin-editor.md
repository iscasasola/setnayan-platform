## 2026-06-28 · feat(admin): onboarding content editor for each event type

Step 2 — the admin surface to modify each non-wedding type's onboarding (owner
directive 2026-06-28). Builds on the `event_type_onboarding` spine.

- **New route `/admin/event-types/[type]/onboarding`** (Setnayan HQ) — a structured
  editor for a type's onboarding content:
  - **Welcome** intro copy (eyebrow / headline / subcopy; all-or-nothing override).
  - **Signature questions** — add / remove / reorder; per question eyebrow + text +
    ID; per option title / desc / key + a chip multi-select of the **categories that
    answer adds to the starter plan** (sourced from the type's applicable taxonomy
    tiles, so only valid categories can be attached).
  - **Starter plan** — essentials + per-persona extra categories + per-persona
    in-app services (chip multi-selects).
  - **Reveal copy** — per-persona title + tagline.
  - **Preview flow ↗** link, and **Reset to default** (deletes the override row →
    falls back to the code defaults).
- **Server actions** `upsertOnboardingSpec` / `resetOnboardingSpec` in
  `app/admin/event-types/actions.ts` — `requireAdmin` defense-in-depth (table RLS
  also gates `is_admin()`), normalizers that clamp + sanitize the submitted JSON
  (and double as validation), `admin_audit_log` rows (`event_types.onboarding_upsert`
  / `.onboarding_reset`), and revalidation of the roster + `/onboarding/[type]`.
  The upsert OMITS `axis_overrides` so an existing one is preserved.
- **Roster link** — each non-wedding row gains an "Onboarding content →" link next
  to "Onboarding profile →". Wedding shows a note (its bespoke wizard isn't edited
  here) and is excluded from the editor.

Edits take effect on the live `/onboarding/[type]` flow with no redeploy. typecheck
+ lint clean; 639/639 lib tests green.

SPEC IMPACT: None — admin tooling over the existing engine; no schema/SKU/pricing change.
