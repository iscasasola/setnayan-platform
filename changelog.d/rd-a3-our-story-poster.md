## 2026-09-29 · feat(prints): the A3 Our Story poster — the couple's Love Story, chapter by chapter, to print and frame

Owner, 2026-09-26 (DECISION_LOG "AN A3 'OUR STORY' POSTER TO PRINT AND FRAME"):
*"is it possible to generate a A3 printable of their stories? so they can print
it and frame it?"* — Stage E of `EVENT_HUB_BUILD_PLAN_2026-09-28.md` ("becomes a
Details print item; reads Love Story from Details").

- **A new print piece, `story-poster`** (`PRINT_PIECES`, A3 297 × 420 mm, cut
  straight), in `PRINT_SET_KEYS` — so it is listed wherever the invitation set
  is listed: Prints & Tickets today, and the Details navigator's "Invitation
  set" group (`lib/maker-details-items.ts` on #6094 reads `PRINT_SET_KEYS`).
- **One Love Story source.** `printStoryChapters` (`lib/love-story-moments.ts`)
  reads `loveStoryScenes` — the couple's moments (or the onboarding words until
  they save one), hidden moments left out, reading order — grouped under their
  chapter names. Nothing is typed twice and nothing is invented (no date → no
  date line).
- **`layoutStoryPoster`** (`lib/print-layout.ts`): the theme's still where it
  puts one, the couple's logo, "Our story", their names and date, then each
  chapter with every moment's date, words and place. Measured like every
  print: one centred column while short, two balanced columns when long, the
  type coming down toward the 6 pt floor, and only then a further sheet — no
  moment is shortened or dropped, nothing passes the safe line
  (`every-print-fits.test.ts` now sweeps it in every theme with a 28-moment
  story, plus a 60-moment one in each still placement). The Event Hub QR rides
  its corner, as on every card.
- **Free / Pro is the print rule already shipped** (`mayServe` / `isProPrint`):
  Classic, Modern and Cyber Neon print print-ready for everyone; a Pro theme is
  a watermarked sample until Event Hub Pro.
- **Never printed blank.** With no Love Story the route refuses the piece (409)
  and leaves it out of the whole set and the sample sheet; the Maker shows its
  card with "Add your Love Story" (→ the Maker's Love Story) and offers no
  download.
- **First-visit tour** `customer_print_story_poster_v1`, mounted after the
  Menu's tour so the two never stack.
- ⚡ **Measuring type got cheaper for every print**: which face draws a
  character and its advance at 1 pt are looked up once per (face, character)
  and scaled, instead of asking opentype per character per draw (a long story
  re-wrapped at every size took 26 s for 28 moments; now ~1 s).

⚠ Owner to confirm: the poster is **words only** — Love Story photos (Pro) are
not placed on it yet, so the "may print blurry" resolution warning in the
DECISION_LOG row has nothing to warn about until photos are added. The
DECISION_LOG row names the Post Event story / Kwento Magazine; the build plan
(2026-09-28) and this build read the Love Story instead.

SPEC IMPACT: None — implements the 2026-09-26 DECISION_LOG row; the two
deviations above are flagged for the owner, not decided.
