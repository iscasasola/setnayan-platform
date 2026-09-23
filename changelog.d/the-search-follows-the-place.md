## 2026-09-23 · feat(search): the search searches the place you are standing in

Owner, across one sitting: *"it must follow where they are pressing"* · *"on
events, you want to focus the search on the events of the user"* · *"Discover
access everything accessible from their account and everything public in the
website"* — and the reference that settles the shape: *"this concept is similar
to shopee when you enter a shop, you will only search inside the shop."*

Recorded first in `DECISION_LOG.md` (2026-09-23), because the OPPOSITE rule was
written into `app-rail-shell.tsx` in absolute terms — *"THE SEARCH FOLLOWS WHO
IS LOOKING, NOT WHICH PAGE THEY ARE ON"* — and was why Admin and the guest list
each had to win their own box one at a time instead of the rule just applying.

### One rule, not six cases

`lib/search-scope.ts` resolves the scope from the URL **through the shipped
`activeRailKey`**, not a second path matcher: the places nest (Discover ⊃ Events
⊃ one event ⊃ its guests), so "most specific wins" is exactly the rule the rail
already implements and tests.

🛑 **A scope only narrows when it HAS something to search.** Narrowing the box
to a place with no index makes it *promise* a search that returns nothing —
the defect `public-search-nouns.ts` exists to prevent. Memories, the vendor
shop, inside-an-event and one event's guests are therefore **deliberately
absent**: the rule is agreed for them, the index is not built. `/admin` is
absent for the opposite reason — it already hands the shell its own
`searchSlot`.

### The box announces where it is pointed

The half of the Shopee pattern nobody would infer from "narrow the results".
The placeholder read one hard-coded **"Search events, people, vendors"** on
every screen from Discover to inside a wedding — promising two nouns the index
cannot resolve as rows, hiding the two it answers well, and saying nothing
about which place you were in. It now reads the scope, and the escape row
carries the scope too, so a narrowed box always offers the step out.

### 🔴 Two measured defects this also closes

**Typing "wedding" could not find your wedding.** The index was built from the
RENDERING: the subtitle puts the type through `eventTypeBadge`, which turns
`wedding` into "KASAL" *before* anything is searched. Measured live on
www.setnayan.com signed in as the owner — `?q=wedding` → 24 results, **zero of
his**; `?q=kasal` → 2, **both his**. Every type was affected (BINYAG, KAARAWAN,
ANIBERSARYO); only `debut` survived, by coincidence. The index now reads the
data via `lib/event-vocabulary.ts`, and a guard asserts the badge map and the
term map cannot drift apart.

**The dropdown and Enter disagreed.** Each filtered the same index with its own
copy of the rule and the copies differed — the palette matched `KIND_LABEL`,
the results page did not. `?q=event` → 21 results, **zero of the searcher's
own**. Above that filter sat a comment promising the two were identical: an
intention the code beside it did not implement, with each half green. Both now
call `lib/command-match.ts`.

### ⚠ Two existing guards re-aimed — neither loosened

- `one-top-bar.test.ts` asserted the literal `marketplaceEscapeItem(query)` and
  an exact line of source. The row now carries the scope, so a guard keyed on
  the spelling went red while its property was intact. It now asserts the
  **property** in three parts (built from the live query · appended after the
  filtered list · never run through it).
- `two-bars-two-jobs.test.ts` pulled the top placeholder out of the component
  with a regex for a string literal, and fired its own *"re-aim this guard"*
  message once the words moved into `SEARCH_SCOPES`. It now **imports the real
  module** and checks **every** scope's placeholder, long and short — stronger
  than the single string it checked before.

### Verification

`tsc --noEmit` exit 0 · `npm run lint` exit 0 · `lint:dup-rule` clean ·
**278/278** front-door, launcher and lib guards pass. The three new guards were
**probed in both directions** — dropping "wedding" from the term map, removing
the scope filter, and re-inlining the results page's own haystack each turn
them red; tree restored and re-confirmed clean.

⚠ **Not verified in a browser.** Local `/dashboard` redirects to sign-in and I
do not enter credentials.

### Still to come — named so it is not mistaken for done

Memories, Shop, inside-an-event and Guests have the rule and **no index**, so
they keep the wider scope. Folding the in-page boxes (`guests-search.tsx`,
People's capture line) into the bar is the slice after that.

SPEC IMPACT: `DECISION_LOG.md` — two rows added 2026-09-23 (the rule; People as
two halves of one place).
