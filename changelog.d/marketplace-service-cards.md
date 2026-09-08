## 2026-09-08 · feat(explore): the marketplace query lists SERVICES, not shops

Owner: *"Marketplace is where they can view all services and search what they
want … on the body, it will only show all service cards."* And: *"bench is the
place where it is fixed per category."* Two surfaces, two shapes.

`lib/marketplace-service-cards.ts` is the query half: one row per **card**,
filtered but never grouped by category.

### The bug it makes unrepresentable

Measured on production. `/explore` listed one card per VENDOR and picked a
service to stand for the shop:

```
SHOWING: HOST MC
"Live Band by Saysay Live Band & Hosting (FIXTURE)"
Starts at ₱35,000
```

The ₱40,000 Host Mc card appeared **nowhere on the page**. The vendor matched
correctly — they do offer host_mc — and then the page drew the wrong card. A
couple searching for a host saw a band, at the band's price.

Verified against the live database, the new query returns:

| category | price |
|---|---|
| `live_band` | ₱35,000 |
| `host_mc` | **₱40,000** |

🔑 **One row per card leaves no "which service stands for this shop" question to
answer wrongly.**

### Three decisions worth naming

- **It states the visibility rule itself** — active card, published shop,
  `verification_state` AND `public_visibility` both `verified` — rather than
  trusting RLS. It runs with whatever client the caller passes, and an admin
  client bypasses `vendor_services_public_read` entirely. Stating the rule keeps
  the answer the same for every caller.
- **Visitor text is escaped before it reaches `or()`.** That filter is a
  comma-separated expression list: a comma inside a value becomes a NEW
  condition and a `)` ends the group early — and the value arrives from a query
  string.
- **A failed query THROWS.** Returning `[]` would render as "no suppliers match",
  which is the same page a genuinely empty marketplace draws. That is the exact
  failure this codebase keeps producing, and the caller must not be handed a
  convincing lie.

Mutation-tested five ways — drop the escaping, swallow the error into `[]`, drop
a visibility clause, filter by category when none was asked for, go back to
listing vendors. Each turns it red. (One test assertion was itself wrong first —
it forbade *any* comma in the `or()` expression, when exactly one is the
separator we build. Counting conditions is the honest check.)

⏭ Rendering it in the page body is the next step; this is the query and its
proof.

SPEC IMPACT: None.

### ⛔ Correction before merge — the first draft gated on a DEAD column

The query filtered `vendor_profiles.is_published = true`, and
`lib/one-definition-of-live.test.ts` refused it. That column's **only writer in
the whole app** is a tick-box on `/admin/vendors/[id]/edit`; approving a shop
does not set it, and the guard's own header records that *the owner's own
fully-verified shop sat at `is_published = false`*. Seven code paths were once
gated on it and all seven silently found nothing.

So the new marketplace would have hidden every verified shop nobody had ticked
by hand — a query that runs perfectly and matches nothing, which is the exact
disease the rest of this file is about. Dropped; the rule is now
`verification_state` AND `public_visibility`, matching
`vendor_profiles_public_read`.

🔑 **The live-database check I ran did not catch it.** Saysay happens to be
ticked, so the wrong query returned the right answer. A measurement against one
row that happens to pass proves the row, not the rule. The repo's own guard
caught it, before it shipped.

A test now pins it: the marketplace must never filter on `is_published`.
