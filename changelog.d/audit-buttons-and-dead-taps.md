## 2026-11-27 · docs(audit): buttons + dead taps

- `docs/audits/2026-11-27/buttons.md`: a read-only code inventory of every tappable control in `apps/web/app/**` and
  `apps/web/components/**` at 068460f (6,219 controls), with findings sorted blocker / bug / polish, counts per area,
  per problem and per route, and a "Not covered" list. No blocker held up on a hand read; 34 bugs (clicks on non-buttons,
  server-action results dropped, role=button with no keyboard path, an unnamed icon button, a ▾ on a link) and
  183 polish rows (under 44 px, ▾ with no list, more than one main).
- `docs/audits/2026-11-27/buttons-inventory.tsv`: one row per control (file · line · route · element · label · handler / destination).
- No app code changed.

SPEC IMPACT: None. An audit; it feeds fix lists to builders.
