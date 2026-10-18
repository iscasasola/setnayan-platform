## 2026-10-18 · feat(dress-code): each role's call time is set beside its outfit in Studio › Mood Board & Dress Code

Owner, verbatim: *"Call time: each role will have their call time."*

- **One home, nothing moved.** The call time already lived on each row's outfit line
  (`dress_code_config[roles|groups][key].callTime`) — written by the older desktop dress-code form, read by the guest
  page through `resolveAttireFor`. The Studio only *said* it ("Arrives 2:00 PM"). No migration: every time already set
  shows in the Studio as it is.
- **Studio › Attire:** every row except Guests gets a **Call time** field (the phone's own time wheel, `type="time"`),
  saved on blur through the same one draft write as its Wear (`saveDress`); **Clear** takes it back. A row with no Wear
  picked has no outfit line to keep a time on and says "Pick what they wear first". The header's "Arrives …" now reads
  the draft live. Helpers `callTimeOf` / `withCallTime` (`lib/mood-board-studio.ts`).
- **The old form's field retires:** the Maker's desktop Dress code scene (`DressCodeFields` → `RoleAttireField` /
  `GroupAttireField`) draws no time field and posts no `_call_time`; `updateDressCode` keeps every stored time through
  `carryCallTimes` (`lib/role-dress-code.ts`) — a Save there never wipes a time, and a stale tab never writes over one
  the Studio set since. A poster that still sends a tier's times is read as before.
- **The guest page is unchanged** — Me › Arrive by and the dress-code scene's "Call time" above the outfit read the same
  field. Prints show no times today, so they were left alone.
- Tests: `lib/each-role-has-its-call-time.test.ts` (new, 6), `each-role-wears-its-own` + `the-outfit-figure-…` updated;
  12 sabotages all red.

SPEC IMPACT: owner ruling 2026-10-18 "each role will have their call time" — the controller records the DECISION_LOG row.
