## 2026-09-17 · fix(website): a chip tells the truth about empty

The website editor's rail drew a chip beside every row and picked its colour by
comparing the status STRING to a denylist of three literals — grey for exactly
`'Not set'`, `'Off'` and `'Hidden'`, success-green for everything else. So four
statuses meaning "there is nothing here" were painted as achievements:

| chip | what it actually meant |
|---|---|
| `Private` | **nobody at all can view the site** |
| `No schedule` | no schedule blocks are public |
| `0 photos` | the gallery is empty |
| `0 showing` | no sections are showing |

A couple whose wedding site nobody could open saw the same green chip as a couple
who had published theirs.

🔑 **The denylist is the defect, not the four strings.** Adding them to the list
leaves the machine that produced them running: every future empty-state wording is
success-green by default, and the fifth arrives silently. The rule is inverted
instead — a row now SAYS whether it is filled, and the colour follows the claim
rather than the spelling.

`status` becomes a `RowStatus { label, filled }`, built through `done()` / `todo()`.
It is **required, not defaulted, on purpose**: a default would have to guess, and
both guesses are wrong — defaulting to filled recreates this defect exactly, while
defaulting to empty would grey every finished row until somebody noticed. Making it
part of the type means a new row cannot COMPILE without answering, which is the only
version of this that cannot rot.

`Unlisted` stays green: a link-only site is a deliberate, working choice, not an
empty one.

Guarded by `apps/web/lib/a-chip-tells-the-truth-about-empty.test.ts`, which
deliberately does **not** check the four — it checks that the denylist is gone and
cannot come back, which is the only assertion that also covers the fifth. The claim
is EXERCISED against wordings this codebase has never used. Sabotage-checked four
ways, each still parsing and typechecking, count printed before the colour: the
denylist restored in a new spelling · `todo()` returning filled · `Private` declared
done · the two colours swapped.

SPEC IMPACT: None.
