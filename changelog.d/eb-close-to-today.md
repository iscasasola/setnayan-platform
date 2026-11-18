## 2026-11-16 · fix(supplier): ✕ on a customer card opened from Today goes back to Today

Found on the phone walk of every supplier button (16 Nov 2026, EB-290; owner: "Fix it"). A supplier tapped a Today row (e.g. "Agree to this booking"), the customer card opened, and ✕ landed on **Clients**, a screen they had not visited.

The card already closed back into the list it was opened from (Clients, Chats). Everything else fell back to the Clients list. This was written on purpose in the shell's own doc ("From anywhere else (hard load, Today, a notification) … ✕ goes to `closeHref`"), and the owner's "Fix it" overrides it for Today.

- Today's one door into a card (`nextHref`, `to: 'card'`) adds `from=today`.
- The client page turns that into the shell's close target (`pickedClientCloseHref`, `lib/picked-client-close.ts`). It accepts only `today`. Anything else, missing or unknown, keeps the Clients list, so cards opened from a notification or a typed address close as before.
- No new server action, no migration.

Guard: `lib/picked-client-close.test.ts` (3 tests). Two sabotages, each measured 1 → 0 and each red: Today's door without `from=today`, and the page not passing the close target. `today-rows-jump.test.ts` now expects `&from=today` on the two links it pins. `lint-port-no-lost-controls`: no route lost anything.

SPEC IMPACT: None.
