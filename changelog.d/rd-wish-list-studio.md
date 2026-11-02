## 2026-10-08 · feat(egifts): Studio › Wish list (wish list 2/5)

Stacked on `rd/wish-list-tables` (wish list 1/5 — it carries the ONE migration)
and on the Event Hub train (`rd/studio-reply-by-editable`). This PR adds no
migration.

Owner 2026-10-08, "ok wish list" (design `EGIFTS_WISH_LIST_2026-10-08_fable.md`
§ 2 + § 6 E-PR2; prototype `egifts_wish_list_2026-10-08_fable.html` frames
01–06 · 09–11 · 26): in the new Maker's **Studio › E-Gifts**, ONE section is
added between Ways to give and the Thank-you message.

- **Wish list** — rows, never boxes: photo · name · "₱ sent of ₱ price · n
  gifts" with a thin meter (gold while filling, green when got) · Got it ✓ · the
  grip. Got wishes sink to the end; "4 wishes · 1 got" beside the eyebrow.
- **＋ Add an item** is the one creating button: a sheet from the thumb zone —
  Photo · Name · Price (optional, ⓘ) · Link (optional) · Note (optional) —
  ✕ Not now · ＋ Add it.
- **A wish, open:** the Got it switch with its honest line ("Marks itself when
  the gifts sent reach ₱4,500" · "Reached ₱2,500 — marked for you. Flip it off
  if it isn't in your account yet." · "Marked by you"), the gifts guests say
  they sent toward it, then the same five fields — **kept when a field is left
  and when the sheet closes; no Save, no "Saved"**. 🗑 Remove is two taps.
- **Reorder:** hold the grip (or the arrow keys) — one drag is one write.
- **States:** empty (three sample shapes that are the editor's alone,
  `aria-hidden`) · no way to give switched on → the list is KEPT and the amber
  line says guests are not shown it · **Accept gifts? No → nothing below** but
  the two lines that say it is all kept (the thank-you row folds away too) ·
  **a refused read says "Couldn't load your wish list." with Try again — never
  "No wishes yet" with an add button under it.**
- **"What guests see"** gains "· Wish list · 4 wishes" while a way to give is on.
- **Gifts sent to you** — a count only ("₱14,500 said sent · 5 gifts"); its
  screen is wish list 5/5.
- **LIVE, not drafted** (owner: "live"): a wish saves at once like a way to
  give, under the SAME "Guests see this right away" line — no second note; ✓
  Apply does not cover it. The thank-you words stay drafted as approved.
- **First-visit tour** `customer_wish_list_v1` (the prototype's own words).

How it is built:

- **+0 exported server actions.** `saveWishItem` · `deleteWishItem` ·
  `moveWishItem` · `setWishItemGot` are plain server functions in
  `pabuya/wish-items.server.ts`, reached through the E-Gifts page's one existing
  door — `saveEgiftMethod` when the form carries `wish_op` (the
  `saveCustomSection` "one export, six intents" shape). 1199 before and after.
- **Lazy.** The section rides the `StudioTool` door (`maker-details` chunk) and
  imports no server action of its own; the Maker's first-load files learn only
  its type and two strings.
- **Every write is the couple's own session** — RLS on `event_wish_items` is
  the boundary; a zero-row write is said, never reported as kept. Editing a
  PRICE re-settles the automatic Got it against what guests say they sent; the
  couple's own mark is never touched by a sum.
- **A wish's photo** goes to the public media bucket under
  `events/<event>/wish-list/` (`wishPhotoPolicy` — a ref naming anything else
  is refused), through the shipped `FileUpload`, and is registered in the event
  media sweep so it is deleted with the event.
- **One rule for "is the list shown to guests"** — `wishListShownToGuests`
  (gifts accepted · a way to give on · at least one wish). No switch of its own.
- `ugat-both-ends`: `event_wish_items` now has its writer — its debt row is
  taken out (45 → 44). `event_gift_records` still waits for wish list 4/5.
- Buttons are the shared `ActionButton`; the sent figure and the meter use the
  shared `Count` / `Fill`.

Not in this PR (said, not dropped): the gift rows inside a wish's sheet are
read-only and show "shot" / "no shot" — the screenshot's picture, tapping a gift
to correct or remove it, and the "Gifts sent to you" screen are wish list 5/5;
the guest side is 3/5 and 4/5. A replaced or removed wish photo is left in
storage until the event is deleted (no displaced-object cleanup yet).

Tests: `lib/wish-list-studio.test.ts` (14) · `lib/the-wish-list-follows-the-drawing.test.ts`
(8, the section rendered on the prototype's seed) · `the-guest-text-is-honest`
+1 ("sent" is the only money word on every gift surface) · `event-media-sweep`
+2.

SPEC IMPACT: None beyond wish list 1/5's. Build status in the corpus:
`EGIFTS_WISH_LIST_BUILD_STATUS_2026-10-08.md`.

## 2026-10-08 · fix(egifts): a wish action costs one request and renders no page (wish list 2/5)

Owner rule, 2026-10-08 ("the program created will create the least amount of
request for the tasks to be done"); controller's named change 1 for this stack.

**Before** (read from the code): every add · edit · got it · remove · reorder
in Studio › E-Gifts › Wish list rendered the WHOLE Maker on the server
**twice** — the door ended with `await revalidateSurfaces()` (and
`revalidatePath` inside an action makes Next render the action's own route into
its response), and the screen then asked for the same render again
(`makerSave(…, requestMakerRefresh)`). A reorder also wrote every wish, one
after another.

**After:** one request per wish action, **zero** Maker renders.

- `studio-wish-list.tsx` — the five saves are HELD (`makerSave(…, { held: true })`);
  an edit, the Got it switch and a run of moves fold into ONE write per wish
  (`makerLatestWrite`); the list is the drawing, and a refusal puts back only
  the wish it was about (never a snapshot of the whole list). A new wish's row
  is replaced by the row as kept when the save answers; a reorder waits for a
  wish still on its way in.
- `wish-items.server.ts` — a save answers with the row as kept (`wish`: real id,
  link as stored, the picture's address, the mark after a price change), read
  back in the SAME write. A reorder writes only the wishes whose place changed,
  together. A picture address that cannot be built is `null`, never a failed
  save.
- `actions.ts` — the wish list's door refreshes the guests' pages AFTER its
  answer is sent (`after`), so its own route is never rendered into the response.

Supabase requests per action (counted on the real functions over the replayed
schema, `tests/db/the-wish-list-writes-keep-their-rules.db.test.ts` test 8),
each plus the door's one sign-in check and, after the answer, one read of the
event's address: add 2 (was 2) · edit 3 (was 3) · got it 1 · remove 1 ·
reorder 1 + one per wish that moved, together (was 1 + one per wish that moved,
one after another). Whole-Maker server renders per action: **0 (was 2)**.

Guards: `lib/the-wish-list-costs-one-request.test.ts` (new, 5 tests) · test 8
of the DB test (new) · `a-drawn-pick-never-rerenders-the-maker` and
`every-maker-edit-shows-before-it-saves` each learn that a held save of LIVE
rows asks for no Apply bar and draws on its own list — one reason per handler,
a stale or shared reason fails.

SPEC IMPACT: None (no word, no layout and no schema changed; the behaviour the
design draws — "kept as you type", "guests see it right away" — is unchanged).
