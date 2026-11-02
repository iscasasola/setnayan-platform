## 2026-08-17 · fix(event-hub): the guest rooms speak the event's own word, not "the couple"

**What a person gets.** A guest at a graduation, a birthday, a corporate day or a
trip stops being told about "the couple". The seat pass, the seat finder, the
table map, the gift page, the plus-one welcome, the day-of hub and the recap now
use whatever that kind of event calls the person throwing it — celebrant,
graduate, organiser, host. **A wedding reads byte-identically to before.**

**Why it was wrong.** The Event Hub asked the event type exactly ONE question —
"may this event have a public page at all?" — and never asked it for the WORDS.
Meanwhile all 16 seeded event types have carried a full `terminology` block in
production the whole time. Measured 2026-08-17: ~79 wedding-only words are read
by a guest across the Hub, and nothing in `app/[slug]/**` read `terminology` —
zero call sites.

**The 11 sentences changed** (all bucket 2 — a universal job wearing wedding
clothes, per the owner's 2026-08-17 ruling that wedding-dedicated parts STAY
wedding): `seat/page.tsx` ×2 · `find-seat/page.tsx` ×1 · `find-my-table/page.tsx`
×1 · `pabuya/page.tsx` ×2 (incl. "Pin your cash on the couple", which no earlier
count had caught) · `hub/page.tsx` ×4 · `welcome/page.tsx` ×1. Plus
`recap/page.tsx`, whose hand-typed `!== 'wedding' ? 'event' : 'wedding'` patch —
a third vocabulary being born — now reads the same source as everything else, so
a birthday's recap is a "birthday recap".

**New:** `app/[slug]/_lib/event-words.ts` — the guest tree's single reader of the
per-type organiser noun. Deliberately narrow: it must NEVER be used to neutralise
a part that exists BECAUSE it is a wedding (the two-name masthead, the love story,
the bride's/groom's sides, the cinematic reveals, the tea ceremony). Those keep
every wedding word; hiding them for other types needs a per-block gate that does
not exist yet and is NOT in this PR.

🔒 **The safety property is asserted, not assumed.** `event-words.test.ts` pins
the ten rewritten wedding sentences against frozen literals (duplicated on
purpose — a test that imported them would agree with any edit) and pins the
count, so deleting a pair fails too. 8 tests. **Mutation-proved:** breaking the
organiser lookup → 5 fail; dropping the possessive `s` → 3 fail; swapping the
typographic apostrophe for a straight one → 5 fail; restored → 8 pass. Occurrence
counts printed before and after each sabotage.

⚠ **Found dead, deliberately NOT counted as fixed:** `empty-states.tsx`'s
`photos` plate ("The couple's photos will appear here") has **no caller anywhere**
— `SectionEmptyPlate` is only ever passed `details` and `story`. Rewording a
string no guest can reach would be a fix nobody can see, so it is left with a
comment telling whoever wires it up to take the word from the new helper.

⚠ **Not in this PR, and named rather than silently skipped:** the ~54 wedding
words on the main event page (`page.tsx` + `site-body.tsx`), which is the bulk of
the count; and the per-block event-type gate, which is the largest remaining
piece — today the profile's Save-the-Date and monogram locks are recorded but
unenforced on the guest tree, so a non-wedding created far enough ahead would
render the wedding save-the-date machinery.

`seat/page.tsx`'s local `EventRow` gains `event_type`, which the query already
SELECTed and the type simply never declared. No query changed.

SPEC IMPACT: None. Behaviour for weddings is byte-identical and asserted so;
prod is 3 weddings, 2 simple events and 1 date.
