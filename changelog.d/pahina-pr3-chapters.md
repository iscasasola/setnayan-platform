## 2026-07-26 · feat(guest-site): Pahina wave A PR-3 — chapter grammar (story · details · programme · dress code)

Third PR of the Pahina premium-guest-site reskin (design `Premium_Guest_Site_Design_Spec_2026-07-25.md`
§5/§7, build plan §1 PR-3 + §5). Targets the wave branch `wave/a-pahina-reskin`, not `main` —
the owner previews the whole wave once and it lands in a single merge (§12 cost discipline).

The editorial body stops speaking in identical rounded-cream cards and starts speaking in
numbered chapters, recessed plates, and hairlines.

**Chapter numbering established** (`№ 01` hero · `№ 02` story · `№ 03` details · `№ 04` programme ·
`№ 05` dress code · `№ 06` reserved for the gallery · `№ 07` RSVP — the last two land in PR-4).
Components that can co-occur with a numbered chapter carry an UNNUMBERED eyebrow instead, so no
page can ever show a duplicate №: `our-love-story-widget` (shares `love_story` with `OurStory`),
`venue-widget` (shares the details slot with `PublicEventDetails`), the two "Good to know" notes,
`tea-ceremony-card`, and `guest-column-card`. Per spec §11a the guest-personal layer is STARRED,
not numbered — `YourSeatBlock` uses a gild `✦`.

- `our-story.tsx` — chapter `№ 02`, drop cap on the opener, the second composed paragraph set as a
  gild-ruled pull quote, milestone rail with gild mono years. Left-aligned (§1: symmetry was the
  template signal). Composer logic and copy untouched; no text is duplicated between treatments.
- `empty-states.tsx` `PublicEventDetails` — `№ 03` over a paper-deep plate, gild mono WHEN/WHERE
  keys, display-face venue name. Still event-level facts only (anonymous-tier firewall unchanged).
- `venue-widget.tsx` — plate + gild mono CEREMONY/RECEPTION key. `NavLinksRow` (Maps/Waze/Apple)
  kept verbatim.
- `schedule-widget.tsx` — the **programme rail**: mono gild time column baseline-aligned to entries,
  hairline separators instead of stacked boxes, notes on a quiet left rule. All now/next logic
  (`pickTriggerNowNext`, wall-clock inference, run-of-show header, progress ring) is untouched.
- `dress-code-widget.tsx` — `№ 05` + **silk swatches** (tall fabric chips, inner shading, gild pin).
  INC and Muslim modesty fallbacks and the `genderNote` copy are verbatim.
- `site-body.tsx` — greeting becomes a left-aligned salutation with the guest's name in gild
  (personalization unchanged).
- Also restyled per build plan §5: `your-seat-block`, `tea-ceremony-card`, `guest-column-card`,
  `special-message-widget` + `what-to-bring-widget` ("Good to know" plates).

**Functional-color exile starts here** (§4). Removed from the guest tree: the
`border-success-300 bg-success-50/50` wrapper around the day-of promoted schedule in
`site-body.tsx` (emphasis now lives on the rail's live row — accent left rule + veil wash +
"Happening now" tag); the `success-*`/`danger-*` Do/Don't boxes in the dress code (now gild-ruled
veil and ink-ruled paper-deep — distinguished by key and rule, not hue); `warn-100`/`success-100`
in the venue band (now a veil→gild wash); and `text-emerald-700` in `your-seat-block`. The
remaining `success-*`/`warn-*` sweep under `app/[slug]/` is PR-4's.

`globals.css` — added `.pahina-dropcap`, `.pahina-quote`, `.pahina-swatch` (the three moves Tailwind
cannot express as utilities), and **moved the whole Pahina block into `@layer components`**. It was
unlayered, and unlayered CSS beats every `@layer` including utilities — so a `.pahina-plate` could
never be tuned with a Tailwind `bg-*`/`border-*`/`p-*` on the same element, which is exactly what
the chapter components need. Matches the convention already documented on the launcher fidelity
surfaces in the same file.

Verified: `tsc --noEmit` clean · `next lint` clean (0 errors) · **3356/3356** unit + golden tests
pass, including the `site-body-plan*` goldens (they lock the plan, not markup) · production build
compiles. Bundle delta nil — CSS and classNames only, no new dependencies.

Not verified: the local visual pass on the sample event. The dev server falls back to the anon key
(no service-role key in `.env.local`), so `/maria-and-jose` 404s under RLS. The visual pass is owed
on the `wave/a-pahina-reskin` Vercel preview — which is the owner's review surface for the wave
anyway, and the only branch previews are built for (§12 rule 2).

SPEC IMPACT: None. Visual reskin only — no schema, pricing, SKU, gating, or copy change.
