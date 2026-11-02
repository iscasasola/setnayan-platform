## 2026-09-09 · feat(story): a guest changes their mind after publish and it comes down everywhere

**S14 of the by-the-minute story build.** `04` §3 · `07` Q6 (owner-ruled 2026-09-09,
build both) · `08` step 4.1.

### What was true before

A guest could withdraw and it did not come down. Measured against `origin/main`, not read:

* the host's guest form is the **only** writer of `photo_consent = false` in the product, and it
  revalidated `/dashboard/{eventId}/guests` and its `backTo` — two host screens, nothing public;
* the guest's own "Not me" (`removeMyTag`) revalidated `/{slug}` and stopped there;
* `/{slug}/recap` and `/{slug}/print` are their own cached routes at `revalidate = 300`, so a
  withdrawn photograph stayed on both — and the print sheet is the surface a person is about to
  put on paper;
* the share card is `max-age=3600, stale-while-revalidate=86400`, and **no `revalidatePath` can
  reach a `Cache-Control` header**, so calling one on it would have looked like a fix and done
  nothing.

⇒ The withdrawal came down on the next read and not before, and a printed copy never knew.

### What ships

* **One list of everywhere** — `lib/a-withdrawal-reaches-every-copy.ts` (pure: the surfaces, the
  card URL, the printed sentences) and its `.server.ts` (`everyCopyIsNowStale`: stamp, then
  invalidate, in that order — revalidating first races the write and re-caches the old card
  address for another hour). Nine consent writes now call it, including four nobody had asked
  for: the account-level RA 10173 opt-out (`optOutOfEventStory`, which reached one host screen),
  the RSVP selfie and the day-of face enrolment (both **lift** a veto), and soft-deleting a guest
  (which un-vetoes every capture that tagged them — a *widening* hidden inside a delete).
* **The share card's address moves.** `og:image` carries `?v={story_version_at}`. A URL-keyed
  cache is busted by moving the URL; nothing else could have reached it.
* **The fourth publish rung — "Taken back."** `event_editorial.status` gains the value; the
  ladder offers it only to a story that has actually been published (asked of the stamped
  `edition_no`, the one fact the database refuses to move). It reads exactly like `draft` — host
  only — which is the safety argument: every shipped reader that asks `status = 'published'`
  refuses it unedited. Published → taken back → published keeps the same edition number.
* **A version stamp on the printed keepsake**, in the celebration's own time zone, beside the QR
  that returns to the living page. A timestamp and not a counter: `now()` is race-free where
  `version + 1` is not, and "as it stood on 10 September at 2:32 AM" is something a person can act
  on.

### 🔑 What the stamp cannot do, said in the product and not only here

**A copy printed before this ships carries no stamp and can never know anything. Paper cannot be
recalled.** The stamp lets a reader CHECK; it does not reach a printed page. Neither does an
already-posted share, which holds the old card address. `the-stamp-never-promises-paper.test.ts`
fails on the vocabulary of recall so no kind rewording can quietly promise otherwise.

### Guards, each sabotaged and measured

Nine mutations, occurrence counts printed before and after, every one caught:
a dropped call site (5 → 4) · the print surface dropped from the list (3 → 2) · the card URL
stopped moving (1 → 0) · **the indirection broken two hops away** (5 → 4, and it named
`askToTakeMyPhotoDown`) · **S8's own trap — the JSX rendering stripped with the import left
standing** (2 → 1) · the limit softened into a promise (1 → 0) · the CHECK forgetting the fourth
rung (1 → 0) · the fourth state falling through to "everyone" (1 → 0) · the publish action leaving
the list (1 → 0).

🔴 **And two cuts of the source guard ACCUSED CORRECT CODE before either missed anything.** Asking
the three questions of a whole function body convicted `markResponse`, which inserts a guest and
later updates a different table; asking them of two different builder chains convicted
`submitRsvp`. A cheaper proxy does not merely miss — it convicts, and the tempting way out is to
edit correct code until the guard is happy. Both are recorded in the guard itself.

### Exposure surface

Widened by exactly one line plus its two counters (6597 → 6598, col 4848 → 4849) — the new column
on a table whose three RLS policies admit only the host, an accepted moderator and an admin; no
"any signed-in person" policy exists and `anon` gets nothing. Baseline regenerated in this PR.

SPEC IMPACT: `04` §3 (the ⛔ unhandled block becomes shipped) · `07` Q6 (ruled → built) ·
`08` step 4.1 · `02` §8 (the fourth state) · `09` (S14's row).
