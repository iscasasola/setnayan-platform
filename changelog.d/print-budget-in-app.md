## 2026-10-28 · fix(budget): Print budget opens signed in inside the app, with Done back to Budget

Owner, 28 Oct, asked how "Print budget" should open in the app: *"signed in"*.

- Web: unchanged (a new tab). App: `PrintBudgetLink` opens the print page in the app's OWN view (`location.assign`),
  which carries the session — not the in-app browser sheet, which is signed out.
- The print page's bar leads with **‹ Done** (back to Budget), sticky under the notch (`viewport-fit=cover`).
- The print page's "Download CSV" link left it — a file link in the app's view renders the file with no way back;
  Budget's own CSV button beside "Print budget" already saves it through `SaveFileLink`.
- `a-file-download-never-traps-the-app.test.ts`: the "Print budget" exception is gone (the link takes over the tap).
  New check in `budget-export.test.ts`, sabotaged (openEventHub in place of location.assign) → red, restored.

SPEC IMPACT: DECISION_LOG 2026-10-28 "CHAT — EIGHT OWNER ANSWERS" (6) records it.
