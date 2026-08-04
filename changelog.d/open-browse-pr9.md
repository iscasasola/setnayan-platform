# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-24 · feat(website): open-browse PR9 — couple section-mode control (setSectionMode)

Add the couple's open-browse three-state section control (Auto / Shown / Hidden)
to the existing invitation-widgets editor. Additive only — the legacy `is_visible`
toggle and Up/Down reorder are untouched, and `mode` coexists with `is_visible`
(PR7's reader treats `is_visible=false` OR `mode='hidden'` as hidden).

- New server action `setSectionMode(formData)` in
  `apps/web/app/dashboard/[eventId]/website/widgets/actions.ts`: host-gated via
  `requireHostMembershipOrThrow`, validates `next_mode ∈ {auto,shown,hidden}`,
  re-reads the row (silent no-op on always-on rows — never holdable, council §1.4),
  and writes `invitation_widgets.mode`.
- "Shown disabled while empty" rule: force-on is refused (redirect
  `?error=empty_source`) when the widget's source has no content, computed
  server-side from the same signals the guest site reads.
- New shared helper `apps/web/lib/website-section-content.ts`
  (`computeSectionContentMap`) mirrors site-body's `openBrowseContent` map so the
  editor and guest site never drift on what "has content" means. Types with no
  clear signal fail OPEN (treated as having content).
- Widgets editor UI (`.../widgets/page.tsx`): SELECT now loads `mode` + `audience`;
  each hideable row gets a form-only (no-JS) three-state control with the current
  mode highlighted and the Shown button disabled while empty; auto-populate hint
  lines added under widgets that fill from other planning work (Schedule, Our
  Photos, venue, date, love story).

No production flag flipped; the control writes a column that is only consulted on
the dormant open-browse path (`events.website_open_browse` DEFAULT FALSE).

SPEC IMPACT: None — implements council build-plan row 9; no schema (mode column already exists).
