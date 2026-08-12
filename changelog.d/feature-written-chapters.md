## 2026-08-13 · fix(admin): the Feature button never rendered for a story told in writing

**A fix nobody can reach is no fix.** On 2026-08-12 the server action stopped
refusing to feature a chapter with no YouTube video — but the admin surface
still rendered the Feature control only inside `r.thumbUrl ? (…)`. Every written
story showed a greyed-out ineligible label with **no button at all**, so the
owner could not feature one however correct the action had become.

Found while writing the instructions for where to click.

### Three assumptions in one screen

| line | was | now |
|---|---|---|
| Feature control | rendered only when a YouTube thumb existed | always rendered for an unfeatured row; the action re-asserts every condition |
| row note | declared a thumbnail-less chapter ineligible for the shelf | says it is told in writing and previews the lede the tile will lead with |
| preview chip | `no embed` | `Written` |

The admin row now carries `excerpt`, so the operator can see what the text-led
shelf tile will actually say before committing to feature it — the Feature click
is the moderation review, and reviewing a story you cannot read is not a review.

🔑 **The refusal and the control are two different layers, and lifting one does
not restore the other.** The action was fixed, tested and verified in prod while
the button it enables stayed invisible. Same shape as the route rewrite fixed an
hour earlier: a correct change at one layer, silently undone at another.

🛡 A guard locks the regression, anchored on a POSITIVE assertion first (exactly
one Feature control in the file) so it cannot pass by quietly matching nothing.
Mutation-tested with counts printed: restoring the `: r.thumbUrl ? (` gate
(0 → 1 occurrences) turns it red. The banned phrase check deliberately matches
comments too — and caught this PR's own first draft, where the explanatory
comment quoted the sentence it was retiring.

SPEC IMPACT: None.
