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

## Open questions (controller / owner)
1. **The phone path does not reach this dropdown.** In Production every couple's phone gets the NEW Maker (Stages | Studio, `NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED`; desktop keeps the shipped Maker). Measured in `/dev/maker-lab?studio=1&venue=church`:
   - the Venue scene's Edit tab is the one door "Change it in Suppliers" (`lib/maker-parts.ts` `makerPartQuietRow`);
   - Studio › Info shows the venue read-only.

   So the Picture choice (and the shipped venue photo chooser before it) is reachable only on a computer. Putting Picture ▾ on the new Maker's Venue scene Edit tab is a separate build that needs a go-ahead. (Owner memory: phone first, 99% of users.)
2. **See-through list (controller review item 1).** The open list is the shipped PickMenu popover. Its surface is `.sn-glass-bare` (bg `rgba(255,255,255,.86)` + blur), the same as every PickMenu outside the new Maker. It is opaque only inside the new Maker, where PickMenu opens as `MakerSheet` (`maker-shell.tsx` `withPickSheet`). At 375 in the old Maker it opens above the pill and lies over the dock's "Your event ▾" pill. I did not change the shared PickMenu (every dropdown in the app uses it). Two options: make the popover opaque app-wide in `pick-menu.tsx`, or accept it because phones use the new Maker.
3. **Dark mode.** The Maker lab is not a dark-ready route (`theme-bootstrap-script.ts` `DARK_READY`), so the dark shots add `.dark` to `<html>` by script. Say so when reporting.

## Left, in order
1. Re-shoot 02 and 03 in light and dark at 375 (WebKit iPhone 13), plus desktop 1280: `scripts/shoot.mjs` (command below). The light 375 shot of 38d5df2 exists and was checked (one line each). The dark and desktop shots did not finish because the dev server died: memory pressure, 4 `next dev` processes on the machine.
2. Look at each PNG yourself, then report to the controller: new head sha, the screenshot paths, and open questions 1–3.
3. Wait for CI on the head. Keep the PR a draft with `do-not-auto-merge`.
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
- After the fix (38d5df2): `02-maker-picture-list-open-375-light.png` · `03-maker-picked-our-drawing-375-light.png` (from the run that died; re-shoot all four sets).
- New Maker evidence for open question 1: `peek-studio.png` (Venue scene → "Change it in Suppliers").
- Scripts: `scripts/serve.sh` · `scripts/walk.mjs` · `scripts/shoot.mjs` · `scripts/stub.mjs`.

## Labs
- `/dev/maker-lab?tool=details&item=venues&venue=church&vpic=photo|drawing|none[&pro=1]` (old Maker). On a phone, tap `[data-lt-tile="details:venues"]`.
- `/dev/details-lab?tool=details&item=venues&venue=church&vpic=…`
- `/dev/maker-lab/guest?venues=default&photo=1[&drawing=1]` (the guest card).

## Rules that bind this work
Production is SELECT-only; never open the owner's real Maker. Other builders own the attire, the art kit and the cover-scene files. Use the heavy-lock lanes (`~/Documents/Claude/Projects/heavy-lock.sh`), FIFO, and release on time. Push after every step.
