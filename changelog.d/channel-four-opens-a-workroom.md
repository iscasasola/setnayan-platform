## 2026-09-03 · feat(event-hub): channel 4 opens the workroom, not a settings row (EH5)

The Event Hub controller's "four stages of your one link" grid gave every
channel the same "Preview" link into the public rendering of that stage. The
story is different from the other three by design (§ 2.4 of
`EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md`): the couple works on it for
weeks with two other authors, so its card now also carries a same-tab door
straight into the existing full-screen editor at `/website/editorial` — no
new page, no new route.

`resolveHubFacts` and `resolveHubNextStep` (`lib/event-hub-control.ts`) take
an optional `HubEditorialRead`, appended after the existing params so every
prior 3-arg call site is untouched. When the live channel is the story, the
four facts on the stage switch from "replies in / still quiet" (which no
longer apply — RSVPs closed with the RSVP channel) to the workroom's own:
chapters written, guest columns waiting on the host, photos placed, and
draft/published. The next-step card now names guest columns waiting for
review by count ("N guests wrote you a column") ahead of the generic "write
your story" copy, when there is a real, measured pending count — nothing a
guest writes appears until the host reviews it, and that decision now shows
on the same screen the host is standing on.

Both reads (`event_editorial`, `guest_columns` pending count) are asked ONLY
when `standing.stage === 'editorial'`, so every couple still planning or on
the day pays nothing extra. The chapter count reuses the shipped
`readChapterOverrides` parser (now exported from
`app/[slug]/_components/editorial/data.ts`) rather than re-deriving
`draft_json` by hand, and counts only overrides that carry a real `writeUp`
— not the auto-built timeline chapters. A refused `event_editorial` or
`guest_columns` read renders as an em-dash, never a fabricated zero; guest
columns switched off entirely renders "Switched off", distinct from a
switched-on queue that happens to be empty.

Scoped behind PR #5012 (OPEN at branch time, CLEAN, four files fenced off):
none of `website/editorial/page.tsx`, `website/editorial/actions.ts`,
`website/editorial/_components/editorial-editor.tsx`, or
`website/privacy/page.tsx` were touched. This PR only routes to and reads
counts from the already-shipped editorial system.

SPEC IMPACT: None — implements design § 2.4, already recorded in
`EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md`.
