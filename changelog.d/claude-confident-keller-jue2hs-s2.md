## 2026-11-28 · fix(seat-plan): S review — Fix all books each chair once; Undo after the save; the pulse runs whole

Controller post-merge review of #8496:
- **"Fix all"** works out every placement against one pool of free chairs before writing, then writes once per table.
  Two fixes can no longer take the same chair.
- **The Undo line** is said only once every write has landed.
- **Taking a suggestion, or a Fix,** moves each guest with their +1s, using the drag's own rule.
- **A just-taken guest** leaves every strip at once.
- **The dry run** is asked once the plan settles, not on every change.
- **The Find pulse** is no longer cut short by a re-render.
- **The lab's sample dry run** is built on the client, so no server action is spent on it.
- **"Suggest seats on the cards"** stays on this device until L11's settings column lands.

SPEC IMPACT: None.
