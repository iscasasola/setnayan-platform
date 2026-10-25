## 2026-10-26 · feat(suppliers): the calmer "Cover your event" header — title, quiet count, thin bar

Owner, 2026-10-25, on the Suppliers header ("Cover your event ⓘ · Covered 6 of 14 · 📅 Your date is set: … · Every
card below shows whether that supplier is free that day."): *"this can also have a better presentation."* — and on
2026-10-26, on the look-first renders (`shots-2026-10-25/thumb-room/header-after-{390,1280}.png`), verbatim: *"Yes —
build the new Suppliers header as shown."*

- The title row is "Cover your event ⓘ" with a quiet **"N of M covered"** on its right, and a **thin bar** under the
  title drawing the same count (`_components/cover-ring.tsx`). The shell draws them; the bench — the one that knows
  what is covered, live as categories are added or removed — publishes its count through a context.
- The bench's own **"Covered N of M"** line is no longer drawn under that header (the pre-replan bench, with no header
  to publish to, keeps it).
- A **settled date** (banner tone `anchored`, "Your date is set: …") draws **no banner** — the date is already on the
  date · place line above — and what it explained, "free that day", is now a line in the ⓘ (`EXPLORE_INFO_DATE`).
  A **date conflict** still draws its banner, and so do a narrowing build and "Booking these suppliers sets your date"
  — they are news, not detail.
- `/dev/suppliers-lab` gains `&date=set|conflict` to draw both banners.

Guard: `app/dashboard/[eventId]/vendors/the-cover-header-is-calm.test.ts` (the bar's share, the title row's count and
bar, no second count, only the settled-date banner hidden, "free that day" in the ⓘ, the count is not a control).
No port-control or ugat baseline needed regenerating (nothing pressable was removed).

SPEC IMPACT: None — owner-approved presentation of an existing header; no decision changed.
