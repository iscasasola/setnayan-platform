## 2026-09-13 · fix(privacy): a private celebration's share card is no longer public

ST-9. `/api/og/realstory-slug/[slug]` selected the event by slug with the ADMIN
client and never read `landing_page_visibility` at all. Its only redirect was
"no such event". Measured on production, unauthenticated:

    papic-pool-test-simple-event   PRIVATE   → 200 image/jpeg 29,941 b
    zelda-ben                      unlisted  → 200 image/jpeg 22,026 b
    cale-ice                       public    → 200            (correct)
    qqqq-definitely-not-real-9931  —         → 302

The card draws the monogram, the couple's NAMES, the exact DATE and
"INVITATION". `private` is the strictest setting a couple can choose.

TWO HARMS, not one. Identity and date disclosure to anyone who guesses a slug —
and slugs are guessable from two first names. And 200-versus-302 is an EXISTENCE
ORACLE: it says which celebrations are real before the image says whose.

- A sealed celebration now returns the SAME 302 to the same brand image as a slug
  that was never registered, folded into ONE branch. Not a 403 — a 403 closes the
  disclosure and keeps the oracle.
- `/api/og/recap/[slug]` had the identical shape and returned the fallback only
  because `isRecapPublished` happened to decline. The leak was LATENT, not
  absent: the moment a private couple published a recap it would have gone live.
  Sealed BEFORE that gate, so the answer does not depend on an unrelated one.
- `/api/og/v/[slug]` already checked visibility and is the model. Untouched.

⚖ `unlisted` STILL RENDERS — owner ruling 2026-09-13, "unlisted should still
render the card". Unlisted means not indexed but shareable by link; sealing it
would break a feature the couple chose. The accepted consequence, stated rather
than engineered around: unlisted celebrations remain ENUMERABLE and their card
carries names and date. That trade was taken knowingly, for unlisted only.

🔑 `invited_accounts` WAS LEAKING TOO, and no report of this bug mentioned it.
The fix asks `openToStrangers` — the existing allow-list — instead of testing
`=== 'private'`. `lib/event-visibility.ts` exists because an exclusion test over
a growing set admits every future member by default; its docblock records that
`!== 'private'` once made `invited_accounts` "completely public everywhere,
instantly" across 31 call sites. Sealing only `private` would have repeated it.

It also asks `resolveEffectiveVisibility`, not the raw column, so a couple whose
scheduled launch moment has passed still gets a card before anything writes the row.

SPEC IMPACT: None — the visibility semantics are already the recorded decisions
(2026-08-15 four audiences, 2026-09-13 unlisted ruling). This makes two routes
that never asked the question ask it.
