import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Camera, Play, Users } from 'lucide-react';

import { orbBackground } from '@/app/dashboard/(account)/life-flash/_components/placeholder';
import {
  lensEmptyLine,
  lensIsWall,
  selectLens,
  type AlaalaLensKey,
  type AlaalaWall,
  type WallItem,
} from '@/lib/alaala-wall';

/**
 * AlaalaLensBody — what a lens actually answers with.
 *
 * ONE renderer, both Alaala surfaces: the home's obsidian-tile section (chips
 * are a client island that swaps server-rendered bodies) and `/dashboard/library`
 * (chips are links, one body per request). Two surfaces answering the same five
 * words two different ways is the drift this component exists to prevent.
 *
 * 🔑 NOT ONE CARD PER EVENT. Alaala keeps PHOTOS. The event a frame came from
 * is provenance — it decides where the tile opens and nothing else. If this
 * component ever grows a `.map()` over events, the surface has turned back into
 * the board and the guard in `alaala-is-memories.test.ts` will say so.
 *
 * ⚠ Plain `<img>`, deliberately: these URLs are presigned R2 and are not in the
 * `next/image` allowlist (the same reason the album strip uses one). They are
 * already RESOLVED — a raw `r2://` ref in an `<img src>` fails silently, which
 * is what `lint-stored-asset-refs.mjs` exists to catch.
 */

/** Where a frame opens. */
function frameHref(item: WallItem): { href: string; external: boolean } {
  // OWNED → the event's album, where the full viewer and Download all live.
  if (item.role === 'couple') {
    return { href: `/dashboard/${item.eventId}/studio/papic`, external: false };
  }
  // ATTENDED → the picture itself. The event dashboard admits COUPLE members
  // only (`[eventId]/layout.tsx` → notFound), so sending a guest there is a
  // door that cannot open. A tile that opens the photo is smaller than the
  // album card it replaces, and it is the part that actually works.
  return { href: item.url, external: true };
}

function Frame({ item }: { item: WallItem }) {
  const { href, external } = frameHref(item);
  const label = item.isClip
    ? `Clip from ${item.eventName}`
    : `Photo from ${item.eventName}`;

  const media = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt=""
        title={item.eventName}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        loading="lazy"
        draggable={false}
      />
      {item.isClip ? (
        <span
          aria-hidden
          className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
        >
          <Play className="h-3 w-3 fill-current" strokeWidth={0} />
        </span>
      ) : null}
    </>
  );

  const shell =
    'group relative aspect-square overflow-hidden rounded-xl bg-cream ring-1 ring-ink/[0.06] transition-shadow hover:shadow-[0_10px_22px_-14px_rgba(23,22,15,0.55)]';

  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={shell}
    >
      {media}
    </a>
  ) : (
    <Link href={href} aria-label={label} className={shell}>
      {media}
    </Link>
  );
}

/**
 * The People door, on EVERY branch of the People lens.
 *
 * It used to hang off one prose placeholder, so replacing that placeholder with
 * real faces silently deleted the only route from Alaala to /dashboard/people.
 * `lint-port-no-lost-controls.mjs` caught it in this same change: a page ships
 * with its doorway, and a control that disappears when a feature starts WORKING
 * is the worst kind to lose.
 */
function PeopleDoor() {
  return (
    <Link
      href="/dashboard/people"
      className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--sn-gold-700)] transition-colors hover:text-[color:var(--sn-gold-600)]"
    >
      Open People
      <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}

/** A read failed. Never print "nothing here" over a refused query. */
function Unreadable() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-ink/20 bg-white/50 px-3 py-3 text-xs text-ink/60">
      <AlertTriangle
        aria-hidden
        className="mt-px h-4 w-4 shrink-0 text-[color:var(--sn-warning)]"
        strokeWidth={1.75}
      />
      Some of your memories could not be loaded just now. This is not an empty
      album — try again in a moment.
    </p>
  );
}

function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-white/50 px-4 py-6 text-center">
      <Camera aria-hidden className="mx-auto h-6 w-6 text-ink/25" strokeWidth={1.5} />
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink/55">
        {children}
      </p>
    </div>
  );
}

export function AlaalaLensBody({
  lens,
  wall,
  tiles = 12,
}: {
  lens: AlaalaLensKey;
  wall: AlaalaWall;
  /** How many frames this surface has room for. */
  tiles?: number;
}) {
  if (lens === 'people') {
    if (!wall.facesMeasured) {
      return (
        <div className="space-y-2.5">
          <p className="rounded-xl border border-dashed border-ink/20 bg-white/50 px-4 py-4 text-xs leading-relaxed text-ink/55">
            Family, godparents and friends — suggested from your events,
            confirmed by both sides.
          </p>
          <PeopleDoor />
        </div>
      );
    }
    if (wall.faces.length === 0) {
      return (
        <div className="space-y-2.5">
          <Nothing>{lensEmptyLine('people', wall.hasAttendedEvents)}</Nothing>
          <PeopleDoor />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-3">
          {wall.faces.slice(0, tiles).map((face) => (
            <li key={face.key} className="flex w-[64px] flex-col items-center gap-1.5">
              <span
                aria-hidden
                className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full text-base font-extrabold text-ink ring-2 ring-white/70"
                style={{ background: orbBackground(face.displayName, face.inMemoriam) }}
              >
                {face.displayName.charAt(0).toUpperCase()}
                {face.inMemoriam ? (
                  <span aria-hidden className="absolute -right-0.5 -top-0.5 text-[9px]">
                    ✦
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-center text-[11px] font-bold text-ink/80">
                {face.displayName}
              </span>
              <span className="text-[10px] text-ink/45">
                {face.eventCount} {face.eventCount === 1 ? 'event' : 'events'}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-1.5 text-[11px] text-ink/45">
          <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Who kept showing up — counted from the photos, never guessed.
        </p>
        <PeopleDoor />
      </div>
    );
  }

  const frames = selectLens(wall, lens);

  if (frames.length === 0) {
    return wall.unreadable ? (
      <Unreadable />
    ) : (
      <Nothing>{lensEmptyLine(lens, wall.hasAttendedEvents)}</Nothing>
    );
  }

  const shown = frames.slice(0, tiles);
  // The TOTAL comes from the uncapped read, never from what is on screen —
  // `frames` is already a display budget, so counting it would print a cap as
  // a total. `partial` means a source hit its fetch ceiling, so it is "N+".
  const total = wall.totals[lens] ?? frames.length;
  const more = total - shown.length;
  const atLeast = wall.partial ? '+' : '';

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((item) => (
          <Frame key={item.key} item={item} />
        ))}
      </div>
      {wall.unreadable ? <Unreadable /> : null}
      <p className="text-[11px] text-ink/45">
        {lens === 'with_me'
          ? `${total}${atLeast} ${total === 1 ? 'frame' : 'frames'} you are in`
          : `${total}${atLeast} ${total === 1 ? 'frame' : 'frames'} kept`}
        {more > 0 ? ` · showing the newest ${shown.length}` : null}
      </p>
    </div>
  );
}

/** Guarded re-export so a caller can ask which lens needs a grid. */
export { lensIsWall };
