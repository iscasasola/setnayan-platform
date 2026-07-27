## 2026-07-27 · feat(vendors): the song desk — the first specialization surface, and the read that made it possible

Fills the `song_desk` slot the frame (PR #3796) left open for band / singer /
choir / orchestra / DJ. Plugs in exactly as the registry documents: a component
in its own subdirectory + **one line** in `SPECIALIZATION_SURFACES`. No edit to
`page.tsx`, `specialization-slot.tsx` or `lib/vendor-dayof-frame.ts`, so the two
remaining specialization PRs (MC script · floor command) are still unblocked and
still conflict-free.

**THE DESK BUILDS ONE THING, BECAUSE THE OTHER TWO WERE ALREADY ON THE SCREEN.**
The owner's 2026-07-26 lock names *"requests · set list · what's-next"*. Two of
those already render on this exact page, so rebuilding them would have been a
duplicate that can disagree with the original:

- *what's-next* — `FloorClock` (next-block countdown) and `RunOfShowHeader`
  (live realtime timeline) render **above** this desk, in the generic kit.
- *set list* — authored at `/vendor-dashboard/repertoire`; the generic kit's
  `setlist` module already links there, and it deliberately stays generic
  (removing a live tool during free-during-launch is an owner call).
- *requests* — **existed at no layer, DB or UI.** This is the entire delta.

**The gap this closes.** `event_song_picks` shipped host-only
(`event_song_picks_host_select`, migration 20260731000000) because the picks fed
the couple's onboarding and the marketplace match score, and the score is
computed *for* the couple. The consequence nobody had hit until now: the band
booked to play those songs was the one party who could not see them.

**New — `supabase/migrations/20271013090000_song_desk_booked_vendor_reads_song_picks.sql`.**
One additive SELECT policy, `event_song_picks_booked_vendor_read`, copied from
the shipped precedent one table over — `event_schedule_blocks_booked_vendor_read`
(20261130003000) — reusing the same `public.current_vendor_booked_event_ids()`
SECURITY DEFINER helper. That helper already encodes "genuinely booked" (status
IN contracted / deposit_paid / delivered / complete, matched to the caller's own
profile or a team membership), so this grant cannot be wider than the run-of-show
grant a booked vendor already holds, and "booked" has one definition in the
schema rather than two that drift. **SELECT only** — the couple keeps sole write.
No table, no column, no existing policy touched.

⚠ **Deliberately NOT narrowed to music vendors.** Doing so would hardcode the
taxonomy keys into SQL where they would drift from `MUSIC_CANONICALS` in
`lib/songs.ts` — the exact drift the gate author avoided by reusing that set
rather than re-listing it. A security policy that disagrees with the app about
who counts as a music act is worse than a boundary one notch wider whose scope is
the couple's wedding playlist, shared with vendors already trusted with the
couple's full timeline and headcount, and performed publicly at the event.
Flagged for owner awareness rather than decided silently.

**New — `apps/web/lib/song-desk.ts` (pure, no I/O).** `buildSongDesk({ requests,
repertoire })` crosses the two song sets into three groups. **The order is the
opinion:** `gaps` (requested, you don't play it) first because it is the only
actionable row before a set starts; `ready` (requested and in your repertoire)
second; `spare` (yours, unrequested) last and collapsed, so a long repertoire
can't push the gaps off a phone screen. Zero requests reads as **100%, not 0%** —
vacuously complete, and never a divide-by-zero. Tolerant by construction: ragged
join rows, duplicate ids and null lists all survive, because the floor is the
worst place to discover a bad join.

**New — `apps/web/lib/song-desk.test.ts` · 14 tests.** Neutralisation **run, not
asserted**: inverting the gap branch turns 10 of 14 red, and the 4 survivors are
exactly the cases with no requested-AND-in-repertoire song to misfile — the
asymmetry that proves the suite tests the crossing itself.

**New — `.../live/[eventId]/_components/song-desk/song-desk.tsx`.** Async Server
Component over the props contract. Both reads go through the **request-scoped**
client under the caller's own RLS and are scoped to the handed-in `eventId` /
`vendorProfileId` — no admin client, because the frame mounting the component is
not authorisation for its queries (registry doc; 2026-07-26 security review). An
unbooked vendor reads zero rows from the policy, not from a UI check.

**Changed — `apps/web/lib/songs.ts`.** Adds `fetchEventSongRequests` (the
existing `fetchEventSongPickIds` returns bare ids because the match score only
counts overlap; a musician on the floor needs the titles). Extends the existing
module rather than adding a parallel one.

**Verified:** typecheck clean · lint clean (no new warnings) · full unit suite
**4344/4344** · the frame's own `"being REGISTERED does not unlock"` invariant
still passes now that a real surface is registered.

⏭ **Not built, deliberately:** per-event set ORDERING and a mark-as-played
tracker. Both need a new table, and the shipped repertoire model carries no
per-event ordering — an owner call, not a build side effect.

SPEC IMPACT: `DECISION_LOG.md` — appended a 2026-07-27 row recording the song
desk landing, the `event_song_picks` booked-vendor read (with the
not-narrowed-to-music-vendors reasoning), and the two deferred pieces.
