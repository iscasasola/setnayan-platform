## 2026-11-17 · feat(articles): Build 2 of 3 — Articles on the chapter store + the Journal move (in progress)

Build 2 of the owner-approved Find · Build · Book drawing v15 (specs
`prototypes/find_build_onboarding_2026-11-17_fable.html`, DECISION_LOG rows of
2026-11-17). The migration and the Journal import wait for the owner's answer on
the PR before any SQL is written.

- Journal copy fixed per `JOURNAL_CONTENT_AUDIT_2026-11-17.md`: "wedding website"
  → Event Hub; four slugs renamed off "vendor"/"website" (old slugs forward via
  `JOURNAL_SLUG_RENAMES`); the free posts name Event Pro honestly; the
  zero-commission line narrowed to payments to suppliers; the budget CTA links
  the budget-breakdown article.
- `lib/journal-move.ts`: the 91 slugs, the renames, the text-and-links body
  converter (no photos), tags, and the onboarding "Not sure yet" tag → article
  map for Build 1. Held by `lib/journal-move.test.ts`.
- `/dashboard/creator`: new posts carry no video link or teaser (text and links
  only); an older chapter with a video keeps it. "Public posts can appear on
  Google and in AI answers" (`PUBLIC_POSTS_ARE_FINDABLE`) beside the form and the
  Everyone choice.

SPEC IMPACT: None (the corpus rows of 2026-11-17 already describe it).
