## 2026-09-18 · fix(chat): one chat box everywhere — the client page and the couple's workspace stop embedding their own copy (S18)

Owner, after #5586 served: **"why did the chatbox never change?"** #5586 turned the two THREAD pages
into one Messenger-style frame. The page the supplier actually lands on — `/vendor-dashboard/clients/[eventId]`
— and the couple's `/dashboard/[eventId]/vendors/[vendorId]/workspace` each still embedded their OWN copy of
the chat under the flag-on `RelationshipTabShell`: two navigation rows above a conversation #5586 never
touched.

- **A chat landing on either page now lands on THE conversation** — the thread page, the one frame. Both
  pages redirect `?tab=chat` / `?tab=call` / no tab to their thread page (flag-on only; flag-off keeps its
  "Open chat" button, which already went there — the two shells now agree where chat lives). Their sections
  stay reachable by `?tab=` and are now behind the frame's ⋮ (supplier: Quote & payments · Files & contracts ·
  Schedule · Full customer profile; couple: Quote · Payments · Files · Schedule · Booking details).
- **The strip keeps "Chat" as a door, not a room** — `RelationshipTab` gains `href`; a link tab renders as an
  anchor in the same shape, is never selected and has no panel. The Call tab is gone on both sides (the call is
  the 📞 icon on the composer row). The supplier's six-button action row is gone under the flag-on shell —
  every button has a home in the frame (New quote · Log payment · Call are tools on it; Contract, Files,
  Schedule are in its ⋮ and in the strip).
- **Three things the owner saw on that page, fixed:** the next-move tile said *"Quote sent — follow up while you
  wait"* to a supplier whose couple had accepted and ASKED TO BOOK (the one state with a fuse) — the chain now
  lives in `lib/supplier-next-move.ts`, executed by its test, with rungs for a request to book and an accepted
  quote; the pipeline strip read *"Quoted"* in the same state — it now reads *"Asked to book"* / *"Quote
  accepted"* on the current rung (`pipelineCurrentLabel`); and the privacy notice told the SUPPLIER *"your
  vendor sees what they need from your profile"* — `ChatPrivacyNotice` takes `viewer`, the supplier frame
  passes `vendor`, the couple's 0019 canonical string is byte-identical.
- **QuoteTab's "New quote"** opens the frame's Build-a-quote tool (`#build-quote`) instead of leaving for the
  proposals list.

Guards: new `lib/one-chat-box-everywhere.test.ts` (the stream is mounted in exactly the two thread pages,
counted across `app/`; the redirects, the link tabs, the ⋮ sections and the notice reader are all counted) and
`lib/supplier-next-move.test.ts` (every rung executed). `the-lock-step-tells-the-truth` scan floors re-pointed
from 4 mounts / 2 callers to 2 / 1 — the assertion (every mount passes the handshake) is unchanged.
`port-control-baseline.json` regenerated: the client route and the workspace route drop the chat blocks they
no longer render and the `?tab=chat` destination; nothing is lost — the thread pages render every one of them.

SPEC IMPACT: `0019_communications` § Gate — the pinned privacy notice gains a vendor-side EN string (the
couple's canonical string is unchanged); `DECISION_LOG.md` row added.
