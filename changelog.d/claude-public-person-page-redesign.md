## 2026-11-13 · feat(u): the person page takes Home's shape, with a section bar and dateless covers

The approved Person frame of `prototypes/public_pages_three_2026-11-13` (DECISION_LOG 13 Nov: "THREE PAGES, ONE
FAMILY", "SIMPLER TO MOVE AROUND", "THREE PUBLIC PAGES APPROVED"; covers per "EVENT COVERS SAY THE EVENT NAME ONLY,
NO DATE"), built on the shipped `/u/[userSlug]`:

- **Header in Home's shape** — the shared `ProfileHeader` now draws `layout="home"` here too: left-aligned
  rounded-square photo with the frame dot, the name, `setnayan.com/u/…`, the counts row (adds **"N events"** —
  public events only, the ones the Events section lists, never "0"), then **Follow + Share** under the counts with
  the shipped one-way note.
- **Sticky section bar** (`app/u/_components/section-bar.tsx`) — Events · Chapters · Partnered with, current one
  underlined, ↑ Top at its right edge; real `#` anchors, one-tap jumps that never write history. A tab exists only
  for a section the page drew, so "Partnered with" (storyteller-only, as shipped) disappears with its section.
- **Events** = one section: Coming up, then Past (smaller). Covers keep the couple's poster but print the event
  **name + kind chip** ("Wedding · Up next"), never a date.
- Chapters by year with the shipped tiles; Partnered with as soft pills (name + logo, never offer terms).
- Report this page + Made with Setnayan move into one quiet footer. One 240 ms fade on arrival, off under
  `prefers-reduced-motion`.
- Guard: `app/u/the-person-page-moves-around.test.ts` (public-only count, dateless covers, tab ⇔ section, no
  history writes).

SPEC IMPACT: None — matches approved prototype.
