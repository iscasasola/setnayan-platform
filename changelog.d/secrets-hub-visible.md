## 2026-07-25 · fix(admin): make Secrets & Rotation findable on the Money & Settings hub

Owner, twice: *"i cannot find the button for secrets"* → *"secret is still not showing."*

Root cause, and it is not a missing registration: the **2026-07-15 flatten** made the admin sidebar render exactly six hub rows, and child items deliberately **never render as sidebar links** — they feed active-state and badge rollup only. So registering `secrets` in `ADMIN_NAV_GROUPS` (PR #3668) was correct and still produced no clickable sidebar row, by design. The real doorway for any child is its group's **hub landing**, which enumerates the children as cards: for `settings-group` that is `/admin/money`.

On that hub the card existed but was easy to miss — the page was titled plainly **"Money"** (nobody scans a money page for an API key) and `secrets`/`integrations` were the only two settings-tail items with **no entry in `ADMIN_NAV_DESCRIPTIONS`**, so both rendered as bare labels with an empty description line, 15th and 16th of 16 cards.

Fixes, all copy-level:
- Hub retitled **"Money & Settings"** (matching the group label renamed in #3686) with a subtitle that names integrations and API keys explicitly; page `<title>` updated to match.
- Added descriptions for `secrets` and `integrations` so both cards read like every other card.

Not done deliberately: no seventh sidebar row. "Up to 6 menus only" is an owner lock (2026-07-09 respine); the fix belongs on the hub, not in the rail.

SPEC IMPACT: None — copy only; no routes, entitlements, structure, or data touched.
