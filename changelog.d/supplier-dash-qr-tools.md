## 2026-11-01 · feat(supplier): Customers › QR codes gains "My page" and "Crew for an event"

Step 4 of `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §12 ("Dashboard remainder — QR"). Per DECISION_LOG
2026-10-29 "🔳 CORRECTS THE QR ROW ABOVE — THE QR DROPDOWN ALREADY EXISTS; EXTEND IT, DON'T REDRAW IT", the live
"Which code ▾" (`app/vendor-dashboard/invite`) keeps Shortlist · Booked · Check a date (shipped with #7007) and adds:

- **My page** — one code to the shop's own Setnayan page, `/v/<slug>` (the day-of review code keeps its `#reviews`).
- **Crew for an event** — Event ▾ (each booked event today or ahead, once) → that event's ONE crew code, read from
  `vendor_crew_codes` exactly as Hub › Crew reads it. Making, replacing and Allow stay in Hub › Crew; the row under
  the code says how many phones wait for an Allow and opens it. A refused events, code or count read is said, and a
  non-admin (whom RLS shows nothing) is told only the owner or an admin makes it — never "no code yet".

The choices and their words live in `lib/supplier-qr-codes.ts`; guarded by `lib/supplier-qr-codes.test.ts` (the My
page code is rendered and scanned back with `jsqr`). No migration, no new write.

SPEC IMPACT: None — builds an existing ruling (DECISION_LOG 2026-10-29); no new decision.
