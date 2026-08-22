## 2026-08-21 · feat(studio): Pakanta becomes the eighth Studio product

Owner: *"pakanta is paid. so add this to the studio."*

Pakanta — the couple's own wedding song, written from the love story they
already told us — has been **sold since 2026-05-14 and had no public page of
any kind.** The only way to meet it was to already own a wedding and open the
services hub. So it was the one paid product missing from the Studio group in
the sidebar, and a guard existed specifically to keep it out: *"Pakanta has no
public page — a rail row for it would be a fake door."*

The right way to satisfy the instruction is to remove the guard's REASON.

- **`/pakanta` is a real public product page**, built on the shared doorway kit
  like the other seven. Its words are the ones the product already ships with
  (`add-ons-detail.ts` has carried them since the App Store detail pages were
  built) — not a second account of one product. No price on the page: prices are
  admin-managed and move, so the doorway sells the benefit and links to
  `/pricing`. No claim about how the song is produced, so the page makes no
  claim it would have to disclose; the in-app surface carries that disclosure
  before anyone pays.
- **Pakanta is the eighth row in the Studio group.** No `surface` (it is not
  wedding-only — a debut can buy a song) and no `demo` marker (nothing renders
  one, and "try it" over a page with no demo button is the fake door this file
  forbids).
- Registered where a new public route must be registered, each of which a guard
  demanded rather than left to memory: the sitemap, `llms.txt` (both the route
  list and the prose line), the SEO health-check sweep, the doorway-invariants
  list, the doorway `studioKey` list, and — the one that matters most —
  **`lib/reserved-slugs.ts`, so no shop, wedding or person can claim `pakanta`
  as their permanent address.**

🚨 **AND THE GUARD THAT KEPT IT OUT COULD NEVER HAVE FIRED.** It searched
`front-door.tsx` for the string "pakanta". The Studio rows are built from
`STUDIO_APPS` in `lib/studio-apps.ts`, and that word has never appeared in the
front door's own source — so adding Pakanta to the rail would have left it
GREEN. It was decoration for its whole life while naming a real rule, which is
the worst combination: a rule everybody believed was enforced. It is now
inverted AND repaired — it walks the real rail rows and asks the filesystem
whether each one's page exists, so it catches the reverse failure (a row
outliving its page) for all eight products, not just this one.

SPEC IMPACT: None on price or scope — Pakanta's SKU, price and delivery flow
are untouched. This is discoverability: a product we already sell now has a
public page and a row in the sidebar.

## 2026-08-23 · the address protection was only half done — and the half that decides was missing

⚠ **THE BULLET ABOVE OVERSTATED WHAT SHIPPED.** It says `lib/reserved-slugs.ts` means
"no shop, wedding or person can claim `pakanta` as their permanent address." That file is
**GENERATED from the route folders**, so it picked the new page up by itself — and that is
exactly why it read as done. **The database half was never written**, and the database is
the half that runs when a shop actually registers.

**Measured in production before fixing it, by querying rather than assuming:**
`business_slug_is_reserved('pakanta')` returned **NO**. No shop and no event holds the word
today, so nothing is taken from anybody — but the auto-mint could have handed our own product
page to a business called "Pakanta", **permanently**, because a shop address is immutable
once minted. Same trap that nearly cost us `/creators` and `/open-shop` on 2026-08-11, and
the reason `pay` was reserved on 2026-08-21.

🔑 **A GENERATED LIST AND A HAND-WRITTEN ONE ARE NOT ONE MECHANISM.** The generated half
updates itself and the authoritative half does not, so the surface that is easiest to check
is the one that is always already correct. Ask which copy actually *decides*.

🔑 **AND THIS WAS THE ONLY THING FAILING ON THIS CHANGE** — `typecheck + lint` was red on
`vendor-business-slug-mint.db.test.ts` ("no NEW route word is left uncovered by the database
mint"), not on anything about Pakanta's page. **A pull request reported as "blocked on
conflicts" was blocked on a real defect.** Read the failing job before assuming the block is
mechanical.

Fixed in migration `20271158413546_pakanta_is_our_page_not_a_shops.sql`. The function body is
reproduced from `pg_get_functiondef` **read out of production**, not from memory and not from
the newest migration file — they were checked against each other rather than assumed equal,
because `CREATE OR REPLACE` silently reverts any fix a reader forgot was in there.

🛡 **Mutation-tested and MEASURED**, both directions: with the literal present (occurrences
1) the suite is 15/15; deleting it (occurrences 1 → 0) turns test 7 RED at 14/1; restoring it
from an explicit backup returns 15/15. An unmeasured mutation proves nothing either way.

SPEC IMPACT: None — no price, SKU or scope change. One word added to the reserved list.
