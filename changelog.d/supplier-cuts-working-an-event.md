## 2026-11-14 · feat(supplier): cut 6 — "Post an update" on every booked event, and the couple sees it on their day

Owner-approved supplier cut 6 (DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 6). The timed walk found no way to post an update: the six shipped statuses (On site · Setup done · Ready to start · Packed up · Running late · Need help) sat under "Report to the coordinator", drawn only on the event's own day and below the tools, and no couple screen read them.

- **Supplier:** ONE **Post an update** button on top of each booked event's page in the Hub, every day, with "Your updates" underneath. It opens a sheet with the same six statuses and the note box; Post. A status with a note is ONE row (the note is the body, the status still decides whether it is work for the coordinator) — `buildVendorStatusDraft(key, note)` and the shipped `submitVendorStatusPreset(eventId, key, note?)`; no new server action. A note with no status goes through the shipped `submitDayRequest`.
- **Couple:** a **From your suppliers** card in Home's day-of grid — the vendor lane of the same stream, newest first, read through the couple's own session (RLS `event_day_requests_event_read`), with the supplier's name from their own list and the time on the event's clock. A refused read says it could not load.
- **Coordinator:** unchanged — their floor inbox already reads the stream; Running late and Need help file as issues there.
- Still behind the shipped `coordinator_requests_inbox` activation control (an owner switch; per `lib/privacy-coverage.ts` all day-of controls are active in prod — not re-measured from this session).
- Help answers `post-an-update` (suppliers) and `supplier-updates-on-the-day` (couples), tour stop `hub-post-update`, ⓘ on "Your updates" and on the couple's card.
- Guard: `lib/supplier-cuts-post-an-update.test.ts`.

SPEC IMPACT: None (implements the approved prototype; the DECISION_LOG row already records it).

## 2026-11-14 · feat(supplier): cut 7 — ＋ → Make a quote, in the chat, good for 14 days

Owner-approved supplier cut 7 (same DECISION_LOG row; prototype § 7). The walk: a quote could not be made in the chat — with no quote out, ＋ only opened the full builder (or, by its "Change quote" card, said "No quote in this chat yet" with no way forward), and Send stayed dim until a hidden "How long is it valid?" was set.

- With no quote out, ＋ → **Make a quote** drops a short card in the chat: tick your cards (each with its own "from" price), **Your offer** (starts at their sum, typeable), **Good until** — FILLED at 14 days, or the event day if that comes first, shown as "Nov 28 · 14 days" and changeable — and an optional note. **Send quote** posts the shipped `sendCustomProposalFromChat`, so it lands as the quote card the chat already shows. **Full quotation** opens today's builder (discounts, payment schedule, travel, crew meal stay there). No new server action; the cards are read in the browser by the shop's own session (`loadCardsForMakeQuote`).
- `lib/make-a-quote.ts` (the words and arithmetic, pure) · `app/_components/chat/cards/make-quote-card.tsx` · the no-quote branch of `quote-step-card.tsx` · the ＋ row `MAKE_A_QUOTE_LABEL` in `lib/chat-plus.ts` (a card now; its door is still the builder).
- Help answer `make-a-quote-in-chat`; ⓘ on Good until and on Full quotation.
- Guards: new `lib/supplier-cuts-make-a-quote.test.ts`; re-aimed `lib/chat-plus-sends-a-quote-first.test.ts` (claim kept: a no-quote chat never drops a dead card; the builder keeps its name and door).

SPEC IMPACT: None.

## 2026-11-14 · feat(supplier): cut 5 — a supplier sets their own times before the hosts' program exists

Owner-approved supplier cut 5 (same DECISION_LOG row; prototype § 5). The walk: both test events' Schedule tab said "The hosts haven't made their chapters yet" with **0 controls**, while the chat pinned "DUE NOW · Set your call time on their Schedule" — a supplier's times could only be sent as a request against a chapter the host made.

- **Before the program:** the Schedule tab shows **Your times · 12 Dec** — Call time ("Your crew meets"), Arrive at the venue, Done by — three time rows that save in place ("✓ Saved"), and the line "The hosts haven't built their program yet. Your times slot in once they do."
- **Once the program exists:** the arrival and finish slot into the first chapter the supplier is linked to as the same "<shop> arrives" / "<shop> is done" requests My times already files (the host OKs them, or Auto-agree puts them in; the host can still move them). Once — `filed_at` records it. This runs when the supplier next opens their Schedule (a client effect posting the shipped action), never as a write during a page read.
- **The chat pin:** a call time kept here counts as set, so "Set your call time on their Schedule" turns done (`callTimeIsSet` beside the shipped `chat_call_time_for` read, in `lib/chat-pin-facts.server.ts`).
- **Schema (ADD-ONLY):** migration `20271346335702_supplier_own_times_before_the_program.sql` — one new table `supplier_own_times` (one row per booked shop per event; three `HH:MM` wall clocks, CHECKed; `filed_at`). RLS at create; grants revoked then SELECT/INSERT/UPDATE only (no DELETE policy, no DELETE grant); the booked shop (owner or team) reads and writes its own row signed as itself; the event's people read; anon nothing. Nothing existing is altered.
- **No new server action:** the shipped `suggestScheduleChange` takes `request: 'own_times'`.
- `lib/supplier-own-times.ts` (pure), the `OwnTimesForm` in `supplier-schedule.tsx`, the read on the client page, lab state `/dev/supplier-lab?s=schedule&state=noprogram`.
- Help answer `set-your-times`; a sentence on the client tour's chat stop; ⓘ on Your times.
- Guards: `lib/supplier-cuts-own-times.test.ts`; DB `tests/db/a-supplier-keeps-own-times-before-the-program.db.test.ts` (the booked supplier writes with no program; the couple reads; the couple, another supplier, an unbooked shop and a write signed as someone else are refused with the row unchanged; non-HH:MM clocks refused; no DELETE; anon nothing).

SPEC IMPACT: None (implements the approved prototype; schema is add-only).
