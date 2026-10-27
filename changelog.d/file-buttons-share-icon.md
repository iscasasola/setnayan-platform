## 2026-10-28 · fix(files): every file button wears the Share icon, not the download arrow

Owner, 27–28 Oct: *"the button should be like the share icon where they can download it view it, open the file"* ·
*"yes share"*. Every control that hands the person a FILE — prints and the Prints carousel, PrintSaveButton's default,
the QR strip (`QrActions`) and QR card, pass / ticket / guest-code saves, budget CSV + ICS, contract PDFs, emcee
script, entrance chart, Papic / Memories "Download all" and photo saves, reels, teasers, the thank-you film, the
monogram files, Pabuya QRs, the vendor calendar `.ics`, the data export, the blog planner PDF, the guest-list
template — now wears lucide `Share` (the box with the up arrow, the mark the Guests "Save as Excel" ≡ choice already
wore), never `Share2` (the "share a link" node). Words unchanged; sizes and stroke widths kept. Icons that name what
the file is (CalendarPlus, Table2, Printer) stay.

- New guard `lib/a-file-button-wears-the-share-icon.test.ts`: no file in app/ (admin, dev aside) that mounts a save
  mechanism imports a download arrow, and lucide `Download` is imported only by a named allowlist (the desktop-app
  download page; the chat attachment chip, PENDING its chat builder). Seen failing by sabotage, then restored.
- `studio-screens-follow-the-prototype` and `every-qr-carries-the-strip` now pin `Share` where they pinned `Download`.

SPEC IMPACT: DECISION_LOG 2026-10-28 "CHAT — EIGHT OWNER ANSWERS" (7) — implemented as recorded; no corpus edit.
