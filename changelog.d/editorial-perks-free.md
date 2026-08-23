## 2026-08-23 · feat(editorial): correcting the story we wrote for her is free, and the eyebrows can be read

### 1 · Arranging your own story costs nothing, so it is free

Owner, 2026-08-23, asked what it would cost us: *"keep it free if this costs us
nothing."* **Measured: it costs nothing.** Every perk behind the PRO chip on the
story editor is a PRESENTATION CONTROL over data the couple already owns —
reordering their rows and sections, naming their own moments, choosing which of
their guests' wishes to feature. They ship as `disabled` attributes on buttons:
no render, no storage, no external call, zero marginal cost.

⚠ **AND THE TRAP WAS ALREADY HALF-SPRUNG.** The à-la-carte row has been
`is_active = false` in production with **zero orders ever**, and nothing had
switched the feature on — so the perks were **dark for everyone** who had not
bought the ₱3,500 umbrella. That is "free and retired are the same catalog row
and opposite products", caught one step in. This ships the other half.

🔒 **Narrow by construction.** `EDITORIAL_PRO` has exactly THREE readers — the
buy surface, the editor's `isPro`, and `saveEditorial`'s server-side re-check —
all through `isEditorialProActive`. Every other Event Hub PRO perk, **the
no-watermark included**, gates on a different helper reading
`COUPLE_WEBSITE_PRO`, which is untouched and still sells at ₱3,500. A guard now
pins that separation in both directions, because collapsing the two helpers
would hand the watermark away with nothing thrown.

Two sentences that would have become **false** are corrected: the AI/GEO
document and the Event Hub PRO buy page both listed Editorial PRO as something
that upgrade unlocks. Nothing about the umbrella's price or scope is changed.

⏭ **OWNER DECISION, SURFACED NOT ANSWERED:** Event Hub PRO still sells at ₱3,500
and now buys the cinematic reveal and the removed watermark. Whether it should
say something different is a pricing call.
⚠ And name the cost honestly: he meant RUNNING cost. Forgoing a sold upgrade is
a revenue decision — effectively made, but it is not a no-op.

### 2 · The story page's gold eyebrows failed AA

⚠ **In this repo the slot named `terracotta` is the atelier GOLD `#A9834B`**,
and the action colour lives in the slot named `mulberry` — inherited, backwards,
and the most common colour mistake made here. Measured **3.48:1** on the page
ground, under the 4.5:1 floor for the 12px type these eyebrows are set in:
seven text sites in `editorial-content.tsx` plus one in `living-moments.tsx`.

🔑 **A whole-component call, not a rider** — the file's own docblock names
champagne-gold as a deliberate editorial accent, so fixing one eyebrow would
have made it the odd one out. And the fix **keeps the gold**: `terracotta-700`
is the same family one step deeper. Switching to mulberry or the link slate
would have changed this page's accent — a design reversal wearing a contrast
fix's clothes.

✅ **Measured in BOTH themes**, because a light-only check waves through a token
that flips on dark: **5.02:1** light, **5.17:1** on the candlelight ground.

⛔ Two uses stay on the lighter gold — `aria-hidden` decorative glyphs, which
carry no text, so the 3:1 non-text bar applies and 3.48:1 clears it. The guard
permits exactly those two and is **floored at two**, so removing them turns it
red rather than into a test of nothing.

### Guards

Eight mutations, each measured before → after, **all red**: the free entry
removed · the watermark gate reading the free key · llms.txt selling it again ·
the buy page listing it again · an eyebrow reverting in each file · a decorative
glyph losing its `aria-hidden` · every eyebrow deleted.

🪤 **One guard cried wolf on correct code** — it looked 400 characters past a
function signature and swallowed a neighbouring constant's declaration. Scoped
to the function body. *A guard that cries wolf teaches you to skim past the one
time it is right.*

🪤 **And one fired on the comment that explains the fix** — a JSX block naming
the very token it had just removed. The guard now blanks comments while keeping
line numbers. Third time this week a guard has reported the defect it repaired.

⚠ **Two entitlement tests are retargeted, not relaxed.** They asserted the
handshake rule (*a submitted umbrella order activates nothing*) **using
EDITORIAL_PRO as its subject**. With that free, the assertion would have had to
be flipped to `true` and would then have been testing the free set while its
name still claimed the handshake. The rule keeps a real subject —
`STD_PREMIUM_OPENINGS`, still paid — and the free one is asserted in the
direction that is now true.

SPEC IMPACT: Yes — `DECISION_LOG.md` (2026-08-23): Editorial authoring is free
for every event; the Event Hub PRO umbrella is unchanged and its description no
longer claims it.
