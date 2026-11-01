## 2026-10-31 · fix(memories): Delete asks, then shows it deleting

Owner: "When we press delete a pop saying it cannot be undone continue button then when continue is pressed. We show a deleting progress icon and delete." The viewer's Delete confirm keeps its words ("This cannot be undone"); its button is now **Continue**, the shared SubmitButton: while the delete runs it shows a spinner + "Deleting…", is disabled, and raises the app's no-touch veil; Keep it is disabled meanwhile. Guard: `app/_components/memories/delete-asks-then-shows-it-deleting.test.ts`.

SPEC IMPACT: None.
