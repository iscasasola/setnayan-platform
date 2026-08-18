## 2026-08-18 · fix(privacy): withdrawing photo consent blurs and keeps, instead of hiding

Owner ruling 2026-08-17, confirmed with the trade-off on the table 2026-08-18.

**What a person experiences:** a guest who opts out of photos no longer takes the whole photo
down with them. The picture stays on the public event page with **every face blurred into it**;
the couple's own album is untouched and unblurred.

⚠ **THE BLUR IS ALL FACES, NOT ONE — and the owner chose that knowingly.** `lib/face-blur.ts`
blurs every detected face; there is no per-person targeting and none is possible until face
recognition runs and guests enrol (prod: recognition off on every event, **0** enrolments). So a
table of ten with one opt-out renders as ten blurred faces. The alternative on the table was
keeping today's behaviour — the photo vanishing entirely — which serves nobody. **Do not
"improve" this into a partial blur without re-asking.**

⚖ **MONOTONE BY CONSTRUCTION, which is what makes it safe to ship.** The gate can only ever show
LESS of the original than before, never more: not vetoed → the original · vetoed with a bake →
the blurred stand-in (previously nothing) · vetoed without a bake → nothing · veto unresolved →
nothing. **No face that is hidden today becomes visible.** The softening only turns *nothing*
into *blurred*, and a test walks all 8 input combinations asserting the original never escapes.

🔑 **ONE GATE, NOT A CHECK REPEATED TEN TIMES.** `data.ts` consulted the veto in **ten** places
and each dropped the row independently. Teaching ten sites the new "…unless a blurred copy
exists" rule is ten chances to forget, and the eleventh surface makes eleven — so the rule lives
in `publicKeyForCapture()` and a guard fails if a raw veto check reappears. Same reasoning as the
guest photo-wall mirror.

⚖ **ONE SITE DELIBERATELY KEEPS THE OLD DROP: the hero.** The ruling exists so a photo is not
deleted — it still appears, blurred, in the gallery and timeline. An all-faces-blurred photograph
is not a thing to open a wedding recap with, and softening there would gain no photo, only a
worse front door. The guard permits exactly one raw check and asserts it is that one.

🔑 **THE RULING WOULD HAVE SILENTLY NOT APPLIED TO MOST EVENTS.** Blurring was built as a venue-wall
feature and its bake is gated on the `LIVE_WALL` SKU. Withdrawal blur governs the **public event
page**, which no SKU covers — so leaving that gate in place would have meant every event without
a wall keeps hiding photos forever, i.e. no change at all. The bake now counts withdrawn-consent
guests and **skips the SKU gate for them**; a privacy obligation is not a purchased feature. The
two counts are read separately on purpose: an `.or()` cannot tell which condition fired, and the
SKU rule applies to one and not the other.

🛡 **4 mutations, each measured by occurrence count, all RED:** a vetoed photo falling back to its
original (1→0) · the unresolved-veto fail-closed removed (1→0) · one public read reverting to a
raw drop (1→2) · the wall SKU gate returning for withdrawals (1→0).

🪤 **The suite reported "# tests 0 … # fail 0" twice before it ran anything.** The path contains
`[slug]`, which the test runner reads as a glob character class, so it matched nothing and exited
green — including through a `find`-provided path. It only runs from **inside** the directory.
*A search that cannot match is not a negative result.*

📊 Prod today: **0 guests have opted out** of 39, so nothing visible changes on any live page.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-18 (the all-faces trade-off and the hero exception).
No schema change, no migration, no price or SKU change.
