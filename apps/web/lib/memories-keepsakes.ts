/**
 * THE KEEPSAKE ROW ON MEMORIES — which of the four doors a host sees, in what order, and why a dimmed one is dimmed
 * (owner 2026-10-31, asked *"on memories. the Photo Magazine, Flash Life, and Thank You. must be added as a row of
 * buttons?"* → "Build both": the row Magazine · Recap · Flash · Thank You under the pinned row).
 *
 * Each door opens a SHIPPED card, unchanged — `MagazineCard` · `RecapCard` · `LifeFlashCard` · `ServiceParts
 * service="papic"` (the Thank-You Video door, which left the ⚙ for this row: one home). Every answer here is computed
 * from the card's OWN read (`readMagazineCard` · `loadRecapCoupleSummary` · `readLifeFlashCard` · `readServicePart`),
 * so the button and the card can never disagree about whether there is anything to open.
 *
 *   · A card that gates itself to nothing because there is nothing YET is a dimmed door with its reason in the ⓘ —
 *     never silently missing (a host must be able to tell "not yet" from "not here").
 *   · A card whose own docblock says it must say NOTHING — Life-Flash with its flag off or for a viewer who is not the
 *     couple; the Thank-You part where the catalogue does not offer it or the store shell refuses it — draws no door.
 *
 * Pure — no React, no I/O — so `memories-keepsake-row.test.ts` drives it directly.
 */

export const KEEPSAKE_ORDER = ['magazine', 'recap', 'flash', 'thank-you'] as const;
export type KeepsakeKey = (typeof KEEPSAKE_ORDER)[number];

/** The one word on each button, and the card's own name (the sheet's title). */
export const KEEPSAKE_WORDS: Record<KeepsakeKey, { word: string; title: string }> = {
  magazine: { word: 'Magazine', title: 'Photo Notes Magazine' },
  recap: { word: 'Recap', title: 'Your Recap' },
  flash: { word: 'Flash', title: 'This day, as a flash' },
  'thank-you': { word: 'Thank You', title: 'Thank-You Video' },
};

export type KeepsakeDoor = {
  key: KeepsakeKey;
  word: string;
  title: string;
  /** false = dimmed: the card has nothing to offer yet. */
  ready: boolean;
  /** Why it is dimmed — the ⓘ's words. null when ready. */
  reason: string | null;
};

export type KeepsakeReads = {
  /** `readMagazineCard` — the card renders once there is a photo. */
  magazine: { photos: number };
  /** `loadRecapCoupleSummary` — the card renders once there is a photo or an approved message. */
  recap: { privatePhotos: number; approvedKwentos: number };
  /** `readLifeFlashCard` — null = the card says nothing here; `moments: null` = not measured. */
  flash: { moments: number | null } | null;
  /** The flash's threshold — `SCOPE_MIN_MOMENTS.event`, passed in so this file copies no number. */
  flashMin: number;
  /** `readServicePart(eventId, 'papic')` — false = the part is not offered here. */
  thankYou: boolean;
};

function door(key: KeepsakeKey, reason: string | null): KeepsakeDoor {
  return { key, ...KEEPSAKE_WORDS[key], ready: reason === null, reason };
}

export function keepsakeDoors(r: KeepsakeReads): KeepsakeDoor[] {
  const out: KeepsakeDoor[] = [];
  out.push(
    door(
      'magazine',
      r.magazine.photos > 0 ? null : 'Your magazine is made from this event’s photos — it opens once the first photo lands.',
    ),
  );
  out.push(
    door(
      'recap',
      r.recap.privatePhotos > 0 || r.recap.approvedKwentos > 0
        ? null
        : 'Your Recap is put together from your photos and your guests’ messages — it opens once the first one arrives.',
    ),
  );
  if (r.flash) {
    const m = r.flash.moments;
    out.push(
      door(
        'flash',
        m === null
          ? 'We couldn’t check this event’s moments just now. Nothing has changed — refresh to try again.'
          : m < r.flashMin
            ? `This event’s flash plays once ${r.flashMin} moments are gathered — ${m} so far.`
            : null,
      ),
    );
  }
  if (r.thankYou) out.push(door('thank-you', null));
  return out;
}
