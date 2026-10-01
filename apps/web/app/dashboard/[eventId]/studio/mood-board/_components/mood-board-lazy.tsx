'use client';

import dynamic from 'next/dynamic';
import { SlotButton, SlotFill, SlotRows } from '../../../launch/_components/lazy-slot';

/**
 * ⚡ THE MOOD BOARD'S CLIENT PIECES, LOADED WHEN THE BOARD IS OPENED.
 *
 * The Mood Board is an item of the Event Hub Maker's Details (DECISION_LOG
 * "SCHEDULE, MOOD BOARD AND SEAT PLAN MOVE INSIDE THE EVENT HUB (DETAILS)"), so
 * the Maker's server graph reaches `mood-board-editor.tsx` — and Next puts every
 * `'use client'` module a route's server files import into that route's FIRST
 * LOAD, eagerly. The studio (theme studio, inspiration, palette, the boards,
 * Make it real) was ~60KB gzipped of a Maker opened with Details shut.
 *
 * So the editor imports these stand-ins — same names, same props — and each
 * loads its piece the first time it renders (`details-lazy.tsx` explains the
 * mechanism and `details-pieces-are-lazy.test.ts` holds it). The standalone
 * `/studio/mood-board` page draws the same editor, so it loads the same way;
 * rendered on the server there, `next/dynamic` preloads each piece's code with
 * the page. The small navigator parts (`mood-board-parts.tsx`) stay in place.
 */
export const ThemeStudio = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './theme-studio').then((m) => m.ThemeStudio), { loading: SlotFill });
export const InspirationBoard = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './inspiration-board').then((m) => m.InspirationBoard), { loading: SlotFill });
export const PaletteBoardProvider = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './palette-board-context').then((m) => m.PaletteBoardProvider), { loading: SlotFill });
export const PaletteSection = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './palette-section').then((m) => m.PaletteSection), { loading: SlotRows });
export const PartFinalizationPanel = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './part-finalization-panel').then((m) => m.PartFinalizationPanel), { loading: SlotRows });
export const MoodboardBoard = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './moodboard-board').then((m) => m.MoodboardBoard), { loading: SlotFill });
export const MakeItReal = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './make-it-real').then((m) => m.MakeItReal), { loading: SlotFill });
export const ShareWithVendorsButton = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './share-with-vendors-button').then((m) => m.ShareWithVendorsButton), { loading: SlotButton });
export const PrintablePdfButton = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './printable-pdf-button').then((m) => m.PrintablePdfButton), { loading: SlotButton });
export const ConceptPdfButton = dynamic(() => import(/* webpackChunkName: "maker-mood-board" */ './concept-pdf-button').then((m) => m.ConceptPdfButton), { loading: SlotButton });
