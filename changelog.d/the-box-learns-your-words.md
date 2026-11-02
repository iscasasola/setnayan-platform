## 2026-08-26 · feat(admin): the box answers words nobody listed — once, then free

The last piece of the assistant the owner asked for. Three steps, cheapest first,
and the model is the **last** one:

1. **What the box knows** — the scanned map and the menu, matched by word. Answers
   nearly everything, runs in the browser, costs ₱0.
2. **What it has been taught** — a phrase somebody typed before, one indexed
   lookup. Also ₱0.
3. **The model** — only when the first two have nothing, and its answer is
   written back to step 2, so the same phrasing never reaches a model twice.

That order is the whole economic story: **the feature gets cheaper the more it is
used**, which is the opposite of how AI usually bills. The button only appears
where the box would otherwise say *"nothing matches"*.

**What the model may do: choose from a list. Nothing else.** Every address it
returns is re-validated against the scanned route map before being offered or
stored, so it cannot invent one — and a phrase learned months ago degrades to
*"no answer"* when a page moves, never to a broken link. It performs no action,
opens no form, presses nothing. The one-person admin plan (2026-07-11) binds
that: the machine may prepare and may hold back, it may never be the thing that
lets money, a price, an approval or a publish through. A guard asserts the whole
chain touches exactly one table — its own memory.

⚖ **A SUPERSESSION, RECORDED RATHER THAN ASSUMED.** `DECISION_LOG` 2026-08-03
removed "Admin AI" as a concept — *"an assistant you have to go and ask is just
one more screen to visit"*. The owner reversed that on 2026-08-26 asking for
exactly this, and a 2026-08-26 row already flagged that the reversal *"should be
deliberate, not accidental"*. It is deliberate, and the old objection is answered
on its own terms: this is not a screen, it is the ⌘K box already on every admin
page.

**🚨 A finding worth more than this feature: `relrowsecurity` is vacuous in the
PGlite replay.** A brand-new table created inside a replayed database — no policy,
no `ALTER` — already reports row security **on**. Measured, then reproduced with a
live probe kept in the test so a future PGlite fix makes it fail loudly. **15 db
test files assert that flag today**; in the replay none of them can fail.
Named, not fixed here. Same family as the documented `auth.role()` shim.

**🪤 The exposure freeze refused the first cut, and it was right.** The memory
shipped with `GRANT SELECT` to `authenticated` behind an `is_admin()` policy —
ten new capabilities reachable with the public anon key. The honest fix was not a
baseline line: **nothing in a browser reads this table.** Every read and write
goes through one admin-gated server action on the service role, so the grant and
the policy are gone entirely. The migration says so, loudly, because adding a
policy back is the obvious "improvement".

**Guards** — 12 assertions, 10 mutations, all RED after one fix. 🪤 One of mine
could not fire: it forbade `useEffect(...ask())` with a pattern that disallowed a
`)` between them, and every real effect starts `useEffect(() => {`, so the arrow's
own bracket blocked the match — the mutation landed and the guard stayed green.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-08-03 "Admin AI is removed as a
concept" lock is superseded by the owner's 2026-08-26 request, recorded there.
