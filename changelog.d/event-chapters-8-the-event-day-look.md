## 2026-11-05 · feat(schedule): event chapters slice 8 — the Event Day look

The owner-approved brief `SCHEDULE_SLICES_8_10_BRIEF_2026-11-05.md` (specs repo), slice 8; the contract is `prototypes/schedule_redesign_2026-11-04.html`. Extends the shipped Schedule page; nothing is redrawn from scratch, and the data model is unchanged.

- **The day is a list, not an hour grid** (where chapters are drawn). Each chapter is a row sized by its content (`lib/day-list.ts`, `_components/day-list.tsx`):
  - its start in large type and its end in small type, in the app font with tabular figures (no monospace);
  - its length, and a thin spine in its kind's tint;
  - its venue, plus supplier faces and a count ("2 suppliers · 1 picking"). A dashed face is a booked supplier with no chapter yet, shown on the chapters its trade usually serves (`suggestedChapters`);
  - its moments inline.
  - Gaps between chapters read "1h 30m · free · travel to <venue>".
  - Rows: a tap opens the chapter; a swipe left removes it with Undo. The hour grid stays where no chapters are drawn (the Maker, a failed read).
- **One pinned row:** `Event Day ▾ · N chapters · 👤 · N need you › · ⚙`. It stays on screen and tightens on scroll ("≡ 7"). Share, Paper, Announce, the script and Running late (↕) stay inside ⚙ (#7256).
- **The counts are the filters.** "N chapters" narrows the day to one chapter, shown as a tinted chip with ✕. View as shows its state as "👤 DJ Migs ✕". A line under the date says what you are seeing and how to clear it.
- **"N need you ›"** is the row's one action: the supplier requests sheet. While a filter is on it shrinks to a badge.
- **No 👁 on the day.** Who sees a chapter is in its ⓘ ("Who sees it: guests — it is on the invitation…").
- **"Happening now" on the day:** a terracotta top line and "Happening now · 6:12 PM" on the running chapter, with its running moment marked.
- **Dark mode:** drawn only in the theme tokens (`bg-cream`, `text-ink`, `sn-accent`, `gold-deep`). The Schedule is NOT added to the dark-mode ready-list (`lib/appearance.ts` `DARK_READY`); adding it would show the Light/Dark switch, which is an owner call.
- **Guard:** `app/dashboard/[eventId]/schedule/the-day-is-a-list-of-chapters.test.ts` (6 tests).
- **Lab:** `/dev/chapters-lab` (`?live=1` with a fixed clock for "Happening now"); the chapters lab's day now honours `?live=1`.

SPEC IMPACT: None beyond the approved brief and prototype. Not built from the prototype, because the brief does not list them:
- the opaque thumb strip under "+ Add a chapter";
- the day-of "Announce" and final-week "Release ›" as the row's action (only "N need you ›" is built);
- crew initials under moments, roles summary, crew passes.
