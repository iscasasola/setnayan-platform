## 2026-08-11 · fix(vendors): the address the wizard previews is the address the database mints

**Two answers to one question, and they disagreed.**

The app answers "is this word free?" with `findSlugConflict` — five sources:
reserved words, weddings, shops, **people**, and **retired addresses still
forwarding**, failing closed on any probe it can't run. The database's own
auto-mint asked **three**: its own reserved list, shops, weddings.

So the shop-registration wizard could show a vendor a safe-looking preview while
the database minted a colliding one — **permanently**, because a shop address is
immutable and there is no correction path.

Three holes, closed in `20271132502763`:

1. **The word list had drifted 15 words behind the app's**, including `creators`
   and `open-shop` — both live pages, both in the sitemap, both answering
   200/307 in production right now. A business named "Creators" would have been
   minted `setnayan.com/creators`, shadowing a real Setnayan page.
2. **People were never asked about.** Handles live in the same top-level
   namespace.
3. **The forwarding ledger was never asked about** — covering both of its
   meanings: a rename still forwarding printed invitations, and a closed shop's
   owner-locked one-year hold.

`business_slug_is_available()` (new) is the single database-side answer, used by
the mint's main loop **and** its last-resort fallback — that fallback previously
checked the word list only, so the path taken after fifty failures was the least
careful one in the function.

✅ `KNOWN_DB_MINT_GAP` **is now empty.** A baseline is a bill, not a decision:
each line was a decision that a shop may permanently take one of our own pages.
With it empty, a new top-level route folder appearing tomorrow turns the test red.

🛡 Five new db tests drive the **real registration path** and assert the minted
address dodged the occupied word — plus an expiry counterweight (an expired hold
must free the word, or the ledger is a one-way ratchet) and a **neutralisation
test** that swaps the availability answer for one that says yes to everything,
watches the collision happen, and restores the function **by reading the
migration file** rather than re-typing it.

Mutation-proof run: removing `creators` from the migration turned the coverage
test red and named the word; restored → 15/15 green.

⚠ Nothing is retroactive — both production shop addresses were checked first and
neither is affected.

SPEC IMPACT: None.
