## 2026-08-28 · feat(taxonomy): the card maker collects a search miss a supplier actually resolved

C3 of the category-suggester stream. "Collect first, then recommend" (owner,
2026-08-28) applied to the one place it was still owed: when a supplier types
a phrase the kind sheet's search (C1's ranked trades, already carrying C2's
reviewed aliases) comes back with nothing for, and they go on to pick a real
live trade anyway and save the card, that pairing is now remembered —
`(phrase, canonical_service)`, landed **unreviewed**, `source='collected'`, in
the same `canonical_service_aliases` table and the same admin review queue
C2's mined rows already use at `/admin/taxonomy/aliases`. No new table, no
new schema — RULE 0: the table's own `source` column already anticipated
`'collected'` as a value nobody had wired a writer for yet.

🚨 THE POISONING RISK THIS WAS BUILT AGAINST: unlike `admin_search_phrases`
(admin-authored or model-validated), this cache is written by an untrusted,
unauthenticated-relative-to-the-corpus account, served cross-tenant. A
supplier could type "catering", deliberately pick a wrong trade, save a real
card, and try to teach that pairing to every future supplier. Two floors,
both re-checked server-side (never trusted from the browser alone):
  1. ONLY a genuine miss is collectible — a phrase the ranked-trade search
     (which already folds in C2's reviewed aliases) found nothing for, and no
     legacy department pill's own label matched either. A phrase either
     search already answers is never learned.
  2. ONLY a pick that resolves to a live coverage trade counts — Miscellaneous
     and every legacy department pill teach nothing and are dropped.

🔒 AND THE DEEPER FLOOR: reusing C2's table means a collected row inherits
C2's RLS shape for free — `USING (reviewed_at IS NOT NULL)`. A collected
phrase answers **nobody**, including the supplier who typed it, until an
admin approves it at the existing review screen. Collecting is never the
same act as serving; C2's review/unteach UI IS the review/unteach UI for
this too, so nothing new had to be built there. Proven end-to-end against a
real replayed schema (`SET ROLE authenticated`, a genuine low-privilege
role): an unreviewed collected phrase is invisible to an ordinary session,
that same session cannot self-approve it (RLS admits zero rows to the
UPDATE), and once approved the exact same way `approveTradeAlias` approves
it, the phrase flows through `reviewedAliasesByLiveTrade` +
`rankTaxonomyOptions` — the maker's own real pipeline — and ranks its trade.

The trigger is server-validated, not client-trusted: `commitVendorService`
re-derives whether the posted `category` is a live coverage leaf from the
same taxonomy the save itself just enforced, fresh, before ever calling the
writer — a tampered hidden field cannot queue a pairing for a category that
was never real. The write is fire-and-forget (`after()`), so a supplier's
save never waits on or fails because of this.

A held-open "pending miss" (the query that just missed) survives a cleared
search box — the common real case is type-miss, clear, browse, pick — but is
dropped the moment a later non-empty query finds something, so a stale miss
can never get silently paired with an unrelated later pick.

Trap paid for in-flight: `canvas-field-parity.test.ts` enforces that the
zero-step canvas and the 6-step wizard post the exact same field set to the
shared `commitVendorService` (the wizard has no kind-search band at all, so
it posts the new `collected_kind_phrase` field hard-coded empty).

Guarded: 8 pure unit tests on the miss/eligibility logic, 16 wiring
assertions (each measured with a targeted mutation, shown red then
reverted), 7 db tests against the real replayed schema. Full unit suite:
11160/11160. tsc: 0 errors. No new migration, no grant/policy change — the
exposure-surface baseline is unchanged (6295 facts).

SPEC IMPACT: None. Extends the C2 alias table's already-documented `source`
vocabulary (`mined | collected | proposed`) with its second live writer;
no schema, no locked decision, no pricing affected.
