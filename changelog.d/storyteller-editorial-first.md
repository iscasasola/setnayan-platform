## 2026-08-12 · feat(creator): a chapter's story is writing — the video is optional

**A couple with 400 photos and no TikTok can now publish their story.** Until
today they could not, and that is the measured reason the storyteller shelf was
empty: prod held **0 creator_chapters rows** and **0 of 9** accounts with a
public profile.

Owner decision 2026-08-12, verbatim: *"their storytelling doesn't need to be a
video anymore. it will be their editorial and they can also paste a video they
can upload to the editorial."*

### The brief named one wall. There were six.

Publishing hard-failed without an `embed_url`, and the only accepted providers
were YouTube / Instagram / TikTok — so telling your own story on Setnayan
required an audience somewhere else first. But **fixing only that would have
shipped a worse bug than the one it closed**: five more gates sat behind it, and
a video-less chapter would have published with a success message and then
existed nowhere.

| # | the gate | what a person would have experienced |
|---|---|---|
| 1 | `publishChapter` required `embed_url` | "Add the embedded edit before publishing" — the named wall |
| 2 | `fetchPublishedChapters` filtered `!!embed_url` | published, then **missing from their own profile** |
| 3 | `fetchPublishedChapterByPublicId` returned null | their story's own page **404s** |
| 4 | `fetchPublishedChapterForShare` returned null | no share card when they post the link |
| 5 | shelf + admin required a **YouTube-derived** thumbnail | can never be featured on `/realstories` |
| 6 | publishing needs a public address + the profile switch | 8 of 9 accounts have **no address**; the switch has **never once** been on |

Gates 2–5 are the same family this repo keeps paying for — **rejected, not
thrown; the only symptom is an absence.**

### What changed

- **`creator_chapters.body`** — a first-class column, migration
  `20271140092009`. The story used to live at `substrate.itinerary`: travel-shaped
  naming on what is now the main event, capped at 4000 chars and rendered as a
  single `<p>`, so a whole wedding came back as one grey slab. **Renamed the
  value, not the documentation** — the `sponsored_included` → `included_in_package`
  lesson. Cap 4000 → 20000; blank lines now become paragraphs.
- **Publishing requires a title and a story.** A video is optional and, when
  present, a companion. Enforced in the action with a readable sentence *and* by
  a DB `CHECK` — the app layer is never the control, since PostgREST serves this
  table to the browser client. Drafts stay unconstrained.
- **One press.** Publishing also switches on the public page, with the copy
  saying so *before* the press. It does **not** mint a web address — that is a
  permanent public handle, and it is chosen, never assigned by a side effect;
  publish points at the picker instead.
- **Text-led shelf tiles.** A written chapter has no video to derive a poster
  from, so it renders a typographic hero + "Read" instead of being dropped. A
  rendered teaser is deliberately **not** used as a shelf poster: its R2 URL is
  presigned and `/realstories` is ISR, so it would 404 a day later.
- `publicProfileEnabled` read as `=== true`, not `!== false` — a failed profile
  read used to claim the page was live.

### Proof

- 31 unit + 8 new DB tests, run against the real replayed schema.
- **Both guards mutation-tested with occurrence counts printed.** Neutering the
  `CHECK` (1 → 0 occurrences, sabotage marker present) turned 3 refusal tests
  red; reverting the readability rule to `!!embed_url` (1 → 0) turned the
  written-story test red. Both restored, both suites green.
- Migration **dry-run against prod in a rolled-back transaction** first; the
  constraint refused a published-with-no-body row, and prod verified untouched
  afterwards (no column, no constraint, 0 rows).
- Grants checked in `pg_class`/`pg_attribute`: `creator_chapters` is
  table-granted, so the new column needs no re-GRANT. (Had it been
  column-granted like `events`, naming `body` would have had the whole query
  rejected and the page would 404.)

SPEC IMPACT: `DECISION_LOG.md` 2026-08-12 row added — chapters are
editorial-first; the video is optional; the YouTube-thumbnail rule no longer
gates featurability.
