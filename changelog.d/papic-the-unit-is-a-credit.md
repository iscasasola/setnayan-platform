## 2026-08-29 · fix(papic): the unit is a credit everywhere a customer reads it

Owner: *"please make sure to change shots to credits"*, then **"fix it"** when a
sweep of the live site showed the new word stopping at `/papic`.

**Measured before touching anything.** `/pricing` said *shots* **137 times** and
*Snippet* never — and the link that takes a customer there is the one on the
Papic page reading *"See every amount"*. They read one product on one page and a
different vocabulary on the next click. Home, `/features`, `/explore`, `/alaala`
and `/papic/try` all still said *shots* too.

### ⛔ What this deliberately does NOT do

**A photograph is still a shot.** *"Take the shot"*, *"Next shot"*, *"that shot
was too large to save"*, *"who is in a shot"* and the vendor's **shot list** are
correct English and are untouched. Only the CURRENCY meaning moves.

That distinction is the whole job. A blanket rename would have hit **440**
occurrences and corrupted the capture screens; the real currency copy is ~50
strings. The first count I gave the owner (~150) was wrong in both directions —
too low for the raw total, far too high for the actual work.

### How it was done

Rewrites happen **inside string literals only**, never on identifiers — so
`shot.id`, `patchShot`, `papic:out-of-shots` and the rest of the 227 code
fragments that merely contain the letters are unaffected.

**Seventeen of those 137 hits were DATA, not code.** Every ladder line on
`/pricing` (*"₱70 to add 100 shots"*) renders from a catalog title, so no amount
of code editing could have fixed them. Migration `20271182734063` rewrites the
titles and descriptions **by pattern** rather than as seventeen hardcoded
strings: the rows differ only by a number, `replace()` is naturally idempotent
here, and a hardcoded list would need re-typing the next time a rung is added —
which is exactly how the price seed drifted last week.

🔒 Scoped to `PAPIC_GUEST%`. `PAPIC_CAMERA_MINI_DAY` also says *shots* and is
left alone: it is superseded, its title carries its own marker, and rewording a
retired product helps nobody. Dry-run against production in a rolled-back
transaction; the post-condition refuses to commit if any rung still advertises
the old unit.

**A Snippet is named where the clip cost is quoted** — `papicPointCurrencyTerms`
now reads *"a Snippet (10-second video) = 8 credits"*, so every surface reading
that helper gets the word without its own edit.

### 🪤 The rename corrupted three real sentences, and only a review caught them

A rule reading `the shots` → `the credits` is right for money and wrong for
photographs, and it hit three places before anyone would have seen them:

- the photographer answer on `/papic` — *"your photographer is composing the
  **credits** that matter"*, on the page that exists to reassure a couple who
  just paid ₱80,000 for one;
- a comment about image quality — *"on exactly the **credits** that matter most"*;
- a supplier card — *"collect the **credits** they choose to share with you"*.

All three reverted. **No test would have caught any of them** — they are
grammatically fine and every suite stayed green. They were found by reading every
one of the 103 changed contexts and asking, of each, whether the word meant money
or a photograph.

🔑 **That is the real lesson of this rename.** The danger was never missing an
instance; it was changing one that should have stayed. A guard can tell you a
word is absent. It cannot tell you the word you put there means the wrong thing.

### Seven tests pinned the old wording, and every one was updated rather than weakened

Each still asserts exactly what it did — that the currency terms are DERIVED from
the capture constants, that a bucket never promises an exact photo+clip split,
that the fallback tier table mirrors its seed. Only the expected string moved.

🔑 The `mini` display title was already a **hand-applied override** in
`papic-copy-guardrails.test.ts`, under a comment explaining that a display title
is *"product copy the owner may change"* while economics must never drift. That
is precisely the maintenance point this rename needed, and it is why nothing
about that guard had to be relaxed.

11,417 unit · typecheck exit 0 · every blocking lint green · migration dry-run
against production, rolled back.

SPEC IMPACT: The customer-facing unit is a **credit**; a ten-second video is a
**Snippet**. The corpus still says *shots* throughout.
