## 2026-10-08 · feat(maker): "draft 1-3" — the opening line, the thank-you words and Reply by wait for ✓ Apply

Owner, 2026-10-08, verbatim: *"draft 1-3"*. In the Maker these three now save into the hub DRAFT and reach the live column only at ✓ Apply; item 4, the Event Hub address, stays live.

- `lib/hub-draft.ts`: `pabuya_message` (session read + write — its grants are 20271230123132) and `guest_list_edit_deadline` (drafted, but NOT in the session-client live read; Apply writes it through the admin client with `updatePaxSettings`' audit row) join the draft (`HUB_DRAFT_SETTINGS_COLUMNS`); `print_details` may also hold `opening_line` (`HUB_DRAFT_OPENING_LINE_KEY`), cleaned as `parsePrintDetails` cleans it and merged by Apply beside the name and ticket styles. Labels and Apply-sheet places for each.
- Writers: `savePabuyaMessage` (draft branch on `HubDraftField`; the registry link stays live), `updatePaxSettings` (draft branch; the pricing view posted beside it stays live, written only if it changed), `POST /api/hub-print/words` (the Maker's words form marks `opening_line_to_draft`; the switches and reply line stay live).
- Reads: the Maker's Details / Studio / RSVP stage read all three draft-over-live; the host prints overlay the drafted line (`loadPrintSet` → `overlayHubDraftEvent`).
- "Guests see this right away" removed from the thank-you editor and Reply by.
- ⚠ NOT drafted: E-Gifts' ways to give — rows of `event_egift_methods`, not an `events` column; the draft holds only `events` columns and section rows, so drafting them is a draft-shape change (owner call). The registry link (`gift_registry_url`) also stays live.
- Guards: new `lib/draft-1-3-waits-for-apply.test.ts` (4, each sabotaged red once). Updated to the ruling: `hub-draft.test.ts` (a "setting" kind), `every-maker-form-drafts-or-says-so.test.ts` (the thank-you editor left the live list), `details-words-and-plans.test.ts` (Reply by no longer says "saves immediately").

No migration. No Apply RPC (Apply is `hubDraftAction`'s sequential writes).

SPEC IMPACT: `DECISION_LOG.md` — "draft 1-3" (2026-10-08) as built: opening line · thank-you words · Reply by draft; ways to give and the slug stay live (pending owner).
