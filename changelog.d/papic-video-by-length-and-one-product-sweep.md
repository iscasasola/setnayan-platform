## 2026-08-11 · feat(papic): a video costs what its length costs — and the retired product leaves the building

Three owner asks in one change: price video by length, delete Papic One from onboarding rather than
rewriting around it, and fix the public pages.

### 1 · A video is billed by its length

Owner's table: **1–2s = 2 · 3s = 3 · 4–6s = 5 · 7–10s = 8**. A photo stays 1.

**Nothing got more expensive** — ten seconds still costs 8, exactly what every clip cost before, so
this is purely a cut for short clips. It is also a real behaviour change: until now there was no
reason to shoot short, because a 2-second clip and a 10-second clip cost the same.

🔑 **AN UNMEASURED CLIP COSTS THE MOST, NEVER THE LEAST.** The duration reaches the server as a
number the *browser* stamped — `app/papic/actions.ts` already called it "spoofable by a hostile
direct caller". Now that the price depends on it, the only safe failure direction is expensive:
null, NaN, negative, zero and absent all bill the top band. Failing cheap would hand every client a
discount for sending nothing.

⚠ **THE PRESIGN SEAM GATES ON THE CHEAPEST BAND, NOT THE DEAREST**, and that is a decision rather
than a rounding choice. No file exists at presign time, so a length is unknowable there; gating at
the ceiling would refuse a URL to a shooter with 3 credits for a 2-credit clip they can plainly
afford. Refusing a shot somebody CAN pay for is a user-facing defect; the cost is a rare orphan
object, and the authoritative reserve still refuses it. That seam's stated job has always been
"no URL ⇒ no orphan bytes", never "decide the price".

🔒 **STORAGE STAYS FLAT, ON PURPOSE.** `preservationUnits` bills from a row carrying `is_clip` and
**no duration** — a kept video's length is unreadable, so billing it at the cheap band would
under-charge every video over three seconds. Given its own constant
(`PAPIC_PRESERVATION_UNITS_PER_CLIP`) rather than left to fall out of `papicCaptureCost('clip')`
returning the ceiling for a missing argument: that would make a ₱500/yr pricing decision something a
reader infers from a default. **Both** preservation counters now say it the same way — the second
one (`papic-gallery.ts`) was found by an adversarial sweep, not by me.

⚠ **ONE HONEST WART IN THE OWNER'S TABLE, LEFT ALONE AND RECORDED:** 4s costs 5, but 2s+2s costs 4.
One credit, for a worse video and the fiddle of stopping mid-shot. The test tolerates exactly that
one case and fails if a second ever appears or the gap grows.

🚨 **A SECOND CLIP CONSTANT EXISTED AND HAD BEEN WRONG SINCE 2026-07-29.** `vendor-papic-tier.ts`
set `clip: 7` while its own docblock said "1×10s clip = 8 pts" **twice** and claimed to mirror the
couple pool. It drifted when the owner moved the couple's clip 7 → 8 and nothing pointed the two at
each other. **Its test pinned 7 as well** — a second copy of the mistake, agreeing with the bug
through weeks of green CI. Both now DERIVE. Vendor clips stay flat (different meter, and that route
has no duration in hand).

### 2 · Papic One is deleted from onboarding

Deletion, not a rewrite, exactly as the owner said: the stepper, the rung, the camera count, the two
hidden form fields, the order line, the seat provisioning and its fail-closed unwind, and the `one`
product view. 🔑 **The unwind went with it** — that complexity was inherent to SELLING a camera, and
with nothing provisioned at commit there is no partial state to detect.

**The card is removed, not emptied.** It would have emptied itself (no active rung, zero free
points), but "renders as an empty card" is not "is not offered": a product heading with nothing
under it, on the screen where a couple chooses what to pay for, reads as a broken page.

⚠ **A tab opened before the change still posts the old fields.** They are dropped rather than
carried — the couple's real pick is untouched, and a payload naming only cameras buys nothing.
That is now the single camera assertion this module keeps.

### 3 · The public pages

🚨 **`/pricing` LISTED ITS PAPIC LADDER BY HAND AND WAS ALREADY WRONG.** A hardcoded list of three
service codes (the 3,000 / 6,000 / 10,000 rungs) could never show the two the owner added on
2026-08-11 and still named the one he retired — so the **public pricing page advertised a ladder
that no longer existed**, silently. Derived from the live catalog now. Its label strip had also
stopped matching the renamed titles, so the page was rendering "₱1,000 to Papic — add 3,000 shots".

🚨 **RETIRING EVERY ROW RE-ARMED A SEED.** `fetchPapicOneTiers` treated `data.length === 0` as
"unreadable" and answered with `FALLBACK_ONE_TIERS` — a live-looking rung, on a path the **guest buy
action** reads. Deactivating the last row would have walked the retired product back onto sale at a
price from a code constant. A read ERROR now falls back; an empty-but-readable table returns `[]`.
This is the "a denied read and an empty read are the same value" trap, in the direction that sells
something.

`/papic` no longer names two products. The headings name the *behaviour* — "give a camera its own
shots" / "let the whole room shoot" — because a product name there is what taught people there were
two things to buy.

### Verification

`papic-clip-cost.test.ts` (12) — mutation-tested four ways: an unknown duration billing cheap,
rounding down, a band edge creeping one second, storage following the cheap band. Every sabotage
verified applied and every restore verified by checksum. `papic-one.test.ts` gains the seed-re-arm
regression (mutation-tested). Typecheck clean · all 23 CI lint commands pass · port baseline green.

⏭ **Still carrying the old names:** the features page (EN + Tagalog), the help centre articles,
`llms.txt`, and the pricing estimator. Copy only — no prices or behaviour.

SPEC IMPACT: `DECISION_LOG.md` (2026-08-11 · video priced by length; supersedes the flat 8) ·
corpus `CLAUDE.md` currency line (`1 photo = 1 pt · 10-sec clip = 8 pts`).
