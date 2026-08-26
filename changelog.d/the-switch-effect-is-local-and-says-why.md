## 2026-08-26 · fix(papic): the uploads switch answers the question `handles-have-gates` asks

CI caught what review did not: `handles-have-gates.db.test.ts` flags any switch **written by one surface and read by nothing outside it**, and asks the one question a scanner cannot — *does the copy beside this control promise something it does not do?*

That guard exists because `users.planner_mode` shipped promising the Overview tab would change while the Overview never read the value.

**For this switch the answer is NO — today.** The couple's own picker is the only manual-upload path in the product and it sits on the same screen as the switch, so its effect really is local. Reasoned line added to `tests/db/handles-have-gates.baseline.txt` rather than a suppression.

## 🔒 But a baseline line that stops being true is worse than no line

It reads as *"somebody checked"*. The OFF copy says **"Nothing can be added from a phone or laptop"** — a claim about the whole gallery, true only while nothing else can upload.

So rule 8 of `the-uploads-switch-is-real.test.ts` fails the moment a **fourth** thing records a capture. At that moment two things must happen together and neither is optional: the OFF copy stops being true unless the new path honours the switch, **and the server must read the column, not just the screen**. Hiding a control is not closing a door — the live photo wall mirrored to every guest's phone while the only "off" switch closed the venue screens.

⚠ **Counted at the CALL, not by import** — the question is how many places can put a row in, and an import that is never called is not a path. The offline drain and the camera-bridge sink are excluded with a reason: they take a `record` **callback** handed to them by the two seat components, so they are the same path plumbed through, not a fourth door.

| sabotage | count | result |
|---|---|---|
| a fourth recorder appears | 3 → 4 | 🔴 |

**Verified:** `tsc --noEmit` exit 0 · `handles-have-gates` 4/4 · the switch guard 8/8.

**SPEC IMPACT:** None.
