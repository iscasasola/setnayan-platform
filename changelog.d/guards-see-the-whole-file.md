## 2026-08-30 · fix(guards): the shared comment stripper had a bigger hole than the regex it replaced

Half the guards in this repo work by reading source text and matching a pattern, so
every one needs the same first step: remove comments, so PROSE ABOUT a banned
construct is not mistaken for the construct. `lib/strip-comments.ts` exists to be
the one honest way to do that. It was not honest.

**Judged by TypeScript's own parser** over the 4,735 files under `app/` + `lib/` +
`components/` + `tests/` — a stripper that removes only comments cannot make a file
that parses stop parsing:

| stripper | files it breaks |
|---|---|
| the naive two-`replace` regex, still copied into 295 guard files | **22** |
| `lib/strip-comments.ts`, as shipped | **330** |
| `lib/strip-comments.ts`, fixed here | **0** |

The shared lexer was **fifteen times worse than the thing it replaced**, in the
silent direction: a guard whose subject was eaten asserts against a blank and passes.

- **Regex literals.** `/foo\//g` ends `\`, `/`, `/`. The lexer read the last two as
  a line comment and blanked the rest of the line. The files most likely to hold
  such a pattern are the guards that scan for banned constructs.
- **An unterminated `/*` ate to end of file.** In a file that COMPILES that opener
  cannot be a comment — the compiler would have refused it — so it is text or data,
  and this codebase writes it constantly: `content-type video/*`, `accept="image/*"`,
  and JSX prose like `(/api/v1/vendor/*)`. That last one is not inside a string, so
  no amount of quote-tracking can see it; refusing to treat a never-closed opener as
  a comment is what handles it.

⚖ The bias is deliberate: leaving a comment standing makes a guard complain about
prose — loud, fixed in minutes. Eating code makes a guard pass while checking
nothing. Where the two trade off, this file now chooses the loud failure.

**What was added**

- `lib/strip-comments.ts` — regex-literal awareness and the unterminated-opener rule.
  `scripts/port-controls.mjs` carries the byte-identical JS twin and is ported too.
- **The parse oracle, as a permanent test.** It runs in both directions: eating code
  fails it, and so does a stripper that "gets safe" by stripping nothing.
- **A parity test between the two copies.** Their docblocks have always ASKED them to
  stay identical; nothing checked, so a fix to one could silently leave the other
  behind — the same shape of defect this module exists to prevent.
- **`scripts/lint-one-comment-stripper.mjs`**, wired into CI as a blocking guard: a
  NEW private stripper fails the build. It strips comments with the real stripper
  before looking, so a docblock about the hazard is not itself a finding.
- **`scripts/one-comment-stripper.baseline.txt`** — the 295 files that already carry
  one. A DEBT, not a decision: the list may only shrink, and an entry whose file has
  been migrated must be deleted in the same change, so it cannot rot into a page
  nobody reads.

**Three files migrated, and the fix proved on the case that started it.** Adding one
JSDoc block to `app/api/papic/guest-capture/route.ts` cut what its guards could see
from 16,218 characters to 6,430 and turned six of them red at once, on a change that
touched none of what they assert. `papic-guest-own-camera` · `papic-capture-has-a-ceiling`
· `guest-cameras-open-when-the-host-says` now use the shared lexer; re-adding that
JSDoc leaves all 30 of their tests green.

⚠ **The other 295 are a programme, not a commit.** They hold 205 distinct shapes, and
changing what a guard SEES changes what it asserts, so each needs its own judgement.
The baseline makes that debt visible and payable instead of invisible.

SPEC IMPACT: None — test infrastructure only, no product behaviour.
