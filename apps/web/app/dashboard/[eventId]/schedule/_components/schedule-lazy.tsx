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
export const DeletePreparationItemButton = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ './prep-item-controls').then((m) => m.DeletePreparationItemButton), { loading: SlotButton });
export const RunOfShowHeader = dynamic(() => import(/* webpackChunkName: "maker-schedule" */ '@/app/_components/run-of-show-header').then((m) => m.RunOfShowHeader), { loading: SlotRows });
