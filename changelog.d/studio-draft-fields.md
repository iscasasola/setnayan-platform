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

## 2026-10-08 · fix(studio): the thank-you words are the Studio's own row (no box, no Save); an empty Love Story shows its shape; the Maker's first load is back under 507 KB

Owner, on the preview (Maker › Studio, 375 px, maria-and-jose): faults 2 and 3 of the 08 Oct preview pass, plus the red bundle check on this PR.

- **Studio › E-Gifts › Thank-you message** (`pabuya/_components/pabuya-message-editor.tsx`): in the Studio the editor is `StudioThanks` — "Your own words ⓘ" and Start from ▾ on one row, the words on a full-width row, the character count. No `sn-tile`, no helper paragraph (15 words behind ⓘ for the page's 60), no Save / Saved. The words go to the DRAFT as they are typed (`savePabuyaMessage` + `HUB_DRAFT_FIELD`, one write per pause through `makerLatestWrite`; ✓ Apply flushes a write still waiting), and the burst ends in one Maker render so the ✓ Apply count moves. A refused write is said in both doors of the field ("These words are not in your draft yet. …" + Try again) and the words stay in the box. A starting point picked in one door is typed into the other (the pick announces itself to the Maker's `same-field` listener). The E-Gifts page and the shipped Maker keep the editor exactly as it was.
- **Studio › Love Story, empty** (`our-story/_components/moment-order-cards.tsx`): an event with no moments draws the real card (band · photo box · year · title · first line · grip, one set of classes shared with the real card) as grey sample shapes, one under each of the three chapters a story is anchored by (How we met · Together · The yes — the real labels). `aria-hidden`, not tappable, gone with the first real moment. "+ Add a moment" unchanged.
- **Add a moment sheet, in the Studio** (`moment-sheet-studio.tsx`): the three helper paragraphs (Photos · When · This one is…) are each an ⓘ beside the label; the Studio's fields keep clear of the floating foot when scrolled into view (`scroll-mb-24`). The dashed drop zone is the shared `FileUpload`'s and is left as it ships. The foot's frosted fill (`.sn-glass-row`) arrives with main (#6410) — this branch does not merge main.
- **Budget** — "draft 1-3" put two things in front of the Maker's first load (506.9 → 507.4 KB, CI red):
  - `lib/hub-draft.ts` (in the first load) imported `PABUYA_MESSAGE_MAX` from `lib/pabuya-message`, which moved the five starting-point templates out of the lazy editor chunk into the first load. The cap is now the draft lib's own number (`HUB_DRAFT_PABUYA_MESSAGE_MAX`), held equal to the column's by a guard that also forbids the import.
  - the thank-you editor — also the E-Gifts PAGE's — imported `HUB_DRAFT_FIELD` from `lib/hub-draft.ts`, which put the draft library's chunk on that page's own list (measured in the local build) and — inferred from CI's chunk lists for the base and for this PR, not measured against a base build — re-split the Maker's first-load chunks around the new sharing. The editor now spells the field (`'draft'`), held equal by a guard that forbids the import.
  - margin, same file: the venues' entry of `HUB_DRAFT_FACT_GROUP` is written out instead of computed (`Object.fromEntries` was a statement the minifier had to keep in every Maker open; the Record type refuses a missing or extra column).
  - Measured ONCE locally (CI's env, before the last two): 507.09 KB (519,259 B, 91 over). The final tree was not rebuilt locally — CI's "bundle size check" is the judge.
- Guards (each seen red once): `studio-round-3-follows-the-owner` 4b and 8; `draft-1-3-waits-for-apply` A (the cap, the templates import, the venues written out) and B (the Studio's draft field, the editor's spelled field and its missing import).

No migration. +0 server actions.

SPEC IMPACT: None (owner rulings already in `DECISION_LOG.md`, 2026-10-07/08); status in `STUDIO_ROUND3_BUILD_STATUS_2026-10-08.md`.

## 2026-10-08 · perf(studio): two Studio pieces leave the Maker's first load (507 KB on the combined train)

No behaviour or visual change — the same markup, the same map.

- `lib/studio-tile-defs.ts` (in the first load through `maker-shell.tsx`) now holds only the eleven tile keys and the editor each opens (`STUDIO_TILE_ITEM`). The tiles' words — label · short · sub · reads (`STUDIO_TILES`) — moved to `lib/studio-tiles.ts`, which only the server reads; its `item` is the map's.
- Studio forms' group headings ("Your event" · "Your Event Hub" · "Your invitation set" · "For the day"): drawn by the server in `maker-details.tsx` and only placed by `details-workspace.tsx` (first load) — the two class strings and the JSX no longer ship with the Maker.
- Guard: `studio-followups-follow-the-prototype` 7 (each assertion seen red once).

SPEC IMPACT: None.
