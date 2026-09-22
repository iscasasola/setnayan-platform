## 2026-09-22 · fix(chat): a quote supersedes only the cards it was built from

`lib/offered-service-card-state.ts` shipped the owner's 2026-09-22 ruling — the quote card replaces the
offered-service card, and the offer stays as dimmed history rather than being deleted. It decides from
**two timestamps and nothing else**: the offer's `created_at` against the newest quote *anywhere in the
thread*. It cannot know which cards a quote covered, because nothing recorded that.

**Measured by executing the shipped rule, not by reading it:**

```
offer CARD_PHOTO 10:00 · offer CARD_VIDEO 10:05 · one quote built from PHOTO
  CARD_PHOTO -> superseded  actionable=false  "Replaced by a quote"
  CARD_VIDEO -> superseded  actionable=false  "Replaced by a quote"   ← never quoted for
```

The video offer is retired by a quote that never covered it, and loses its actions. That is **the
ruling's own mitigation — "a view must not be destroyed" — failing in the direction it was written to
prevent.**

🔑 **The information existed at compose time and was thrown away.** The builder loads one or several
service cards and knows exactly which. Nothing persisted it, so a later surface had to guess with a
timestamp proxy. Same shape as `includes_setnayan_gift` before 20271240324859.

**The column is NULLABLE with no default, deliberately against the nearest precedent.**
`vendor_locked_qr_tokens.vendor_service_ids` is `JSONB NOT NULL DEFAULT '[]'`, which is right there —
nothing reads it to retire another card. Here `[]` would read as "built from no cards", and **every
quote written before this migration would suddenly assert that about itself.** NULL is the honest value
for a row that never said. Three states, all distinct and all tested:

| value | meaning | effect |
|---|---|---|
| `NULL` / unreadable | never said | falls back to today's thread-wide rule |
| `[]` | a real statement: built from no card | supersedes nothing |
| `['A']` | covers exactly A | supersedes only A's offer |

⚖ **The fallback keeps this file's own risk reasoning.** A quote that never said still counts, exactly
as before. Of the two mistakes — a stale offer shown as live, or a live offer marked as history — only
the first can make someone act on the wrong number, so silence must not make an offer look live again.
**Passing no card reproduces the old answer exactly**, which is what makes this additive: the existing
call site and all eight existing tests are untouched.

**⚠ THIS FIXES NOTHING LIVE, AND A REVIEWER SHOULD NOT HAVE TO WORK THAT OUT.** Measured against
production, 2026-09-22:

| measure | prod |
|---|---|
| offered-service card messages, ever | **0** |
| threads with any offer | **0** |
| most offers in one thread | **0** |
| quotes / proposals | 2 |

**Nobody has ever posted an offered-service card.** The defect is real, executed and in shipped code,
and it has never had a victim, because the feature it serves is unused. That is also why **the fallback
is load-bearing rather than politeness**: every existing proposal row will have no ids, so the
thread-wide rule is what actually runs until cards are used.

**Two layers of guard, because a pure rule is only as right as its inputs.** The decision is EXECUTED
(13 cases); the wiring is asserted from source, since it lives in a client component no test can
import — the proposal read must ask for the column, the fetched ids must reach the card data, and the
rule must be told WHICH offer it is deciding about. **That middle layer is exactly what silently
dropped a column on the quote-revision read earlier today**: the query stopped asking, the value
arrived undefined, and every pure test stayed green.

**Five sabotages watched red:** drop the per-card filter · treat silence as "covers nothing" · treat
`[]` as "never said" · drop the column from the stream's select · stop passing the offer's card id.

🔑 **Two defects, one cause, found within a day of each other.** `includes_setnayan_gift` and
`service_card_ids` were both known at compose time, both never stored, and both left a downstream
surface guessing — one with the card's answer, one with a timestamp. The fix is the same shape:
persist what the builder already knows.

SPEC IMPACT: None — implements the 2026-09-22 ruling more faithfully; no new copy, no new price.
