## 2026-09-13 · feat(invite): the last door hands over the guest's QR, and a returning guest can reach it

Owner, 2026-09-13: *"they get to see the QR Code so they can directly go to the event hub with
their custom QR. just to save the qr and of course they have a button to proceed and see the event
hub"*.

**Door 03 (`app/[slug]/invite/enter/page.tsx`)** used only to SAY the QR was waiting on the next
screen — and in the save-the-date phase `qr_card` is out of phase, so on the commonest arrival it
was not waiting anywhere. The door now renders the guest's own invitation QR, prints the address it
encodes, and offers the shipped `GuestCodeKeepers` pair (Save the code / Copy link). The
phase-aware proceed button is untouched: same `/{slug}` destination, same `arrivalDestinationFor`
words.

**Door 02 (`app/[slug]/invite/reply/page.tsx`)** gives a guest whose `rsvp_status` is no longer
`pending` a visible way onward to door 03. The 2026-09-10 ruling that sends a returning guest
straight to the Reply door is NOT reversed — this is an addition to where they land, not a change
to it. No reveal is replayed.

**New:** `app/[slug]/invite/_components/invite-qr-panel.tsx` — a small presentational panel that
receives a pre-rendered SVG and a url and takes no id, token or parameter of any kind. The image
comes from the SAME `renderInvitationQrSvg` / `buildInvitationUrl` the Event Hub's own invitation
card uses, and the save is the SAME `/api/guest/qr` route (cookie-authenticated, no id in the path,
`Content-Disposition: attachment`). The paid branded PNG at `/api/website/qr/guest/[guestId]` is
deliberately NOT used: it requires a Supabase auth user plus the CUSTOM_QR_GUEST order, and an
invite-link guest holds a guest-session cookie and usually no account at all.

Guarded by `app/[slug]/invite/the-last-door-hands-over-the-qr.test.ts` (12 tests), and the new panel
is picked up for free by the existing `every-qr-surface-can-be-kept.test.ts`.

SPEC IMPACT: None — this implements an owner instruction against shipped mechanisms; no locked
decision, SKU, price or schema moves.
