## 2026-07-26 · fix(security): SEC-6 — an unexamined video can no longer reach a public guest page

**The defect (LIVE in production).** "NSFW filter is on by default and CANNOT be
disabled" is a locked product rule, and it was false in two independent ways.

1. **The verdict was host-writable.** It lived inside `events.std_media`, a JSONB
   column the couple must be able to write (they pick their own video). Postgres
   RLS is ROW-level, never column-level, and the Supabase anon key is public, so
   a single `PATCH /rest/v1/events` setting `nsfw:"approved"` published an
   unscreened video. The server action's refusal to accept a client verdict was
   real but enforced in a layer PostgREST does not run.
2. **Nothing ever looked at the video.** `lib/nsfw-screen.ts` downloaded the
   POSTER, classified that JPEG, and wrote `approved` for the MP4 beside it.
   `posterKey` arrives from the client as an independent upload with no
   derivation proof, and `std_media.fit` defaults to `'fill'`, in which mode the
   guest is never sent the poster at all — so the only examined artifact was one
   the guest never received and the only received artifact was one nothing
   examined. nsfwjs is image-only and Vercel has no ffmpeg, so there was no
   server-side frame extraction anywhere in the stack.

**The fix, in one rule:** an artifact may be served only if THAT ARTIFACT'S OWN
BYTES were examined by an examiner competent to judge them. Anything else may
only REJECT. It is monotone on purpose — a dirty poster is reason enough to
refuse the video beside it; a clean one is not reason enough to publish it.

- The verdict moved to `events.std_media_nsfw`, withheld from `authenticated` +
  `anon` by a column REVOKE **and** a guard trigger that RAISEs (no GRANT can
  undo it, so re-applying the `20271005100000` privilege baseline cannot re-open
  the hole). `StdMedia` has no `nsfw` field at all, so a forged one is
  unrepresentable rather than ignored.
- The verdict is BOUND to the media it judged and SEALED: on a decision the
  screen copies the classified bytes, server-side and ETag-conditioned, into
  `events/{id}/std-screened/` — a prefix `/api/upload` refuses to presign — and
  the guest is served only that copy. A re-PUT to the couple's still-presigned
  upload key lands on an object no guest reads.
- Authorisation is a per-artifact `StdExamination` naming the SEALED ref, its
  fingerprint, and WHO examined those bytes. `COMPETENT_EXAMINERS` makes "an
  image classifier authorises a video" unrepresentable rather than merely unwise.
- **The automatic screen can no longer approve a video.** A clean poster parks
  the row at the new `in_review`; a human examines the sealed clip in the Reveal
  Studio and their Approve is what records the video's examination.
- The one already-serving production row is carried across honestly, marked
  `grandfathered` and examined `by: 'legacy-poster-screen'`, stays in the admin
  re-review queue, and drops the marker on a real approval.

**Admins:** approving a Save-the-Date video is now a required step, in
/admin/studio → Reveal Studio. A row with nothing frozen to watch shows
"Prepare for review" first — approval is only ever against immutable bytes.

**When server-side frame extraction lands** this comes back off in one line: add
`'frame-extract'` to `COMPETENT_EXAMINERS.video`.

SPEC IMPACT: `0024_save_the_date` — a couple's Save-the-Date video no longer goes
live on an automatic screen; the verdict is `events.std_media_nsfw`, not a field
of `events.std_media`. Corpus `DECISION_LOG.md` row appended.
