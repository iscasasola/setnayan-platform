## 2026-09-25 · fix(guests): the drawer's QR is the real one, and every QR download saves instead of navigating

Owner, verbatim: *"the QR on guest list on initial popup when it shows from
the right side, is not real. the person needs to click download photo to see
the real QR. it should already be the real QR."* And: *"When we try to
download the QR code, when that button is pressed. it should just save and
not open a new page."*

- The Guest list drawer (`guest-detail-body.tsx`) used to draw `DecorativeQr`
  — an SVG pattern seeded from a hash of the guest's `qr_token`, distinct per
  guest, but encoding nothing. Scanning it did nothing. It now renders an
  `<img>` of the same gated route the Download control already used
  (`/api/website/qr/guest/[guestId]`) — the preview IS the download, inline,
  so there is one generator and one payload by construction.
- That route was also missing `Content-Disposition: attachment` — the likely
  root cause of "opens a new page instead of saving": a browser that ignores
  the anchor's `download` attribute on a same-origin GET (iOS Safari, the
  Capacitor iOS shell both do) renders an unnamed PNG as a page. It now names
  the file with the same `guestQrFileName` helper `/api/guest/qr` uses.
- Added `SaveFileLink` (`app/_components/save-file-link.tsx`): fetch → blob →
  object-URL, or the native share sheet where `navigator.canShare({ files })`
  is available, in place of a bare `<a download>`. `href`/`download` stay on
  the anchor as the no-JS fallback. Wired into the shared `QrActions` strip,
  the drawer's own Download control, and the Guest list's "Download QR codes
  (PDF)" button (`roster-tabs.tsx`) — every QR/PDF download on the Guest list
  and its drawer now goes through it, and none of them use `target="_blank"`
  or `window.open`.
- `CUSTOM_QR_GUEST` is already free for every event (`FREE_FOR_ALL_SKUS`,
  `lib/entitlements.ts`) and the Guest list + drawer are not in
  `STORE_SHELL_HIDDEN_ADDON_KEYS` / the store-shell web-only routes — both
  re-checked, neither changed.

SPEC IMPACT: None.
