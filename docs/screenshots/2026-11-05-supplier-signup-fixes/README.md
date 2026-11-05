# Supplier sign-up fixes — 390 px screenshots (2026-11-05)

Taken on a local `next dev` with a **dummy env** (Supabase pointed at an unused localhost port — nothing reached
production), Chromium 390×844 @2x. "Before" shots were taken on the same server with `origin/main`'s copy of the
changed file swapped in for a moment, then restored.

| File | What it shows | How |
|---|---|---|
| `item1-before-open-shop-address.png` | `/open-shop` step 4, signed out, typed an address → "Couldn't find that" | the real page |
| `item1-after-open-shop-address.png` | same, after the fix → pin dropped, city "Quezon City", the confirm card | the real page |
| `item4-before/after-recaps-empty.png` | the empty Recaps page with / without the "Coming soon" tag | a dev-only harness repeating the page's empty-state JSX (the real page needs a signed-in shop) |
| `item4-before/after-plan-addons.png` | Vendor AI, 3D Booth, Papic Challenges and Instagram cards with every switch OFF | a dev-only harness mounting the REAL card components |
| `item5-before/after-claim-door.png` | the couple's-own-link claim door, without / with "Sign in & claim" | `/dev/add-your-own-lab?s=claim` (mounts the real `CoupleLinkDoor`) |
| `item5-after-finalize-refused.png` | `/finalize` refusing a personal (customer) account — link not spent | a dev-only harness repeating `NotASupplierShell`'s JSX (the real route needs a signed-in session + a live invite) |

⚠ Item 1: the sandbox could not reach Nominatim or the OSM tile servers (proxy 403), so the dev server ran with a
stub answering the two Nominatim URLs with a fixed Quezon City result, and the map tiles are grey. The "before"
shot used the same stub — it still missed, because the old session check returned before any lookup.
