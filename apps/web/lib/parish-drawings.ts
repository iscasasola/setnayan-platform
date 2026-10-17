/**
 * apps/web/lib/parish-drawings.ts
 *
 * ⛪ A DRAWING OF THE PARISH, ON THE CEREMONY CARD.
 *
 * Owner, 2026-10-16 (DECISION_LOG "A LIBRARY OF PARISH DRAWINGS FOR THE EVENT
 * HUB"): *"we will have this kind of drawing for the eventt hub. we will collect
 * the different churches."* Each parish gets ONE soft pencil-and-watercolour
 * drawing; the ceremony venue card shows it when the event's ceremony is that
 * parish. The library itself is parked; for tonight, verbatim: *"just the one
 * for us first"* — the Santuario de San Vicente de Paul, cale-ice's church.
 *
 * WHY A LIST IN CODE, NOT A COLUMN (the smallest honest path):
 *   1. A drawing belongs to the PARISH, not to one couple: two couples married
 *      at the same church see the same drawing. So it is keyed per venue, as the
 *      ruling says — never per event, and never by a write to a real event.
 *   2. The ruling keys the library to `venue_directory`, and says storing a
 *      drawing per venue (a column or table) is a LATER build. The Santuario is
 *      not in `venue_directory` yet, and cale-ice's ceremony is a hand-added
 *      supplier. A shipped asset + this list is the library's first row, with no
 *      schema and no admin screen; when the column lands, `parishDrawingFor`
 *      reads it instead and every caller stays as it is.
 *   3. The couple's own venue photo (`venue_map` › `venue.*.ownPhoto`) already
 *      exists, but it is drawn as a cover-cropped photo in a framed box (a dark
 *      one on Full photo) — a drawing whose white is cut to transparent needs to
 *      sit on the card itself.
 *
 * MATCHING IS BY THE NAME THE GUEST READS — the card's own `venue.name` (the
 * booked supplier's name, or the couple's typed ceremony name), normalised. It
 * deliberately does NOT use the pin: the pin is withheld until a guest replies
 * (`lib/venue-disclosure.ts`), so a pin check would make the drawing appear and
 * vanish with the reply. The name never closes, so neither does the drawing — a
 * picture of a church tells a guest no more than its name, which they already
 * read (the same reasoning that keeps the venue photo up before a reply).
 *
 * The match is a PREFIX of the full parish name ("Santuario de San Vicente de
 * Paul …" also matches "… Parish & Shrine of the Poor"), and only on a card
 * that is the ceremony (or the one place for both). It never matches a bare
 * "San Vicente de Paul": other parishes carry that name.
 *
 * 🎨 THE FILE: drawn by the owner (Higgsfield, from his photo of the church —
 * the couple's own artwork, no third-party credit). Cut to transparent so a
 * dark Look shows no white box: the paper and the sky wash around the building
 * are cut by colour-to-alpha against white; the building stays opaque. 686 px
 * wide = 2× the 343 px card. AVIF first, WebP fallback, both under 60 KB.
 * The cut: `controller-2026-10-12/venue-drawing/cut_church.py`.
 *
 * 🖼 THE DRAWING IS THE COUPLE'S CHOICE, NEVER AUTOMATIC (owner 2026-10-16,
 * DECISION_LOG "A VENUE CARD'S PICTURE IS THE COUPLE'S CHOICE"), verbatim:
 * *"on a church you can upload a photo or use our pro feature photos of the
 * venue"*. #6588 drew the drawing on every matching ceremony card and so
 * REPLACED the couple's own uploaded photo. Now the card draws it only once the
 * couple picks "Our drawing ◆" in the Maker (`VenueChoice.drawing`, stored in
 * the `venue_map` scene's `config_json.venue`) — `venueDrawingFor` below is the
 * ONE reader the guest card uses. `parishDrawingFor` only answers "does the
 * library HAVE a drawing of this venue?" — what the Maker asks before it offers
 * the choice at all. Event Hub Pro: tried in the draft, named at Apply.
 */

import type { EventVenue } from '@/lib/event-venues';

export type ParishDrawing = {
  /** Stable key for the parish — the asset's file name. */
  key: string;
  /** The AVIF (served first) and WebP (fallback), under `public/`. */
  avif: string;
  webp: string;
  /** The files' intrinsic size, so the card reserves its space before load. */
  width: number;
  height: number;
  /** What a screen reader says. */
  alt: string;
};

type Entry = {
  /** The parish's name, normalised (`normaliseParishName`); a venue name that
   *  STARTS with it matches. */
  match: string;
  drawing: ParishDrawing;
};

/** The library. One row per parish. */
export const PARISH_DRAWINGS: readonly Entry[] = [
  {
    match: 'santuario de san vicente de paul',
    drawing: {
      key: 'santuario-de-san-vicente-de-paul',
      avif: '/parish-drawings/santuario-de-san-vicente-de-paul.avif',
      webp: '/parish-drawings/santuario-de-san-vicente-de-paul.webp',
      width: 686,
      height: 370,
      alt: 'A watercolour drawing of the Santuario de San Vicente de Paul',
    },
  },
];

/** Lower-case, accents dropped, everything but letters and digits to one space. */
export function normaliseParishName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The drawing for this venue card, or null. Only a ceremony card (or the one
 * place that is both) carries a parish drawing.
 */
export function parishDrawingFor(venue: Pick<EventVenue, 'role' | 'name'> | null | undefined): ParishDrawing | null {
  if (!venue || (venue.role !== 'ceremony' && venue.role !== 'both')) return null;
  const name = normaliseParishName(venue.name);
  if (!name) return null;
  for (const entry of PARISH_DRAWINGS) {
    if (name === entry.match || name.startsWith(`${entry.match} `)) return entry.drawing;
  }
  return null;
}

/**
 * ⛪ The drawing a guest's venue card SHOWS: the library's drawing for this
 * venue, and only when the couple picked "Our drawing" for the card
 * (`EventVenue.drawingChosen`). Absent the pick, null — whatever the name.
 */
export function venueDrawingFor(
  venue: Pick<EventVenue, 'role' | 'name' | 'drawingChosen'> | null | undefined,
): ParishDrawing | null {
  if (!venue?.drawingChosen) return null;
  return parishDrawingFor(venue);
}
