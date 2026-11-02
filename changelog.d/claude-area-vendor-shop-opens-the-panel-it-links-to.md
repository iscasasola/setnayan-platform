## 2026-09-19 · fix(vendor-shop): a link into a My Shop panel opens it; the Website tab says "live" only when it is (AREA-VENDOR)

My Shop's four panels always started closed and nothing read the address, so three doors landed on a shut fold: Instagram's OAuth callback (`#gallery-media` + the connect result — both inside the closed Website panel, so the supplier was told nothing either way), the Website tab's "Edit page", and Performance's "Add recent photos" (which went to the retired `/vendor-dashboard/profile` redirect). `ManageTiles` now opens the panel named by the hash (on load and on `hashchange`, mapping in `manage-tiles-hash.ts`) and renders Website open on the server when the page carries an Instagram result; the two links point at `#website` / `#gallery-media`.

The Website tab decided "live" from `public_visibility` alone and printed "Open live" for a page couples get a 404 on (the public page also requires `verification_state = 'verified'`). It now uses `isShopLive`, says "Open preview" with a "Only you can see this page" notice until then, and the not-live copy no longer says "verification is underway" is enough.

Also adds `build-sessions/AREA-CHECKLIST-VENDOR.md`, the owner's click-test list for the supplier pages.

Test: `app/vendor-dashboard/shop/a-link-into-a-shop-panel-opens-it.test.ts` (each door checked from where it is declared; ManageTiles rendered open/shut). Five sabotages each turn it red.

SPEC IMPACT: None.
