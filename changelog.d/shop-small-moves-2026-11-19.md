## 2026-11-19 · feat(supplier-shop): the Shop tab, simpler — the photos are the buttons, two lines of doors, Templates then Specialized tools

Owner, 19 Nov 2026, on the Shop drawing (`prototypes/shop_final_with_spaces_2026-11-19.html`, artifact NN7HGqqxtnsTWRUA5MyRAv, approved: *"i approve the design already"* — specs `19f46fd5`). This PR is the drawing's **"Small changes"** list only: moving and rewiring what already ships. **No data, no migration, no new read.**

- **The cover photo is the button** (*"cover photo should not be an icon but the actual cover photo tap that"*). A tap on the photo opens the device's picker at once, then the shipped Portfolio uploader with the new photo pre-picked as Your page's draft cover (`PortfolioUploadDoor coverPick`, unchanged). The **Upload pill and the Cover door are gone**. `SupplierHero` gains one optional `photoDoor`; Today and Portfolio pass none and are unchanged.
- **The logo is the button too** (*"same as the profile photo"*). A tap opens the picker and the Logo screen rises on the framer with the picked photo. A **verified** shop's logo still changes by request, so there the tap opens the Logo screen as before. The camera dot is gone.
- **Two lines of doors** (*"profile photo Share then view Shop / Then Promote, QR, Prints, Gifts, Plan"*). Line one: logo · Share · View shop. Line two: five equal buttons. Every door opens the place it opened before; "Your gifts" reads "Gifts"; the tiles' small lines left so five fit 390 px (Prints and Plan keep theirs for screen readers).
- **The plan link is off the cover photo** — the Plan button under it is its one door.
- **Templates, then Specialized tools** (*"form maker and offer makers are all inside Templates then Specialized Tools"*). The "Makers" heading is "Templates" (Forms Maker · Offer Maker). Specialized tools is its own part, open on the page: the same carousel, one tap closer; a tile opens that tool into the body.
- **The order** (owner: *"Yes, all three"*): cover → notices → Templates → Specialized tools → Analytics → Badges → Bundles and services.
- **The Shop ▾ menu follows the page**: Details · Portfolio · Templates · Specialized tools · Analytics · Bundles and services. Page and Promote left the list (View shop and the Promote button open them); their own screens still say "Shop · Page" / "Shop · Promote".

**Guards re-aimed, none deleted:** `the-quick-row-is-the-drawn-three` → `the-quick-row-is-the-drawn-five` (+ a fourth check: no plan link, no Cover door, no Upload pill; the photo and the logo open the picker) · `the-shop-sections-are-v13` · `the-shop-tab-is-v113` · `the-supplier-frame-holds` · `how-it-is-going-is-a-shop-segment` · `one-supplier-hero` · `the-shop-sheets-open-without-a-request` · `rw309-fits-375-and-presses-at-44` · `share-buttons-use-one-icon`.

**Not in this PR (by the controller's scope):** "Your halls" stays in Clients ⚙ — it moves with the Spaces build. Spaces itself and the #7968 rework stay with the availability builder.

**Left reachable, said plainly:** the Cover screen (`?view=cover` — See cover photo · Choose from Portfolio) has no door on the cover any more; "Choose cover photo" is on Your page › Cover as before. "See profile photo" and "Adjust profile photo" for an existing logo are still in the Logo screen (`?view=logo`), which a tap now opens only for a verified shop; for everyone else the tap is the picker, and re-framing the current logo is on Details › Name and logo, as before.

**Motion:** none added, none removed.

SPEC IMPACT: None — the ruling and the drawing are already in the corpus (specs `19f46fd5`).
