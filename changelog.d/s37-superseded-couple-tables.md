## 2026-09-18 · chore(db): drop two superseded couple-planning tables — the build-grid state and delegates (S37)

**SPEC IMPACT:** None — both features were already replaced (the build grid on 2026-07-29, delegation
by `event_moderators`); no screen changes.

S26's both-ends guard (#5625) ranked both `table-no-writer`. Re-measured against `origin/main` and
production; **(b) delete** — `20271234098872_drop_superseded_couple_planning_tables.sql`.

- **`event_category_build_state`** — the Lock/Auto/Hidden grid's state. Grid and writers deleted
  2026-07-29. Production held 4 rows, all `'auto'` on one internal event — identical to an absent row;
  only `'excluded'` ever changed a screen, and prod had none. Removed `getCategoryBuildStates()`, its
  read on the vendors page, and the state read in `proposeBuildFromQuotes()`; "Not needed" /
  "✓ Covered" (`event_category_decisions`) is the one way to take a category out.
- **`event_delegates`** — delegation whose auto-grant writer never shipped; the live mechanism is
  `event_moderators` (`autoInviteCoordinator`, "Promote your coordinator", access requests). 0 rows.
  Its insert policy never checked `member_type`, and anon held SIUD grants. The
  `event_action_log_event_members_read` policy's delegate branch (a table with no rows admitted nobody)
  is removed; the member branch is recreated unchanged.

**Guards — none weakened:** the three `event_delegates` purge rules leave `coverage.ts` and the table
is listed DROPPED in both guardrails; the erasure "over-deletion" fixture (2q) and the FK-surface
fixtures went with the table — `concierge_abuse_flags` still carries both verdicts (actor SET NULL,
subject CASCADE) in the same test; `event_category_build_state` moves to `DROPPED_AFTER_CLOSING`; FK map
and exposure baseline regenerated (37 lines removed; the one added line is the narrowed policy).
Local: 85/85 across eight db suites.

⚖ **Held for the owner, not dropped:** `event_feature_policy_override` — read on every add-on check,
written "via direct DB" by design (its migration says so). A DB-only escape hatch or dead? Owner call.
