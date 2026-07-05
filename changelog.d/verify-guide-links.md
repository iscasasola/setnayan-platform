## 2026-07-05 · feat(vendors): "How to get this →" guide links on verification docs

Vendors on **My Shop → Get verified** now get a **"How to get this →"** link on the
four required legal/financial slots (DTI/SEC · BIR 2303 · Mayor's Permit · Bank
account proof), each opening a plain-English Help Center guide that walks them
through the PH process and links the official government portal (DTI BNRS, BIR
ORUS, SEC eSPARC).

- New Help Center topic **"Getting verified"** (`roles: ['vendor']`) with 4 articles in `lib/help.ts`:
  `how-to-get-dti-sec-registration`, `how-to-get-bir-2303`, `how-to-get-mayors-permit`,
  `how-to-prepare-bank-account-proof`.
- `DocSlot` gains an optional `guideSlug`; the shared `DocSlotCard` renders the link
  when present (so both the My Shop surface and the retiring `/verify` page get it).
- Help-article renderer now splits body newlines into paragraphs and linkifies bare
  `https://…` URLs (new-tab, `rel=nofollow`) — benefits all 60+ existing articles;
  single-line articles render byte-identically. `helpMetaDescription` flattens
  whitespace so multi-line bodies still yield clean SEO descriptions.
- Bank-account-proof hint updated with the name-match rule (holder name should match
  the DTI/SEC business name) + "you can blur the balance".

SPEC IMPACT: None — Help Center content lives in-code (iteration 0029 pattern); this
is additive vendor-guidance content + a copy clarification on an existing shipped
surface. No schema, no migration.
