## 2026-11-18 · fix(help): answer what Google's AI answers were guessing — freelancers, escrow, Event Hub domains

Google's AI answers about Setnayan (pasted by the owner) filled three FAQ gaps with guesses, and one existing answer was false.

- NEW `freelancer-without-dti` (Getting verified): a shop opens free with no papers; being booked needs verification and its three papers; a solo supplier registers a DTI business name online.
- NEW `supplier-payment-escrow` (Suppliers & budget): couples pay suppliers directly, Setnayan never holds the money; a problem is reported from the supplier's Report page or Report a problem in chat and followed on Disputes.
- NEW `event-hub-own-domain` (Event Hub): no own domain or name.setnayan.com address — EVENT_SUBDOMAIN is off sale since 2026-08-11.
- FIX `supplier-which-documents`: said FOUR required papers including bank proof; `REQUIRED_DOC_SLOT_KEYS` has been THREE since the 2026-11-14 ruling.
- `HELP_LASTMOD` → 2026-11-18 so the help sitemap tells crawlers the answers changed.

SPEC IMPACT: None — FAQ copy describing what already ships.
- FIX `supplier-what-verified-changes`: said a booking is refused before verification and the shop "always" shows in search. Since 15 Nov (`shopBookingRefusal`, `lib/findable-shop.ts`) it is the reverse — an unverified shop is messaged and booked on its own link or QR and shows in no search list until verified. The new freelancer answer says the same.
- FIX the "About prices" note on the suppliers front page (`supplier-front-page.tsx`) and the coordinators page (`for-coordinators/page.tsx`): both still said an unverified shop "is shown until its first inquiry" — the 7 Nov rule the 15 Nov "Verified only" ruling replaced. Now: found only through its own link or QR, where couples can still book it (matches `FREE_FINDABLE`).
- NEW `papic-credits-run-out`: camera shots wait on the guest's phone and send when credits are added; gallery picks show Out of Credits and send nothing. Web only (`appBody: HELP_NOT_IN_THE_APP`) — the app names no paid service.
