import Link from 'next/link';
import { ChevronRight, RotateCw } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import type { AlbumView } from '@/lib/card-portfolio-albums';

/**
 * 🃏📸 A CARD'S PORTFOLIO — the albums of the events this card was booked on, then the supplier's own uploads LAST,
 * labelled "yours, not from an event" (frames 72 · 74 of the approved service card maker drawing, DECISION_LOG
 * 2026-10-08). Read-only: the card collects it, the supplier types nothing.
 *
 * A DUMB VIEW (types only — it mounts inside the client grown card too). Every label and line arrives from
 * `toAlbumViews` (`lib/card-portfolio-albums.ts`); each album is the SAME album Their work shows (one album, two places).
 *
 *   work === null      the read was refused → "Couldn't load this card's portfolio · Retry", in the row's own place —
 *                     never an empty list that reads as "nothing collected".
 *   work === []       "Albums arrive on their own from the events this card is booked for …" + the own uploads.
 *
 * `variant="couple"` (the grown card on the shop's page, inside its EVENTS section — the owner ruled the grown card
 * says "Events", never a second word for them) draws the events' photos only: the card's own photos already sit in the
 * grown card's Photos section, so they are not drawn twice.
 */
export function CardPortfolioSection({
  work: albums,
  own = [],
  variant,
  retryHref = null,
}: {
  /** The card's event albums (`toAlbumViews`); null = the read was refused. */
  work: AlbumView[] | null;
  /** The card's own cover + showcase photos (display URLs) — the supplier's own, never proof. */
  own?: readonly string[];
  variant: 'vendor' | 'couple';
  /** Where Retry reloads (the same screen). */
  retryHref?: string | null;
}) {
  if (albums === null) {
    return (
      <p className="flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink/75" role="status" data-card-portfolio="unread">
        <span>Couldn’t load this card’s portfolio</span>
        {retryHref ? (
          <Link href={retryHref} className="sn-press inline-flex min-h-11 items-center gap-1 font-medium text-sn-accent" data-card-portfolio-retry="">
            <RotateCw aria-hidden className="h-4 w-4" strokeWidth={2} />
            Retry
          </Link>
        ) : null}
      </p>
    );
  }
  return (
    <div className="space-y-3" data-card-portfolio={albums.length ? 'albums' : 'own-only'}>
      {albums.map((a) => (
        <div key={a.key} data-card-portfolio-album="">
          <AlbumHead album={a} />
          {a.urls.length > 0 ? <Strip urls={a.urls} more={a.more} label={a.label} /> : null}
        </div>
      ))}
      {variant === 'vendor' ? (
        <div data-card-portfolio-own="">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0">
              <b className="block text-[15px] font-medium text-ink">Your own uploads</b>
              <span className="block text-[13px] text-ink/60">
                {own.length ? `${formatCount(own.length)} ${own.length === 1 ? 'photo' : 'photos'}` : 'no photo yet'} · yours, not from an event
              </span>
            </span>
          </div>
          {own.length > 0 ? <Strip urls={own.slice(0, 4)} more={Math.max(0, own.length - 4)} label="Your own uploads" /> : null}
        </div>
      ) : null}
      {variant === 'vendor' ? (
        <p className="text-[13px] text-ink/60">
          {albums.length
            ? 'Albums arrive from the events this card was booked for — the photos the couple showed, and your Papic album 7 days after the guests are told. Type · venue · month, never a name. Each one is the same album as in Their work.'
            : 'Albums arrive on their own from the events this card is booked for, 7 days after the guests are told.'}
        </p>
      ) : null}
    </div>
  );
}

function AlbumHead({ album: a }: { album: AlbumView }) {
  const words = (
    <span className="min-w-0">
      <b className="block truncate text-[15px] font-medium text-ink">{a.label}</b>
      <span className="block truncate text-[13px] text-ink/60">{a.line}</span>
    </span>
  );
  return a.href ? (
    <Link href={a.href} className="sn-press flex min-h-11 items-center justify-between gap-3" data-card-portfolio-open="">
      {words}
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
    </Link>
  ) : (
    <div className="flex min-h-11 items-center">{words}</div>
  );
}

function Strip({ urls, more, label }: { urls: readonly string[]; more: number; label: string }) {
  return (
    <ul className="mt-1 grid grid-cols-4 gap-0.5" aria-label={label}>
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
