## 2026-09-11 · fix(vendor-page): a shop's own logo no longer breaks its share card

Follow-up to E1 ("a shop's link preview never breaks"). Verified live in
production immediately after E1 deployed: `saysay-live-band…` (no logo)
served its card fine; `setnaprod` (has a logo) 302'd to the static brand
fallback — the exact broken-share failure mode E1 existed to close, now for
shops WITH a logo instead of without one.

**Root cause:** `lib/social/vendor-card.tsx` embedded the shop's logo as a
data-URI `<img>` node inside the satori tree. Satori reads an `<img>`
node's `src` off a TOP-LEVEL prop, but this file's own `el(type, style,
children)` helper puts its second argument under `props.style` — correct
for every other node here (satori reads a div's box model off `style`),
silently wrong for `<img>` (`props.style.src` is not `props.src`). Every
render threw `Error: Image source is not provided.`, caught by the route's
catch-all, which 302'd to the brand card. Reproduced locally against the
real `setnaprod` fixture's actual logo (fetched from its public R2 host,
read-only) before writing the fix — the isolated repro throws the identical
stack the production 302 implied.

**Fix:** the logo is never handed to satori at all now. `renderVendorOgPng`
renders a text-only card (zero image awareness), then composites the
separately-fetched, `sharp`-normalized logo tile onto the finished PNG at a
fixed corner position via `sharp`'s `.composite()` — the same proven
technique `lib/social/profile-card.tsx` already uses for its hero photo.
Visually verified locally (satori/sharp render fine in this install; only
the `server-only`-guarded module import is blocked for `node:test`) against
the real logo — a clean, on-brand card with the badge correctly placed.

Guarded by new `lib/social/vendor-card.test.ts` (3 tests, source-scan
pattern — the same constraint the rest of `lib/social/` lives under: these
modules carry `import 'server-only'`, not installed for `node:test`, so
none of them are import-tested directly): pins that the module never hands
satori an `<img>` node again, that the logo is composited via `sharp`, and
that a missing/broken logo still returns a valid card. Mutation-checked
RED (reintroduced `el('img', …)` → 1 test failed) then restored from an
explicit backup.

SPEC IMPACT: None.
