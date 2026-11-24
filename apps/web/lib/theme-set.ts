/**
 * lib/theme-set.ts — THE THEME, SHOWN AS ONE MOVING SET (owner 23 Nov 2026: *"animated yes"*; DECISION_LOG "THEMES ARE
 * SHOWN AS THE ANIMATED SET — APPROVED" and "EVENT HUB THEMES BATCH 6 APPROVED"; drawing
 * `prototypes/maker_theme_set_animated_2026-11-23/`).
 *
 * One theme wears every surface a guest touches, so a theme is chosen by seeing all of them at once: the Event Hub page
 * with its guest bar, the RSVP sheet, the digital ticket, the invitation and the table sign — overlapping as ONE
 * composed picture, arriving in that order, and cross-fading in place when another theme is tried.
 *
 * 🧩 THE PIECES ARE THE SHIPPED ONES, DRAWN SMALL — never a second copy of any of them (the drawing's "For the
 * builder", rule 1):
 *   · page + bar  — the sample Event Hub itself (`/maria-and-jose?theme=<id>`, the same page the theme tiles framed);
 *   · RSVP sheet  — that page with its reply sheet open (`#your-details`, `RSVP_SHEET_ANCHORS`);
 *   · ticket      — the sample's digital ticket from the one print door (`/api/hub-print/pass?sample=1`);
 *   · invitation  — the sample's invitation from the same door;
 *   · table sign  — the sample's table sign from the same door (`layoutTableSign`, lib/print-layout.ts).
 * Every address here is built by the readers that already build them (`sampleHubTileSrc`, `samplePrintSrc`); this file
 * only says which piece is which, in what order they arrive, and how they are named to a screen reader.
 *
 * Pure: no React, no window. `lib/the-theme-is-a-moving-set.test.ts` holds it.
 */
import { RSVP_SHEET_ANCHORS } from '@/app/[slug]/_components/rsvp-sheet-state';
import { samplePrintSrc } from '@/lib/maker-theme-tiles';
import { sampleHubTileSrc } from '@/lib/theme-sample-stills';

/** The five pieces, in the order they arrive (the drawing: page, RSVP, ticket, invitation, table sign). */
export const THEME_SET_PIECES = ['page', 'rsvp', 'ticket', 'invitation', 'sign'] as const;
export type ThemeSetPiece = (typeof THEME_SET_PIECES)[number];

/** What each piece is, in the guest's words — the set's accessible description, and the lab's captions. */
export const THEME_SET_PIECE_LABEL: Readonly<Record<ThemeSetPiece, string>> = {
  page: 'Event Hub page and guest bar',
  rsvp: 'RSVP sheet',
  ticket: 'Digital ticket',
  invitation: 'Invitation',
  sign: 'Table sign',
};

/** A piece drawn as a live page (a sandboxed frame of the sample) or as a picture (an SVG from the print door). */
export type ThemeSetSource = { kind: 'page'; src: string } | { kind: 'picture'; src: string };

/** Where each piece of the set is read from, for one theme. */
export type ThemeSetSources = (piece: ThemeSetPiece, themeId: string) => ThemeSetSource;

/** The print door's own name for a piece drawn as a picture. */
const PRINT_PIECE_OF = { ticket: 'pass', invitation: 'invitation', sign: 'table-sign' } as const;

/**
 * 🧪 A LAB'S OWN DOORS (dev only — a lab has no sample event and no database): two address templates, `{theme}` and
 * `{piece}` filled in (`{piece}` is the print door's name: `pass` · `invitation` · `table-sign`). Plain strings, so a
 * server page can hand them to the Maker. Absent everywhere but a lab.
 */
export type ThemeSetLabDoors = { page: string; print: string };

/**
 * The sources: the curated sample event, the same for every couple, dressed in the theme being tried.
 * `board` — the sample's palette as `sampleBoardQuery` wrote it; `version` — the sample's print-inputs hash (its
 * prints' cache key). The pass is the sample's ticket; the sign is its table sign.
 */
export function liveThemeSetSources(opts: { board: string | null; version: string | null; lab?: ThemeSetLabDoors | null }): ThemeSetSources {
  const lab = opts.lab ?? null;
  return (piece, themeId) => {
    if (lab) {
      const t = encodeURIComponent(themeId);
      if (piece === 'page' || piece === 'rsvp') {
        const src = lab.page.replace('{theme}', t);
        return { kind: 'page', src: piece === 'rsvp' ? `${src}#${RSVP_SHEET_ANCHORS[0]}` : src };
      }
      return { kind: 'picture', src: lab.print.replace('{theme}', t).replace('{piece}', PRINT_PIECE_OF[piece]) };
    }
    switch (piece) {
      case 'page':
        return { kind: 'page', src: sampleHubTileSrc(themeId, opts.board) };
      case 'rsvp':
        return { kind: 'page', src: `${sampleHubTileSrc(themeId, opts.board)}#${RSVP_SHEET_ANCHORS[0]}` };
      case 'ticket':
        return { kind: 'picture', src: samplePrintSrc('pass', themeId, opts.version, opts.board) };
      case 'invitation':
        return { kind: 'picture', src: samplePrintSrc('invitation', themeId, opts.version, opts.board) };
      case 'sign':
        return { kind: 'picture', src: samplePrintSrc('table-sign', themeId, opts.version, opts.board) };
    }
  };
}

/** The one main button's words for a theme being tried (the drawing: "Use Hagdan"). */
export function themeUseLabel(name: string): string {
  return `Use ${name}`;
}
