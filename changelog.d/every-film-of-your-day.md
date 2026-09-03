## 2026-09-03 · feat(story): couples can attach every film of their day

The ₱2,500 Live Studio description has been promising **"unlimited video-link uploads"**
since migration `20271194920190` landed this morning. It was not true. Nothing anywhere let
a COUPLE attach a video link to their event — `video-links-editor.tsx` exists but is
vendor-dashboard only, for vendor microsites. The buy screen was selling a feature that did
not exist. This is that feature.

A couple pastes a YouTube or Vimeo link — same-day edit, prenup, the videographer's finished
cut — optionally labels it, and it joins their story permanently, beside the live replay.
No limit.

- `event_films` (migration `20271200391597`) — a table, not a jsonb column: "unlimited" is
  the promise, and an array makes ordering and removal a read-modify-write race between two
  people editing one event. `UNIQUE (event_id, provider, video_id)`, so pasting the same
  film twice is a no-op rather than a duplicate-key error the couple reads as "it broke".
- `lib/event-films.ts` — pure, no parser of its own. `parseVideoRef` in
  `lib/vendor-microsite.ts` already handles YouTube AND Vimeo including the
  `vimeo.com/{id}/{hash}` unlisted share form, and is tested. A second parser would be a
  second place for an unlisted link to stop playing and a second place for a Drive link to
  reach an iframe.
- Rows are **re-validated on the way OUT**, not only on the way in — values also arrive by
  admin edit, restore or migration, and that is the last step before an `iframe src`. An
  unrecognisable row is dropped, never rendered as a broken frame.

⚠ **FREE AND UNGATED, DELIBERATELY.** No `requireLiveStudioOwned()`. Owner ruling
2026-09-02: linking belongs with Story Maker, which is free; `LIVE_STUDIO` names it because
one unlock covers everything, not because it gates it. A gate here would mean a couple's own
prenup film vanishing from their own story the day an entitlement lapsed. The Watch-the-Film
replay directly above it DOES gate on `LIVE_STUDIO` — that renders a broadcast Setnayan
produced. Opposite postures, both correct.

🔒 **`REVOKE ALL ON public.event_films FROM anon` in the creating migration.** A new `public`
table inherits Supabase's blanket grants and arrived with anon holding SELECT + INSERT +
UPDATE on all seven columns — caught by `exposure-freeze`, not by review. Anon needs nothing:
the public story page reads through service role and the only writer is a host-gated action.
🔑 This is the fix that was NOT available on `public.users` this morning (`20271193294406`),
where twenty-plus RLS policies read that table in their USING clause and revoking anon's
SELECT would have made `creator_chapters.public_can_read_published_chapter` RAISE instead of
deny. A new table has no dependants, so the whole grant goes at birth.

🪤 **A near-miss worth recording:** the controller first mapped row ids back to films BY
ARRAY INDEX. `filmsFromRows` DROPS rows it cannot validate, so one bad row would have
silently attached the wrong id to the wrong film — and the id is what Remove deletes.
Rewritten so each id stays with its own row.

Guard: `lib/every-film-of-your-day.test.ts` (6). Mutation-tested: dropping the parser guard
and dropping the Vimeo unlisted hash each turn it red. A third sabotage — removing ONE of the
two validation layers in `filmFromRow` — did NOT, because the other layer still catches it;
removing both turns two tests red. Defence in depth, recorded rather than "fixed".

Verified: `tsc` exit 0 · unit 12395/12395 · exposure-freeze + both Ugat guards green ·
baseline regenerated, and every added line reads `anon=-`.

SPEC IMPACT: None — this makes an existing catalog promise true.
