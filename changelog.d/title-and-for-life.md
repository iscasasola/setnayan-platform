## 2026-08-17 · fix(copy): the brand is appended once, and "for life" matches the ruling

### 1 · The doubled tab title

`app/layout.tsx` sets `title: { template: '%s · Setnayan' }`, so Next appends the
brand to every CHILD segment's title. 94 page titles carried it too, so tabs,
Google results and share cards read **"Pricing · Setnayan · Setnayan"**.

**Measured live before touching anything** — `/pricing`, `/terms` and `/explore`
all rendered the doubled form on www.setnayan.com.

🔑 **THE ROOT PAGE IS EXEMPT AND ONLY MEASUREMENT SHOWS IT.** `app/page.tsx`
shares the root SEGMENT with the layout declaring the template, so Next does not
template it: `/` rendered with NO suffix while its siblings doubled. Reasoning
from the docs gets this backwards, and "fixing" it would have broken the
homepage title.

🔒 Two titles are the literal string "Setnayan" as a PRIVACY control on hidden
profiles — they must not confirm a slug belongs to anyone. Those now use
`title: { absolute: … }`, which bypasses the template instead of being reworded.

⚠ **THE FIRST CUT OF THE GUARD CRIED WOLF ON 57 CORRECT FILES.** It forbade the
brand anywhere in a title and flagged "Download Setnayan for Mac", "How Setnayan
works", "Claim your Setnayan profile". Obeying it would have produced "How
works". It now matches only the two real shapes — a redundant brand SUFFIX, and
a title that is only the brand. Mutation-checked in three directions: suffix
reintroduced → RED · template removed → RED (positive control) · natural brand
phrase → stays GREEN.

### 2 · "Keep it forever" / "for life"

The ruling (owner 2026-08-07, re-confirmed 2026-08-10) is **free for 5 years,
compressed, then a paid option — and nothing is ever deleted**. `/privacy` was
corrected months ago and already publishes it. The front door, the Google result
and every share card still promised forever.

Owner chose the replacement: **"— and never lose a photo"** for the title, and
"match all five".

🔑 **IT WAS NOT FIVE SITES. IT WAS TWENTY-SIX.** Sixteen in metadata/JSON-LD and
front-door copy, then ten more in Alaala, the guest site, onboarding, pabuya,
About and Our Story. Elsewhere the over-claim is removed rather than replaced —
deleting a promise we cannot keep, without inventing a new one.

⚖ **AND SOME "forever" IS CORRECT AND IS UNTOUCHED** — the Pakanta song really is
theirs forever, the Drive folder really is theirs, planning really is ₱0 forever,
and the vendor tier really is free forever. 25 such uses were read and kept.

🚨 One genuine over-claim found on the way: the paid preservation card said
"Keep your full-res **forever**" — it is an annual paid option. Now "Keep your
full-res originals".

SPEC IMPACT: None — the ruling is unchanged; the copy now matches it.
