## 2026-07-10 · fix(marketing): make nav popups opaque + fix unreadable /vendors hero headline

The two slim nav popups (Prices — "Everything to start — free." · Vendors —
"A whole business — free.") rendered on a translucent `rgba(251,251,250,0.6)` +
`backdrop-filter: blur(16px)` frosted-glass card, so the blurred page photos
behind them bled through and washed out the copy. Switched `.hr-ov-card-glass`
to a SOLID near-white surface (`var(--hr-bg)` + `var(--hr-line)` hairline, no
backdrop-filter) so the popup text is fully readable. The dimmed
`.home-reskin-ov` backdrop still isolates the popup from the page. Removed the
now-redundant translucent close-button override — it falls through to the base
solid-white `.hr-ov-x`.

Separately, the `/vendors` photographic hero headline ("Everything your business
needs. Set na 'yan.") used `.m-display`, which hard-sets `color: var(--m-ink)`
(dark navy) and overrode the header's inherited `#fff` — so the headline
rendered navy-on-photo and was illegible despite the dark scrim. Added an
explicit `color: '#fff'` inline override on the `<h1>`.

The two popup destination pages (`/pricing`, `/vendors`) already use the opaque
`m-*` marketing system and needed no de-glass pass beyond the hero fix above.

SPEC IMPACT: None (visual/readability fix; no pricing, SKU, or schema change).
