## 2026-11-19 · feat(theme): the admin dashboard is monochrome — its buttons keep their colour

Owner, 19 Nov 2026, verbatim: **"then admin dashboard is the black and white color but buttons will stay colord.
just the background. same effects. just monochromatic"**. Colour by role is now three sets in one token system:
events = the light terracotta (the app's own) · supplier = the light blue · **admin = black, white and grey**.
Stacked on dark mode PR 1 (the one colour set).

- **A scope, tokens only** — the supplier look's mechanism. `app/admin/template.tsx` carries `data-admin-look`
  and loads `app/admin/_components/admin-look.css`, which re-points the one colour set while an admin page is on
  screen. Light: page `#F5F5F5` · card `#FFFFFF` · tile `#F0F0F0` · wash `#E8E8E8` · words `#1F1F1F` / `#3D3D3D` /
  `#666666` · grey lines · the hero band grey into white. Dark: page `#0E0E0E` · card `#1A1A1A` · tile `#242424` ·
  wash `#2E2E2E` · words `#F5F5F5` / `#D0D0D0` / `#A3A3A3` · the hero a dark grey card lit white from one corner.
- **The same effects, in greyscale:** the hero band and its glow, the ground's three soft lights, the card lift.
- **Buttons and accents keep their colour.** The scope names none of the decision, toggle, money, private,
  status, category or gold tokens, so they paint exactly what the app paints.
- **This changes Light on admin on purpose:** the warm neutrals (page `#F7F5F4`, warm ink `#2C2A29`, warm lines)
  become neutral greys on every admin page.
- **Admin dark is written, not switched on.** `/admin` is NOT on `DARK_READY`: its screens have not been swept for
  hard-coded colours (the 22 Oct rollout map counted 716 in 109 files). The dark set waits for that sweep.
- Guard `the-admin-look-is-monochrome.test.ts`: the template wears the look · tokens only · every colour written
  in the file is a grey (r = g = b) · no button or accent token is named · every text/surface pair at AA in both
  themes · `/admin` stays off the ready-list until swept.

**Not verified:** one admin screen was rendered (the admin shell lab, with the look applied in the capture, since
labs do not mount the admin template). Admin screens that paint hard-coded warm colours of their own will still
show them until they are swept.

SPEC IMPACT: None new — the controller logs the 19 Nov ruling.
