## 2026-08-26 · refactor(vendor-dashboard): the five rooms are re-cut to the jobs a shop owner actually does

Owner, after the admin console was re-cut the same way: *"we also want to rearrange
the vendor dashboard to be easy to manage for the vendors. where they have customers,
responses to requests, setting up their shop, setting up their services, performance
analysis"* — then, shown the drawing, *"yes i agree."*

**Same five rooms, same five keys, nothing deleted.** Only labels, order and which
room a thing sits in.

- **Overview is now Today** — on the rail, the phone bar, the page heading, the tab
  title and the admin's rename registry. The page's own docblock has described it as
  *"a decision surface — what needs you today"* since it was written; the word
  "Overview" named the layout, not the job. Same rename the admin console took on
  2026-08-26. The key stays `overview`.
- **My Customers moves ahead of My Shop** on both the rail and the phone bar. People
  are the daily job; setting up a shop is a once.
- **Contracts and Proposals move from My Shop into My Customers.** A quote and a
  contract are papers about a deal with one customer. 🔑 This ENDS a disagreement that
  already existed: the phone's bottom bar has lit *Customers* for `/contracts` and
  `/proposals` all along while the laptop rendered them under My Shop. Every inbound
  link in the app names the route, not the hub, so only the two forwarding stubs
  changed and the client page, the send-a-quote card, the requote nudge and the public
  proposal page were not touched.
- **Your services opens first on My Shop**, above verification and with Packages kept
  directly beneath it. It was a shut drawer below the verify block — two taps from the
  rail to reach what the page is most for. `defaultOpen` is now unconditional, a
  superset of the five deep-link params that used to open it, so no link that worked
  before can stop working.
- **The fourteen tools sit on three named shelves** — *What couples see* · *Working
  with others* · *Protection* — cut by who the tool is for, the only question you can
  answer without opening the card. Every href, label and sub-line is byte-identical to
  the flat grid it replaces.
- **"On the Day (BEO)" loses the parenthetical in the MENU.** BEO is hotel and
  catering jargon; a florist does not use it. The admin's own registry already said
  "On the Day", so this ends a second disagreement rather than starting one.

🔑 **The keys did not move, and that is the whole reason this is safe.** The staff role
filter, the `vendor.sidebar.<key>` rename registry, the per-section localStorage and
the badge map all key off them, and three of those four fail silently. A label is a
string; a key is a contract.

⚠ **The registry label WINS over the one in the code** — the rail replaces its own word
with the registry's whenever a slot exists, so a rename lands in both files or it does
not happen. Both were changed.

⏭ **Not in this change, and not an oversight:** the answers desk on Today (the widened
"what needs you" list) is the second half and ships separately. Earnings stays
always-on inside My Shop even though Payday lives in My Customers — moving a
tier-gated ledger is its own change, and it was not in what the owner agreed to.

SPEC IMPACT: vendor-dashboard IA — labels and ordering only. The five destination keys,
all 46 surfaces and every route are unchanged. Corpus row appended to `DECISION_LOG.md`.
