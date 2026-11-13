## 2026-11-13 · fix(suppliers): Booked's opened row no longer cuts its buttons; a "Nobody yet" line's door sits under its words

- Booked: the opened row's fold is one `minmax(0,1fr)` column, so the chapter pickers, Share and the tiles stop
  running 6 px past the gutter where `overflow:clip` cut them (measured live at 390; pre-existing).
- Build: inside "Nobody yet · N", each line's "Find in X" door is on its own row under the words (the approved
  prototype's drawing), so a long category name is not squeezed beside a wide button.
- `build-sessions/shots-build-booked/`: the prototype's 390-px Proposed shots for Build and Booked, and the
  safe-navigation check the owner asked for.

SPEC IMPACT: None
