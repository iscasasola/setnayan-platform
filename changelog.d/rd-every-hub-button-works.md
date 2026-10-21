## 2026-10-21 · fix(hub): every press a guest makes on the Event Hub is 44 px

Owner, 21 Oct: *"Can you also check the buttons on the event hub if all works"*. A Playwright walk pressed every
control on the guest Event Hub — `www.setnayan.com/maria-and-jose` signed out and read-only (every non-GET request
aborted in the browser), and the `/dev` labs as a guest with a pass — at 375 px touch and 1280 px. It found every
control reaching where it should: no fragment link to a missing id, no dead handler, no console error on the Hub's
own presses. What it found instead was a family of presses smaller than a thumb, each fixed with a 44 px floor:

- the venue card's **Google Maps · Waze · Apple Maps** chips (`NavLinksRow`, Invitation and The Day) — 26 px tall,
  side by side; the map's **© OpenStreetMap** credit — 20 px (now a 44 px corner, the credit drawn as before);
- the photo viewer's **Close** (40 px wide) and its **Open full size** link (28 px), on Our Photos, Photos of you and
  the live wall;
- the guest's **QR sheet ✕** (32 px), the **Live hub** and **Account** corner pills (40 px), the Live hub's
  **back arrow** (36 px) and its More sheet's ✕ (32 px), the door pass ✕ (40 px);
- **Save the code** (30 px) beside Copy link, Watch live's **Open on Facebook** (30 px), the Save the Date's
  **Add to calendar** (40–42 px), **Find your seat** (42 px), the empty-state and back-cover doors (38–40 px),
  the venue page's **Try again** (36 px), the selfie step's ✕ and ⓘ (36 px), **View larger map** (32 px),
  the guest-to-host line (40 px);
- the Messenger / Instagram **in-app bar** links (32 px) — now 44 px inside the SAME 44 px bar (the bar's padding
  moved into the links);
- the guest checklist's **tick box**, which the global `button { min-height: 44px }` had stretched into a 28 × 44
  bar — the button is now a 44 × 44 press around the 28 px box, drawn as before.

Guard: `app/[slug]/every-hub-press-is-44px.test.ts` — every `<a>` / `<Link>` / `<button>` / `<summary>` under
`app/[slug]` (and the shared presses the Hub mounts) whose classes size it reaches 44 px in each axis they size.
Sabotaged three ways (chip floor removed · QR ✕ back to `h-8 w-8` · the global button floor removed), each RED,
restored GREEN.

SPEC IMPACT: None — the 44 px floor is the existing house rule (`globals.css` "Touch targets ≥ 44pt"); no copy,
layout or ruling changes.
