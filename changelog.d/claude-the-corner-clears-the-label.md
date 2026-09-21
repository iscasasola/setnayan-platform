## 2026-09-21 · fix(invitation): the top bar's label gives way to the corner controls

Seen live after the music button moved to the top-right corner: pinned to the
viewport corner, it covered the invitation bar's "INVITATION" label at the top
of the page on a phone (a guest's Account control does the same). The label is
decoration, so on phones it now hides while such a control is on the page,
via a `data-top-corner` marker and one CSS rule. Guard: bottom-edge.test.ts.

SPEC IMPACT: None.
