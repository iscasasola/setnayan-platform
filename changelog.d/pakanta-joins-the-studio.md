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
