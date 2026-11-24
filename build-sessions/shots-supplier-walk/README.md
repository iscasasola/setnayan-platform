# Supplier walk shots: Shop and Toolkit on live 7247a56 (read-only, signed in)

Taken in the app's browser pane, which is signed in as the walk account. Headless Chromium has no sign-in, and the owner's session cookie is not copied. The 390 px shots emulate a phone (touch pointer, `pointer: coarse` confirmed). Each shot was taken after a 3.5 s settle.

| File | What |
|---|---|
| `shop-390-light.jpg` | Shop, 390 × 844, light |
| `shop-390-device-dark.jpg` | Shop, 390 × 844, device set to dark |
| `toolkit-390-light.jpg` | Toolkit home, 390 × 844, light |
| `toolkit-390-device-dark.jpg` | Toolkit home, 390 × 844, device set to dark |
| `shop-1280-light.jpg` | Shop, 1280 × 800 (pane scaled to 800 × 500) |
| `toolkit-1280-light.jpg` | Toolkit home, 1280 × 800 (pane scaled to 800 × 500) |

**Dark:** neither page is on the dark ready-list (`DARK_READY` in `lib/appearance.ts`). Only `/vendor-dashboard/clients$` and `/vendor-dashboard/customers$` are on it for suppliers. So both pages paint light on a dark device, by design. The "device dark" shots prove it: `prefers-color-scheme: dark` is true and `html.dark` is absent. No desktop dark shots were taken; they would be the same as light.

**Seen:**
- Desktop Shop › Analytics: the "30 days · 12 months" switch is wider than the narrow two-column card. "12 months" runs past the Opened and Asked cards, and the carousel edge cuts it off (`shop-1280-light.jpg`). Source: `app/vendor-dashboard/performance/_components/analytics-carousel.tsx`, `control` → `<PillSelector … grow={false}>`.
- The Toolkit says "11 widgets · 29 graphs · **6** badges"; `/for-suppliers` says "11 **tools** · 29 graphs · **5** badges". Two lists: the store counts its own badge read (`store-screens.tsx` `toolkitCounts(d.badges)`), and the front page counts `SHOP_BADGE_KEYS` (`supplier-front-data.ts` `BADGE_ROW`).
- The Toolkit's paid widget price line ("One-time · Plus, Pro or Ultra") wraps to 4 short lines beside "Buy" at 390 and at desktop (a look note only).
