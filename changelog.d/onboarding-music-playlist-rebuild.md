## 2026-08-05 · feat(onboarding): a background music PLAYLIST, and an audible admin preview

Rebuilds PR #1180's feature against today's code. **#1180 is left open and untouched** — closing
it is the owner's call; this lands the capability so that decision is not blocking.

**What a person gets.** The Setnayan team can set up to **8** onboarding background tracks
instead of one, and **press play on each one right there** to hear what is currently set. A couple
signing up hears them back-to-back in order, then looping — instead of one track on repeat for
~15 minutes.

**Why a rebuild rather than a merge.** #1180 is ~5,382 commits behind with four conflicting hot
files, and the decisive problem is that its target moved: the admin page it rewrites
(`app/admin/onboarding/page.tsx`) is now a **27-line redirect stub** — the body was re-homed into
`app/admin/ugat/_surfaces/onboarding-surface.tsx` on 2026-07-11. It also carries a migration that
would re-create an existing column and edits `CHANGELOG.md` directly, which the current doc
contract forbids.

**No migration.** `platform_settings.onboarding_bg_music_r2_keys` (TEXT[]) already exists — it
arrived via the 2026-10-11 schema-drift reconcile.

🪤 **THE COLUMN IS A GHOST, AND THAT SHAPED THE WHOLE DESIGN.** It has had **no writer and no
reader** since it landed. Verified against live prod 2026-08-05: the real track sits in the
**singular** `onboarding_bg_music_r2_key`, and the array is `[]`. **A plural reader that trusted
the array alone would have silenced the music that is playing right now.** Both the read path and
the admin surface therefore fall back to the singular column, and the save action **mirrors** the
first track back into it — `/admin/website-media` resolves that column to decide whether a file is
"In use", so letting the two disagree is how a live track becomes deletable. (That resolver
already reads both columns, so playlist tracks are safe from the sweep.)

🔴 **Fixed a live defect found on the way.** `contentTypeFromRef` mapped images and — deliberately
— video, but never audio, so an `.mp3` fell through to the `image/jpeg` default, `isImage()`
passed, and the admin uploader rendered `<img src="…mp3">`: **a broken-image glyph sitting next to
the live onboarding track today.** Audio now has its own content types, an `isAudio()` predicate,
and an inline `<audio controls>` preview — which is also the "audible" half of the original ask.

**Player detail worth keeping:** a single track keeps the native seamless `loop`; a playlist
cannot, because `loop` suppresses `ended` and the next track would never start. Changing an
`<audio>`'s `src` also pauses it, so an effect resumes playback on advance — **only when already
playing**, so it never starts audio a guest did not ask for.

Tests: 6 new, pinning the resolution ORDER (the only part that fails silently), including the
exact prod shape today. 6/6 pass; 54 pass across the neighbouring media/settings suites.

SPEC IMPACT: None — no pricing, SKU or scope change.
