## 2026-09-25 · feat(event-hub): the Maker's colours, words and Love Story save to the draft, not the live page

The owner edits his own PUBLIC Event Hub in the Maker. Every control marked
"Saves immediately ⓘ" was a half-finished edit a guest could read. They now
save into the draft that already ships (`event_site_drafts`,
`hubDraftAction`, `<HubDraftField />`, `<HubDraftDock>`). Guests see nothing
until Apply. Undo, Restore and Apply cover them. Same mechanism as #5972 and P6
#5974; no new action, no migration.

**Moved into the draft:**

- **Colors** (`ColorsPanel` → `updateSiteColors`): background, buttons,
  Candlelight, typeface and magic move. The background colour stays free. The
  other four are Pro. A free couple can try them in the draft and pays at Apply
  (`HUB_LOOK_EVENT_COLUMNS`; `site_art_direction` is classified the way
  `siteLookChange` reads it). The guest layout paints the look and cannot see
  `?editor=1`, so the host canvas now wears it a second time from the
  overlaid row (`HostDraftLook`). The layout and the canvas share one
  translation (`lookScopeProps`). Guests never build this look.
- **Text** (`TextPanel` → `updateSpecialMessage`, `updateWhatToBring`), plus
  the Details panel's special message.
- **Our story** (`StoryPanel` and the scrapbook's words form → `updateOurStory`,
  `love_story` + `together_since`).
- **Our Love Story moments** (`loveStoryMomentAction`: add · edit · delete ·
  keep off · pick from our events). The moments are built on the drafted
  moments. The five-story cap and the photo screen still run at save. Apply
  asks `momentCapRefusal` again (more than five, or a new photo, is Pro) and
  re-screens every photo that the live story did not already hold. The screen
  moved to `lib/love-story-screen.ts` and is now shared by both. The scrapbook
  shows the draft and says so.
- **Dress code** (`updateDressCode`) and **Camera cues** (`updatePhotoMoments`;
  `PhotoMomentsEditor draft`).
- **Hero photo panel** in the editor: this now posts to `uploadHeroPhoto`'s
  existing P6 draft door.

The Maker panels read the draft laid over the live row, so a drafted edit stays
visible in the panel that saved it.

**Still live, marked, with a reason** (`every-maker-form-drafts-or-says-so`):

- the address, visibility, launch phase and open browsing (never drafted);
- gallery, music and hero video (media: open decision D6);
- a scene's own words and "Remove this section" (these live on the section row;
  the draft holds a section's canvas, mode and place);
- "+ Add a scene" (inserts a row);
- go-live;
- the theme link (`invite_theme`, picked on the Guest list's invite page);
- the E-Gifts thank-you message (E-Gifts' own column);
- the print settings (`print_details`). No guest page reads these; only the
  printed set does.

**Known limit:** a draft that turns Candlelight OFF while it is live cannot
take the layout's attribute away. The canvas stays dark until Apply. Turning it
on previews correctly.

**Tests:** `lib/maker-live-savers-draft.test.ts` (new) covers each writer's door
before its live write, the Pro gate after the door, the Love Story order (draft
base → cap → screen → door), and Apply's re-screen. It also covers Colors, Text
and Story as values: the save lands in the draft, the live row is untouched,
the host overlay shows the draft, and Apply copies it with Pro held or applied
as appropriate. `every-maker-form-drafts-or-says-so` now follows each
panel's `action` prop to its caller's binding (`COMPONENT_WRITERS`).
`hub-draft-wiring` adds the seven writers. `hub-draft.test` moves the
"no words column" rule to "each column is one kind; only look is Pro".

SPEC IMPACT: `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 2 gains an as-built
note. The draft now holds the Colors columns and the couple's words, and
Apply re-checks the Love Story cap and photos.
