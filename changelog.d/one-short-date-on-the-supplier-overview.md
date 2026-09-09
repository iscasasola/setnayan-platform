## 2026-09-09 · fix(vendor): the supplier's overview dates stop depending on the machine

Replaces the page's local `shortDate` (`toLocaleDateString('en-PH', …)`) with the
shared `monthDay`, pins the page's three other date formats to a stable locale,
and stamps the lapsed-lock date in Asia/Manila instead of the server's zone.

SPEC IMPACT: None — no product rule changes. Five of the six rendered strings are
byte-identical; the sixth was a whole day wrong for evening timestamps and is now
right.
