## 2026-11-22 · chore(ship): batch T — the App Store screenshot screens

Tier 2 (owner 22 Nov: the App Store shots come from the live app and change only with a new version). Six reviewed PRs, one CI run, merged after the Apple chain.

- **#8153** @ 494bc23a63: Memories goes dark; the Papic block is the one glow.
- **#8152** @ 5781ec004c: guests drawing v4 parity.
- **#8155** @ f6bcb0ffdf: Papic, one camera. Its red was CI-only: stale generated maps, and the ✕ ratchet lowered (`app/papic/_components/camera-controls.tsx` 1 → 0).
- **#8156** @ 4d1bb2b0e4: a guest's seat number counts from 1 on the ticket, the print and the seat pass.
- **#7908** @ 8813827a86: the Check-in desk in three parts. Migration `20271357880360` → f8cb9bfa1f (controller GO).
- **#7920** @ 15e9de4609: suppliers Find · Build · Book. Migrations `20271355381662` → 5349f7475f and `20271355916558` → 28d9e4a28f (controller GO).
- **#8176** @ 916c397cb3: every booking door asks the shop's booking window and the card's order lead through one helper (`lib/booking-window.server.ts`; a failed read degrades open). The days strip stops dating month-only events. Its red was only the stale screens map.

Conflict: `lib/table-words.ts` got a seat-counts-from-1 helper from both #8152 (`seatWords`) and #8156 (`seatNumberWords`). Both are kept, with one `formatCount` import.

Exposure +3, all intended:
- `events.date_months`: authenticated only.
- `event_type_profiles.event_size` and `.core_categories`: the same grants as the table's 25 other columns; RLS keeps writes admin-only.

SPEC IMPACT: None beyond what each PR's own fragment records.
