## 2026-09-01 · refactor(marketing): three explainers become one, in both locales

`/why-setnayan`, `/how-it-works` and `/features` each answered part of one
question — *what is this and what does it do* — and a reader had to find all
three. They are now one page, `/features`, with its Taglish twin `/tl/features`.

**RULE 0 PAID.** Nothing new was built. `/features` ALREADY had the architecture
a merged explainer needs — a shared `FeaturesPageBody`, nine dictionary-backed
sections, an anchor nav, and thin EN/TL routes (the dictionary + thin-routes
pattern, owner 2026-06-13). The other two folded in as two more sections. Keeping
`/features` as the destination also keeps the strongest URL and its existing
EN↔TL hreflang pair, so only three URLs needed redirects instead of five.

**~800 LINES OF DUPLICATION RETIRED.** `/how-it-works` (413 lines) and
`/tl/how-it-works` (405 lines) were a page and a FULL COPY of it — the older
duplicate-the-whole-page localization pattern. The two locales now sit in one
file and cannot structurally drift. The Taglish prose was CARRIED OVER, not
re-translated, so the owner's approved wording survived the move.
`/why-setnayan` was English-only and now HAS a Taglish edition it never had.

### 🛑 Four claims were FALSE and were corrected in the move

All four were live on two public pages in two languages. Each was checked
against the shipped tree or the production database, not against the document
that made the claim.

1. **`/e/[event-slug]` does not exist.** There is no `app/e/`; the guest-facing
   route is `app/[slug]`. The pages printed a URL a visitor could copy into a 404.
2. **"One event, one owner today"** — co-hosts ship (`lib/host-gate.ts` refuses
   with *"only current hosts"*, plural; `lib/chat.ts` names co-host invites).
3. **Wedding-only framing** — `select count(*) from event_type_profiles` → **17**
   live celebration types. PR #5029 removed this framing from the HOME page;
   these two still carried it.
4. **"Couple browses /vendors"** — `/vendors` is the SUPPLIER sales page, and
   `/vendors/*` → `/explore` (owner directive 2026-06-14). Hosts browse `/explore`.

⚠ **`/why-setnayan`'s wedding framing was deliberately LEFT ALONE** and flagged
instead: there it is owner-approved positioning copy, and narrowing the audience
is a marketing decision. Correcting a false statement is a defect fix; rewriting
approved positioning is not.

### What moved with it

- **301/308s** for all three retired URLs. `/tl/how-it-works` → **`/tl/features`**,
  never the English page — a Taglish reader sent to English is a locale
  regression and breaks hreflang reciprocity.
- **FAQPage JSON-LD** carried over from `/why-setnayan`, built from `WHY_FAQ` —
  the same constant the section renders, so the rich result can never quote an
  answer the page no longer shows.
- **`lib/llms-txt.ts`** (the AI-crawler index), `lib/seo/health-checks.ts`
  (`KNOWN_PUBLIC_ROUTES`), `lib/routes.ts` (EN + TL), `site-chrome` NAV_ROUTES,
  the static sitemap, and 4 internal article links.
- **`/about` and `/tl/about`** deep-link to `/features#how-it-works`. The Taglish
  About was also **leaking locale** — it linked to the ENGLISH `/how-it-works`.
  Fixed to `/tl/features#how-it-works`.

### 🔒 The retired slugs stay reserved — and already did

Both words still RESOLVE (308s), so a shop that minted `setnayan.com/how-it-works`
would shadow the redirect and every indexed link would land on a stranger's shop
— and a shop address is immutable once minted. They are reserved, and a test now
pins it.

🪤 **A FALSE CLAIM THIS PR ALMOST SHIPPED, kept here because the correction is
the useful part.** The first version of this changelog, the commit message, a
source comment and the PR body all said that deleting the route folders had
**un-reserved** these two slugs, and that this PR "restored" them. **That was
invented.** `how-it-works` and `why-setnayan` were already in the
hand-maintained `DB_MIRRORED_RESERVED_SLUGS` on `origin/main`, in its
*"must not be shadowed"* section. The addition was a duplicate; the danger was
never real. What actually happened is duller: the GENERATED half went stale when
the folders were deleted, `reserved-slugs.test.ts` said so, and regenerating
fixed it.

🔑 **It was caught by the mutation run, not by the test suite.** Removing the
duplicate failed **nothing** — a vacuous mutation whose cause was a wrong
premise rather than a weak assertion. Had I only run the suite, all 11,677 tests
would have passed over a changelog that told the next reader a story that never
happened.

⚠ **Found in passing, NOT fixed here:** `weddings` is not reserved at all,
despite `/weddings` → `/realstories` being a live permanent redirect — the same
shape of gap, pre-existing, and out of scope for this PR.

**Guard:** `app/features/one-explainer-page.test.ts` — 13 tests covering the
redirects, the Taglish destination, the reserved slugs, the sitemap, both
locales' shape, and all four corrections.

SPEC IMPACT: None. No pricing, no schema, no gate, no locked decision. Public
copy corrected to match shipped behaviour.

### 🪤 Two CI-only guards the local suite never runs

`npm run test:unit` does not run the `lint-*.mjs` blocking guards, so both of
these went green locally and red in CI:

- **`lint-one-comment-stripper`** — this PR's guard had grown its **own**
  two-replace comment stripper. That shape strips BLOCK comments first, so a
  line comment containing a slash-star sequence opens a comment that closes only
  at the next real star-slash, blanking everything between — after which a guard
  asserts against a blank and *passes*. Now uses `lib/strip-comments.ts`, the
  repo's one stripper. (Measured 2026-08-30: one added JSDoc cut what six guards
  could see from 16,218 characters to 6,430.)
- **`lint-port-no-lost-controls`** — `/about` and `/tl/about` stopped offering
  `/how-it-works`. The removal is deliberate, so the baseline was regenerated in
  this PR, exactly as the guard instructs; each removed control is now one
  readable line in the diff. **The baseline was regenerated only AFTER merging
  `origin/main`** — regenerating from a stale base would have silently dropped
  routes other PRs had added. Every removal in that diff belongs to the three
  retired routes; nothing else lost anything.

🔑 **And the fix for the first one broke the file.** The note explaining the
star-slash hazard was written *as a block comment*, so its own literal
star-slash closed the comment early and the file stopped parsing. Rewritten as
line comments. Prose about comment delimiters must not live inside a block
comment — the guard's own failure mode, reproduced while documenting it.

**Now verified the way CI verifies:** 11,696 unit tests, `tsc` clean, `next lint`
clean, and all **22 blocking guards** run locally and passing.
