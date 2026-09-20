## 2026-09-20 · feat(checkin): the door desk reads a guest's NFC tag — plus a per-phone NFC test switch

PR 3 of NFC (#5721 strip · #5726 in-app writing). Owner: "build the NFC
check-in for guests too."

**Desk** (`app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx`):
a "Read a guest's tag" control beside the QR camera, shown only where the
device can read tags (the Setnayan app via the native plugin, or Chrome on
Android). A guest's tag holds the SAME invitation link as their QR, so the
desk resolves it with the SAME parser (`parseGuestQrPayload`, via
`guestTokenFromTag`) and lands on the same guest card. iPhone reads one tag
per press (CoreNFC's own sheet, then it closes); Android keeps listening
until Stop. Reader: `app/_components/use-nfc-tag-reader.ts`. Blank tags and
non-guest tags are named; read failures always offer the QR instead.

**Method recorded truthfully.** `guest_checkins.method` gains `nfc_tap`
(migration `20271234853164_guest_checkin_method_nfc_tap.sql`, re-listing
every existing value; constraint name `guest_checkins_method_check` verified
in prod; prod had 0 check-in rows). The desk now records the method from HOW
the guest was found (`selectedVia`) — previously it wrote `qr_scan` whenever
the camera happened to be on, even for a guest found by name search.

**Per-phone test switch.** The owner has only an iPhone, and iPhone writes
tags only inside the app, which loads the live site where the flag is OFF.
Opening any page with `?nfc-test=1` (in the app:
`setnayan://vendor-dashboard/customers?nfc-test=1`) turns NFC on for that
phone only, in localStorage; `?nfc-test=0` turns it off. Captured once at the
root (`<NfcTestSwitch />` in `app/layout.tsx`) so it works from any page.
Both NFC surfaces now ask `useNfcEnabled()` (flag OR opt-in); it is the
registered gate in `flag-chokepoint-scan.test.ts`. The shared device
detection moved to `app/_components/nfc-runtime.ts`.

Guards: `lib/the-desk-reads-a-guest-tag.test.ts` (4; mutation-checked: a
migration missing `nfc_tap`, the method inferred from the camera, the shared
parser bypassed — each red) · `lib/nfc-write-flag.test.ts` (4) ·
`lib/nfc-tag.test.ts` (13). ugat schema-claims + concept-coverage db tests
green. tsc 0 · lint clean · 363 tests across the 37 guards that read any
touched file.

Not verified: a real tap. Owner's iPhone-only steps:
`build-sessions/NFC-OWNER-STEPS.md`.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 NFC row amended (check-in read +
test switch). Schema: one CHECK vocabulary widened. No SKU · no price.
