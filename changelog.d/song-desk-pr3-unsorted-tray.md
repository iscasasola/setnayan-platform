## 2026-07-30 · feat(couple): onboarding feeds the studio — the Unsorted tray, and one resolved id instead of three fuzzy joins

Song Desk **PR 3**, owner-answered 2026-07-30 ("onboarding feeds the studio", chosen over studio-only or leave-both-and-fix-the-score).

### The defect

A couple picks songs at onboarding (`event_song_picks` — flat, resolved `song_id`s), later opens the playlist studio (`event_playlist_picks` — per-moment, free text), and finds it **empty**. So they type the same songs again, and the band's desk then shows both copies (the duplication PR 2 had to document as known).

### The tray

The onboarding picks **not yet placed in a moment**, at the top of the studio — because "where did my songs go?" is asked before any other question on that page. Each row has a *Place in…* select.

- ⚠ **It is a derived view, not a 12th slot.** A pseudo-moment would propagate into `PLAYLIST_SLOT_TYPES`, the DB enum, the studio's section list, `groupPicksBySlot`, the band's render order and the vibes table — and every one of those would then special-case something that is not part of the night. Nothing is written while a pick sits in the tray; **placing writes a normal playlist pick** and the tray shrinks because the derivation changed.
- **The section renders nothing once everything is placed** — a permanently visible empty tray is a chore you can never finish.
- **One-way.** Nothing writes back to `event_song_picks`: that is the matcher's original source and the record of what the couple said at onboarding. Placing a song does not un-say it — so clearing a moment later brings the song back to the tray, correctly.
- **Place, not drag.** Couples plan on phones, where dragging means long-press, scroll-while-holding and a drop target that may be off screen. A select is one tap, says out loud what the gesture only implies, and is keyboard/screen-reader accessible for free. Dragging can be added later over the same action.

### One resolved id instead of three fuzzy joins

`event_playlist_picks` gains a **nullable** `song_id` (migration `20271022319040`), resolved at write time by the same `findOrCreateSongId` onboarding already uses.

Three readers had been answering *"is this the same song?"* by normalising strings — the tray's already-placed check, the band's repertoire crossing (PR 2's knowingly-generous blank-artist rule), and the vendor match score. **Resolve once at write instead of three times at read.**

- **The text stays the display truth.** Nothing renders from the joined row; `song_id` is an identity used only for crossing. NULL = uncatalogued (a family composition, a spelling they prefer) and **every consumer keeps its text fallback** — PR 2's fuzzy rule is not deleted, it becomes the *second* pass.
- **`ON DELETE SET NULL`**, so retiring a catalogue song never deletes a couple's pick. No NOT NULL, no unique — the same track may legitimately appear in two moments.
- **Re-resolved on every edit.** A stale id is worse than a null one: it would keep crossing against the *old* song invisibly. Editing label or artist re-resolves, reading the row for whichever side the form didn't send.
- **The backfill is exact-normalised-match only.** The looser blank-artist rule is fine at read time (a musician can eyeball it, and the matched artist is shown) but **writing a guess into a stored id is a different act** — invisible afterwards, and it would silently feed the money-adjacent match score. Rows needing a guess keep NULL.
- **Done now because the table is empty.** Prod holds zero real rows (only today's test fixture), so the backfill is free and total. In a month this is a migration reconciling thousands of hand-typed labels, with every unresolvable row a permanent NULL.

### The matcher reads both

`fetchEventSongPickIds` fed the vendor "% match" from `event_song_picks` alone — **a song assigned to `first_dance` counted for nothing**, so a couple who planned in the studio got scores from a partial list. It now unions both tables, and:

- **anti-picks are excluded** — counting a banned song toward compatibility would invert the score;
- **unresolved rows contribute nothing**, which is the honest outcome for a money-adjacent number (they remain visible to the band via the text fallback — un-countable is not invisible);
- **the union de-duplicates**, because the overlap ratio divides by this length and a song chosen in both places would quietly deflate every vendor's score.

### Tests

`lib/song-desk.test.ts` **§7** — 14 new (59 in file). Full `test:db:ci` **640**, `test:unit` **5483**, lint + `dup-rule` + `migration:check` clean. Baseline: **one** added fact, `event_playlist_picks.song_id anon=- authenticated=SIU`.

⚠ **One test had to be rewritten because the mechanism it claimed to cover was unkillable.** "A pick placed with different text but the same id" originally used `"ikaw "` vs `"Ikaw"` — which the blank-artist *text* rule already swallowed, so deleting the id pass killed nothing and the branch was **untested rather than proven**. Replaced with the real case: the couple **renamed** a placed pick ("our song (the slow one)"), text the normaliser can never reconcile, where only the resolved id connects the two rows. Verified: dropping the id pass now turns it red.

SPEC IMPACT: PR 3 built — recorded in `Song_Desk_BUILD_ORDER_2026-07-27.md` + `DECISION_LOG.md`. **Only PR 5 (sets) remains in the stream.**
