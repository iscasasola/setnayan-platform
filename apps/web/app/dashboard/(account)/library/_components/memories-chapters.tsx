import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, Camera, Play } from 'lucide-react';
import { EventMonogram } from '@/app/_components/event-monogram';
import { groupIntoChapters, type ChapterBlock } from '@/lib/alaala-chapters';
import { lensEmptyLine, selectLens, type AlaalaLensKey, type AlaalaWall, type WallItem } from '@/lib/alaala-wall';
import { formatCount } from '@/lib/format-number';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import type { Album } from '../_data/photos-albums';
import { GalleryDoor } from './gallery-doors';
import { WallOpen, WallViewerRoot } from './memories-wall-viewer';

/**
 * memories-chapters.tsx — Memories, wearing the Papic gallery (owner 2026-10-22: *"Memories must look similar to
 * the gallery of papic. Somewhat but not exactly"*). The approved contract is
 * `prototypes/people_and_memories_template_2026-10-22.html` M1–M4; its §5 map says where every shipped piece went.
 *
 * What is the gallery's: gold mono chapter headings · a three-across grid of rounded square frames · ▶ on a clip ·
 * a gold dot on a frame you are in. What is "not exactly": the page stays on the PAGE's tokens (light and the
 * app's dark), never the gallery's obsidian, and the chapters are:
 *   · ALL EVENTS (controller 2026-10-22, the prototype's question 2: "by event") — one heading per event, EVERY
 *     event including the empty ones (owner 2026-08-19, "show all eight events"), with its Gallery › door (the
 *     shipped `GalleryDoors`, on the heading now) and the event's monogram tile when nothing is kept yet. This
 *     replaces the cover shelf AND the Gallery rows — four shapes before the first photograph became one.
 *   · ONE EVENT — the day's chapters, from the run of show (`lib/alaala-chapters.ts`, the Papic gallery's own),
 *     falling to time-of-day chapters when there is no schedule to read.
 * Owner, 22 Oct: NO counts line at the top ("remove these") — the page starts with the Life-Flash tile; the clip
 * and with-you marks live on the tiles. The foot line stays only where it explains a capped list.
 */

export const MEMORIES_HEADING =
  'font-mono text-[11.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--sn-gold-700)]';

/**
 * A frame opens IN THE SHARED VIEWER TEMPLATE (owner 2026-10-30, "the same template will show but no need for
 * tagging" — `memories-wall-viewer.tsx`): the photo itself, Share, and for your own event its Memories door. It used to
 * open the event's Memories (yours) or the bare picture in a new tab (theirs).
 */
function Tile({ item }: { item: WallItem }) {
  const label = `${item.isClip ? 'Clip' : 'Photo'} from ${item.eventName}${item.withMe ? ' — you are in it' : ''}`;
  const media = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
      {item.withMe ? (
        <span aria-hidden data-tile-with-me="" className="absolute left-[7px] top-[7px] h-[9px] w-[9px] rounded-full bg-[color:var(--sn-gold-500)] ring-[1.5px] ring-white/70" />
      ) : null}
      {item.isClip ? (
        <span aria-hidden data-tile-clip="" className="absolute bottom-1.5 right-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/55 text-white">
          <Play className="h-3 w-3 fill-current" strokeWidth={0} />
        </span>
      ) : null}
    </>
  );
  const shell = 'relative block aspect-square overflow-hidden rounded-xl bg-ink/[0.06]';
  return (
    <WallOpen item={item} label={label} className={shell}>
      {media}
    </WallOpen>
  );
}

/** One chapter heading, the gallery's: gold mono, the count, and a door at its right end. */
function Heading({
  label,
  count,
  href,
  door,
}: {
  label: string;
  /** null = say "nothing yet"; undefined = not known (a refused read) — no count at all, never "nothing yet". */
  count: number | null | undefined;
  href?: string | null;
  /** The event's Gallery › door (`GalleryDoor` — hosts only), at the heading's right end. */
  door?: ReactNode;
}) {
  const text = (
    <>
      {label}{' '}
      {count === undefined ? null : (
        <span className="font-normal tracking-normal text-ink/50">· {count === null ? 'nothing yet' : formatCount(count)}</span>
      )}
    </>
  );
  return (
    <div className="mt-2 flex min-h-[52px] items-center gap-3" data-memories-chapter="">
      {href ? (
        <Link href={href} className={`min-w-0 flex-1 truncate ${MEMORIES_HEADING}`}>
          {text}
        </Link>
      ) : (
        <h3 className={`min-w-0 flex-1 truncate ${MEMORIES_HEADING}`}>{text}</h3>
      )}
      {door ?? null}
    </div>
  );
}

/** The life-flash tile — the grid's first row (P M1). Quiet, and not pressable, until there is something to play. */
export function LifeFlashTile({ eventName, hasFrames }: { eventName: string | null; hasFrames: boolean }) {
  const eyebrow = eventName ? `Life-Flash · ${eventName}` : 'Life-Flash';
  if (!hasFrames) {
    return (
      <div className="relative mb-1.5 mt-3 h-[150px] overflow-hidden rounded-2xl bg-ink/[0.05]" data-life-flash="quiet">
        <span className="absolute left-3.5 top-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--sn-gold-700)]">
          {eyebrow}
        </span>
        <div className="absolute bottom-3 left-3.5 right-3.5">
          <p className="text-[17px] font-semibold text-ink">Your Life-Flash</p>
          <p className="text-[12.5px] leading-snug text-ink/60">Gathers the moments that mattered most, as your events happen.</p>
        </div>
      </div>
    );
  }
  return (
    <Link
      href="/dashboard/life-flash"
      className="relative mb-1.5 mt-3 block h-[184px] overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#8E6C4E_0%,#B98A5B_36%,#CBA766_62%,#6B4E3A_100%)]"
      data-life-flash="play"
    >
      <span className="absolute left-3.5 top-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/85">{eyebrow}</span>
      <span aria-hidden className="absolute bottom-3.5 left-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#2C2A29]">
        <Play className="h-5 w-5 fill-current" strokeWidth={0} />
      </span>
      <span className="absolute bottom-3 left-[70px] right-3.5 text-white">
        <span className="block text-[17px] font-semibold">{eventName ? 'The day, in a flash' : 'Your Life-Flash'}</span>
        <span className="block text-[12.5px] leading-snug opacity-90">The moments that mattered most, through every camera that was there.</span>
      </span>
    </Link>
  );
}

/** A refused read, said as one — never a "nothing yet" over a query that did not answer. */
export function MemoriesUnreadable({ what }: { what: 'memories' | 'events' }) {
  return (
    <p role="status" className="flex items-start gap-2 py-3 text-[13px] text-ink/65" data-memories-unreadable={what}>
      <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0 text-[color:var(--sn-warning)]" strokeWidth={1.75} />
      {what === 'memories'
        ? 'Some of your memories could not be loaded just now. This is not an empty album — try again in a moment.'
        : 'We couldn’t load your events just now. Nothing has changed — your photos are safe. Refresh to try again.'}
    </p>
  );
}

const grid = 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5';

/** The albums a lens is about — Owned are yours, Attended theirs, the rest all of them. */
export function albumsForLens(albums: Album[], lens: AlaalaLensKey): Album[] {
  if (lens === 'owned') return albums.filter((a) => a.role === 'couple');
  if (lens === 'attended') return albums.filter((a) => a.role === 'guest');
  return albums;
}

export async function MemoriesChapters({
  lens,
  wall,
  albums,
  albumsMeasured,
  eventId,
  lifeFlash,
  blocksFor,
}: {
  lens: AlaalaLensKey;
  wall: AlaalaWall;
  /** Every event, oldest first (the shelf's order, owner 2026-08-19). */
  albums: Album[];
  albumsMeasured: boolean;
  /** The Event dropdown's pick; null = all events. */
  eventId: string | null;
  lifeFlash: boolean;
  /** The picked event's run of show, for the day's chapters. Throws or [] = time-of-day chapters. */
  blocksFor: (eventId: string) => Promise<ChapterBlock[]>;
}) {
  const frames = selectLens(wall, lens);
  const picked = eventId ? albums.find((a) => a.event.event_id === eventId) ?? null : null;
  const shown = picked ? frames.filter((f) => f.eventId === picked.event.event_id) : frames;
  const total = picked ? shown.length : (wall.totals[lens] ?? frames.length);
  const more = picked ? 0 : total - shown.length;
  const atLeast = wall.partial ? '+' : '';
  const nothing = shown.length === 0;

  const intro = (
    <>
      {lifeFlash ? <LifeFlashTile eventName={picked?.event.display_name ?? null} hasFrames={!nothing} /> : null}
      {nothing ? (
        wall.unreadable ? (
          <MemoriesUnreadable what="memories" />
        ) : (
          <div className="px-4 pb-2 pt-5 text-center" data-memories-empty="">
            <Camera aria-hidden className="mx-auto h-7 w-7 text-ink/35" strokeWidth={1.5} />
            <p className="mx-auto mt-2 max-w-[300px] text-[14.5px] leading-snug text-ink/60">
              {lensEmptyLine(lens, wall.hasAttendedEvents)}
            </p>
          </div>
        )
      ) : wall.unreadable ? (
        <MemoriesUnreadable what="memories" />
      ) : null}
      {!albumsMeasured ? <MemoriesUnreadable what="events" /> : null}
    </>
  );

  // ── ONE EVENT: the day's chapters ─────────────────────────────────────────
  if (picked) {
    let chapters: { key: string; label: string; items: WallItem[] }[] = [];
    if (shown.length > 0) {
      let blocks: ChapterBlock[] = [];
      try {
        blocks = await blocksFor(picked.event.event_id);
      } catch {
        // A refused run of show falls to time-of-day chapters — a gallery is never blank over a heading.
        blocks = [];
      }
      const byId = new Map(shown.map((f) => [f.key, f]));
      const { days, undated } = groupIntoChapters({
        frames: shown.map((f) => ({ id: f.key, capturedAt: f.capturedAt })),
        blocks,
        tz: DEFAULT_EVENT_TZ,
      });
      chapters = days.flatMap((d) =>
        d.chapters.map((c) => ({ key: `${d.dayKey}:${c.key}`, label: c.label, items: c.frames.map((fr) => byId.get(fr.id)!).filter(Boolean) })),
      );
      if (undated.length > 0) chapters.push({ key: 'undated', label: 'Undated', items: undated.map((fr) => byId.get(fr.id)!).filter(Boolean) });
    }
    const door = <GalleryDoor event={picked.event} />;
    return (
      <WallViewerRoot items={chapters.flatMap((c) => c.items)}>
      <div data-memories-body="event">
        {intro}
        {chapters.length === 0 ? (
          <>
            <Heading label={picked.event.display_name} count={wall.unreadable ? undefined : null} href={picked.href} door={door} />
            <div className={grid}>
              <MonogramTile album={picked} unknown={wall.unreadable} />
            </div>
          </>
        ) : (
          chapters.map((c, i) => (
            <section key={c.key} data-memories-filter-name={`${picked.event.display_name} ${c.label}`}>
              <Heading label={c.label} count={c.items.length} door={i === 0 ? door : null} />
              <div className={grid}>
                {c.items.map((it) => (
                  <Tile key={it.key} item={it} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      </WallViewerRoot>
    );
  }

  // ── ALL EVENTS: one chapter per event, every event ───────────────────────
  const events = albumsForLens(albums, lens);
  return (
    <WallViewerRoot items={events.flatMap((album) => shown.filter((f) => f.eventId === album.event.event_id))}>
    <div data-memories-body="all">
      {intro}
      {events.map((album) => {
        const mine = shown.filter((f) => f.eventId === album.event.event_id);
        return (
          // 🔦 The account Memories tour rings the first event drawn (the engine takes the first visible match).
          <section key={album.event.event_id} data-memories-chapter-event={album.event.event_id} data-memories-filter-name={album.event.display_name} data-tour="library-event">
            <Heading
              label={album.event.display_name}
              count={mine.length > 0 ? (lens === 'with_me' ? mine.length : Math.max(album.count, mine.length)) : wall.unreadable ? undefined : null}
              href={album.href}
              door={<GalleryDoor event={album.event} />}
            />
            <div className={grid}>
              {mine.length > 0 ? mine.map((it) => <Tile key={it.key} item={it} />) : <MonogramTile album={album} unknown={wall.unreadable} />}
            </div>
          </section>
        );
      })}
      {/* The foot line only where it explains a capped list (owner 2026-10-22). */}
      {more > 0 ? (
        <p className="mb-1.5 mt-2 text-[12.5px] text-ink/55" data-memories-capped="">
          {formatCount(total)}
          {atLeast} {total === 1 ? 'frame' : 'frames'} {lens === 'with_me' ? 'you are in' : 'kept'} · showing the newest {formatCount(shown.length)}
        </p>
      ) : null}
    </div>
    </WallViewerRoot>
  );
}

/** An event with nothing kept yet keeps its place — its own mark, "Nothing yet" (the shelf's empty cover). */
function MonogramTile({ album, unknown = false }: { album: Album; unknown?: boolean }) {
  const inner = (
    <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-ink/[0.05]">
      <EventMonogram event={album.event} size="lg" plays={album.markPlays} place="album-shelf" />
      {/* Over a refused read the tile keeps the event's mark and says nothing — "Nothing yet" would be a guess. */}
      {unknown ? null : <span className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-ink/55">Nothing yet</span>}
    </span>
  );
  return album.href ? (
    <Link href={album.href} aria-label={unknown ? album.event.display_name : `${album.event.display_name} — nothing kept yet`} data-memories-monogram="">
      {inner}
    </Link>
  ) : (
    <span data-memories-monogram="">{inner}</span>
  );
}
