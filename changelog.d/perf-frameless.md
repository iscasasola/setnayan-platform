## 2026-07-02 · style(vendor): de-card static readouts on My Performance (frames = clickable)

Applies the affordance rule "a frame means you can click it" to the vendor My
Performance cockpit (owner 2026-07-02: *"if the card is unclickable, remove its
framing, only place a frame if it is a button"* → full de-card).

Removed the `rounded border bg-white` box treatment from every **static** card so
the numbers/charts/tables sit flat on the page, grouped by the section labels +
spacing added in the arrangement pass. Kept the frame only on genuinely
interactive elements.

De-carded (border + white box stripped): Momentum stat tiles · ROI ("Setnayan vs
your own book") incl. its empty + honesty-footnote panels · Funnel · Bookings/
Views by source (`SourceBreakdown`, shared — also flattens the /demand own-data
strip) · Inquiry handling (tiles + slipped-leads + heatmap panels) · Conversion
& deals · Reputation · Capacity · the per-service booked callout on page.tsx.

Kept framed (intentionally — these ARE interactive or the signature surface):
Health composite hero (a clickable/expandable card) and its Growth-tips reveal
(white-on-dark, each carries a CTA) · the Daily/Monthly/Annual filter pills · the
service-scope `<select>` · the funnel's tap-to-expand rows · upsell CTAs.

Data-viz bars/rings, mono label chips, and empty-state text are untouched (not
"frames"). Spacing is preserved by each card's existing `space-y-*` parent, so no
panels collide once unboxed.

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (visual/affordance pass; no data, pricing, or logic change).
