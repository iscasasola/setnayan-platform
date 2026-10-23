## 2026-10-23 · feat(desktop): Home, Guests and Suppliers fill the body column

Owner: "shouldn't home, guests and suppliers maximize the width as well?" → yes; "bottom search bar is misaligned".
From 1024 px the three pages fill the body (viewport − rail − 2 × 32; 976 px at 1280, 1136 at 1440), superseding the
19 Oct 48 rem / 64 rem caps for these three. Home's top splits 1.1 : 1 (Next + What's next | numbers + money).
Suppliers' date line, Find · Build · Booked, list and thumb row share one left edge and width: the portaled rows read
the column's measured edges through the Guests dock's `followColumn` (now with a `target` option). The Guests dock's
controls sit on the column edges from 701. Phones (< 701) and tablets (< 1024) unchanged.

SPEC IMPACT: DECISION_LOG.md row "HOME, GUESTS AND SUPPLIERS FILL THE DESKTOP — ONE BODY COLUMN" (corpus 1c7d60cc).
