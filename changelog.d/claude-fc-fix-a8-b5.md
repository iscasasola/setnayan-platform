## 2026-11-25 · fix(admin): final check area 8, batch 5: admin saves say when they failed

Final check, area 8 fixer, batch 5 (lane A only; no amounts, plans or rules change):

- **A8·F-6**: editorial review: flag, unlock and re-scan check their write; the couple is told only after the unlock lands.
- **A8·D-9**: event deletions: "Keep it" is saved before the couple is told; a refused write tells nobody.
- **A8·F-7**: user reports: "Block uploader" with no uploader found, or a refused block, fails and leaves the report open.
- **A8·H-10**: prod smoke test: a network failure reads as a failed test, not "fired ✓".
- **A8·D-10**: event face-mode saves show their saved / refused notice on the accounts page too.
- **A8·A-10**: payments: an approval whose receipt did not issue says so (the approval itself is unchanged).
- **A8·I-1**: integrations: the Resend, AI paywall, OAuth and Maya saves check their write.
- **A8·I-2**: integrations: the four "clear" buttons say cleared, or that the clear failed.
- **A8·H-15**: menus: every menu-slot write is checked before its audit row.
- **A8·E-12**: fraud wipe-ban: every refusal (no reason, name mismatch, already pending, already banned) comes back to the queue as a sentence instead of the crash page; a sent request says it waits for a second admin in Approvals. The dialog still runs the action directly.
- **A8·H-6**: connection logs: a refused resolve or archive reverts the rows and says so.
- **A8·B-6**: budget planner: a typo in a price is refused (nothing saved) and every save shows its failure.

Guard: `apps/web/app/admin/batch-5-saves-say-failures.test.ts` (mutation-checked).

SPEC IMPACT: None.
