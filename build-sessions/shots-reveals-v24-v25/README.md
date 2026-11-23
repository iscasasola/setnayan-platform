# Reveals v24 + v25: one frame strip per new design (390 px, light over dark)

Each file is one design: the top row light, the bottom row dark; left to right the closed reveal, then frames after a
guest's swipe (a swipe throws a reveal open; the tap's hands-free open passes through the same states, slower).

- `classic-flap-*` the seven flap shapes (scallop is the default) · `gatefold-panel-*` the six new panels, sealed ·
  `fabric-*` the six new fabrics · `gift-lining-*` six linings (seen once the lid is off) · `gift-floor-*` nine floors ·
  `gift-around-*` eight arrangements.
- Rendered from the guest Event Hub lab, `/dev/maker-lab/guest?veil=1&opening=<id>&flap=|panel=|fabric=|lining=|floor=|around=`,
  the real `RevealMount` + overlay + stage over the lab's sample cover; headless Chromium, software WebGL, one frame =
  exactly 1/60 s (`window.__revealFrameClock`).
- Light and dark differ only in the browser's colour scheme: the guest Event Hub dresses itself from the couple's own
  theme, and the reveal covers it until it opens.
- Not shown: real phones, real fingers, the full hands-free open of every design (one hands-free gift box open was
  watched in the lab: closed, the bow undone, the lid, the card a window onto the page).
