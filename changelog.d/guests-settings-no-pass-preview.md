## 2026-10-28 · fix(guests): Guests ⚙ › Invitations drops the Event Pass preview

Owner, 27 Oct: *"Why is the invitation here? Shouldn't that be on prints?"* — 28 Oct: *"yes"*. Invitations is now the
count · Send to N · Pick who, nothing more; the Event Pass stays in Prints (`PRINT_PIECES.pass`) and each guest's ticket
on their card. Removed the `passSrc` prop end to end (Setup view, lab, render harness) and the lab's stand-in picture.
Re-aimed `setup-follows-the-pop-up-rule-and-speaks-plainly` (4) and `one-link-row-only-for-open` to "no pass picture";
dropped the guests-lab line from `every-logo-plays`' still-list (it now draws none).

SPEC IMPACT: DECISION_LOG 2026-10-28 "CHAT — EIGHT OWNER ANSWERS" (8) records it.
