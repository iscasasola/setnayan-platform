## 2026-08-10 · fix(open-shop): the vendor's name comes from their account, and the number has to be a real Philippine one

Two owner rulings.

### 1 · "vendor's name is their account name. so it should not be editable."

RULE 0 first: the read-only box **already shipped** — greyed, with *"From your account."* underneath.

🔴 **And it had never once engaged.** Measured in production: `users.display_name` is **null for every account**, the owner's included. The lock reads `readOnly={!!accountName}`, so with no account name it fell through to editable every single time. **A lock that only holds when a column is populated, on a column nothing populates, has never been shut** — which is why a name could be typed by hand at all.

Two things were needed, and neither was the box:

- **The rule moved to the server.** `readOnly` is a property of an input, not a rule; this is a server action reachable by direct POST, so the name arrived from the form whatever the screen did. The **account name now wins, always**, and the form is consulted only when the account has none.
- **The first name given establishes the account name.** Otherwise *"it comes from your account"* is a promise about a field nobody has ever filled. Opening a shop is the one place the app asks a vendor for their name, so that answer becomes the account's — after which the branch never runs again and the name is changed only on the account profile, which already has an editor for it (checked before locking anything: a locked field with nowhere to change it is a dead end).

### 2 · The contact number must belong to where the shop is

> *"if the mapped in USA, the number should be USA correct… the contact number is reliant to the map location. Meaning step 3 and 4 should be together?"*

**The dependency is real; the country choice is not — yet.** `lib/geo.ts` sets `countrycodes=ph` on **both** the address search and the pin lookup, so a vendor cannot pin an address outside the Philippines at all. There is exactly one country to check against today.

So this validates the Philippines properly rather than half-building a country matrix for a case the map cannot produce.

**On merging the steps — no, and here is the answer to the question.** Reordering beats merging: step 4 already carries a map that "needs full attention and cannot be made smaller", and stacking four more fields onto it makes the worst screen in the flow. The moment a second country opens, **location moves before contact** so the country is known when the number is typed. That trigger is written at the top of `lib/ph-phone.ts`, where the second country will land.

**Deliberately generous about spelling, strict about origin.** The cost of refusing a real business its own number, on the screen where it is signing up, with no way around it, is worse and less reversible than the cost of a slightly odd format. So `09XX XXX XXXX`, `+63…`, `63…`, bare `9…`, landlines with area codes, and any mix of spaces, hyphens, dots and brackets are all accepted — and stored in one canonical `+63…` form, so the same number typed four ways is one value.

🪤 **A real hole, caught by its own test:** `+65 6123 4567` was **accepted**. The parser dropped the `+`, leaving `6561234567`, which matches the landline shape — ten digits starting with 6. **An explicit `+` is the caller naming their country out loud; when it is not ours, no pattern match on what follows should second-guess them.** Mutation-tested.

Also: a foreign number now reports *"that isn't a Philippine number"* rather than *"you left this blank"* — the two were briefly conflated, which would tell someone who typed a full number that they had typed nothing.

Verified: **7438/7438** unit · 20/20 `lint-*.mjs` · `tsc` clean. An existing guard caught the new refusal string and required it be assigned to a step — it is on step 3, with the box it is about.

SPEC IMPACT: `DECISION_LOG.md` — both rulings recorded.
