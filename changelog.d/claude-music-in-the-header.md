## 2026-09-21 · fix(invitation): the music button moves to the top-right corner

Owner: "follow your proposed" (design canvas, "The music button — today and
proposed"). The button floated bottom-left, over whatever scrolled under it.
It now sits in the top-right corner: on a guest's page it joins the Account
control's cluster through a portal (one cluster, never two fixed elements
stacked); with no cluster it holds the corner alone. Before the first tap a
small "Tap for their song" bubble says there is music, since browsers never
autoplay it; after that tap it never shows again. While music plays, three
small bars move in place of the speaker; they hold still under reduced motion.
Guard: the music test in bottom-edge.test.ts.

SPEC IMPACT: None.
