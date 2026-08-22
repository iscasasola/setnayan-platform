import Link from 'next/link';
import { Play } from 'lucide-react';
import { EventMonogram } from '@/app/_components/event-monogram';
import { getPhotosAlbums } from '../_data/photos-albums';

/**
 * AlbumShelf — one cover per event, oldest first, above the whole-library grid.
 *
 * Owner 2026-08-19: *"first row should be chronological albums of each event.
 * then under it can be all the photos in grid."* — the Apple Photos shape:
 * collections across the top, the library underneath.
 *
 * ── NOT A SECOND LIST OF EVENTS ────────────────────────────────────────────
 * Per-event albums were deliberately demoted on 2026-08-13, and the reason is
 * still right: the thing that was removed answered with EVENT NAMES AND COUNTS,
 * which made Alaala a second events board — and the board is for DOING while
 * Alaala is for KEEPING. This shelf is a different object. It answers with
 * PHOTOGRAPHS: a cover, its clip badge, its count. You read it by looking, not
 * by reading names.
 *
 * ── EVERY EVENT, INCLUDING THE EMPTY ONES (owner 2026-08-19, asked twice) ───
 * "show all eight events." Production has 8 events and 14 photos, all 14 on ONE
 * of them, so 7 covers are empty today. An empty cover says "nothing here yet";
 * a missing one makes an event you are actively planning disappear from your own
 * gallery. `getPhotosAlbums` already keeps zero-count albums — this needed no
 * data change, only the decision.
 *
 * ── CHRONOLOGICAL MEANS BY THE EVENT'S DATE ────────────────────────────────
 * `getPhotosAlbums` returns owned-then-attended (its own ordering job, which the
 * `?tab=albums` grid still relies on) so the shelf sorts its OWN copy. Undated
 * events sort last rather than being dropped — an event with no date yet is the
 * most likely one to have nothing in it, and the least useful thing to hide.
 *
 * ⚠ `event_date` IS A DATE, NOT AN INSTANT. `new Date('2026-12-12')` is midnight
 * UTC, which is 11 Dec anywhere west of Greenwich — the documented defect that
 * printed the wrong day on 41 screens. Sorting only compares these values to
 * each other, so the offset cancels; it is parsed as a plain string key here and
 * never rendered from a Date.
 */
export async function AlbumShelf({ userId }: { userId: string }) {
  const { albums } = await getPhotosAlbums(userId);
  if (albums.length === 0) return null;

  const ordered = [...albums].sort((a, b) => {
    const da = a.event.event_date;
    const db = b.event.event_date;
    if (da && db) return da < db ? -1 : da > db ? 1 : 0;
    if (da) return -1; // dated before undated
    if (db) return 1;
    return 0;
  });

  return (
    <section aria-labelledby="album-shelf-heading" className="mb-8">
      <h2 id="album-shelf-heading" className="sr-only">
        Albums, one per event
      </h2>
      {/* A rail, not a grid: the library grid below is the thing you scroll. */}
      <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {ordered.map((album) => {
          const cover = album.thumbs[0];
          const label = album.event.display_name;
          return (
            <li key={album.event.event_id} className="w-[9.5rem] shrink-0 snap-start sm:w-44">
              <Link
                href={album.href ?? '#'}
                className="sn-press group block"
                aria-label={
                  album.count > 0
                    ? `${label} — ${album.count} ${album.count === 1 ? 'item' : 'items'}`
                    : `${label} — nothing kept yet`
                }
              >
                <span className="relative block aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-ink/[0.04]">
                  {cover ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 object, already resolved upstream */}
                      <img
                        src={cover.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      {cover.isClip ? (
                        <span className="absolute bottom-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-cream">
                          <Play aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </>
                  ) : (
                    // The empty cover carries the event's own mark, so a shelf on
                    // launch day reads as YOUR events waiting, not as blank tiles.
                    <span className="flex h-full w-full items-center justify-center">
                      <EventMonogram event={album.event} size="lg" />
                    </span>
                  )}
                </span>
                <span className="mt-1.5 block truncate text-[13px] font-semibold text-ink">
                  {label}
                </span>
                <span className="block text-[11px] text-ink/55">
                  {album.count > 0
                    ? `${album.count} ${album.count === 1 ? 'item' : 'items'}`
                    : 'Nothing yet'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
