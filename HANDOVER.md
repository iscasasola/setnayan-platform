# HANDOVER — venue picture choice (PR #6591, branch `rd/venue-picture-choice`)

Worktree: `~/Documents/Claude/Projects/wt-venue-choice` (cut from `origin/main` @ #6588's merge `89c594566a`).
PR: **#6591**, DRAFT, label `do-not-auto-merge`. Do not undraft or merge it; the controller decides.
Head when this file was written: `38d5df2d78aee21e421fbb38df728fc5d09c7d91`. This file's own commit sits on top of it. Re-measure with `git -C ~/Documents/Claude/Projects/wt-venue-choice log --oneline -3`.

## The ruling
DECISION_LOG 2026-10-16, "A VENUE CARD'S PICTURE IS THE COUPLE'S CHOICE". Owner, verbatim: *"on a church you can upload a photo or use our pro feature photos of the venue"*. This corrects #6588, where the parish drawing replaced the uploaded photo automatically.

## Done (all pushed)
- **Dropdown**: the shipped `VenuePhotoPicker` in `apps/web/app/dashboard/[eventId]/launch/_components/details-your-event.tsx` (Details › Venues, the old/desktop Maker) is now a "Picture" row with the house PickMenu.
  - Choices: supplier photos (as shipped) · Your photo / Upload your photo · **Our drawing ◆** · **None**.
  - "Our drawing" is listed only when `parishDrawingFor` matches the card's guest-facing name.
  - The ◆ mark comes from `makerProMark`; the option is hidden by `makerProUsable` in the app-store shell when the couple doesn't own Pro.
  - The list is built in pure `apps/web/lib/venue-picture-choice.ts`.
- **Storage**: `VenueChoice.drawing: true` in `invitation_widgets(venue_map).config_json.venue[slot]`. There is no new column.
  - `readVenueChoices` (lib/event-venues.ts) keeps only `true`.
  - `resolveEventVenues` sets `EventVenue.drawingChosen`.
  - `venueDrawingFor` (lib/parish-drawings.ts) is the only reader the guest card uses (`venuePicture` in `app/[slug]/_components/venue-styles.tsx`).
- **Pro**: `venueBagNewDrawings` / `venueBagFreePart` in lib/hub-draft.ts.
  - Turning a drawing on is a Pro `add`, held at Apply. The free photo and source edits still go live.
  - Named on the Apply sheet as "Our drawing · Ceremony venue" with Remove (lib/hub-pro-effects.ts).
  - The Save-the-Date live door (`studio/save-the-date/actions.ts`) never sets or clears it.
- **Guards**:
  - `apps/web/lib/a-venue-cards-picture-is-the-couples-choice.test.ts`.
  - `lib/the-ceremony-card-draws-its-parish.test.ts` was updated so its cards say `drawingChosen`.
  - 31 tests pass. One sabotage was run (the guest card ignoring the pick) and 5 went red.
- **Checks**: full preflight was green on d70db4c (48 checks); quick preflight was green on 38d5df2. CI on d70db4c: 27 pass, 1 skipped.
- **Fix after controller review 1** (38d5df2): the Picture pill is `flex-1`, so the list is as wide as the pill. Measured at 375: every option on one line, "◆ Pro" on the "Our drawing" line, list 223 px inside the screen.
- **Changelog**: `changelog.d/venue-picture-choice.md`.
- ⚠ **cale-ice** shows its uploaded ceremony photo again once this is live (no stored pick), until they pick "Our drawing ◆".

## Controller rulings 2026-10-17 (on the open questions)
1. **Phone path — YES, built in this PR** (c3544f6). The new Maker's Venue scene › Edit: row 1 keeps "Change it in Suppliers"; rows 2–3 are each card's Picture ▾ (`VenuePictureRows` in `details-your-event.tsx`, lazy via `details-lazy.tsx`; data `MakerState.venuePictures` from `launch/page.tsx`, only when `stagesStudio`). Same `VenuePhotoPicker` (new `row` prop), same list, same `useVenueChoices` → `draftVenueChoice`, same ◆ / `makerProUsable`. Upload opens in `PickSheetContext`'s sheet. Guard section 5 (rendered rows + toolbar/launch wiring). Sabotage: toolbar drops rows → 1 red; rows never offer the drawing → 2 red; row without PickMenu → 1 red.
   Builder decisions: captions "Ceremony picture" / "Reception picture" (one card: "Picture"); no picture drawn in the toolbar (the stage behind is the preview); a refused save is said on the line under the tools (`setWhy`).
2. **See-through popover on the desktop old Maker — ACCEPTED as shipped.** The shared PickMenu is unchanged.
3. **Dark via forced `.dark` — fine** (the Maker lab is not a DARK_READY route); say so in the report.

## Left, in order
1. Walk at 375 in the new Maker lab (WebKit iPhone 13): `/dev/maker-lab?studio=1&venue=church&vpic=photo` → Venue scene → Edit → Picture ▾ open → pick Our drawing ◆ → guest card (`/dev/maker-lab/guest?venues=default&photo=1&drawing=1`). Light + dark. Keep the existing desktop shots.
2. CI to green on the head. Keep the PR DRAFT + `do-not-auto-merge`.
3. Copy final shots to `~/Documents/Claude/Projects/shots-2026-10-17/6591/`. Report.
4. After the PR merges: `git worktree remove ~/Documents/Claude/Projects/wt-venue-choice --force && git worktree prune`.

## The exact next command
The walk lane is needed: `serve.sh` takes `walk:venue-picture-choice`, starts `next dev` on 3613 with the no-database lab env plus the 54321 stub, and on `STOP` releases the lane and removes `.next`.
```bash
D=~/Documents/Claude/Projects/controller-2026-10-12/venue-picture-choice
PW=~/Documents/Claude/Projects/wt-venue-choice/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/
($D/scripts/serve.sh > $D/serve.log 2>&1 &)
# wait until: grep -q "dev pid" $D/serve.log && lsof -iTCP:3613 -sTCP:LISTEN   (first page compile ~60-100 s)
cd $D && node scripts/shoot.mjs $PW $D http://localhost:3613 > $D/shoot.log 2>&1; cat $D/shoot.log
touch $D/scripts/STOP     # ALWAYS — releases the walk lane
```

## Screenshots (`~/Documents/Claude/Projects/controller-2026-10-12/venue-picture-choice/`)
- First walk (d70db4c), all ok: `01-maker-your-photo.png` · `02-maker-picture-list-open.png` (the shot the controller rejected: wrapped labels) · `03-maker-picked-our-drawing.png` · `04-maker-our-drawing.png` · `05-maker-none.png` · `06-maker-reception-no-drawing.png` · `07-guest-your-photo.png` · `08-guest-our-drawing.png` · `09-guest-none.png` · `walk.log`.
- After the fix (38d5df2), WebKit iPhone 13 at 375: `02-maker-picture-list-open-375-light.png` · `02-maker-picture-list-open-375-dark.png` · `03-maker-picked-our-drawing-375-light.png` · `03-maker-picked-our-drawing-375-dark.png` (log `shoot2.log`). Desktop 1280 light: `02-maker-picture-list-open-desktop-light.png` · `03-maker-picked-our-drawing-desktop-light.png`.
- New Maker evidence for open question 1: `peek-studio.png` (Venue scene → "Change it in Suppliers").
- Scripts: `scripts/serve.sh` · `scripts/walk.mjs` · `scripts/shoot.mjs` · `scripts/stub.mjs`.

## Labs
- `/dev/maker-lab?tool=details&item=venues&venue=church&vpic=photo|drawing|none[&pro=1]` (old Maker). On a phone, tap `[data-lt-tile="details:venues"]`.
- `/dev/details-lab?tool=details&item=venues&venue=church&vpic=…`
- `/dev/maker-lab/guest?venues=default&photo=1[&drawing=1]` (the guest card).

## Rules that bind this work
Production is SELECT-only; never open the owner's real Maker. Other builders own the attire, the art kit and the cover-scene files. Use the heavy-lock lanes (`~/Documents/Claude/Projects/heavy-lock.sh`), FIFO, and release on time. Push after every step.
