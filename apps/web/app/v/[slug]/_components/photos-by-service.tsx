'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { couplePhotoShare } from '@/app/_actions/couple-photo-share-actions';
import { PutOnMyPageButton } from '@/app/vendor-dashboard/collections/_components/put-on-my-page-button';
import { formatCount } from '@/lib/format-number';
import {
  SERVICE_PHOTOS_PER_CARD,
  cardLine,
  photoTiles,
  serviceLine,
  type ServicePhoto,
  type ServiceView,
} from '@/lib/photos-by-service';
import type { ServicePrivatePhotos } from '@/lib/couple-photo-share';

/**
 * 📸 PHOTOS BY SERVICE — the view and the Portfolio row (owner 2026-11-14, DECISION_LOG d8ec0922; approved prototype
 * `prototypes/supplier_photos_by_category_2026-11-14_fable.html`, "On a phone · 390" frames).
 *
 *   THE WAY IN    Ⓐ the service name on every card (`ServiceFace` `pathLead`) · Ⓑ the Portfolio's "Photos by service"
 *                 row, one tile per service with a photo (`PhotosByServiceRow`).
 *   THE VIEW      the shared `Sheet` (rises like every sheet; ‹ / ✕ / Esc / a tap on the dark close it) · one heading
 *                 per service card with "Open card ›" · its photos, each captioned kind · month — never a name.
 *   EMPTY         one line, and each card still one tap away ("See the card ›").
 *   FAILED        amber, "Couldn't load these photos just now. Try again" — never "no photos", a claim about the shop.
 *   THE SHOP'S    when the shop opens its own page, its private album photos of those events join, marked "Only you";
 *   OWN VIEW      a tap offers the shipped "Put on my page" (the 7-day guest notice) or leaving it in the album.
 *
 * By reference only: every tile is a photo another place already shows (the event, the card, the couple's look).
 */
export function PhotosByServiceSheet({
  view,
  open,
  onClose,
  ownerShopId = null,
  readPrivate = readPrivateAfterThePage,
  putAction,
}: {
  view: ServiceView | null;
  open: boolean;
  onClose: () => void;
  /** The shop's id when the viewer runs it (asked after the page) — turns on the "Only you" photos. */
  ownerShopId?: string | null;
  /** Only `/dev/shop-preview-lab` passes these (fixtures, no session); the page uses the real reads. */
  readPrivate?: (shopId: string, serviceKey: string) => Promise<ServicePrivatePhotos>;
  putAction?: Parameters<typeof PutOnMyPageButton>[0]['action'];
}) {
  const headingId = useId();
  const router = useRouter();
  // one-render: keep (retry) — Try again re-reads a page whose read failed; no server action ran before it.
  const retry = () => router.refresh();
  const [mine, setMine] = useState<ServicePrivatePhotos | null>(null);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<ServicePhoto | null>(null);

  useEffect(() => {
    setMine(null);
    setPicked(null);
    setMore({});
    if (!open || !view || !ownerShopId) return;
    let live = true;
    readPrivate(ownerShopId, view.key)
      .then((r) => {
        if (live) setMine(r);
      })
      .catch(() => {
        if (live) setMine({ status: 'unread' });
      });
    return () => {
      live = false;
    };
  }, [open, view, ownerShopId, readPrivate]);

  if (!view) return null;
  const own = mine?.status === 'ok' ? mine.byCard : null;
  const cards = view.cards.map((c) => {
    const priv: ServicePhoto[] = (own?.[c.cardId] ?? []).map((p) => ({
      key: `${c.cardId}:me:${p.photoId}`,
      url: p.url,
      caption: p.caption,
      tag: 'only-you',
      photoId: p.photoId,
      notice: p.notice,
    }));
    return { ...c, photos: [...priv, ...c.photos] };
  });
  const onlyYou = cards.reduce((n, c) => n + c.photos.filter((p) => p.tag === 'only-you').length, 0);
  const total = view.photos + onlyYou;
  const ownerView = mine?.status === 'ok';
  const line = ownerView
    ? `Your view · ${formatCount(total)} ${total === 1 ? 'photo' : 'photos'} · ${formatCount(view.photos)} on your page`
    : serviceLine(view);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledById={headingId}
      rise
      head={
        // The prototype's own top row: ‹ (back to where you tapped) · the service over its line · ✕.
        <div className="flex min-h-14 items-center gap-1 border-b border-ink/10 px-2" data-photos-by-service-head="">
          <button type="button" onClick={onClose} aria-label="Back" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/5">
            <ChevronLeft aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1 py-2">
            <h2 id={headingId} className="truncate text-[16px] font-semibold leading-tight text-ink">
              {view.label}
            </h2>
            <p className="truncate text-[13px] text-ink/60">{line}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink">
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      }
    >
      <div className="pb-[calc(1.25rem+env(safe-area-inset-bottom))]" data-photos-by-service={view.key}>

        {ownerView && onlyYou > 0 ? (
          <p className="mx-4 mt-1 rounded-2xl bg-[var(--m-orange-4)] px-3 py-2.5 text-[13.5px] text-ink" data-photos-by-service-note="">
            <b>Only you see the dark-marked ones.</b> Couples see the {formatCount(view.photos)} that are already on your page.
          </p>
        ) : null}
        {mine?.status === 'unread' ? (
          <Failed words="Couldn’t load your album just now." onRetry={retry} />
        ) : null}

        {view.unread ? <Failed words="Couldn’t load these photos just now." onRetry={retry} /> : null}

        {total === 0 && !view.unread ? (
          <div data-photos-by-service-state="empty">
            <p className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-ink/50">No photos yet</p>
            <p className="px-4 pt-1 text-[14px] text-ink/70">No event photos for {view.label} yet.</p>
            {cards.map((c) => (
              <CardLink key={c.cardId} title={c.title} anchorId={c.anchorId} onClose={onClose} line="See the card" />
            ))}
          </div>
        ) : (
          cards.map((c) => {
            if (c.photos.length === 0) return null;
            const all = more[c.cardId] === true;
            const shown = all ? c.photos : c.photos.slice(0, SERVICE_PHOTOS_PER_CARD);
            const rest = c.photos.length - shown.length;
            return (
              <section key={c.cardId} className="pt-3" data-photos-by-service-card="">
                <div className="flex min-h-11 items-center justify-between gap-3 px-4">
                  <span className="min-w-0">
                    <b className="block truncate text-[15px] font-semibold text-ink">{c.title}</b>
                    <span className="block text-[13px] text-ink/60">{cardLine({ ...c, photos: c.photos })}</span>
                  </span>
                  {c.anchorId ? (
                    <a href={`#${c.anchorId}`} onClick={onClose} className="sn-press shrink-0 text-[13.5px] font-medium text-link">
                      Open card ›
                    </a>
                  ) : null}
                </div>
                <ul className="mt-1.5 grid grid-cols-3 gap-0.5 px-4">
                  {shown.map((p) => (
                    <li key={p.key} className="relative aspect-square overflow-hidden rounded-md bg-ink/5">
                      {p.tag === 'only-you' ? (
                        <button
                          type="button"
                          onClick={() => setPicked(p)}
                          aria-label={`${p.caption} — only you see this. Put it on your page?`}
                          className="absolute inset-0"
                          data-photos-by-service-only-you=""
                        >
                          <Tile photo={p} />
                        </button>
                      ) : (
                        <Tile photo={p} />
                      )}
                    </li>
                  ))}
                </ul>
                {rest > 0 ? (
                  <button
                    type="button"
                    onClick={() => setMore((m) => ({ ...m, [c.cardId]: true }))}
                    className="sn-press min-h-11 px-4 text-[13.5px] font-semibold text-link"
                  >
                    +{formatCount(rest)} more
                  </button>
                ) : null}
              </section>
            );
          })
        )}

        {ownerView && onlyYou > 0 ? (
          <div className="mx-4 mt-3 border-t border-ink/10 pt-2" data-photos-by-service-picked="">
            {picked && picked.photoId ? (
              <div className="space-y-1">
                <p className="text-[14px] font-medium text-ink">{picked.caption} · only you</p>
                <PutOnMyPageButton photoId={picked.photoId} notice={picked.notice ?? null} {...(putAction ? { action: putAction } : {})} />
                <button type="button" onClick={() => setPicked(null)} className="sn-press min-h-11 text-[13.5px] text-ink/70">
                  Leave it in your album
                </button>
              </div>
            ) : (
              <p className="min-h-11 text-[14px] text-ink/70">
                <b className="text-ink">Tap an “Only you” photo</b> · put it on your page, or leave it in your album
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

/** The shop's own private photos of one service, asked once the sheet opens (never part of the cached page). */
async function readPrivateAfterThePage(shopId: string, serviceKey: string): Promise<ServicePrivatePhotos> {
  const r = await couplePhotoShare({ op: 'service_private', vendorProfileId: shopId, serviceKey });
  return r.op === 'service_private' ? r.result : { status: 'unread' };
}

function Tile({ photo: p }: { photo: ServicePhoto }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL */}
      <img src={p.url} alt={p.caption || (p.tag === 'couple' ? 'From the couple' : '')} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
      {p.tag ? (
        <span
          className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
            p.tag === 'only-you' ? 'bg-ink text-cream' : 'bg-cream/90 text-ink'
          }`}
        >
          {p.tag === 'only-you' ? 'Only you' : 'From the couple'}
        </span>
      ) : null}
      {p.caption ? (
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3 text-[11px] text-white">
          {p.caption}
        </span>
      ) : null}
    </>
  );
}

function CardLink({ title, anchorId, onClose, line }: { title: string; anchorId: string | null; onClose: () => void; line: string }) {
  const body = (
    <>
      <span className="min-w-0">
        <b className="block truncate text-[15px] font-medium text-ink">{title}</b>
        <span className="block text-[13px] text-ink/60">{line}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
    </>
  );
  return anchorId ? (
    <a href={`#${anchorId}`} onClick={onClose} className="sn-press mx-4 mt-2 flex min-h-11 items-center justify-between gap-3">
      {body}
    </a>
  ) : (
    <div className="mx-4 mt-2 flex min-h-11 items-center justify-between gap-3">{body}</div>
  );
}

function Failed({ words, onRetry }: { words: string; onRetry: () => void }) {
  return (
    <p
      className="mx-4 mt-3 flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-[14px] text-ink"
      style={{ background: 'rgb(var(--color-warn) / 0.12)' }}
      role="status"
      data-photos-by-service-state="unread"
    >
      <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--color-warn))' }} strokeWidth={1.9} />
      <span className="flex-1">{words}</span>
      <button type="button" onClick={onRetry} className="sn-press min-h-11 font-medium text-link">
        Try again
      </button>
    </p>
  );
}

/**
 * Ⓑ The Portfolio's "Photos by service" row: one tile per service that HAS a photo (a tile with none is not drawn —
 * the service name on its cards still opens the view). Each tile opens the same view.
 */
export function PhotosByServiceRow({
  views,
  ownerShopId = null,
  readPrivate,
  putAction,
}: {
  views: ServiceView[];
  ownerShopId?: string | null;
  /** Lab only — see `PhotosByServiceSheet`. */
  readPrivate?: (shopId: string, serviceKey: string) => Promise<ServicePrivatePhotos>;
  putAction?: Parameters<typeof PutOnMyPageButton>[0]['action'];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const tiles = photoTiles(views);
  if (tiles.length === 0) return null;
  return (
    <div className="mb-4" data-photos-by-service-row="">
      <div className="mb-2">
        <h3 className="text-[15px] font-semibold text-ink">Photos by service</h3>
        <p className="text-[13px] text-ink/60">Every card’s event photos, together</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => setOpenKey(t.key)}
              className="sn-press block w-full text-left"
              aria-label={`${t.label} — ${t.line}`}
              data-photos-by-service-tile={t.key}
            >
              <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL */}
                <img src={t.cover} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
              </span>
              <b className="mt-1 block truncate text-[14px] font-semibold text-ink">{t.label}</b>
              <span className="block text-[12.5px] text-ink/60">{t.line}</span>
            </button>
          </li>
        ))}
      </ul>
      <PhotosByServiceSheet
        view={views.find((v) => v.key === openKey) ?? null}
        open={openKey !== null}
        onClose={() => setOpenKey(null)}
        ownerShopId={ownerShopId}
        {...(readPrivate ? { readPrivate } : {})}
        {...(putAction ? { putAction } : {})}
      />
    </div>
  );
}
