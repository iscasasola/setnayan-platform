'use client';

import dynamic from 'next/dynamic';
import { SlotButton, SlotFill, SlotNone, SlotRows } from './lazy-slot';

/**
 * ⚡ DETAILS PIECES LOAD WHEN THEY ARE OPENED — NEVER WITH THE MAKER.
 *
 * Owner, 2026-09-29: *"the Maker must never be slow"*; the Maker's first-load
 * JavaScript has a ceiling (`scripts/check-maker-js-budget.mjs`, CI "bundle
 * size check"). Folding Details in (the theme gallery, the prints, Your event,
 * Words, Love Story, Schedule, RSVP, the Mood Board, Logo, Hero, Reveal) put
 * every one of their editors into the code a phone downloads before its first
 * tap — 643KB against 505KB — although Details is closed on a cold open.
 *
 * 🔑 WHY A SERVER FILE IMPORTS FROM HERE AND NOT FROM THE PIECE. Next puts
 * EVERY `'use client'` module a route's server files import into that route's
 * first load, eagerly (`next-flight-client-entry-loader`: `webpackMode:
 * "eager"`), whether or not the page ever draws it. The ONLY way a piece
 * leaves the first load is to be reached through a client-side `import()` —
 * which is what each `dynamic()` below is. So Details' server files
 * (`maker-details.tsx`, `maker-prints.tsx`, `details-your-event-parts.tsx`,
 * `maker-made-once.tsx`, the launch page) import these stand-ins, with the SAME
 * names and props; each loads its real piece the first time it renders.
 * 🛡 `details-pieces-are-lazy.test.ts` fails if a server file of the Maker
 * imports a lazy piece's own module again.
 *
 * 📦 THE PIECES TRAVEL AS NAMED CHUNKS — `maker-details` (everything here),
 * `maker-mood-board`, `maker-schedule` and `maker-seating` (`seating-lazy.tsx`)
 * — those three are also drawn by their own standalone routes, and a route
 * that loads the `maker-details` group becomes its parent (see seating-lazy.tsx). Every `import()` names its chunk: webpack's runtime —
 * loaded on EVERY page, under the shared-bundle ceiling
 * (`scripts/check-bundle-size.mjs`) — carries an entry per async chunk and per
 * chunk an async group depends on. Unnamed, the first cut of this split grew
 * that runtime 4.0KB → 4.9KB gz and put the shared bundle over its ceiling.
 *
 * What stays in the first load, on purpose:
 *   · the Details navigator and its workspace (`details-workspace.tsx`);
 *   · the theme pick's provider (`maker-theme-picker.tsx` — it wraps the
 *     navigator, so a lazy provider would hold the whole of Details back);
 *   · the print words form's own fields (`opening-line-field.tsx`,
 *     `soft-post.tsx` — a field that has not arrived would be missing from a
 *     words save);
 *   · the small shared doors (`details-go.tsx`, `details-piece.tsx`);
 *   · the Hero/Reveal/Logo frames (`details-look-pages.tsx`) and the Love
 *     Story's moment sheet (`moment-sheet.tsx`) — MEASURED: each saves ~2–4KB
 *     but depends on chunks the first screen already has (the element sheet, the
 *     editor bridge), and making them lazy added more to the every-page runtime
 *     (7 dependency entries for the moment sheet alone) than it took off the
 *     Maker;
 *   · the guest card of a parent (`GuestCardBody`'s pieces) and the Requests
 *     rows (`guests/claims`) — the Guest list and the Requests page draw the
 *     same modules as their MAIN content, and lazy there would flash a
 *     placeholder where a card opens today.
 *
 * ⏳ A piece that has not arrived holds its slot (`lazy-slot.tsx`). It is almost
 * never seen: once the Maker is on screen and the phone is idle, the Maker
 * WARMS every piece here (`maker-tools.tsx` — the one registry of the Maker's
 * tools; `lib/warm-dynamic.ts`), so its code is on the phone AND its first
 * render draws the real piece, not this slot. With Save-Data on, a piece loads
 * when it is first drawn, as before. Rendered on the server (a Maker opened at
 * `?tool=details`), a piece arrives with the page — `next/dynamic` preloads its
 * code there.
 */

/* ── Words · Your Event Hub ─────────────────────────────────────────────── */
export const QrLookControls = dynamic(() => import(/* webpackChunkName: "maker-details" */ './qr-look-controls').then((m) => m.QrLookControls), { loading: SlotRows });
export const SpecialMessageField = dynamic(() => import(/* webpackChunkName: "maker-details" */ './special-message-field').then((m) => m.SpecialMessageField), { loading: SlotRows });
export const PabuyaMessageEditor = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ '../../pabuya/_components/pabuya-message-editor').then((m) => m.PabuyaMessageEditor),
  { loading: SlotRows },
);
/* 🎁 The E-Gifts page's own manager — the Your event form's E-Gifts field (2026-10-06). */
export const PabuyaManager = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ '../../pabuya/_components/pabuya-manager').then((m) => m.PabuyaManager),
  { loading: SlotRows },
);

/* ── The prints (Invitation set · For the day · Download) ─────────────────── */
export const PrintPreview = dynamic(() => import(/* webpackChunkName: "maker-details" */ './print-preview').then((m) => m.PrintPreview), { loading: SlotFill });
export const PrintMenuEditor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './print-menu-editor').then((m) => m.PrintMenuEditor), { loading: SlotRows });
export const PrintChoicePicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './print-choice-picker').then((m) => m.PrintChoicePicker), { loading: SlotRows });
export const PassCardDesignPicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './pass-card-design-picker').then((m) => m.PassCardDesignPicker), { loading: SlotRows });
export const PrintSaveButton = dynamic(() => import(/* webpackChunkName: "maker-details" */ './print-save-button').then((m) => m.PrintSaveButton), { loading: SlotButton });
// 🖼 The A3 poster's own photo (owner 2026-09-29) — the Details chunk, like every print control.
export const PosterPhotoPicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './poster-photo-picker').then((m) => m.PosterPhotoPicker), { loading: SlotRows });
// 🖨 "Changed since you printed" (owner 2026-09-29) — the same file, the same chunk, nothing drawn while it loads.
export const ChangedSincePrinted = dynamic(() => import(/* webpackChunkName: "maker-details" */ './print-save-button').then((m) => m.ChangedSincePrinted));

/* ── Your event (names · date · venues · parents & hosts · the march) ─────── */
export const NamesEditor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-your-event').then((m) => m.NamesEditor), { loading: SlotRows });
// 🔤 Name style ▾ (owner 2026-09-30) — under the Names, the same file, the same chunk.
export const NameStylePicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-your-event').then((m) => m.NameStylePicker), { loading: SlotRows });
export const OneNameEditor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-your-event').then((m) => m.OneNameEditor), { loading: SlotRows });
export const DateEditor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-your-event').then((m) => m.DateEditor), { loading: SlotRows });
export const DateBody = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-your-event').then((m) => m.DateBody), { loading: SlotFill });
export const VenuesEditor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-your-event').then((m) => m.VenuesEditor), { loading: SlotRows });
export const MarchMaker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-march').then((m) => m.MarchMaker), { loading: SlotFill });
export const PeoplePieces = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-people').then((m) => m.PeoplePieces), { loading: SlotNone });
export const PeopleBody = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-people').then((m) => m.PeopleBody), { loading: SlotFill });
export const PeopleControls = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-people').then((m) => m.PeopleControls), { loading: SlotRows });
export const ParentCards = dynamic(() => import(/* webpackChunkName: "maker-details" */ './parent-cards').then((m) => m.ParentCards), { loading: SlotRows });

/* ── 🗂 Your info's answers (owner 2026-10-02) — one dropdown per answer, and Event settings ── */
export const AnswerPicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-answers').then((m) => m.AnswerPicker), { loading: SlotRows });

/* ── Story & plans (Love Story · Schedule · RSVP) ─────────────────────────── */
export const LoveStoryPieceFocus = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-tool-pieces').then((m) => m.LoveStoryPieceFocus), { loading: SlotNone });
export const ScheduleSlots = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-tool-pieces').then((m) => m.ScheduleSlots), { loading: SlotNone });
export const MakerRsvpSettings = dynamic(() => import(/* webpackChunkName: "maker-details" */ './maker-rsvp-ask').then((m) => m.MakerRsvpSettings), { loading: SlotRows });
/* 🗳 The RSVP stage (owner 2026-09-30 re-plan: RSVP is its own stage) — its scenes, canvas and controls, in this chunk. */
export const MakerRsvpStage = dynamic(() => import(/* webpackChunkName: "maker-details" */ './maker-rsvp-stage').then((m) => m.MakerRsvpStage), { loading: SlotFill });

/* 🚂 The element sheet (size · font · colour · motion of one scene element) opens
   on a TAP, never on arrival — so it rides this chunk, warmed at idle with
   the rest (`maker-tools.tsx`), instead of the Maker's first load. Moved in the
   2026-09-30 release train to bring the Maker back under its 505KB budget
   (scripts/check-maker-js-budget.mjs) without raising it. */
export const ElementSheet = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/element-sheet').then((m) => m.ElementSheet), { loading: SlotNone });
/* ✍ The type bar — Wording ▾ · Format ▾ · Style ▾ · Hide over the words being typed on the
   canvas (tap-to-type, Maker core part 2); loaded on the first tap, with the element sheet. */
export const TypeBar = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/type-in-place').then((m) => m.TypeBar), { loading: SlotNone });
/* 🚂 …and the scene's bound-fact box ("Change it everywhere / Just this scene",
   #6048/#6176) draws only once a scene is selected — same chunk, same idle warm. */
export const DetailsBoundField = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/details-bound-field').then((m) => m.DetailsBoundField), { loading: SlotRows });
/* 🚂 The Look pages' Details editors (Logo · Hero · Reveal, #6166/#6176) — drawn
   when that Details item is opened; same chunk, same idle warm. */
export const DetailsLookBody = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-look-pages').then((m) => m.DetailsLookBody), { loading: SlotFill });
export const DetailsLookEditor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-look-pages').then((m) => m.DetailsLookEditor), { loading: SlotRows });
/* 🎨 Look as one panel (2026-10-02): its four sections, and its body — the couple's page. */
export const LookPanel = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-look-pages').then((m) => m.LookPanel), { loading: SlotRows });
export const DetailsLookPageBody = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-look-pages').then((m) => m.DetailsLookPageBody), { loading: SlotFill });
export const DetailsLookPieces = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-look-pages').then((m) => m.DetailsLookPieces), { loading: SlotRows });
export const StageStepPreview = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-look-pages').then((m) => m.StageStepPreview), { loading: SlotFill });

/* ── The stage editor's background controls (#6135): shown when Main or a scene is edited ── */
export const MainBackgroundPanel = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/main-background-panel').then((m) => m.MainBackgroundPanel), { loading: SlotRows });
export const HeroFrameSync = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/main-background-panel').then((m) => m.HeroFrameSync), { loading: SlotNone });
/* 🎬 A scene's Animate tab — loaded when it first opens, never in the Maker's first load. */
export const SceneAnimateTab = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/scene-animate-tab').then((m) => m.SceneAnimateTab), { loading: SlotRows });
export const SceneBackgroundRow = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/scene-background-row').then((m) => m.SceneBackgroundRow), { loading: SlotRows });
/* 🥗 …and the Main look's Colours panel and the Pro rows' locked panel (rd/maker-diet,
   2026-09-30): each draws only when its row is opened — "Main" and a Pro row are
   taps, never the Maker's arrival — so they ride this chunk instead of the first
   load, like the background panel above. Room in the 505KB Maker budget for #6205
   and #6209 without raising it. */
export const ButtonsLookRow = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/buttons-look-row').then((m) => m.ButtonsLookRow), { loading: SlotRows });
export const ColorsPanel = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/pro-panels').then((m) => m.ColorsPanel), { loading: SlotRows });
export const ProLockPanel = dynamic(() => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/pro-panels').then((m) => m.ProLockPanel), { loading: SlotRows });

/* ── What's left (Details part 5): a step's heading, its foot, the Ready screens ── */
export const GuideHead = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-guide').then((m) => m.GuideHead), { loading: SlotNone });
export const GuideLinkScreen = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-guide').then((m) => m.GuideLinkScreen), { loading: SlotFill });
export const GuideReady = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-guide').then((m) => m.GuideReady), { loading: SlotFill });
export const GuideFoot = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-guide').then((m) => m.GuideFoot), { loading: SlotButton });
export const StepBackground = dynamic(() => import(/* webpackChunkName: "maker-details" */ './details-guide').then((m) => m.StepBackground), { loading: SlotNone });
/* 🗂 PR-2 — "Which stage do you want ready?" and the stage's Before we start. */
export const StagePicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stage-picker').then((m) => m.StagePicker), { loading: SlotFill });
export const BeforeWeStartScreen = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stage-picker').then((m) => m.BeforeWeStartScreen), { loading: SlotFill });

/* ── The Look (Logo · Reveal — the pages the work area hands in) ─────────── */
export const MakerLogoDoor = dynamic(() => import(/* webpackChunkName: "maker-details" */ './maker-logo').then((m) => m.MakerLogoDoor), { loading: SlotFill });
export const MakerRevealPicker = dynamic(() => import(/* webpackChunkName: "maker-details" */ './maker-reveal').then((m) => m.MakerRevealPicker), { loading: SlotRows });

/* ── 🧭 The new Maker's own chrome (owner 2026-10-06, `makerStagesStudioEnabled`) — Stages | Studio, Studio's
   home and its Tool ▾ row, the grab handle, the one bottom sheet. Drawn only while the new Maker is on, so none
   of it is in the Maker's first load (`scripts/check-maker-js-budget.mjs`); warmed at idle with the rest. ── */
export const StudioSideSwitch = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.StudioSideSwitch), {
  loading: () => <span aria-hidden className="block h-11 w-full rounded-lg bg-ink/[0.06]" />,
});
export const StudioToolMenu = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.StudioToolMenu), { loading: SlotButton });
export const StudioToolRow = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.StudioToolRow), { loading: SlotNone });
/* 🎓 "About the Maker" (Page ▾) — the tour is drawn only when the couple asks for it, never on a first open, so its
   slides' frame and words load with the first ask (08 Oct: #6413's Maker first load was 0.4 KB over its budget). */
export const MakerTour = dynamic(() => import(/* webpackChunkName: "maker-details" */ './maker-tour').then((m) => m.MakerTour), { loading: SlotNone });
export const StudioBackToPart = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.StudioBackToPart), { loading: SlotNone });
export const StudioCover = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.StudioCover), { loading: SlotFill });
export const LowerThirdGrab = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.LowerThirdGrab), { loading: SlotNone });
export const MakerSheet = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stages-studio-parts').then((m) => m.MakerSheet), { loading: SlotNone });
/* 🎬 The new Maker's Stages panel (`stage-tools.tsx`: the stage ▾ with its pages, Style | Text | Animate, ▶,
   the page's parts, swipe) — lazy like the rest of its chrome, never in the Maker's first load. */
export const StageTools = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stage-tools').then((m) => m.StageTools), { loading: SlotFill });

/* ── 🧭 The new Maker's Studio tools (owner 2026-10-06, plan PR 4 — `MakerDetails`'s `studio`): ONE stand-in for
   every piece (`StudioTool`'s `part`) — each stand-in is bytes in the Maker's first load. Drawn only while the new
   Maker is on. ── */
export const StudioTool = dynamic(() => import(/* webpackChunkName: "maker-details" */ './studio-tools').then((m) => m.StudioTool), { loading: SlotRows });
/* 🧭 The redrawn Stages panel's Style (Look | Background | Arrange) and its Arrange rows — ONE stand-in
   (`stage-panel/parts.tsx`), drawn only while the new Maker is on (DECISION_LOG 2026-10-07). */
export const StagePanelPart = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stage-panel/parts').then((m) => m.StagePanelPart), { loading: SlotRows });
/* 📸 Photo moments' editor (a scene's Content — drawn only once that scene is opened): its defaults and its
   rows ride this chunk, never the Maker's first load (budget headroom, 2026-10-07 — the Stages redraw). */
export const PhotoMomentsEditor = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ '../../website/photo-moments/_components/photo-moments-editor').then((m) => m.PhotoMomentsEditor),
  { loading: SlotRows },
);
/* ▶ The Stages ▶'s status line — first pressed, then loaded (`stage-panel/play-status.tsx`). */
export const StagePlayStatus = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stage-panel/play-status').then((m) => m.StagePlayStatus));
/* 🎛 The Camera's own looks in Stages — loaded the first time the Camera is picked (`stage-panel/camera-look.tsx`). */
export const CameraPartTools = dynamic(() => import(/* webpackChunkName: "maker-details" */ './stage-panel/camera-look').then((m) => m.CameraPartTools), { loading: SlotRows });
