## 2026-10-08 · feat(db): events.site_roles — a role's own font and colour (restudy 3/9 · the column)

Owner, verbatim (2026-10-08): *"colors here is not color of the background but
the colors of the different fonts, and buttons and highlights"* · *"fonts will be
multiple fonts like, details, button font, header font, etc."* → *"restudy is
good"* (DECISION_LOG "APPROVED — THE LOOK RESTUDY"; contract
`BACKGROUND_RESTUDY_2026-10-08_fable.md` § 3.5 and § 6 row 3, which names this
column as NEW data).

**The migration alone** — `supabase/migrations/20271266068325_events_site_roles.sql`
— so it can be read, merged and deployed on its own before the code that reads
it (`rd/elements-roles`). No application code in this PR.

- `ALTER TABLE public.events ADD COLUMN IF NOT EXISTS site_roles JSONB` — nullable,
  no default, no backfill: NULL = nothing overridden, so every live page keeps
  exactly what it wears. A CHECK holds it to an object or NULL.
- `GRANT SELECT, UPDATE (site_roles) … TO authenticated` (the Maker reads it and
  Apply writes it on the host's own session); nothing to `anon` (the guest page
  reads events through the service role).
- `events_host` rebuilt over it — the block lifted verbatim from the latest
  carrier (`20271265788160`).
- Post-conditions refuse to apply a half-grant, a lost private column or a default.
- `supabase/security/exposure-surface.baseline.txt` regenerated: +1 line,
  `col public.events.site_roles anon=- authenticated=SU`.

**Rule 0 — why a column, and what it does NOT hold.** The Mood Board's five
(Dominant · Supporting · Accent · Neutral · Accent 2) are
`events.role_palette.reception`, by position, drafted as `main_colours`: they
are the PALETTE every role's default is derived from, not a role's own pick —
and they hold no font at all. Three role facts already have a column and are
not repeated: the Headings font is `site_font_key`, the Buttons fill is
`site_button_color`, their shape is `site_button_style`. So the column holds
only what had no home: `{heading:{color}, body:{font,color}, button:{font},
highlight:{font,color}}`. ⚠ That is narrower than the contract's sketch (which
listed `heading.font` and `button.fill` too) — repeating them would make two
sources of truth for one fact.

Checks: `lint-events-column-grants` ✓ · migration timestamp guard ✓ · PGlite
replay applies it (the exposure baseline is generated from that replay) ·
`ugat-schema-claims` 3/3 · `ugat-concept-coverage` 3/3 (no new subsystem) ·
`events-column-privileges` 7/7 · `exposure-freeze` 6/6 · `ugat-both-ends` 4/4.

NOT applied anywhere by this session. It reaches production only through the
pipeline (`supabase db push --include-all`) when this PR merges.

SPEC IMPACT: None beyond the approved contract — the narrower shape is recorded
in the corpus at `LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md`.
