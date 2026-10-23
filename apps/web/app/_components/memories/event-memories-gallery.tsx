'use client';

/**
 * event-memories-gallery.tsx — THIS EVENT'S MEMORIES: the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html` frames 3–4, which copy the gallery of
 * `prototypes/papic_controller_one_page_2026-10-23.html` — "Gallery, revised").
 *
 *   · NO FRAME, EDGE TO EDGE (owner: *"gallery shouldn't be inside a frame. maximize width"*): square tiles with
 *     1.5 px gaps; the house gutter only where words sit.
 *   · THE COLUMNS FOLLOW THE ZOOM, LIKE APPLE PHOTOS: phone 3 ↔ 5 ↔ 7 ↔ 1 by pinch, desktop 6 · 9 · 12 · 16 with
 *     − / + (and a trackpad pinch), remembered on this device (`lib/gallery-zoom.ts`).
 *   · TOP ROW: Albums ▾ (one PickMenu — All · Papic · Challenges · Event Hub · Suppliers · Your uploads,
 *     `lib/memories-albums.ts`), the album's count, and ⚙ — the Memories settings sheet (owner 2026-10-23, PR-B):
 *     Follow moments in order · Photo wall · Thank-you · Guests see all · Google Drive · Keep full-res.
 *   · CHALLENGES: grouped BY challenge in board order, title + count; in All a challenge photo wears its tag.
 *   · EVENT HUB: the files the live Hub points at, read-only — "Used on your Event Hub" (shown, viewed, saved; never
 *     hidden or deleted here: removing one would break the page that points at it).
 *   · THE THUMB ROW: the shared `ThumbRow` — "Search memories" narrows the photos by who took them, on the device —
 *     and its one round action, + Add photos (the couple's uploads camera, one credit a photo).
 *   · A tap opens the shipped lightbox (`PapicLightbox`). Its photo sheet moderates GUEST and PAPIC files only —
 *     Hide · Report · Stop this guest shooting · Delete forever; a supplier's file is hidden supplier-wide from that
 *     supplier's row in Settings › Event access; an Event Hub file is not moderated at all.
 *   · MEDIA RULE: the grid draws small thumbnails, the viewer the compressed copy, Download the higher quality.
 *
 * The page's own tokens throughout (light and the app's dark) — this is the event's page, not the obsidian
 * Papic surface. A failed read says so (`unreadable`), never an empty gallery.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Download, EyeOff, Flag, ImagePlus, Minus, Play, Plus, Settings, Trash2 } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { FormRows, SwitchRow } from '@/app/_components/form-row';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { GalleryPhoto } from '@/lib/papic-gallery';
import type { HubMedia } from '@/lib/event-hub-media';
import { PapicLightbox } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid';
import {
  blockUploader,
  deletePhotoForever,
  reportCapture,
  setCaptureHidden,
  setSeatPhotoHidden,
} from '@/app/dashboard/[eventId]/studio/papic/moderation/actions';
import {
  ALBUM_KEYS,
  ALBUM_LABEL,
  captureInAlbum,
  challengeGroups,
  isAlbumKey,
  momentGroups,
  type AlbumKey,
  type Moment,
} from '@/lib/memories-albums';
import { memoriesCountWords } from '@/lib/event-memories-words';
import {
  DESK_FROM_PX,
  ZOOM_KEY_DESK,
  ZOOM_KEY_PHONE,
  defaultFor,
  isDense,
  readColumns,
  stepColumns,
  stepsFor,
  type ZoomScale,
} from '@/lib/gallery-zoom';
import { useGridPinch } from './use-grid-pinch';

function useScale(): ZoomScale {
  const [scale, setScale] = useState<ZoomScale>('phone');
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESK_FROM_PX}px)`);
    const on = () => setScale(mq.matches ? 'desk' : 'phone');
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return scale;
}

/** The remembered column count for this scale — localStorage may be refused (a private window); then the default. */
function useColumns(scale: ZoomScale): [number, (next: number) => void] {
  const key = scale === 'desk' ? ZOOM_KEY_DESK : ZOOM_KEY_PHONE;
  const [cols, setCols] = useState<number>(() => defaultFor(scale));
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    setCols(readColumns(raw, scale));
  }, [key, scale]);
  const setTo = useCallback(
    (next: number) => {
      setCols(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        /* per-viewer convenience only */
      }
    },
    [key],
  );
  return [cols, setTo];
}

const ALBUM_KEY_STORE = 'sn.memories.album';
const MOMENTS_KEY_STORE = 'sn.memories.moments';

/** A per-viewer convenience kept on this device — a private window may refuse it; then the default. */
function useRemembered<T extends string>(key: string, fallback: T, valid: (v: unknown) => v is T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (valid(raw)) setV(raw);
    } catch {
      /* the default stands */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setV(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* per-viewer convenience only */
      }
    },
    [key],
  );
  return [v, set];
}
const isOnOff = (v: unknown): v is 'on' | 'off' => v === 'on' || v === 'off';

/** One tile on the grid: a capture, or a file the Event Hub points at. */
type Item = { kind: 'capture'; photo: GalleryPhoto } | { kind: 'hub'; media: HubMedia };
const itemId = (it: Item) => (it.kind === 'capture' ? it.photo.id : it.media.id);

export function EventMemoriesGallery({
  photos,
  countLine,
  footLine,
  cappedLine,
  emptyLine,
  unreadable,
  timeZone,
  hub = null,
  moments = null,
  settings = null,
  addPhotos = null,
  moderate = null,
}: {
  photos: GalleryPhoto[];
  /** "1,284 photos" — the album's count, or null when the count could not be read (no number is guessed). */
  countLine: string | null;
  /** The cameras' state for the foot line: "opens in 51 days" · "cameras open now" · "cameras closed" · null. */
  footLine: string | null;
  /** "1,284 kept · showing the newest 240" — only when the page holds fewer than there are. */
  cappedLine: string | null;
  /** What an empty, readable gallery says. */
  emptyLine: string;
  /** The read was refused — say so, never "nothing yet". */
  unreadable: boolean;
  timeZone: string | null;
  /** 🗂 The Event Hub album's files; null = not read (a viewer not shown the couple's sources, or a refusal). */
  hub?: HubMedia[] | null;
  /** "Follow moments in order" — the day's moments in schedule order; null = no schedule to follow. */
  moments?: Moment[] | null;
  /** ⚙ The settings sheet's rows (the couple's): drawn under its Follow-moments switch. null = no ⚙. */
  settings?: ReactNode;
  /** + Add photos — what its sheet holds (the uploads picker, or the switch-on), or null when it is not offered. */
  addPhotos?: ReactNode;
  /** The photo sheet's moderation (the couple only). */
  moderate?: { eventId: string } | null;
}) {
  const scale = useScale();
  const [cols, setCols] = useColumns(scale);
  const dense = isDense(cols);
  const [opened, setOpened] = useState<Item | null>(null);
  const [q, setQ] = useState('');
  const [album, setAlbum] = useRemembered<AlbumKey>(ALBUM_KEY_STORE, 'all', isAlbumKey);
  const [followMoments, setFollowMoments] = useRemembered<'on' | 'off'>(MOMENTS_KEY_STORE, 'off', isOnOff);
  const [sheet, setSheet] = useState<'settings' | 'add' | null>(null);
  const sheetHeading = useId();

  // ── THE ALBUM, THEN THE SEARCH ─────────────────────────────────────────────
  const inAlbum = useMemo<Item[]>(() => {
    const caps: Item[] = photos.filter((p) => captureInAlbum(p, album)).map((photo) => ({ kind: 'capture', photo }));
    if (album !== 'all' && album !== 'hub') return caps;
    const hubs: Item[] = (hub ?? []).map((media) => ({ kind: 'hub', media }));
    return album === 'hub' ? hubs : [...caps, ...hubs];
  }, [photos, hub, album]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    if (!words) return inAlbum;
    return inAlbum.filter((it) => it.kind === 'capture' && (it.photo.capturedBy ?? '').toLowerCase().includes(words));
  }, [inAlbum, q]);

  // ── SECTIONS: Challenges group by challenge; "Follow moments in order" by the day's moments; else one stream ──
  const sections = useMemo<{ key: string; label: string | null; items: Item[] }[]>(() => {
    if (album === 'challenges') {
      return challengeGroups(shown.flatMap((it) => (it.kind === 'capture' ? [it.photo] : []))).map((g) => ({
        key: `c:${g.id}`,
        label: `${g.title} · ${g.photos.length}`,
        items: g.photos.map((photo) => ({ kind: 'capture' as const, photo })),
      }));
    }
    if (followMoments === 'on' && moments && moments.length > 0) {
      return momentGroups(
        shown.map((it) => ({ id: itemId(it), it })),
        moments,
      ).map((g) => ({ key: `m:${g.key}`, label: g.label, items: g.photos.map((x) => x.it) }));
    }
    return [{ key: 'all', label: null, items: shown }];
  }, [album, shown, followMoments, moments]);

  const albumUnread = album === 'hub' && hub === null;
  const albumCount =
    album === 'all' ? (hub && hub.length > 0 && countLine ? `${countLine} · ${hub.length} on your Event Hub` : countLine) : albumUnread ? null : memoriesCountWords(inAlbum.length);
  const empty = album === 'all' ? photos.length === 0 && (hub ?? []).length === 0 : inAlbum.length === 0;

  // ── PINCH (phone) and ⌃ + WHEEL (desktop): ONE step per gesture, the grid scaling live in between ──────────
  const gridRef = useRef<HTMLDivElement>(null);
  const stepFrom = useCallback((c: number, dir: 1 | -1) => stepColumns(c, dir, scale), [scale]);
  const { snap } = useGridPinch({ gridRef, cols, stepFrom, setCols });

  const steps = stepsFor(scale);
  const zoomWords =
    scale === 'desk' ? '+ / − change the columns' : 'Pinch to change the columns — 3 · 5 · 7, or one large';

  return (
    <section data-event-memories="" data-memories-columns={cols} className="pb-24">
      <h1 className="sr-only">Memories</h1>

      {/* TOP ROW — Albums ▾ · the album's count, centred · ⚙; − / + on a desktop. */}
      <div className="flex min-h-[48px] items-center gap-2 pb-2.5" data-memories-top="">
        <PickMenu
          label="Albums"
          value={album}
          options={ALBUM_KEYS.map((k) => ({ key: k, label: ALBUM_LABEL[k] }))}
          onPick={(k) => {
            if (isAlbumKey(k)) setAlbum(k);
          }}
          dataAttr="data-memories-album"
          compact
        />
        <p className="min-w-0 flex-1 truncate text-center text-[13px] text-ink/60" data-memories-count="" data-tour="memories-count">
          {unreadable || albumUnread ? (
            'couldn’t load'
          ) : albumCount ? (
            <span className="font-medium text-ink">{albumCount}</span>
          ) : null}
        </p>
        {scale === 'desk' ? (
          <span className="inline-flex gap-1.5" data-memories-zoom="">
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Minus}
              label="Fewer columns"
              disabled={cols === steps[0]}
              onClick={() => snap(-1)}
            />
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Plus}
              label="More columns"
              disabled={cols === steps[steps.length - 1]}
              onClick={() => snap(1)}
            />
          </span>
        ) : null}
        {settings ? (
          <ActionButton
            tone="neutral"
            iconOnly
            icon={Settings}
            label="Memories settings"
            onClick={() => setSheet('settings')}
            aria-haspopup="dialog"
            data-memories-settings=""
          />
        ) : null}
      </div>
      {album === 'hub' && !albumUnread ? (
        <p className="pb-2 text-center text-[12px] text-ink/55" data-memories-hub-note="">
          Used on your Event Hub — change them in the Event Hub Maker and this album follows.
        </p>
      ) : null}

      {unreadable ? (
        <p role="status" className="px-4 py-10 text-center text-[14px] text-ink/65" data-memories-unreadable="">
          We couldn’t load your photos just now. Nothing has changed — refresh to see them.
        </p>
      ) : albumUnread ? (
        <p role="status" className="px-4 py-10 text-center text-[14px] text-ink/65" data-memories-unreadable="">
          We couldn’t load your Event Hub’s files just now. Nothing has changed — refresh to see them.
        </p>
      ) : empty ? (
        <p className="px-4 py-10 text-center text-[14px] text-ink/60" data-memories-empty="">
          {album === 'all' ? emptyLine : `Nothing in ${ALBUM_LABEL[album]} yet.`}
        </p>
      ) : (
        /* EDGE TO EDGE: the grid cancels the event layout's gutter (px-4 · sm:px-6 · lg:px-8). One grid per section
           (a challenge, a moment) — the pinch scales them together. */
        <div ref={gridRef} data-memories-grid="" data-tour="memories-grid" className="-mx-4 touch-pan-y sm:-mx-6 lg:-mx-8">
          {sections.map((sec) => (
            <div key={sec.key} data-memories-section={sec.label ? sec.key : undefined}>
              {sec.label ? (
                <h2
                  className="sticky top-0 z-[1] bg-cream px-4 pb-1.5 pt-3 text-[13px] font-semibold text-ink sm:px-6 lg:px-8"
                  data-memories-section-head=""
                >
                  {sec.label}
                </h2>
              ) : null}
              <div
                className="grid gap-[1.5px] bg-ink/[0.08]"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {sec.items.map((it) => (
                  <Tile
                    key={itemId(it)}
                    item={it}
                    dense={dense}
                    large={cols === 1}
                    roomy={cols <= 3}
                    tagChallenge={album === 'all'}
                    onOpen={() => setOpened(it)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {q.trim() && shown.length === 0 && photos.length > 0 ? (
        <p role="status" className="py-3 text-center text-[14px] text-ink/60" data-memories-no-match="">
          No photos from “{q.trim()}” here.
        </p>
      ) : null}

      <p className="pt-2.5 text-[12px] text-ink/55" data-memories-foot="">
        {zoomWords} · remembered on this device{footLine ? ` · ${footLine}` : ''}
      </p>
      {cappedLine ? (
        <p className="pt-1 text-[12px] text-ink/55" data-memories-capped="">
          {cappedLine}
        </p>
      ) : null}

      <MemoriesThumbRow q={q} onSearch={setQ} onAdd={addPhotos ? () => setSheet('add') : null} />

      {opened?.kind === 'capture' ? (
        <PapicLightbox
          photo={opened.photo}
          onClose={() => setOpened(null)}
          timeZone={timeZone}
          more={moderate ? <PhotoSheet eventId={moderate.eventId} photo={opened.photo} /> : null}
        />
      ) : opened?.kind === 'hub' ? (
        <GalleryLightbox
          src={opened.media.url}
          posterSrc={opened.media.kind === 'clip' ? null : opened.media.url}
          kind={opened.media.kind}
          capturedByName="Used on your Event Hub"
          capturedAt={null}
          timeZone={timeZone}
          onClose={() => setOpened(null)}
          actions={
            <a
              href={opened.media.url}
              download
              className="sn-gal-btn inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
            >
              <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Save
            </a>
          }
        />
      ) : null}

      {sheet ? (
        <Sheet open onClose={() => setSheet(null)} labelledById={sheetHeading} rise>
          <div className="px-4 pb-6 pt-3.5" data-memories-sheet={sheet}>
            <h3 id={sheetHeading} className="mb-3 text-[19px] font-semibold tracking-tight text-ink">
              {sheet === 'settings' ? 'Memories settings' : 'Add photos'}
            </h3>
            {sheet === 'settings' ? (
              <div className="flex flex-col gap-5">
                {moments && moments.length > 0 ? (
                  <FormRows data="memories-moments">
                    <SwitchRow
                      name="Follow moments in order"
                      on={followMoments === 'on'}
                      onChange={(on) => setFollowMoments(on ? 'on' : 'off')}
                      note="Your photos under the day’s moments, in schedule order · on this device"
                      data="memories-moments"
                    />
                  </FormRows>
                ) : (
                  <p className="text-[13px] text-ink/60" data-memories-moments-none="">
                    Follow moments in order — add your schedule and your photos group under its moments.
                  </p>
                )}
                {settings}
              </div>
            ) : (
              addPhotos
            )}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

const REPORT_REASONS = [
  { key: 'nudity_sexual', label: 'Nudity or sexual' },
  { key: 'violence', label: 'Violence' },
  { key: 'hate_harassment', label: 'Hate or harassment' },
  { key: 'spam', label: 'Spam' },
  { key: 'not_my_event', label: 'Not from my event' },
  { key: 'other', label: 'Something else' },
] as const;

/**
 * 🛡 THE PHOTO SHEET — moderation on the photo itself (owner 2026-10-23), GUEST and PAPIC files only. The shipped
 * moderation actions, each landing back here (`return_to=memories`): Hide · Report (why ▾) · Stop this guest
 * shooting (event-scoped) · Delete forever (asked twice). A supplier's file has none of it.
 */
function PhotoSheet({ eventId, photo }: { eventId: string; photo: GalleryPhoto }) {
  const [reason, setReason] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const reportRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reason) reportRef.current?.requestSubmit();
  }, [reason]);
  if (photo.source === 'vendor') return null;
  const guest = photo.source === 'guest';
  const table = guest ? 'papic_guest_captures' : 'papic_photos';
  const btn = 'sn-gal-btn inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium';
  return (
    <span className="contents" data-memories-moderate={photo.source}>
      <form action={(guest ? setCaptureHidden : setSeatPhotoHidden).bind(null, eventId)} className="contents">
        <input type="hidden" name="return_to" value="memories" />
        <input type="hidden" name={guest ? 'capture_id' : 'photo_id'} value={photo.id} />
        <input type="hidden" name="hide" value="1" />
        <button type="submit" className={btn}>
          <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Hide
        </button>
      </form>
      {guest ? (
        <>
          <form ref={reportRef} action={reportCapture.bind(null, eventId)} className="contents">
            <input type="hidden" name="return_to" value="memories" />
            <input type="hidden" name="capture_id" value={photo.id} />
            <input type="hidden" name="reason" value={reason ?? ''} />
            <PickMenu
              label="Report — why?"
              value={reason}
              buttonText="Report"
              options={REPORT_REASONS.map((r) => ({ key: r.key, label: r.label, icon: <Flag aria-hidden className="h-3.5 w-3.5" /> }))}
              onPick={setReason}
              dataAttr="data-memories-report"
              compact
            />
          </form>
          {photo.guestId ? (
            <form action={blockUploader.bind(null, eventId)} className="contents">
              <input type="hidden" name="return_to" value="memories" />
              <input type="hidden" name="guest_id" value={photo.guestId} />
              <button type="submit" className={btn}>
                <Ban aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Stop this guest shooting
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {sure ? (
        <form action={deletePhotoForever.bind(null, eventId)} className="contents">
          <input type="hidden" name="return_to" value="memories" />
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="id" value={photo.id} />
          <button type="submit" className={btn} data-memories-delete-sure="">
            <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Tap again to delete forever
          </button>
        </form>
      ) : (
        <button type="button" className={btn} onClick={() => setSure(true)}>
          <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Delete forever
        </button>
      )}
    </span>
  );
}

function Tile({
  item,
  dense,
  large,
  roomy,
  tagChallenge,
  onOpen,
}: {
  item: Item;
  dense: boolean;
  large: boolean;
  roomy: boolean;
  /** In All, a challenge photo wears its challenge (owner 2026-10-23). */
  tagChallenge: boolean;
  onOpen: () => void;
}) {
  const photo =
    item.kind === 'capture'
      ? item.photo
      : { kind: item.media.kind, url: item.media.url, largeUrl: item.media.url, capturedBy: null, challenge: null };
  const who = item.kind === 'capture' ? (photo.capturedBy ?? null) : 'Event Hub';
  const src = large ? (photo.largeUrl ?? photo.url) : photo.url;
  const label = `${photo.kind === 'clip' ? 'Clip' : 'Photo'}${item.kind === 'hub' ? ' used on your Event Hub' : who ? ` from ${who}` : ''}`;
  const challenge = tagChallenge && !dense ? (photo.challenge?.title ?? null) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      data-memories-tile=""
      className="relative block aspect-square w-full overflow-hidden bg-ink/[0.06] p-0"
    >
      {/* 🗜 The small copy — the tile copy only one-across, where 320 px falls apart. Never an original. (An Event Hub
          clip has no still of its own: its tile is the first frame of the file, muted, never playing.) */}
      {item.kind === 'hub' && photo.kind === 'clip' && src ? (
        <video src={src} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {challenge ? (
        <span
          aria-hidden
          data-tile-challenge=""
          className="absolute left-1 top-1 max-w-[calc(100%-8px)] truncate rounded-full bg-black/55 px-1.5 py-[1px] text-[10px] font-medium text-white"
        >
          {challenge}
        </span>
      ) : null}
      {photo.kind === 'clip' && (item.kind === 'capture' || !large) ? (
        <span
          aria-hidden
          data-tile-clip=""
          className={`absolute inline-flex items-center justify-center rounded-full bg-black/55 text-white ${dense ? 'right-1 top-1 h-3.5 w-3.5' : 'right-1.5 top-1.5 h-[22px] w-[22px]'}`}
        >
          <Play className={dense ? 'h-2 w-2 fill-current' : 'h-3 w-3 fill-current'} strokeWidth={0} />
        </span>
      ) : null}
      {who && !dense ? (
        <span
          aria-hidden
          className={`absolute bottom-[3px] right-1 max-w-[calc(100%-8px)] truncate text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${roomy ? 'text-[11px]' : 'text-[9.5px]'}`}
        >
          {who}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The one thumb row, drawn into <body> (the dashboard's page wrapper captures `position: fixed`), above the dock —
 * the Find row's seat (`find-thumb-row.tsx`). "Search memories" narrows by who took a photo, on the device.
 */
function MemoriesThumbRow({ q, onSearch, onAdd }: { q: string; onSearch: (v: string) => void; onAdd: (() => void) | null }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [up, setUp] = useState(false);
  useEffect(() => {
    setHost(document.body);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setUp(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  if (!host) return null;
  return createPortal(
    <div
      data-memories-thumb=""
      data-on={up ? 'true' : 'false'}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-bottomdock-h,64px)] z-[25] pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] py-2.5 transition-transform duration-300 ease-out motion-reduce:transition-none tab:bottom-7 tab:left-auto tab:right-[max(1.75rem,var(--sn-safe-r))] tab:w-[min(720px,calc(100vw-128px))] tab:px-0 ${
        up ? 'translate-y-0' : 'translate-y-[calc(100%_+_32px)]'
      }`}
    >
      <ThumbRow
        name="memories-event"
        field={{
          placeholder: 'Search memories',
          label: 'Search memories — by who took them',
          tour: 'memories-search',
          input: { value: q, onChange: (e) => onSearch(e.target.value), 'data-memories-search': '' },
        }}
        action={onAdd ? { icon: ImagePlus, label: 'Add photos', onClick: onAdd, testId: 'memories-add-photos' } : null}
      />
    </div>,
    host,
  );
}
