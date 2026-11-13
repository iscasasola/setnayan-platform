import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCount } from '@/lib/format-number';

/** One Their work album as drawn — labels and links only (built by the page from `readShopWork`). */
export type TheirWorkAlbumView = {
  anchor: string;
  label: string;
  line: string;
  urls: string[];
  more: number;
  bookedOn: { serviceId: string; name: string; retired: boolean; href: string }[];
};

/**
 * THEIR WORK — the list (frame 78). A DUMB VIEW shared by `/vendor-dashboard/services/their-work` and the card-maker
 * lab. `albums === null` → the read was refused: said with Retry, never drawn as "no work yet".
 */
export function TheirWorkList({ albums, retryHref }: { albums: TheirWorkAlbumView[] | null; retryHref: string }) {
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
    <ul className="mt-4 divide-y" style={{ borderColor: 'var(--m-line)' }}>
      {albums.map((a) => (
        <li key={a.anchor} id={a.anchor} className="scroll-mt-16 py-3" data-their-work-album="">
          <b className="block text-[15px] font-medium text-ink">{a.label}</b>
          <span className="block text-[13px] text-ink/60">{a.line}</span>
          {a.urls.length > 0 ? (
            <ul className="mt-1.5 grid grid-cols-4 gap-0.5" aria-label={a.label}>
              {a.urls.map((u, i) => (
                <li key={u} className="relative aspect-square overflow-hidden rounded-md bg-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL */}
                  <img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                  {a.more > 0 && i === a.urls.length - 1 ? (
                    <b className="absolute inset-0 grid place-items-center bg-black/40 text-[15px] font-semibold text-white">+{formatCount(a.more)}</b>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {a.bookedOn.map((r) => (
            <Link
              key={r.serviceId}
              href={r.href}
              className="sn-press mt-1 flex min-h-11 items-center justify-between gap-3"
              data-their-work-booked-on={r.retired ? 'retired' : 'live'}
            >
              <span className="min-w-0">
                <span className="block text-[12px] uppercase tracking-wide text-ink/50">Booked on</span>
                <span className="block truncate text-[15px] text-ink">{r.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.retired ? <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[12px] font-medium text-ink/70">retired</span> : null}
                <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
              </span>
            </Link>
          ))}
        </li>
      ))}
    </ul>
  );
}
