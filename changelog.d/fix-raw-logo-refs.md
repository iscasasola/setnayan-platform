## 2026-08-02 · fix(vendors): vendor logos were rendering as raw `r2://` refs — broken images, found by the CSP reports

The source of the `img-src r2://setnayan-media` violations in #4042. **Not a
policy gap — a real broken image**, and wider than one surface.

**The contract, and the half everyone forgets.** `vendor_profiles.logo_url`
**stores a raw `r2://` ref** by design (`vendor-dashboard/actions.ts` writes
`logo_url: logoRef`). `VendorAvatar`'s docblock states the other half: *"a raw
`r2://` ref will not render, so pass the resolved URL or null."* Consumers must
call `displayUrlForStoredAsset` server-side. Several don't.

**Confirmed against prod, not inferred:** one of the two vendor profiles holds
`logo_url = r2://setnayan-media/vendors/…/logo/…-setnayan-mark.png`.

**Fixed here (both traced end to end):**
- **`onboarding/wedding/actions.ts`** — the LIVE offender. `toResult` handed the
  raw ref to the client and `onboarding-shell.tsx` dropped it into
  `backgroundImage: url(...)`, so the vendor picker rendered a background that
  cannot load. This is what fired the CSP reports — one per card, which matches
  the 01:34–01:45 and 03:19 clusters.
- **`lib/spotlight-awards.ts`** — the public homepage Spotlight builder. Latent
  **only** because the strip is double-gated and inert by default; it would have
  broken on the day it was switched on.

Both resolve in a single `Promise.all` (each call is a separate signing round
trip) and `.catch(() => null)` — a signing hiccup degrades to the existing
initials/placeholder tile, never to a broken image. `displayUrlForStoredAsset` is
idempotent, so a legacy plain URL passes through untouched.

### ⚠ The scan found NINE, and seven are still outstanding

New `lib/stored-asset-render.test.ts` scans every `.tsx` for a stored-asset field
rendered straight into `src={…}` or `url(${…})`. The failure is silent by nature
— a broken `<img>` renders as nothing, throws nothing, and any test mocking an
https URL will never see it — so a source scan is the only thing that finds it.

The seven remaining are **allowlisted, not excused**: a second test fails if an
entry stops matching, so the list can only **shrink**. Each needs its own data
source traced and resolves batched, which is bigger than this PR.

🔴 **Do `app/explore/_components/folder-vendors-section.tsx` next** — the LIVE,
public Explore marketplace. Verified genuinely raw: `explore/page.tsx` selects
`logo_url` in its vendor query, and its only `displayUrlForStoredAsset` call
resolves **category** photos, not vendor logos.

Also outstanding: `explore/compare`, `proposals/[publicId]`, `vendor/lock/[token]`,
`vendor-invite/[slug]`, `blog/[slug]` partner credit, `HomeSpotlightStrip` (its
builder is fixed here; the component still takes the field name), and the two
admin studio surfaces.

Full unit suite **6165 pass / 0 fail**; both changed files parse clean via the
TypeScript compiler API. ⚠ Full `tsc --noEmit` still cannot run here (heap
exhaustion) — **no green typecheck claimed**; CI is the authority.

SPEC IMPACT: None. Display resolution only; no schema, contract or policy change.
