## 2026-08-06 · fix(guest-site): the Gallery tab comes back after the wedding — and lands on the recap's photographs

A guest opens the couple's page on the wedding day, finds the pictures under **Gallery**, and comes back the week after to look at them again. The tab was gone. Not empty — absent, on the one visit the page is really for.

**Two independent causes, both silent, and the second is why fixing only the first would not have helped.**

**1 · The bar thought the wedding had not happened yet.** `DayOfPhase` is a *window*, not a timeline: `live` runs T-12h..T+36h, `post` runs T+36h..T+60h, and then everything falls to `inactive` — **the same value the page carries six months BEFORE the wedding**. `site-body.tsx` mapped `inactive → 'before'`, so from roughly the Monday after a Saturday wedding the bar reverted to its run-up shape: no Gallery slot, "Home" instead of "Recap", and Details/Story back on what is now a memorial page. The nav resolver in `_lib/site-nav.ts` was already written to draw the slot on `'day'` **or** `'after'` — it was simply never told it was `after`.

The mapping moved out of the component and into `_lib/site-nav.ts` as `navPhaseFor({ dayOfPhase, isRecapBody })`, next to the rules it feeds and under their test. The second input is the body the page is *actually rendering*: once the site has entered its post-event recap the wedding is behind us by definition, because that is the same verdict that put the recap on the screen. `post` stays an independent trigger — a wedding that ended yesterday is over whether or not the website-phases switch is on.

**2 · There was nothing to land on.** The two `menuSections.gallery` inputs pointed at the Live Photo Wall, which is a live-window surface. The after-the-wedding editorial carried **no `#site-gallery` anchor at all**, so the tap would have moved the page zero pixels.

The recap now stamps the anchor on the first photo block it actually draws — "As the Day Unfolded" / "Moments", "From the Day", or the Live Photo Wall — **in the couple's own saved section order**, so a couple who put the wall first gets Gallery landing on the wall.

**3 · The guest's own "photos of you" strip is deliberately NOT the answer.** It closes with the post-event grace (`loaders.ts` loads it only in the `live`/`post` windows: *"a no-login guest keeps access until ~24h after the wedding … then it closes for them (account-holders keep theirs forever in the Collection hub)"*). Pointing a permanent tab at a surface designed to expire would have re-created the same defect a day later. After the day the gallery is the recap's photo run, for guests and link-holders alike.

**🔑 The tab is drawn ONLY when the recap really drew photographs.** A recap with prose and no pictures is an ordinary outcome (nothing uploaded, no Papic captures, or the couple switched the photo blocks off). Drawing a tab for it would dead-end the tap *and* announce that photographs exist and are being withheld — exactly what the resolver's rule 3 forbids ("ANNOUNCE FEATURES, HIDE CONTENT"). So the presence flag and the anchor placement are **one derivation**, not two: `editorial/gallery-anchor.ts` is the single pure statement of which photo blocks render, read by `editorial-content.tsx` (where the anchor goes) and by `site-body.tsx` (whether the slot is drawn). `lib/gallery-after-the-day.test.ts` sweeps 512 input combinations asserting the two can never disagree — the drift this codebase keeps paying for.

**Cost:** `loadEditorialData` is now wrapped in React's per-request `cache()`, so `site-body.tsx` asking the recap what it drew is free — the recap was about to run the same loader on the same render. Scoped to one request, so nothing is shared between visitors and no presigned URL outlives its response.

**Unchanged:** the wedding-day behaviour (Gallery still lands on the Live Photo Wall), the /realstories sample and the print view (both leave `galleryAnchorId` null and render byte-identical markup), and the anonymous tier's editorial DOM, which is still the same single `EditorialContent` element for both identity tiers.

**Noticed, not fixed (different owner, worth a look):** `_lib/site-menu.ts`'s `browsableBodyRenders()` still returns `plan.openBrowse` for the `save_the_date` and `editorial` phases, but `phasedBody` stopped gating `normalBody()` on that flag on 2026-08-05 — so the guard now hides Details/Story tabs whose anchors do render. Its own docblock predicted this exact drift ("this predicate must mirror `phasedBody`; if you change one, change both"). Harmless after the day (both tabs are correctly absent in the `after` phase either way), live in the save-the-date phase.

SPEC IMPACT: None — no SKU, price, or schema change. Behavioural fix to an existing nav slot on the guest event site.
