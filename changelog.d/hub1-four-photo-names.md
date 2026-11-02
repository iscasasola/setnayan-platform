## 2026-08-28 · fix(event hub): four photo features stop answering to each other's names

A host setting up their Event Hub met four photo features named one word apart, and
one of them answered to five different names across four screens.

**Renamed — HOST-FACING ONLY.** Renaming is a deletion to anyone who knew the old
name, so the old ones are written down here:

| was | is now |
|---|---|
| `Photo moments` | **Camera cues** |
| `Our photos` · `Photo gallery` · `Your photos` · `Your own gallery` · `Gallery photos` | **Photos you add** |
| `Your photos` (the guest promise card) | **Each guest's own photos** |

Two of the five names the host's own gallery answered to were the GUEST widget's
name. `Photos of you` — where a guest actually looks at theirs — is guest-facing
only and is deliberately unchanged.

**The guest-facing headings are untouched.** On the event page "Our photos" (the
host's voice) beside "Your photos" (the reader's own) is addressed to one person
and reads correctly. The collision was only ever in the host's chair.

**Kind-neutral.** These sit in a STATIC catalog — not resolved per event — so
"engagement or pre-wedding shots" was shown to a birthday, a reunion and a wake.
The three photo descriptions now name no occasion.

**Deleted: an empty state no guest could reach.** `SectionEmptyPlate`'s `photos`
kind had no call site anywhere and still read "The couple's photos will appear
here." It had been carried since 2026-08-17 with a note saying so. A plate nobody
can reach is not an empty state, so it is deleted rather than reworded, and its
stale exemption comes out of the S13 bill with it.

**The live photo wall renders in two places on purpose** — the event page and the
Live hub, plus the freshness feed — and that is not a defect: a guest needs it in
both. What matters is that they never drift apart on the host's one on/off
question. The existing guard enumerated those three files BY HAND; the set is now
DERIVED from the guest tree, with a floor, so a fourth surface fails on the day it
is written and a surface that stops serving the wall fails too.

⚠ **TEXTUAL COLLISION WITH OPEN PR #4929** (`claude/the-hub-speaks-every-event`),
which edits the same three catalog rows to add a per-noun `describe()`. Whichever
merges second rebases. **The resolution is BOTH:** keep #4929's `describe(noun)`
mechanism and these labels; the base descriptions here already carry no wedding
word, so its guard and this one are both satisfied.

⛔ **"Couple Website PRO" is NOT retitled here.** It is genuinely still titled that
in production (₱3,500, active), and the owner's own price sheet already retitles it
to "Event Hub Pro" in open PR #4925. Doing it here would collide with his.

Guards: `lib/the-four-photo-names.test.ts` (4 rules — pairwise distinct, no shared
first word, no catalog-wide collision, no retired name reaching a host, no
wedding-only word) and the derived-set rule in `lib/live-wall-guest-mirror.test.ts`.
Six mutations, occurrence counts printed before → after, all six red. Full unit
suite 10,598 tests green.

SPEC IMPACT: None — copy only. No new screens, no schema, no new widget types.
