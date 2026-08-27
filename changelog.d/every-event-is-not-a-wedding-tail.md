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
which is how copy is normally written (`{event.display_name} …their wedding…`,
`<Perk>…couples…</Perk>`), and its inner alternation was spelt SINGULAR with a
trailing `\b`, so `couples` and `weddings` were invisible. Two independent
failures, either alone sufficient. The anchor is now tried on the raw line, on
the line with interpolations removed, and on the line with JSX tags removed;
plurals are spelt once and shared. Measured over all 128 files of that tree: the
widened rule surfaces EXACTLY ONE line the old rule missed — the recap sentence
— and the non-exempt offender count stays 0. No baseline to pay down.

**A NEW RULE, AND IT DOES NOT NEED A LIST.** `doors-are-designed.test.ts` gains
"no door tells a mourner they are looking at a wedding", DERIVING its file set
from the DoorShell import (23 files, against the 21 hand-listed in the same
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

**🛡 MUTATIONS.** Every assertion was broken on purpose with the occurrence
count printed before → after; details in the PR body. The apostrophe repair was
proved in all three spellings separately, because a repaired guard that still
cannot fail is a second decoration reading as a fix.
🪤 And `npx tsc --noEmit` printed `errors=0` while exiting **134** on this
machine — the documented crash — until the heap was raised; at
`--max-old-space-size=8192` it is `errors=0 EXIT=0`. Print the exit code beside
the count.

SPEC IMPACT: None. No schema, no migration, no price, no owner-locked decision
moves. Every wedding surface reads byte-identically.
