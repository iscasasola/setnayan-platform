## 2026-08-10 · feat(privacy): a closed shop keeps its trading name through erasure — owner ruling

Owner-locked: *"their old shop's name will never be deleted (unless manual delete by admin)."* Put to the owner a second time with the privacy cost spelled out, and reaffirmed.

`business_name` no longer appears in `VENDOR_PROFILE_PII_SCRUB`. A closed shop keeps its identity, so the address it held means something for the year it stays reserved, and an admin looking at a dormant record can tell which business it was instead of reading a blank.

### The cost, stated rather than buried

A sole-proprietor shop is very often named after its owner — *"Maria Santos Photography"*. On those shops this leaves personal data behind after someone exercised their legal right to have it removed.

What makes it defensible is that a **trading name is a public commercial identity**, not a private fact — and that argument covers the shop's name and nothing else. So the exception is held to exactly one column: `business_owner_name`, `business_owner_position`, contact email and phone, address, coordinates, tax identifiers and logo all still go. **The DPO is the owner**, so this is theirs to make; it is recorded in `DECISION_LOG.md` with the date and the wording, and reversing it is one line.

🔑 **`business_slug` still goes, and that is not an inconsistency.** The name is kept as a record; the address is a scarce claimable word that must be released after a year. It is held in `slug_change_log` for exactly that long and then frees itself. Keeping it on the row would reserve it forever, which is the opposite of what was asked for.

### 🪤 Removing the line broke nothing — and that is the finding

Not one test in either erasure suite noticed. A control proves this is specific to the column rather than the suites being decorative: removing `contact_email` from the same object turns one red immediately. The generic check looks for columns nulled to `NULL`, and `business_name` is `NOT NULL` so it was scrubbed to an **empty string** — a shape the check does not look for.

🔑 **So the old behaviour was unpinned, and the new one would have been too.** A future session tidying the scrub list could put the line back and every suite would stay green, quietly reversing a decision the owner made in writing. **A ruling that only lives in a comment has a half-life.** Four tests now pin it: the shop name survives, the person behind it does not, the address is still released, and the exception is exactly one column wide.

Mutation-tested: restoring the scrub line (2 fail), and widening the exception to the owner's personal name (2 fail).

Verified: **7371/7371** unit · 20/20 `lint-*.mjs` · `tsc` clean · both erasure suites green.

SPEC IMPACT: `DECISION_LOG.md` — recorded as an owner + DPO ruling with its cost.
