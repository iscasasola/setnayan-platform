# Event Details rebuild — progress (branch `rd/event-details-rebuild`)

Spec: corpus DECISION_LOG rows 2026-10-06 "APPROVED — EVENT DETAILS IS REBUILT…", "THE COVER LOSES ITS FRAME…",
"WHEN YES GETS A CELEBRATION · WHAT TO BRING…" (part 2), 2026-10-05 "THEMES ARE REPLACED…", "GLOBAL SETTINGS HOLD THE SPECIAL PAGES".
Builder rules: setnayan-handoff-src/BUILDER-RULES-2026-10-04.md. Worktree: ~/Documents/Claude/Projects/wt-details (base origin/main ce5240de7).

## Map of what ships (measured 2026-10-06 — re-grep before trusting)
- Details items + groups: `apps/web/lib/maker-details-items.ts` (`DETAILS_ITEM_GROUPS`, `DetailsItemKey`, `detailsItemFor`, `DETAILS_FIRST_ITEM`).
- Details page composer: `launch/_components/maker-details.tsx` (labelOf, bodies, editors, pieces → `DetailsWorkspace`).
- Navigator/body/editor columns + phone lower-third tiles + guided flow: `launch/_components/details-workspace.tsx`
  (`themeParts`/`lookAt` = Look sections as phone tiles; `editorsBody` hides non-selected editors — all stay mounted).
- Doors: `launch/_components/maker-bar.ts` (`MAKER_TOOLBAR` has 'look'; `MakerDoor` look|details|prints; `makerPressDoor`).
- Shell: `launch/_components/maker-shell.tsx` (`doors` = desktop Look + Event Details buttons; `ltGlobal` = phone menu
  Look·Settings·Details; `onLtPick`; `openDoorOnNavigator`).
- Phone lower third: `launch/_components/maker-lower-third.tsx` (menu = Global settings | Stages columns).
- Look panel: `details-look-pages.tsx` `LookPanel` (renders `LOOK_SECTIONS` = background·font·colours·buttons from
  `MakerLookPages.look`, built in `website/editor/page.tsx`); sections in `lib/maker-look-sections.ts`.
- Your event parts: `details-your-event-parts.tsx` (names/date/venues/parents/march); answers (papic, gifts): `details-answers-parts.tsx`.
- E-Gifts "where received + details": `dashboard/[eventId]/pabuya/_components/pabuya-manager.tsx` (`PabuyaManager`, data read in `pabuya/page.tsx`).
- Guided flow REFERENCES item keys (keep them present!): `lib/details-guided-flow.ts` `GUIDED_STEPS` uses
  names, date, theme, logo, hero, love-story, rsvp(+pieces who/questions/reply-by), venues, schedule, parents, march,
  mood-board, special-message, seating, papic.

## Design chosen for step 1 (no key renames → guided flow, addresses and guards keep working)
- New item keys `background | colours | font | music` (Look sections as items; `LookPanel sections=[…]`).
  `theme` stays as a HIDDEN item (full Look panel) for the guided "Look" step + old `item=theme` addresses.
- Groups: look = Background·Colours·Font·Music·Mood Board·Logo·Cover page(hero)·Reveal;
  story ("Story & plans", shipped label) = march·love-story·schedule·seating;
  event ("Your event") = names·date·venues·gifts·thank-you·opening-line·special-message·address·qr drawn as ONE
  navigator row; selecting it shows all its editors stacked (new `form` flag on the group in DetailsWorkspace);
  hidden group (present, not drawn) = theme·parents·papic·plan-myself·kindly-reply·rsvp until step 2 rehomes them;
  prints groups (set·day·download) unchanged at the bottom.
- One door: drop 'look' from `MAKER_TOOLBAR` + desktop `doors`; phone `ltGlobal` lists the Details items (scrolls).
- Labels: names → "Event Name"; hero → "Cover page".

## Map for steps 2–7 (measured 2026-10-06, re-grep before trusting)
- Music: editor `page.tsx` row `key: 'music'` → `SiteChromePanel` (media-panels.tsx; posts music + hero video together).
  'backdrop' row = `RsvpBackdropPanel` (events.rsvp_backdrop) — dropped from MAIN_ROWS (done). Lab `maker-lab-shell.tsx` `lookRows` lacks music.
- Cover frame: `app/[slug]/_components/pahina-masthead.tsx` `if (card)` branch: outer `rounded-sm bg-cream p-3 shadow…` + inner
  `border border-gild/45`. Called from `site-body.tsx` (text-only masthead with `card={inviteCard}`, ~1630 and guest tree ~2472).
  Global background = `app/[slug]/_lib/main-ground-layer.tsx` `mainGroundLayerFor` → `<MainGround>` (fixed, page-wide, scrim div
  `data-main-ground-scrim`, cream only). The opaque card hides it → removing the card shows the global background.
- Legibility: `lib/hub-legibility.ts` (contrastRatio, requiredScrim, hubLegibility), `lib/adaptive-theme.ts`
  (`mainGroundLegibility` → {scrim, calmer}; `CALMER_CLIP_SCRIM = 0.5`). Existing darker/lighter precedent: STD film
  `StdLegibility 'auto'|'lighten'|'darken'` in `events.std_background.legibility` (`lib/std-backgrounds.ts`,
  `std-background-layer.tsx` veil). No hub-background field yet → Darker↔Lighter needs a new key on hero `config_json.main`
  (HubMainGround, draft field 'main') — never below `mainGroundLegibility`'s AA scrim.
- Reveal: `RevealOverlayServer` in site-body (~3452) + `app/[slug]/invite/page.tsx`; stages in `events.reveal_stages`
  (`lib/reveal-stages.ts`, REVEAL_STAGE_CHOICES std/rsvp/event); overlay `fixed inset-0 z-[60]` retires after scroll
  past innerHeight on Invitation/Day (first page only). Step 5 = expose per-stage show/hide as the stage's first scene tile.
- What to bring: scene `what_to_bring` (events.what_to_bring); `lib/maker-navigator-tabs.ts` `anchorOfTile` sends
  `w:what_to_bring` to 'home'; `lib/invitation-welcome.ts` (`welcomeParts`, `scenesLeftForDetails` removes it from Details).
  `STAGE_SCENES.rsvp` order has dress_code then what_to_bring; entourage drawn after scenes (site-body ~1962).
  Step 6 = stop Welcome taking it on the Invitation + place after dress_code, before entourage; Day keeps `welcomePartsOnTheDay`.
- Classic rule: `lib/page-ground.ts` `heroMayBePageGround` (`!t.media` → false); `main-background-panel.tsx` `plain = themeId==='house'`
  hides "Same as my hero"/"Upload media"; editor page.tsx `mainThemeId !== 'house'`. Per-part font Pro: `lib/hub-look-pro.ts`
  `HUB_ELEMENT_PRO_FIELDS = ['font','motion']`, `HUB_RUN_PRO_FIELDS = ['font']`; UI `element-sheet.tsx` fontMark.
- Plan it myself: `setPlanningMode` (dashboard actions.ts); `PlanMyselfSwitch` (plan-myself.tsx). Home: `details/page.tsx`
  services section next to "Setnayan AI" row, or `details/_components/event-settings-editor.tsx` after PaxSettingsCard.
- Photos from guests: `events.papic_on` gates captures (`lib/event-accepts-captures-rule.ts`); Day scenes `photo_moments`,
  `your_photos` + fixed `photos_of_you`. Scene show/hide = `invitation_widgets.is_visible` (draft `{kind:'widget', field:'is_visible'}`).
- RSVP stage parts: `lib/rsvp-stage.ts` (`RsvpStageScene`, `RSVP_STAGE_SCENES`), `maker-rsvp-stage.tsx` `RSVP_STAGE_TILE`,
  `maker-rsvp-ask.tsx` `MakerRsvpSettings`. Kindly reply posts via Details' print words form (`WORDS_FORM`, /api/hub-print/words).
- Lab: `/dev/maker-lab?tool=details` (maria-and-jose shape, no DB), canvas `/dev/maker-lab/guest`.

## Status (head of `rd/event-details-rebuild`, PR #6377 draft)
- [x] 1 one button + regrouped list + Your event form (DetailsWorkspace `form`/`hidden` groups, `detailsListGroups`,
      `bodyAlias`; shell `ltGlobal` = Look · Story & plans · Your event · Prints · Settings; labels Event Name / Cover page / E-Gifts)
      — E-Gifts form field mounts the E-Gifts page's own `PabuyaManager` (launch page builds it); QR look controls moved into the QR editor.
- [~] 2 move-outs: Plan it myself → `details/page.tsx` Services (done); RSVP → already on the RSVP stage (done by removal);
      Photos from guests → The Day already has `photo_moments`/`your_photos` scenes with show/hide (done by removal).
      ⏭ NOT DONE: Kindly reply as a part of the RSVP stage (today it is reachable in Prints › The Finer Details; its
      field posts through Details' print-words form `WORDS_FORM`, so the RSVP stage needs its own post to /api/hub-print/words).
- [x] 3 Music in Look (MAIN_ROWS = ['music'], panel titled Music, one line when nothing to set; `MakerLookPages.look.music`).
      ⏭ the dev lab's `lookRows` lacks `music` (shows the one-line empty state there).
- [ ] 4 cover frame removed + global background + Darker↔Lighter (see map: pahina-masthead `if (card)`; needs a new
      key on hero `config_json.main` + `mainGroundLegibility` floor; scrim in main-ground.tsx is cream-only today).
- [ ] 5 Reveal as first scene of STD / Invitation / The Day with show/hide (events.reveal_stages), over the cover only.
- [x] 6 What to bring → Details after Dress code, before Entourage (`welcomeParts` no longer takes it; `anchorOfTile`).
- [ ] 7 Classic no-media rule dropped (`heroMayBePageGround`, `main-background-panel.tsx` `plain`); single-part font
      free (`HUB_ELEMENT_PRO_FIELDS`/`HUB_RUN_PRO_FIELDS` drop 'font', element-sheet fontMark).
- Checks so far: tsc clean; full unit suite run once (all failures were re-pointed guards, re-run green); every CI
  guard script green except build-dependent ones; port-control baseline regenerated by its generator.
- ⏭ Still owed: proof screenshots 375 + 1440 in `/dev/maker-lab?tool=details`; Sonnet review of the final diff.

## Open questions
- "Buttons" (shape/fill/colour) is not in the owner's Look list — plan: draw it inside Colours (button colour is a colour). Owner to confirm.
- Group heading for Wedding March · Love Story · Schedule · Seat plan: reused shipped "Story & plans". Owner to confirm.
