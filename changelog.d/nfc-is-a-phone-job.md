## 2026-09-20 · feat(nfc): writing a tag is a phone job — say so on a desktop; the guest card and a batch list

Owner, after writing his first tag: *"can we only set this for mobile version
since phones are the ones who can do NFC writing? if attempted on desktop, it
should say, you need to run this on your mobile device"* — plus yes to the
guest card and the bulk list.

**1 · A desktop is the wrong DEVICE, not an unsupported browser.**
`nfcDeviceKind()` (pure; takes the browser's pointer, touch, UA and screen
width) answers phone-or-desktop, and `nfcWrongDeviceCopy()` gives each its own
sentence: a computer is told writing happens on a phone and offered the link to
carry over; an iPhone browser is pointed at the Setnayan app; an Android
browser at Chrome. The sheet's heading becomes **"Do this on your phone"** on a
desktop. iPadOS reports a Mac user-agent, so touch + a tablet-sized screen is
what identifies it, not the UA alone.

**2 · The guest's own card carries the strip.** `guest-detail-body.tsx` (the
one body both the roster inspector and the mobile drawer render) now shows
Download · Write to NFC · Copy link on that guest's own invitation link. The
link is built from a new `invitationBase` prop — the event's public address
without the token — resolved once per page in `fetchInvitationBase()` and
threaded through `GuestDrawerHost`. Before this, the card offered only a
Download that 403s without the branded upgrade.

**3 · A batch list, because 180 guests is not 180 taps.** `lib/tag-list-csv.ts`
+ `TagListDownload` put "Tag list (N)" beside Print sheet on the Invitation
page: every guest's name and tag link as CSV, for a desktop NFC writer or an
encoding service. RFC-4180 quoting, CRLF, and a leading `=`/`+`/`-`/`@` in a
NAME is prefixed with `'` so a spreadsheet treats "-Anna" as text, not a
formula.

Guards: `lib/nfc-is-a-phone-job.test.ts` (4) · `lib/tag-list-csv.test.ts` (5) ·
the mount count in `every-qr-carries-the-strip.test.ts` goes 9 → 10.
Mutation-checked: the desktop copy reverted to the generic line, the guest
card's strip deleted, and the CSV's quoting removed — each red. tsc 0, lint
clean, 47 NFC-suite tests green.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 NFC row — device-aware copy, the
guest card, and the batch list. No schema · no SKU · no price.
