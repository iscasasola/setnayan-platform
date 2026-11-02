## 2026-08-26 · fix(admin): what an adversarial audit of my own seven PRs found

Six independent hunters over the seven PRs shipped today, every candidate then
attacked by a skeptic told to kill it. **33 candidates → 9 survived, 15 refuted**
— and **every survivor was confirmed by executing it**, not by reading. All nine
were mine, from today.

### 🚨 The phone blanked on the sentences this feature exists for
`keepByTokens` required **every** word (an AND) while the palette keeps a row on
**any** word scoring ≥15 (an OR). Measured over the real 78-card *All surfaces*
set: *"take me to the pricing for papic services"* showed **0 cards against the
laptop's 10**, and *"i want to add a new category on the taxonomy service"*
**0 against 16** — the two sentences quoted in the PR that shipped it, blanked on
the device the owner reports from. ⚠ And `/admin/more` is `desktopVisible`, so
the same blank was reachable on a laptop.

🪤 **The parity guard could not catch it.** It asked only whether the laptop's
top hit was *present* in the phone's set, over four queries that pass either way.
It now compares the **sets**, over the owner's own sentences.

### 🚨 The box advertised an example that opened the wrong page
Its placeholder reads *"papic prices", "add a category"* — and **"add a category"
opened App Performance**, whose haystack carries *"add expense … category"* from
one job. Three destinations tied at coverage 1.0 and mean 15, so the **alphabet**
decided, and `sel` starts at 0 so Enter went straight there. The Ask escape was
hidden too, because `hits.length > 0`.

Fixed with a **frequency tie-break** — how often a word appears, not merely
whether — after whole/coverage/mean. ⚠ **Multi-word only, and the guard taught me
that:** applied everywhere it re-ordered single-word results and broke the one
guarantee this file rests on. `EVERY single word the admin knows returns exactly
what it returned before` caught it in one run.

🛡 New guard: **the examples are read out of the component**, never re-typed — a
hard-coded copy stops covering the box the moment somebody edits the placeholder,
which is exactly when a new example goes unchecked.

### The rest
- **An apostrophe made the box say something false** — *"vendor's payouts"*
  answered correctly and printed *"No page has the word 'vendor's'"* above it,
  about a word 26 destinations contain. Only the **report** is corrected; the
  splitter is shared with the public site search. Phones type the curly U+2019,
  which is how it reaches somebody who cannot see what is wrong. The stop-word
  docblock now names **which** apostrophe its worked example needs.
- **The recall counter was two bugs in one line** — `void <builder>` never issues
  the request (a PostgREST builder only fires on `.then()`), and it assigned the
  literal `1`, so even had it run the count could never reach 2.
- **The assistant could never return "My account"** — the one curated menu
  destination outside `/admin`, discarded by a bare prefix check every time the
  model picked it. And the old validator **trusted a list the browser sent**,
  which the docblock beside it claimed it did not. The server now rebuilds the
  destination list itself; the parameter is inert.
- **A guard exempted 252 of its 284 jobs** — its exception set was "the menu file
  quotes this address" (nearly every page) rather than "a flag is holding this
  page back" (one). Dropping three pages' worth of job words passed the old
  version; it goes red now.
- The catalog read moved **below** the admin gate — it changed no outcome, but
  doing privileged work for a stranger is the wrong default to leave lying around.

**Guards** — 5 new assertions, 9 mutations, all RED (two only after the guards
that should have caught them were written). 🪤 One extractor caught the owner's
quote out of a **docblock** — strip comments before matching, the house rule,
paid for again.

SPEC IMPACT: None.
