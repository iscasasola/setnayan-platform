## 2026-08-10 · feat(papic-games): four STORY challenges — the first prompts that ask a guest to say something, and they adjust to the guest's side

Owner 2026-08-10, after seeing the "confession booth" idea circulating (couples DIY-ing prompt cards on top of a shared-album app): *"what i mean on our papic challenge. we can add those questions where they can share a story?"* → *"we just want to add those new challenges"* + *"We want a 10 second story."* The four questions are the owner's own wording.

**RULE 0 first: none of the machinery is new.** The 20-slot 3-lane board, SELECT → COMMENCE → RETAKE, the couple's curate/veto, the vendor approval handshake and the free-Story completion reward all ship and are untouched. What was missing was only the *questions*: all 40 shipped challenges are ERRANDS ("Catch the newlyweds mid-kiss", "Get the wedding cake in frame before it's gone"). Not one asked how you met them.

New library rows 41–44 (`stories`), all `capture_kind='clip'`, `mission_type='prompt'`:

| id | title | prompt |
|---|---|---|
| 41 | Most Memorable | Share a story about your most memorable experience with {who}. Ten seconds. |
| 42 | The First Time | Share a story about the first time you met {who}. Ten seconds. |
| 43 | When It Mattered | Share a story of an experience where {who} played a crucial part in your life. Ten seconds. |
| 44 | Always Remember | Share a story of how you will always remember {who}. Ten seconds. |

**🚨 ADDING THE ROWS ALONE WOULD HAVE SHIPPED NOTHING — and it would have looked completely fine.** The board is 20 slots and the Setnayan lane backfills `ORDER BY priority_rank NULLS LAST, library_id` across what is now a 44-row library. A new row with a NULL rank sorts dead last and is **never placed**. And nothing else surfaces the library: **no application code reads `papic_challenge_library` at all** (only `ensure_papic_board` does, inside the database), and the couple's manager screen lets them AUTHOR free text and hide/show what is already on their board — **it has no library picker**. The rows would have existed, every query about them would have succeeded, and no guest would ever have been asked one. Same shape as the face-mode column that had zero writers for seven weeks. So `priority_rank` widens 1..10 → 1..20 (still UNIQUE — a rank is a board POSITION) and the stories take 11–14, landing right after the §9.4 Top-10 heroes. `library_id` widens 1..40 → 1..99.

**The cost, stated rather than hidden:** the board was already full. On an event with no couple picks and no booked vendors the Setnayan lane fills all 20, so four guaranteed stories DISPLACE the four lowest-ordered unranked errands — the board becomes 10 heroes + 4 stories + 6 errands. Nothing is deleted; the displaced rows stay active and return the moment a couple pick or vendor mission takes a slot. Reordering is an UPDATE of four ranks.

**⚠ TEN SECONDS IS THE ANSWER, AND EVERY PROMPT SAYS SO.** A challenge is completed by the guest's next capture, and a Papic clip is hard-capped at 10 000 ms — an owner lock (2026-07-22 · §0) mirrored in the client, the route and the RPC. There is no text-answer completion path and this PR does not invent one. Each prompt therefore names the ten seconds out loud: without it a guest starts a two-minute answer, the recorder cuts them off, and the app tells them they succeeded.

**The {who} side token** (owner: *"Or dedicate it to whether they are team groom/bride/both. so it adjusts."*). `guests.side` is a NOT NULL enum already, so nothing needs authoring or backfilling. `papic_guest_missions` → v5 substitutes per guest: bride → "the bride", groom → "the groom", anything else → "the couple". 🔑 **The substitution belongs in the per-guest reader and nowhere else** — the board is materialized per EVENT, one row serving every guest, so baking it at materialization would show one side's wording to the whole wedding. Signature is byte-identical to the live v4 (read from prod via `pg_get_functiondef`, not assumed), so `CREATE OR REPLACE` is correct and the grants survive; the v3 fail-closed `target_role` guard and the v4 fail-soft no-board branch are carried forward unchanged. ⚠ `target_role` is a `guest_role`, NOT a side — this adds wording, not a new visibility rule.

**🪤 A token in the database reaches a human on four screens.** The couple's manager, the vendor approval list, the vendor challenge panel and the vendor's delivered-photos page all read `papic_missions.prompt` **directly out of the table**, never through that reader — so without a fix they render a literal `{who}` at the couple. New shared `displayChallengePrompt()` renders the neutral wording at each; a prompt without the token is returned byte-identical, so all 40 shipped challenges and every couple/vendor free-text prompt are untouched. Applied at the RENDER site rather than behind an "is this a story?" branch, so the next tokenised prompt needs no second edit.

**Constraint names were read from prod, not guessed.** A `DROP CONSTRAINT IF EXISTS` on a wrong name is a **silent no-op** — the old 1..40 CHECK would have survived and the INSERT would have failed on a name typo alone.

Tests — 28 unit (`papic-missions.test.ts`, fixture corrected from a 40-row to the real 44-row library, with T1/T4/T5 and the veto case re-derived) + 7 new db (`papic-story-challenges.db.test.ts`, full replayed schema). T-STORY-3 asserts the failure this PR exists to prevent: strip the four ranks and the stories fall off the board entirely. **Both halves mutation-tested** — removing the `replace()` turns the two substitution tests red; nulling the four ranks turns the rank test red. Typecheck clean, all 20 `lint-*.mjs` green, migration-timestamp guard green (1082 migrations).

SPEC IMPACT: `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` §9.2 — the library is 44 rows, not 40, and §9.4's rank ladder now runs 1..20 (11–14 = the stories). `DECISION_LOG.md` row added 2026-08-10.
