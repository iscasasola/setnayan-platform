import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { Fold } from '@/app/_components/fold';

/** One Their work album as drawn — labels and links only (built by the page from `readShopWork`). */
export type TheirWorkAlbumView = {
  anchor: string;
  label: string;
  line: string;
  urls: string[];
  more: number;
  bookedOn: { serviceId: string; name: string; retired: boolean; href: string }[];
};

/** The LAST row (frame 78): the cards' own cover + showcase photos — the supplier's own, never from an event. */
export type TheirOwnUploadsView = { count: number; urls: string[]; from: string[] };

/**
 * THEIR WORK — the list (frame 78): each album a fold (type · venue · month, its line), opened by a tap or by a card's
 * `#album-…` link; inside, the strip and one "Booked on" row per card; "Their own uploads" last. A DUMB VIEW shared by `/vendor-dashboard/services/their-work` and the card-maker
 * lab. `albums === null` → the read was refused: said with Retry, never drawn as "no work yet".
 */
export function TheirWorkList({
  albums,
  own = null,
  retryHref,
}: {
  albums: TheirWorkAlbumView[] | null;
  own?: TheirOwnUploadsView | null;
  retryHref: string;
}) {
  if (albums === null) {
    return (
      <p className="mt-4 flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink/75" role="status" data-their-work-state="unread">
        <span>Couldn’t load your work</span>
        <Link href={retryHref} className="sn-press inline-flex min-h-11 items-center font-medium text-sn-accent">
          Retry
        </Link>
      </p>
    );
  }
  if (albums.length === 0) {
    return (
      <p className="mt-4 text-[14px] text-ink/65" data-their-work-state="none">
        Albums arrive on their own from the events your cards are booked for — the photos the couple showed, and your
        Papic album 7 days after the guests are told.
      </p>
    );
  }
  return (
    <div className="mt-4" data-their-work-list="">
      {albums.map((a) => (
        <Fold key={a.anchor} title={a.label} line={a.line} anchor={a.anchor} data="their-work-album">
          <div className="pb-3">
            {a.urls.length > 0 ? <Strip urls={a.urls} more={a.more} label={a.label} /> : null}
            {a.bookedOn.map((r) => (
              <Link
                key={r.serviceId}
                href={r.href}
                className="sn-press mt-1 flex min-h-11 items-center justify-between gap-3"
                data-their-work-booked-on={r.retired ? 'retired' : 'live'}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] text-ink">Booked on</span>
                  <span className="block truncate text-[13px] text-ink/60">{r.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.retired ? <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[12px] font-medium text-ink/70">retired</span> : null}
                  <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
                </span>
              </Link>
            ))}
          </div>
        </Fold>
      ))}
      {own && own.count > 0 ? (
        <Fold
          title="Their own uploads"
          line={`${formatCount(own.count)} ${own.count === 1 ? 'photo' : 'photos'} · the supplier’s own, not from an event`}
          data="their-work-own"
        >
          <div className="pb-3">
            <Strip urls={own.urls} more={Math.max(0, own.count - own.urls.length)} label="Their own uploads" />
            {own.from.length > 0 ? (
              <p className="mt-2 text-[13px] text-ink/60">From {own.from.join(' · ')}</p>
            ) : null}
          </div>
        </Fold>
      ) : null}
    </div>
  );
}

function Strip({ urls, more, label }: { urls: readonly string[]; more: number; label: string }) {
  return (
    <ul className="grid grid-cols-4 gap-0.5" aria-label={label}>
      {urls.map((u, i) => (
        <li key={u} className="relative aspect-square overflow-hidden rounded-md bg-ink/5">
          {/* eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL */}
          <img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
          {more > 0 && i === urls.length - 1 ? (
            <b className="absolute inset-0 grid place-items-center bg-black/40 text-[15px] font-semibold text-white">+{formatCount(more)}</b>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
