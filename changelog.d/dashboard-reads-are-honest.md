## 2026-11-02 · fix(dashboard): refused reads never look empty — the FX-HONEST batch (event-dashboard audit)

Each reader binds its error and the refusal reaches the render as "couldn't load" + a way to retry, never 0, "none", "not a guest" or "not valid" (the pattern of `vendor-dashboard/reads-are-honest.test.ts` and `guests-read-is-honest.test.ts`):

- **Door (#5):** `checkTicketLive` returns `unreadable` on a refused read; the desk decides from its saved list, never "That QR isn't a guest".
- **Invite / join doors (#13):** a refused token or event read throws to the error page, never "This invite link isn't valid".
- **Hub seat tile (#34):** "Couldn't load your seat · Reload", never "Not yet assigned" (`/[slug]/hub`; the invitation's own seat probe keeps its pinned soft degrade).
- **Prints, exports, seat plan (#14):** caterer sheet, seat-plan export, print pack, invitation print, invitation page and the seat plan read `fetchGuestsByEventMeasured`; a refusal is a 503 (`lib/guest-list-unread-response.ts`) or a `ReadRefusedNotice`, never a document of nobody.
- **Messages (#11):** the Unread filter says it couldn't check, never "Nothing unread."
- **Change orders (#12):** "We couldn't load the change orders", never "No change orders yet."
- **Find (#22):** category search and name search carry `unreadable` → "Couldn't load … suppliers · Try again".
- **Recap / keepsakes (#18):** `loadRecapCoupleSummary.unreadable`; the Recap stats and the keepsake row say they couldn't count.
- **Budget target (#44):** "Couldn't load the target · Reload", never "—" or an empty field to type over.
- **Access requests (#20):** `ReadRefusedNotice`, never "Nothing waiting on you."
- **Schedule suppliers (#16):** `readScheduleSuppliers` returns `null` on a refusal; the page says it, View as falls back, the PDF refuses (503).
- **Planning Stage payments (#17):** a refused payments read is `unread` (never "nothing paid" → invented money owed); only confirmed, unarchived suppliers' milestones are owed.

Guard: `app/dashboard/[eventId]/dashboard-reads-are-honest.test.ts` (one test per reader, mutation-checked).

SPEC IMPACT: None.
