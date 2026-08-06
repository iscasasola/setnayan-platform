## 2026-08-06 · fix(invite): three holes in the invitation link, found in a pre-launch audit

The owner asked "are we checking the invite?" before launch. We are — a wrong, replaced or
foreign link is refused, the codes are unguessable, and a guest link never exposes the guest list,
emails or phone numbers. These are the three things that were wrong.

### 🔴 1 · An open redirect on a link that starts with our own domain

`/[slug]/redeem` read `slug` from the **query string** and built its redirect as
`new URL('/' + slug, origin)`. A slug of `/example.com` becomes `//example.com` —
protocol-relative — so the browser leaves the site. **Reproduced against live production:**

```
/cale-ice/redeem?slug=/example.com&token=x   →   location: https://example.com/
```

**No valid token was needed** — the not-found branch redirects before the token is ever checked.
A URL that genuinely begins with `www.setnayan.com`, sent to people we have trained to tap
invitation links without reading them, is a phishing primitive.

Fixed with an allowlist (`^[a-z0-9][a-z0-9-]{0,99}$`): an unsafe slug goes to the site root, and
once the event resolves, every target is built from `event.slug` — the value the **database**
returned, never caller text. The same guard closes a quieter hole: the lookup used
`.ilike('slug', slug)`, where `%` is a **wildcard**, so `?slug=%` matched an arbitrary event.

### 🔴 2 · The couple's "private" note was shown to the guest, and the guest's reply erased it

One column, two contradictory labels:

| surface | label | bound to |
|---|---|---|
| couple's guest page | **"Notes (private)"** | `guests.notes` |
| guest's invitation page | **"A note to the couple"** | `guests.notes` |

Both pre-filled from it; both wrote back to it. So whatever a couple wrote about someone — *"seat
away from Tita"* — appeared **pre-typed in that guest's own reply box**, and submitting their RSVP
overwrote it. Spreadsheet-imported guests hit it from the other side: the importer writes
`Household: <name>` into `notes`, so they opened their invitation and found that already in the box.

Fixed with a **second column**, not a relabelling — one field cannot be both private-to-the-couple
and authored-by-the-guest, and that *is* the defect. `notes` stays couple-private and is no longer
even **selected** onto the guest surface; `guest_note` is the guest's own message, shown read-only
to the couple so the feature is not lost. The couple's box now says plainly who can see it.

**No backfill, and that is verified rather than assumed:** prod has 35 live guests, 28 of whom have
RSVP'd, and **0 rows with a non-empty `notes`**. Had there been any, splitting would have needed a
per-row human decision — the column cannot tell you who wrote the text.

### 🔴 3 · A "private" wedding was still joinable, and the couple could not close the door

`/[slug]` correctly showed a stranger the lock screen while `/[slug]/invite` — the same wedding —
let them type any name, join the guest list, and receive a session that **then opened the lock
screen**. Confirmed on two live private events. Re-issuing the join QR did not help: it mints a new
token but the door still accepted anyone.

Two owner decisions were colliding — *"private until we launch"* and *"anyone can add themselves
with just a name"*. **Private wins.** Guarded at **both** layers, because a page gate is not an API
gate and the server action can be invoked directly with a valid token. Both call the same shared
resolver, so a scheduled launch that has come due counts as public in both places and the two
cannot drift. Refusal is `notFound()` — a private event must be indistinguishable from one that
does not exist.

⚠ **This is the one that was an open question.** It is implemented fail-closed and is deliberately
easy to reverse: delete the guard block. Nothing else depends on it.

### Verification

15 new tests, and **the redirect guard was watched failing** — restoring the old logic turns 5 of
its 6 cases red. 145 tests pass across the 14 suites touching these files. Erasure guardrail 17/17.

Exposure baseline regenerated: the new column reads `anon=SIU`, which is **not new** — all 57
columns on `guests` carry the identical table-level grant and RLS is what gates them. Checked
before reacting.

### Not done here

Rate-limiting the join door · hiding invite links from search engines · an undo for a claimed seat
(a product decision) · giving the guest-session seal its own key. Listed for the owner separately.

SPEC IMPACT: None — no pricing, SKU or scope change.
