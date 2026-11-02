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

### Then an adversarial sweep over 10 chapter surfaces found 6 more

Run because the button proved the assumption lived in more than one layer. 24
agents, every candidate attacked by a refuter told to default to "not real".
Three were in the same screen; three were user-facing elsewhere.

**The creator was still told to add a video.** Their own dashboard rendered a
dashed box on every video-less chapter — *"No embed yet — paste your finished
edit below, then publish"* — **including already-published ones**, so a finished
written story read as permanently unfinished and blocked. The empty state said
the same. **The publish wall, rebuilt in copy after it was removed from the
code.** A video is optional; its absence needs no warning.

**Public pages advertised writing as video.** The profile timeline hardcoded
*"Watch the chapter"* on every card, and the `/realstories` cross-rail chip
hardcoded *"Watch the storyteller's cut"* — both now follow what the chapter
actually is. The cut loader carries `hasVideo` so the label cannot drift again.

**Watch/Read was keyed on the thumbnail, not the video.** Only YouTube yields a
derivable thumb, so an **Instagram or TikTok chapter — a real video — was
labelled "Read" with a book icon.** Now keyed on whether a video exists at all.

**The text hero had no floor and a collision.** With neither thumbnail nor
excerpt it rendered a blank gradient box — no image, no text, nothing — and the
opaque Read/Watch pill was painted over the excerpt's last line. Both fixed.

**Two more false statements on the admin screen**, beyond the button: the header
explainer asserted *"only chapters with a YouTube embed are featurable"* as the
standing rule, and the module docblock claimed *"the action refuses them
serverside too"* — the stated justification a later reader would have used to
put the gate back. 🔑 **A stale comment kept the face-tagging switch shut for
seven weeks; this one hid a button.**
