import type { ReactNode } from 'react';

/**
 * EACH GUEST'S OWN PHOTOS — THE OTHER TWO ARRANGEMENTS: B · The big one and
 * C · Polaroids (prototype `every_scene_three_styles_2026-09-29.html` §14).
 * A · The grid is `PhotosOfYouGallery`'s own three-across grid.
 *
 * 🔒 A STYLE MOVES PICTURES, NOT CONSENT. Every tile arrives here already
 * built by `PhotosOfYouGallery` — the photo, its "Not me" and "Take it down"
 * controls, its "On the wall" badge and its credit — and is placed, never
 * rebuilt. So no arrangement can drop a control a guest uses to take herself
 * out of a picture.
 *
 * ⚠ The prototype's B was "the best one — most-kept first". Nothing records
 * keeps per photo, so a "most-kept" lead would be invented. B leads with the
 * first photo in the gallery's own order (the latest tagged) and says so.
 */

export type PhotoTile = { key: string; node: ReactNode; capturedAt: string | null };

/** B · The big one — the latest photo large, the rest as a strip that slides sideways. */
export function PhotosOfYouLead({ tiles }: { tiles: readonly PhotoTile[] }) {
  const [lead, ...rest] = tiles;
  if (!lead) return null;
  return (
    <div className="mt-4 space-y-2" data-scene-style="lead">
      <div className="w-full">{lead.node}</div>
      <p className="sn-gal-soft text-sm">The latest photo of you</p>
      {rest.length > 0 ? (
        <ol className="flex snap-x gap-2 overflow-x-auto pb-1">
          {rest.map((t) => (
            <li key={t.key} className="w-32 shrink-0 snap-start">
              {t.node}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** "4:41 PM" in the event's zone, or null when the capture has no time. */
export function captureTime(capturedAt: string | null, timeZone?: string | null): string | null {
  if (!capturedAt) return null;
  const d = new Date(capturedAt);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone ?? undefined });
  } catch {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

/** C · Polaroids — each photo as an instant print, with the time it was taken under it. */
export function PhotosOfYouPolaroids({ tiles, timeZone = null }: { tiles: readonly PhotoTile[]; timeZone?: string | null }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-4" data-scene-style="polaroids">
      {tiles.map((t, i) => {
        const time = captureTime(t.capturedAt, timeZone);
        return (
          <li key={t.key} className={`bg-cream p-2 pb-3 shadow-md ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}>
            {t.node}
            <p className="mt-2 text-center font-pahina text-sm italic text-ink/75">{time ?? ' '}</p>
          </li>
        );
      })}
    </ul>
  );
}
