## 2026-11-14 · feat(supplier): cut 6 — "Post an update" on every booked event, and the couple sees it on their day

Owner-approved supplier cut 6 (DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 6). The timed walk found no way to post an update: the six shipped statuses (On site · Setup done · Ready to start · Packed up · Running late · Need help) sat under "Report to the coordinator", drawn only on the event's own day and below the tools, and no couple screen read them.

- **Supplier:** ONE **Post an update** button on top of each booked event's page in the Hub, every day, with "Your updates" underneath. It opens a sheet with the same six statuses and the note box; Post. A status with a note is ONE row (the note is the body, the status still decides whether it is work for the coordinator) — `buildVendorStatusDraft(key, note)` and the shipped `submitVendorStatusPreset(eventId, key, note?)`; no new server action. A note with no status goes through the shipped `submitDayRequest`.
- **Couple:** a **From your suppliers** card in Home's day-of grid — the vendor lane of the same stream, newest first, read through the couple's own session (RLS `event_day_requests_event_read`), with the supplier's name from their own list and the time on the event's clock. A refused read says it could not load.
- **Coordinator:** unchanged — their floor inbox already reads the stream; Running late and Need help file as issues there.
- Still behind the shipped `coordinator_requests_inbox` activation control (an owner switch; per `lib/privacy-coverage.ts` all day-of controls are active in prod — not re-measured from this session).
- Help answers `post-an-update` (suppliers) and `supplier-updates-on-the-day` (couples), tour stop `hub-post-update`, ⓘ on "Your updates" and on the couple's card.
- Guard: `lib/supplier-cuts-post-an-update.test.ts`.

SPEC IMPACT: None (implements the approved prototype; the DECISION_LOG row already records it).
