'use client';

import dynamic from 'next/dynamic';
import { SlotButton, SlotFill, SlotNone, SlotRows } from '../../launch/_components/lazy-slot';

/**
 * ⚡ THE SCHEDULE PAGE'S CLIENT PIECES, LOADED WHEN THE SCHEDULE IS OPENED.
 *
 * The Schedule page is drawn whole inside the Event Hub Maker (Details › Story &
 * plans › Schedule), so the Maker's server graph reaches `schedule/page.tsx` —
 * and Next puts every `'use client'` module a route's server files import into
 * that route's FIRST LOAD, eagerly. The day rail, Announce, the emcee script and
 * the run-of-show header were ~27KB gzipped of a Maker opened with Details shut.
 *
 * So the page imports these stand-ins — same names, same props — and each loads
 * its piece the first time it renders (`launch/_components/details-lazy.tsx`
 * explains the mechanism; `details-pieces-are-lazy.test.ts` holds it). The
 * standalone `/schedule` page loads the same way; rendered on the server there,
 * `next/dynamic` preloads each piece's code with the page.
 */
export const ScheduleDay = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './day-rail').then((m) => m.ScheduleDay), { loading: SlotFill });
export const AnnounceButton = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './announce-button').then((m) => m.AnnounceButton), { loading: SlotButton });
export const Tip = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './day-ui').then((m) => m.Tip), { loading: SlotNone });
export const EmceeScriptButton = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './emcee-script-button').then((m) => m.EmceeScriptButton), { loading: SlotButton });
export const BlockTimeEditor = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './block-time-editor').then((m) => m.BlockTimeEditor), { loading: SlotRows });
export const ScheduleModeToggle = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './schedule-mode-toggle').then((m) => m.ScheduleModeToggle), { loading: SlotButton });
export const AddPreparationItem = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './prep-item-controls').then((m) => m.AddPreparationItem), { loading: SlotButton });
export const PlanningTick = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './planning-todo-controls').then((m) => m.PlanningTick), { loading: SlotButton });
export const TaskDateButton = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './planning-todo-controls').then((m) => m.TaskDateButton), { loading: SlotButton });
export const PlanningFilterFrame = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './planning-todo-controls').then((m) => m.PlanningFilterFrame), { loading: SlotFill });
// 👈 A hand-added step's row, wrapped in its swipe-left Delete (owner 2026-11-03). Its slot while loading is a row's.
export const PrepItemSwipe = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './prep-item-controls').then((m) => m.PrepItemSwipe), { loading: SlotRows });
// 👈 The block list's card, wrapped in its swipe-left Delete (owner 2026-11-03). Lazy like the step's row above: the
// Maker draws this page, and a direct import put the swipe + Undo toast in the Maker's first load (+4.3KB gz).
export const BlockSwipe = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './block-swipe').then((m) => m.BlockSwipe), { loading: SlotRows });
export const RunOfShowHeader = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ '@/app/_components/run-of-show-header').then((m) => m.RunOfShowHeader), { loading: SlotRows });
export const ScheduleOneLine = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './schedule-one-line').then((m) => m.ScheduleOneLine), { loading: SlotFill });
// 📤 The Schedule's Share (the shared budget-PDF button) — lazy, so the Maker's first load does not carry it.
export const SharePdfButton = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ '@/app/_components/share-pdf-button').then((m) => m.SharePdfButton), { loading: SlotButton });
/* 📖 Chapters on the Schedule page (owner 2026-11-01): the page that lays a chapter over the views, and Planning Stage's
   chapter rows — loaded with the rest of the Schedule, never with the Maker. */
export const ChaptersHost = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './chapters-host').then((m) => m.ChaptersHost), { loading: SlotFill });
export const PlanningChapters = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './chapters-host').then((m) => m.PlanningChapters), { loading: SlotNone });
