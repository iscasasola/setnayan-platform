## 2026-09-21 · fix(invitation): the "Tap for their song" hint stays at the top

Seen live: the hint is pinned with the music button, so as a guest scrolled it
rode down over the invitation's text. It now shows only while the page is at
the top (and, as before, only until the first tap). Guard: bottom-edge.test.ts.

SPEC IMPACT: None.
