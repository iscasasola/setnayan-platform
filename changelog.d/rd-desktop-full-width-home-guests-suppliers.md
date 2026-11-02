## 2026-10-23 · feat(desktop): Home, Guests and Suppliers fill the body column

Owner: "shouldn't home, guests and suppliers maximize the width as well?" → yes; "bottom search bar is misaligned".
From 1024 px the three pages fill the body (viewport − rail − 2 × 32; 976 px at 1280, 1136 at 1440), superseding the
19 Oct 48 rem / 64 rem caps for these three. Home's top splits 1.1 : 1 (Next + What's next | numbers + money).
Suppliers' date line, Find · Build · Booked, list and thumb row share one left edge and width: the portaled rows read
the column's measured edges through the Guests dock's `followColumn` (now with `target` and `width` options), written
from 1024 only. From 1024 the Guests dock's controls sit on the column edges (the side safe area still clears).
Review fixes: the uncap is scoped to the event Guests screen, so People keeps its 48 rem column, and Home's grid places
every top piece explicitly, so it is read column by column in the page's own order. Phones (< 701), tablets (< 1024) and
People are unchanged (pixel-identical at 820 and 375 for Suppliers and People; 820 for Home).

SPEC IMPACT: DECISION_LOG.md row "HOME, GUESTS AND SUPPLIERS FILL THE DESKTOP — ONE BODY COLUMN" (corpus 1c7d60cc).
