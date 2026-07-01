## 2026-07-01 · chore(vendor-tiers): cleanup batch — strip stale FAQ hardcode + SSOT honesty

Ran down the remaining vendor-tier cleanup items from VENDOR_TIERS_AND_BENEFITS.md
§5. The product code was already clean, so this is mostly an honesty/SSOT pass:

- `app/for-vendors/_components/page-tail.tsx` — the "How does Setnayan make money?"
  FAQ had a DEAD static default carrying stale Ladder-A prices (₱6,000/₱10,000).
  The live FAQ overrides that exact question with DB-driven `getVendorPrices`, so
  the page already showed correct prices — but the stale hardcode was a landmine.
  Stripped the numbers from the default and pointed it at `/pricing` (no hardcode
  can resurface if the override is ever removed).
- `VENDOR_TIERS_AND_BENEFITS.md` — struck the "read files in-thread" claim in §2
  (thread file-attachments aren't built); added a §5 entry recording that the
  rest of the batch was non-issues (token-buying already verification-gated;
  boost-radius is a cap not a purchase; no shipped "10-photo" over-claim).

Assessed as non-issues (no change): boost/booster/token-pack "scope to plan"
(token buying is already server-side verification-gated; boost-radius is a tier
cap; no ungated booster purchase exists), and portfolio-cap copy (no shipped
surface understates the code caps).

Outstanding, NOT a code fix: the in-thread file-reading/sharing over-claim lives
in the DB-driven Help articles (admin-managed content) — flagged for an owner/
admin edit; no code PR can reach it.

SPEC IMPACT: In-repo SSOT `apps/web/VENDOR_TIERS_AND_BENEFITS.md` updated (§2 + §5).
Corpus decision-log row added via authorized direct-edit. No DB/SKU/price/schema
change; the touched FAQ default is dead code (overridden at render).
