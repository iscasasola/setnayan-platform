## 2026-09-01 · feat(panood): the product film Papic already has

`/panood` now carries `PanoodFilm` (`app/(shell)/panood/_panood-film.tsx`), a landscape (16:9)
sibling of `/papic`'s `_papic-film.tsx` — same hand-called `play()`, same autoplay-refused
fallback to native controls, same "record the real product, never a mock-up" rule. It is wired in
through `DoorwayPage`'s existing, previously-unused `children` slot (renders after the
differentiator, before the FAQ), so the shared archetype needed no change.

The asset (`/add-ons/demo/panood.mp4` + `.jpg`) does not exist yet — recording it is the owner's,
per L3's scope. Until it lands, the `<video>` 404s and `onError` flips a `missing` flag that
renders nothing (no broken box, no placeholder standing in for the product).

**Claims audit (the deliverable, not just the component):** `DoorwayPage`'s hero carries no
kicker/lede (owner-locked 2026-08-19) — h1, two CTA labels, and the demo button's label/sublabel
are the only above-the-fold copy, and the one product-interface claim among them ("Both phones
scan one code and become cameras. You cut between them.") is already proven live by the existing
interactive demo, not merely by a recording — so it needed no edit. No above-the-fold copy was
removed or reworded. The new film section's own caption was written to describe only what the
control-room recording can show — cutting between two camera feeds on the shipped controller
(matching `panood-demo-overlay.tsx`'s own control panel) — and deliberately does not claim the
guest-side Event Hub view, which this film does not capture.

SPEC IMPACT: None.
