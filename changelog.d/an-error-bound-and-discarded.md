## 2026-08-24 · fix(dashboard): an error that is bound and thrown away

The first four passes closed "the error was never named". This one closes the
harder half: **the error IS named, and then discarded.**

```ts
if (error) return 0;     // reads as careful code
```

That satisfied every rule this guard had while doing exactly the damage they
exist to prevent. What it did:

- **The couple's gallery hub** — a refused count printed *"As your guests and
  cameras shoot, every photo gathers here"* and pointed at **Open Papic** instead
  of **View & download**, on the one page whose job is to reach the photos they
  already have. This area has paid for it before: the Papic home tile once told
  coordinators *"0 cameras out"* mid-shoot — an RLS silent-zero, the third state
  the brief names.
- **A supplier's service list** — *"{Supplier} hasn't published a service list
  yet."* **A claim about somebody else's behaviour, printed because our read
  failed.** An absence we did not measure is never someone else's fault to state.
- **A quotation, a proposal and the working notes on a booking** — three cards
  carrying `if (error) return null; // pre-migration graceful-degrade (42P01)`.
  The comment named one cause; the code swallowed every cause, so a refusal took
  the quotation off the screen of the couple who has to accept it. The predicate
  they meant — `isMissingRelationError` — already lived one file away.

`countEventGuestCaptures` and `fetchMarketplaceServices` now return `null` for
*unknown* and keep `[]` for *measured none*. Their other caller (the home tile)
still chooses the zero — but **chooses it at the call site, in the open**,
instead of being handed one that had already swallowed the error upstream.

⚖ **Not every discard is a defect, and two stay exactly as they are.** The
shared-pool hint fails to 0 because the database refuses an over-hand-out
anyway; the missing-table branch returns `[]` because there genuinely is nothing
to show. Both are on the bill **with their reason**, not hidden behind an
exemption that would quietly cover the next one too.

Guard: eighth and ninth rules. Rule 8 matches **behaviour, not spelling** — the
first draft only caught the terse one-liner, and the stale half of that same
rule caught me within the hour when adding a log line moved the `return 0` two
lines down and it reported the discard fixed. **A logged discard is still a
discard.**

SPEC IMPACT: None.
