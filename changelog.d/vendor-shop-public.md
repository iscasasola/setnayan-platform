## 2026-08-08 · design(vendor-shop): a "Verified" chip and a "Featured in N stories" pointer

Two small additions to the top of a vendor's public shop page — the Warm Editorial
Archive port, spec § 3.5 (E1 + E2). Nothing was removed, redrawn or moved.

**What a person experiences**

- A couple opening a shop now sees a small **"✓ Verified"** chip right under the
  cover photo, before anything else. Hovering it says what it actually means:
  Setnayan looked at this shop's business papers before the page went public. It
  does not claim anything about their prices, their reviews or their calendar —
  the page already makes those narrower claims further down, in their own words.
- If real couples' stories mention this shop, a chip near the top now says
  **"Featured in 3 stories →"** and jumps straight down to the stories that are
  already on the page. The stories section itself is untouched — it has shipped
  for months; all it gained is a name to jump to.

**Why they can't lie**

- The Verified chip is switched on by the exact same fact the page uses to decide
  whether a stranger may see the shop at all. A shop Setnayan has not approved has
  no public page, so nobody outside can ever see the chip on an unapproved shop.
  On the two views that do survive — an admin in demo mode, and a vendor previewing
  their own shop before approval — the chip simply is not there. There is no
  "Unverified" badge; saying nothing is the honest answer, and a public page is the
  wrong place to publish a negative about somebody's business.
- The stories chip counts the very same list the section below draws from, and
  appears under a word-for-word identical condition. So it can never point at
  nothing, and the number can never disagree with the tiles you land on.

**The trap this one was built around**

Both story loaders turn a failed database read into an empty list — a broken read
and a genuine "no stories yet" arrive as the same value. A separate count query for
the chip would have looked tidier and would have been the one thing able to announce
"Featured in 3 stories" over a section showing nothing (or the reverse) — and it
would have failed silently, exactly like the loaders do. Sharing one expression with
the section is the fix, and a test now fails if anyone swaps it for a count query.

Same shape on the Verified side: had the chip been keyed on the shop's *visibility*
column instead of its *verification* column — which a sibling comparison page does,
for its own different reason — it would be asserting a different fact from the one
the page actually checks. That conflation is why an earlier migration exists; a test
now fails if the visibility column appears anywhere in this chip.

**Guards** — `apps/web/app/v/[slug]/identity-chips.test.ts`, 7 assertions, each
sabotaged on purpose and confirmed to go red before commit (8 mutations, 0 survivors).
Note the first version of the count assertion DID survive its sabotage — the
plural branch below mentions the same expression, so a loose `includes()` stayed
green while the displayed number was swapped out. It is now anchored to the rendered
text. A guard is decoration until you have watched it fail.

**Chip radius is `rounded-full`, not the spec's 12px** — the repo's radius lint
forbids arbitrary `rounded-[Npx]` and the scale has no 12; every sibling chip in
this stack is already a full-round pill.

**Contrast (unguarded here, so measured by hand):** the chip's slate-blue label on
its own 8%-alpha wash over cream is **7.26:1** — clears AA and the 7:1 AAA floor.
`lint-label-on-fill-contrast` deliberately skips alpha fills because it cannot know
the parent, so re-measure if anyone deepens the wash.

SPEC IMPACT: None. This implements `Design_Warm_Editorial_Archive_2026-08-08/FABLE_Public_Marketplace_Spec_2026-08-08.md` § 3.5 (E1, E2) as written; no locked decision moved. The corpus's own vendor-page audit listed "no Verified-by-Setnayan rendered" as a gap — note the chip reads **"Verified"**, never "Verified by Setnayan", which would be a trademark-shaped claim nobody approved.
