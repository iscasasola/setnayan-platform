## 2026-10-22 · feat(memories): Memories wears the Papic gallery — Life-Flash tile first, one gold chapter per event, Event ▾ · Show ▾ in the thumb row

Owner, 22 Oct: *"Memories must look similar to the gallery of papic. Somewhat but not exactly"*, and of the counts
line drawn at the top, *"remove these"*. Built to `prototypes/people_and_memories_template_2026-10-22.html`
(M1–M4) and its §5 capability map:

- No counts line. The page starts with the Life-Flash tile (the grid's first row). When nothing is kept yet it is a
  quiet tile and not pressable (controller, the prototype's question 3).
- The cover shelf, the "Gallery" rows, the framed Life-Flash card and the dashed box become ONE shape
  (`memories-chapters.tsx`): a gold mono chapter per event (controller, question 2: by event), EVERY event incl.
  empty ones with their monogram tile, "Gallery ›" (`GalleryDoor`, hosts only) on each heading, then 3-across
  rounded frames with ▶ on a clip and a gold dot on a frame you are in.
- New Event ▾ (`?event=`): one event picked → the day's chapters from the run of show (`lib/alaala-chapters.ts`,
  time-of-day when no schedule reads) and ⤓ Download all (the studio's `gallery-zip`) for a host.
- Show ▾ is the same list (five lenses · "Also kept"), moved into the glass thumb row. The People lens and the
  three "Also kept" views draw what they drew.
- A refused wall says "could not be loaded" and the headings carry no count and no "nothing yet". The foot line
  "N frames kept · showing the newest N" only on a capped list.
- `album-shelf.tsx` retired (its rules — every event, by date, undated last — live in the chapters' guard).
  `/dev/memories-lab` draws it on fixture data. Guard: `memories-wears-the-papic-gallery.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-10-22 "PEOPLE WEARS TODAY'S GUEST LIST; MEMORIES WEARS THE PAPIC GALLERY"
(Setnayan-specs f35e6c3f).
