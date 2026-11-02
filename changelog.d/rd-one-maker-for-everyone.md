## 2026-10-25 · fix(maker): one Maker for everyone — the old Event Hub Maker is deleted

Owner, live: *"event hub maker is still showing old maker on other people · we need that fixed · why is it so hard for
you to let the new event hub maker to show and delete that old event hub maker"*.

**Why other people saw the old one.** The launch page chose the Maker per request:
`hasWork && (NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED || viewer is internal)` for a phone, and
`… && (NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED || internal)` for a desktop. The owner is internal, so he always got the
new Maker; a co-host, the second partner, every real couple got whatever the variables said, and a coordinator
(`hasWork` false) got the old chrome whatever they said. A failed `is_internal` read threw "Reconnecting…" instead.

- `lib/maker-stages-studio-flag.ts` and `lib/maker-desktop-columns-flag.ts` deleted (with `makerChoiceIsUnread` and
  `viewAsFreeSwitch().measured`, which only fed it). The launch page asks nothing; `MakerShell` takes no
  `stagesStudio` / `desktopColumns` prop and provides `stagesStudio: true` to its context, a literal.
- The old chrome is deleted from `maker-shell.tsx`: the screen-label top line, the bar's Page ▾, the Event Details door
  and `ShutDoor`, Preview's "Phone and desktop" and "Scenes" rows, the switched bottom sheet (`withPickSheet`). The
  desk CSS rules that hid them went too (one of them would otherwise have hidden "Play this scene").
- The launch page's OFF branches are gone: Studio's tiles, Info/E-Gifts reads, the wish list, pass guests, the venue
  pictures and the Studio RSVP/Love Story/Mood Board are built for every couple; `MoodBoardMakerBody` /
  `MoodBoardMakerControls` and `MoodPart` / `MoodPartNote` (old Maker only) deleted.
- The dev lab draws the one Maker (`?studio=1` / `&desk=1` no longer needed).
- Guest side unchanged: `lib/guest-stages-on.ts` now owns the one read of `NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED`
  (Reply card · Invitation › Me · camera looks) — whether guests follow the Maker is an open owner call.
- `/dashboard/[eventId]/website/editor` and `/website` already forward into `/launch`; the editor page stays — it is
  the Maker's own canvas (`maker=1`).
- Guard `lib/there-is-one-maker.test.ts` replaces `maker-stages-studio-ships-dark` / `the-maker-choice-is-never-a-failed-read`
  / `maker-stages-studio-flag`: fails if a flag module, a flag read, a shell prop or a caller's choice comes back, or if a
  couple OR a coordinator is rendered anything but Stages | Studio.
- Vercel: `NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED` is read by nothing now and can be deleted (not touched here).

Not in this PR: the `useMaker()?.stagesStudio` reads inside the editor components keep their `false` branches — inside
the Maker they are now always `true`; several of those components are also drawn outside it (schedule, Love Story,
seating, pabuya), where the context is absent. Their in-Maker-only dead branches are a follow-up.

SPEC IMPACT: DECISION_LOG.md — new 2026-10-25 row "THERE IS ONE MAKER" (the Stages | Studio flag and the desktop-columns
flag retired; the guest side keeps its own switch).
