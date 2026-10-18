## 2026-10-18 · perf(maker): 13.8KB of first-load headroom — panels, Go live and the ⋯ sheet's QR strip load on open

The Event Hub Maker's first-load JavaScript sat AT its ceiling (507.0KB gz of 507.0KB, `check-maker-js-budget.mjs`
on main 1e5178d), so any merge — even copy-only (#6643) — tipped it over through the webpack runtime's chunk hashes.
Measured with source-map byte attribution per module, the biggest pieces in the cold open that are never drawn
before a tap were moved behind the existing `maker-details` lazy group (`details-lazy.tsx`):

- the Maker rows' media panels (`HeroPhotoPanel` · `GalleryPanel` · `SiteChromePanel` · `VisibilityPanel` ·
  `OpenBrowsePanel` · `LaunchPhasePanel` · `RsvpBackdropPanel`) — drawn only when a row / look page opens; each is a
  whole panel with its own form, so a panel not yet arrived is a slot, never half a form;
- the ⋯ sheet's "Go live" control (`LaunchStdButton`);
- the ⋯ sheet's Scan to view + Pro CTA (`MoreExtras`, moved out of `editor-shell.tsx` into `more-extras.tsx`), which
  carried the QR strip's NFC writer and tag codec (~4.6KB gz alone).

Result (CI env build): Maker first load 507.0KB → 493.2KB gz (13.8KB headroom, budget unchanged at 507KB); shared
bundle unchanged at 201.8KB / 202KB (no new async chunk name, so the every-page runtime gains no entry). No behaviour
change: the same components, props and places; the standalone save-the-date page still imports `LaunchStdButton`
directly. Guards that read `MoreExtras` / the QR strip (`every-qr-carries-the-strip.test.ts`,
`the-maker-lower-third-holds-every-tool.test.ts`) now read `more-extras.tsx` (sabotage: red → restored green).

SPEC IMPACT: None.
