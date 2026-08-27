## 2026-08-27 · fix(words): the tail of "every event is a wedding" — two emailed doors, a song credit, and two guards that could not match

The last of the class PRs #4890 · #4891 · #4896 · #4897 opened. Four reported
findings; one was investigated first and turned out to be REAL but for a
different reason than the audit gave, and the sweep written to prove it found a
fifth surface nobody had named.

**1 · THE CO-HOST INVITATION SAID "Wedding date:" ON EVERY EVENT TYPE.**
`app/host/accept/[token]/page.tsx` rendered a hardcoded `Wedding date: …` and
fell back to the literal `'a wedding'` for an event with no display name. This
door is opened SIGNED OUT, from an emailed link: a family arranging a wake
invites an aunt as co-host, and she reads that her brother's funeral is a
wedding. Both sentences now come from `eventWordsForEvent(invite.event_id)` —
the SERVICE-ROLE resolver, which is load-bearing here and not a detail: `public.events`
has no SELECT policy admitting `anon`, so the cookie-scoped read this resolver
used to make answered WEDDING for every signed-out visitor (PR #4897).
🔒 A wedding reads byte-identically (`eventWord` is 'wedding'). 🔒 No fallback
introduces "host" — the funeral's noun is `family` and its event word is `wake`.

**2 · AND THE SWEEP FOUND A DOOR NOBODY HAD REPORTED — THE SUPPLIER'S.**
`app/vendor/claim/[token]/page.tsx` rendered "They're planning their **wedding**
on 3 September 2026" in three places plus a `Couple invite` eyebrow, to a
supplier opening an emailed claim link. A funeral home booked by a family
arranging a wake read that sentence about the funeral. The invite has always
carried `event_id`, so the type was always resolvable — nothing ever asked.
Found by DERIVING the door set from the DoorShell import rather than reading the
files named in the brief.
⚖ An ADMIN-SOURCE invite carries no event at all and now says "event" where it
used to assert a wedding it had no evidence for.

**3 · A NON-WEDDING'S CUSTOM SONG WAS CREDITED AS A WEDDING SONG.**
`app/[slug]/_components/editorial/data.ts` fell back to `'Their wedding song'`,
and that fallback ALWAYS fired for a non-wedding: its alternative is
`love_story.anchors.song`, a wedding-shaped field a birthday or a debut never
carries. So any other celebration that bought a Pakanta song had it credited to
every guest reading their recap as a wedding song. The event word was already
resolved a few hundred lines above in the same function.

**4 · THE PUBLIC RECAP — CONFIRMED, AND THE STATED REASON WAS WRONG TWICE.**
The page's own comments said "generic profiles disable it, so non-weddings keep
the no-index stub". **That is false.** Migration `20270804110223` added `website`
to EVERY seeded type ("unlock all now", 2026-07-12) and `20271102084500` re-adds
it to anything carrying `day_of`/`gallery`; `GENERIC_PROFILE` and
`FUNERAL_PROFILE` both list it. So the surface gate refuses NOTHING and every
event type renders this page. The reach is real too:
`app/[slug]/hub/page.tsx:436` sets the recap link on `isPost` alone — no publish
check, no type check — so a birthday's guests tap "See the recap gallery" after
the day and read *"…hasn't published their **wedding** recap."* Now resolved
from the event word; both false comments are corrected in place.

**5 · TWO GUARDS THAT COULD NOT MATCH, AND THEY STACKED.**
· `the-couple-is-not-every-host.test.ts` searched for `the couple’s` — the CURLY
character U+2019 — while the string it was written to condemn was
`the couple&rsquo;s`, the HTML ENTITY. Measured against the pre-fix source at
`87edd2fc7^`: **curly 0 · straight 0 · entity 1**. The guard scored ZERO on the
exact source it condemned and reported a pass. The entity is not an oddity, it
is the house style — `react/no-unescaped-entities` makes a bare `'` in JSX a
lint error, so the one spelling the needle knew was the one least likely to be
typed. Every spelling now normalises to one before counting.
· `s13-is-finished.test.ts` exempted `recap/page.tsx` with the reason "an import
of the Pro-tier helper, not rendered text" — false; the same file rendered the
sentence above. **AND THE DETECTOR COULD NOT HAVE SEEN IT EITHER.** Its
`^[^<>{}=(]*` anchor fails at character zero on a line opening with `{` or `<`,
which is how copy is normally written, and its inner alternation was spelt
SINGULAR with a trailing `\b`, so `couples` and `weddings` were invisible. Two
independent failures, either alone sufficient. Proved on the predicates
themselves, in isolation, rather than by running the old guard (removing the
exemption exposes the file's IMPORT line, so that control goes red for the wrong
reason and proves nothing):

| line | old | new |
|---|---|---|
| `{event.display_name} hasn&rsquo;t published their wedding recap.` | **false** | true |
| `<Perk>Marketplace exposure to other PH couples</Perk>` | **false** | true |
| `hasn&rsquo;t published their wedding recap.` (positive control) | true | true |

The anchor is now tried on the raw line, on the line with interpolations
removed, and on the line with JSX tags removed; plurals are spelt once and
shared. Measured over all 128 files of that tree: the widened rule surfaces
EXACTLY ONE line the old rule missed — the recap sentence — and the non-exempt
offender count stays 0. No baseline to pay down.

**🪤 AND THE FIRST CUT OF MY OWN FIX REPRODUCED THE DISEASE IT WAS FIXING.** It
kept the FILE exemption for `recap/page.tsx` and merely rewrote its reason to be
true — which quietly removed the file from the new claim-check, whose subjects
are derived from the reasons that say "not rendered text". Reverting the recap
sentence then left the guard **GREEN**: the page was unguarded a second time, by
the very commit repairing it. Only the mutation run found it; review would not
have. The exemption is now a LINE pardon — the import line and nothing else —
so the rendered stand-in sits back under the main scan where it always belonged,
and a second mutation on a DIFFERENT line of that same file confirms the pardon
does not spread. **When one line needs pardoning, pardon the line.**

**A NEW RULE, AND IT DOES NOT NEED A LIST.** `doors-are-designed.test.ts` gains
"no door tells a mourner they are looking at a wedding", DERIVING its file set
from the DoorShell import (23 files, against the 20 hand-listed in the same
file — whose own docblock already says *a hand-enumerated list is a list of the
doors you thought of*, having missed three real doors). It has a FLOOR, so a
sweep that stops matching FAILS instead of reading as a clean pass. Its bill is
keyed on a LINE, not a file — the point of this whole commit: a file-level
exemption blinds a guard to everything in the file, which is exactly how the
recap sentence lived behind a true statement about an import. And
`s13-is-finished.test.ts` gains a check that DERIVES its subjects from the
exemption REASONS: any pardon claiming "not rendered text" is re-checked against
the file, with its own floor.

**⚖ SURFACED, NOT CHANGED** — four lines pardoned with reasons: "Marketplace
exposure to other PH couples", "Chat with couples in-app", "Couples browsing the
marketplace" and the password page's "One account for couples planning their
wedding". These describe SETNAYAN'S CUSTOMER BASE, not the reader's own event.
Whether Setnayan still calls its customers "couples" now that it serves sixteen
event types is positioning and the owner's call, not a typo fix.

**⏭ FOUND, NOT FIXED, AND SAID OUT LOUD.** `app/[slug]/hub/page.tsx:436`
advertises "See the recap gallery" with no publication check, while its sibling
`app/[slug]/_lib/room-links.ts:130` shows the album ONLY when published — two
surfaces in one tree disagreeing about the same door. It is a soft dead end on
every event type, weddings included; gating it costs a new read on a hot page
and changes wedding behaviour, so it is reported rather than bundled into a
words fix. The WORDS were the defect and they are fixed.
Also unchanged: `ROLE_SUBTYPE_LABEL` in `lib/event-moderators.ts` is a
wedding-shaped co-host role list (Bride · Groom · Ninong · Maid of honor) shown
on the same invitation door — a role-set build, not a noun swap.
**And a SIXTH instance of the class, found on the way out and deliberately left
for its own PR:** `lib/inquiry-mask.ts`'s `inquiryPlaceholderLabel` renders
*"A couple planning a funeral in Manila"* to a supplier — the event type is right
there in the same function and only the article uses it. That module is
DEPENDENCY-FREE by design, so making it type-aware means threading an organiser
noun through **6 call sites** (the supplier's messages, bookings and overview
card, plus two admin demo screens). A design change with callers, not a word swap.
Finally, with the nouns fixed the VERB is still celebratory on both doors — a wake
now reads *"Help plan Lolo Pedro's Wake"*. `EventWords` already carries `solemn`
and the tree already branches on it elsewhere, so a solemn arm is cheap; it is not
a wedding word and was not what was asked for, so it is reported, not slipped in.

**🪤 AND FIXING THE NOUN BROKE THE GRAMMAR — caught by RENDERING the sentence,
not by reading it.** The co-host door carried the literal "a wedding". Replacing
it with `a ${w.eventWord}` reads correctly for the two nouns anyone looks at —
"a wedding", "a wake" — and **"a event"** for the generic profile, "a anniversary"
for an anniversary. It was only visible after printing the finished sentence for
all three profiles. **The moment a noun stops being hardcoded, its GRAMMAR stops
being hardcoded with it.** `articleFor` now lives in `event-words.ts` beside
`possessiveOf`, which exists for exactly the same reason ('parents' → 'parents’').

**🛡 MUTATIONS — 16, ALL RED, EVERY ONE MEASURED.** Each sabotage printed its
occurrence count before → after (all 1 → 0, so all landed), and the exit code
was printed beside the TAP summary. Backups were keyed on the FULL PATH and
restored from those backups, never `git checkout --`. Baseline was proved green
first. The apostrophe repair was proved in all three spellings SEPARATELY —
entity, curly and straight — because a repaired guard that still cannot fail is
a second decoration reading as a fix. Both new floors were broken on purpose and
both went red; both bills were made stale on purpose and both went red.
🪤 And a note that corrects itself rather than a repo bug: running `npx tsc
--noEmit` DIRECTLY printed `errors=0` while exiting **134**, which reads exactly
like the documented crash. It is not one — `pnpm typecheck` sets
`NODE_OPTIONS=--max-old-space-size=7168`, and bypassing the repo's own script
loses it. Through the real script: `errors=0 EXIT=0`; `pnpm lint` EXIT=0 with no
new warnings. **Print the exit code beside the count, and run the repo's script
rather than the tool it wraps.**

SPEC IMPACT: None. No schema, no migration, no price, no owner-locked decision
moves. Every wedding surface reads byte-identically.
