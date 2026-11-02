### Account hub finalization (was "Library")

Completes the account-hub chrome per owner direction (the user-icon → "your account area"):

- **Renamed Library → "Account"** (sidebar nav label + registry slot + switcher row + page H1 + metadata). Route/slot-key kept as internal ids (`/dashboard/library`, `customer.account.library`) so the live surface doesn't move.
- **User-icon** — the nav entry + switcher row icon are now `CircleUser` (was Sparkles), matching the "your stuff" mental model.
- **Profile & Settings moved into the hub** — the Account page header carries Profile + Settings pills (→ `/dashboard/profile` + `#settings`).
- **Switcher footer → Sign out only** — Profile/Settings removed from both switcher panels' footers (they live in the hub now); Sign out + the conditional Hosts link stay. Dropped the now-unused `Sparkles`/`UserCircle`/`Settings` imports.

The desktop sidebar keeps its direct "Profile & Settings" item (the owner's ask was to declutter the switcher, not remove desktop settings access).

SPEC IMPACT: None (account-area chrome; iteration 0021/0025 — to be documented in the North-Star follow-up).
