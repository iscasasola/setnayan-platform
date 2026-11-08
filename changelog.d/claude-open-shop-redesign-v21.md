## 2026-11-07 · feat(open-shop): the v17–v21 deltas on the shipped sign-up — swipe to remove + Undo, buttons by meaning, only the events they can serve, the plan in two columns, the quiet password rule, Email hides Google/Apple, motion, the no-photo tile

Built ONTO the shipped `/open-shop` (owner 7 Nov, prototype `open_shop_redesign_2026-11-06` v21 — the A2 slice of
`PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07`). No new screen.

- **Swipe to remove (v18).** Every picked-service row sits in the shipped `SwipeToDelete`; removing it pushes the
  house Undo toast (`pushUndo` + `UndoToastHost`) that puts the picks back exactly. Removing the main makes the next
  service the main. No row button; Remove also sits inside the opened specialties (⌃ · Remove · ✓ Done fit row).
  The `no-delete-x-on-list-rows` ALLOWED line for `service-cards.tsx` is narrowed to that one in-editor Remove.
- **BUTTON_RULE (v18).** `ActionButton` by meaning everywhere on the step-2 surfaces: grey Cancel / All categories /
  Search all services / Select all / Clear / Back to my services / Use another way; red Remove; green Done.
- **Events you serve (v19).** `eventsTheyCanServe` — only the event types one of the picked services is offered for;
  inside each event only the services it takes (no greyed chips, no "isn't offered" lines); counts are of those.
- **Plan explainer (v19).** One lead ("Your first booking is free, so you can experience Setnayan."), then THEIR picks
  in two columns — what stays Free (the main) and the plan that holds the rest (`planSplit`, names + caps from
  TIER_CAPS, no number typed). The four-plan ladder moved into the title's ⓘ.
- **Password (v19).** `PasswordField mode="new" quiet` now draws ONE rule line once the box is not empty ("At least 8
  characters", ticking as they type) and a non-blocking warning only when it holds their name/email. The leak check
  still speaks only on failure, on submit.
- **Email hides Google/Apple (v19)** — one grey "✕ Use another way" brings them back.
- **Motion (v19).** `.os-in-r` / `.os-in-l` step slides (only after a move, never on load), `.os-rise` once per new
  card, `Count` numbers and `Fill` step bars; all off under `prefers-reduced-motion`.
- **No-photo category tile (v19)** — the wash + line, the name in ink, one gold `tileIcon`; no brown gradient.
- **Not built here:** ⑧ the held-shop-name live refusal (lives in #7359 — a TODO marks the seam); the prototype's
  live "Checking… / Safe to use" leak line (the field never sends the password anywhere; the brief says the check
  speaks only on failure).

Guards: `app/open-shop/the-v21-deltas.test.ts` (new), `lib/open-shop-more-services.test.ts` (+`planSplit`), the
redesign / gate-walk guards updated to the v19 shapes.

SPEC IMPACT: None — the corpus prototype v21 is the contract this implements; no decision changed.
