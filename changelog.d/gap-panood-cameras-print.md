## 2026-07-24 · fix(live-studio): build the camera-operator print sheet (gap audit · G)

Gap audit 2026-07-23 · Batch G. The Live Studio cameras page
(`studio/panood/cameras`) has a "Print the QR sheet" button pointing at
`studio/panood/cameras/print` — a route that was never built, so a couple who
bought Live Studio and clicked it got a 404. (Owner 2026-07-24: build the page.)

Adds `studio/panood/cameras/print/page.tsx`, mirroring the working Papic
photo-crew print pack (`studio/papic/crew/print`): one scannable A4 card per
camera seat with its claim QR + URL, `⌘P`/`Ctrl+P` to print or save as PDF, same
force-dynamic + control-room-member authorization as the cameras page.

Security: only UNCLAIMED cameras are printed — a claimed camera's `claim_qr_token`
is a live seat-hijack credential (the cameras page already hides its QR on
screen), so it stays off the print sheet too. All-claimed → a friendly "nothing
to print" state. The token never crosses to the client; only the built claim URL
+ rendered QR do.

SPEC IMPACT: None — builds a promised surface behind an existing button.
