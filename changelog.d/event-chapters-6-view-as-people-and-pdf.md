## 2026-11-04 · feat(schedule): event chapters slice 6 — View as a named guest or the coordinator, and one person's day as a PDF

Owner's rulings, 4 Nov:
- a named guest: **"What they see now"**;
- the coordinator: **"Everything + their tasks"**;
- the PDF: **"Any View as person, Pro"**;
- a crew member: **"Yes, that plus its PDF"** (the shipped supplier · crew view).

- **View as ▾ › Guests** lists every guest by name; the menu searches ("Find a person"). Picking one draws exactly their Event Hub › Me card today, through the same rule the card uses (`yourSchedule`):
  - before Release: their chapters and their call;
  - after Release: their own lines, marked "theirs";
  - never a chapter the hosts took them off, and never another guest's task.
  - The inputs are the same three facts `readYourSchedule` reads (roles, groups, "not invited"), read once for the event on a Pro event (`readViewAsExtras`). A refused read says so.
- **View as ▾ › By role › Coordinator · <shop>** (a booked supplier on every chapter):
  - every chapter and moment the host reads, backstage included;
  - the coordinator's own tasks under their moment ("You: …"), marked "theirs";
  - their call time.
  - A coordinator's staged prep is not shown: it is hidden from the couple until released, and View as only narrows what the host already reads.
- **Share (PDF)** on every per-person view (guest, role, supplier, crew, coordinator; not Suppliers by time):
  - The screen sends the day it drew (`PrintDay`, `lib/schedule-view-as-people.ts`) to the existing `api/schedule/[eventId]/export` route, which now also takes POST (no new Vercel function).
  - Before it reads the body, the route checks sign-in, the Schedule and Pro.
  - It then accepts only plain strings within limits (`readPrintDay`) and draws the file with the schedule PDF's engine (`personDayDoc`, `lib/schedule-pdf.ts`).
  - A day drawn over refused tasks is never offered as a file.
- `usePrintSave` / `SharePdfButton` take an optional `body` (POST); every existing caller is unchanged.
- **Guard:** `lib/view-as-a-named-guest-and-the-coordinator.test.ts` (5 tests). Breaking "not invited", or letting another supplier's task through to the coordinator, turns it red.
- **Lab:** `/dev/chapters-lab` (Cara Lim, Tito Rey Santos, Lola Nena Cruz, The Planning Desk); `?released=1` shows the view after Release.

SPEC IMPACT: New owner rulings to record in DECISION_LOG (4 Nov):
- View as a named guest = their card as it is now;
- View as the coordinator = everything + their tasks (staged prep excluded for the couple);
- a per-person PDF for every per-person view, part of Pro.
