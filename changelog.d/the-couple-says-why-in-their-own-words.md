## 2026-09-15 · feat(gifts): the couple's own words, on the page rather than on a card

Owner: *"We would love to receive monetary gift so we can find the best suitable
gift from everyone who loves us"*, then *"can we provide 5 templates"*, then *"so
pick among 5 or create your own"*, then — once we found where his words actually
were — *"move the message off the bank card."*

### 🔴 Where they were

He picked a template and it appeared on his live gifts page **before any of this
shipped**. Measured: all 171 characters were in `event_egift_methods.note` —
pasted onto the **bank card**, because that was the only box on the screen that
would hold a sentence.

One fact in the wrong home, failing two ordinary ways: **delete the bank card and
his words go with it**, and **add GCash and they are typed twice**, then edited
twice, then disagree.

### What ships

- `events.pabuya_message` — one nullable column, ≤600 chars. **NULL renders
  nothing at all**, so every event that never touches this reads exactly as it
  did. No backfill, no default sentence put in anyone's mouth.
- **Five templates** as starting points on `/dashboard/<eventId>/pabuya` — pick
  one to fill the box, then change anything. 🔑 **What is stored is the TEXT,
  never a template key**, so editing after picking is just editing, and improving
  a template later cannot silently rewrite a published page.
- The public page renders it **above the methods** — it is the part a guest
  weighs before deciding. The page could already say what to *do*; it had nowhere
  to say *why*.
### What happens to `event_egift_methods.note` — decided, not left

It **stays**, as a per-account line: *"please put your name in the reference"*,
*"this account is for the reception"*. **"We left it there" is not an answer** —
that is how the next session finds two columns holding the same kind of text and
believes the wrong one.

🔑 **The condition on keeping it is that the two are visibly different on
screen**, so its label changed: **"Note for guests (optional)" → "Note for this
account (optional)"**, placeholder *"Please put your name in the reference"*.

That old label is *why his words landed on the bank card.* "Note for guests" is
exactly what a couple reads when they want to say why they are asking. He typed
171 characters into a per-account field and they became the bank card's
property. A **sixth test** holds the new label and fails on the old one.

⚠ **They are identical today only because there is exactly one e-gift method in
the entire production database** — one bank, enabled, with handle, QR and note.
One row is why `note` and "the page" currently look like the same thing. That is
the argument for the move, not against it.

### Not in scope, deliberately

The templates are a **convenience, not a default**. Nothing migrates, reorders or
"upgrades" a message somebody wrote themselves, and a couple who has written
nothing sees an **empty field with suggestions**, never pre-filled words they did
not choose. Their message is the one thing on that page that is theirs.

No data moves in the migration either. The page keeps rendering the per-method
note exactly where it renders it today, so there is **no moment where the words
are nowhere** — the owner's sentence is moved as its own step, after the page
serves, and **read back out of production** rather than trusted from a
migration's own "it ran".

### The traps this column had to clear

- ⚠ **A new `events` column gets no grant.** Without `GRANT SELECT (col)`,
  PostgREST refuses the **whole** query for any caller that names it — which
  reads as "the page is broken", not "one column is missing".
- ⚠ **`events_host` is a view with an explicit projection**, so a column added to
  the base table is a phantom on the view until it is rebuilt. Both done in the
  migration.
- 🔑 **A zero-row UPDATE is success-shaped.** PostgREST returns no error when the
  filter matches nothing — including when RLS refused the row. The action counts
  rows and says so, rather than reporting "Saved" over a page that never changed.

### The exposure baseline moved by exactly one line

`exposure-freeze.db.test.ts` went red, which is the whole point of it — a new
`events` column is precisely its shape. Accepted deliberately, in this same PR:

```
col	public.events.pabuya_message	anon=- authenticated=SU
```

🔑 **`anon=-` is the part to read.** The public internet gains **nothing**; the
gifts page reads through the service-role admin client. `authenticated` gains
SELECT + UPDATE because **the couple edits their own message while signed in**,
row-scoped by the `events` policy they already sit behind — the same shape as
every other host-editable column on that table. Narrowing it would mean routing
the save through `service_role`, which the rest of this editor does not do.

### Guarded

Five tests, including: **no template opens with the ask** (every one makes the
gift optional before it mentions money — a page that opens with the request is
why couples are embarrassed to turn this on), empty becomes **NULL not `''`**,
and the stored value is text rather than a key.

⚠ Stacked on #5523 (the payment-identifier gate); both touch the public page.

SPEC IMPACT: new `events` column + the owner's template ruling; logged in
`DECISION_LOG.md`.
