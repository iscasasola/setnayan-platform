'use client';

/**
 * event-memories-gallery.tsx — THIS EVENT'S MEMORIES: the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html` frames 3–4, which copy the gallery of
 * `prototypes/papic_controller_one_page_2026-10-23.html` — "Gallery, revised").
 *
 *   · NO FRAME, EDGE TO EDGE (owner: *"gallery shouldn't be inside a frame. maximize width"*): square tiles with
 *     1.5 px gaps; the house gutter only where words sit.
 *   · THE COLUMNS FOLLOW THE ZOOM, LIKE APPLE PHOTOS: phone 3 ↔ 5 ↔ 7 ↔ 1 by pinch, desktop 6 · 9 · 12 · 16 with
 *     − / + (and a trackpad pinch) — ONE step per gesture (`use-grid-pinch.ts`), remembered on this device.
 *   · TOP ROW: Albums ▾ (All · Papic · Challenges · Event Hub · Suppliers · Your uploads — `lib/event-memories.ts`)
 *     · the album's count · "Needs a look N" (the filter, lit when on) · ⚙ Gallery settings (a sheet).
 *   · CHALLENGES: grouped by challenge in the board's order, each headed "title · count"; a supplier's challenge
 *     names its supplier in the ⓘ. In All, a challenge frame wears a small tag.
 *   · A TAP opens the photo's own sheet in the thumb zone — its preview opens the viewer (the compressed copy); a
 *     Papic file offers Hide · Report · Stop this guest shooting · Approve · Delete forever; a supplier's file, Hide
 *     their photos; an Event Hub file is shown, never managed here ("Used on your Event Hub").
 *   · THE THUMB ROW: the shared `ThumbRow` — "Search memories" (who took it, the challenge, the Hub's place) and
 *     + Add photos, the one upload door.
 *
 * The page's own tokens throughout (light and the app's dark). A refused read says so, never an empty gallery.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, Eye, Flag, Ban, Trash2, Check, Minus, Play, Plus, Settings, Download, X } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { SwitchTrack } from '@/app/_components/switch-track';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PapicLightbox } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid';
import {
  approveScreenedCapture,
  blockUploader,
  deletePhotoForever,
  reportCapture,
  setCaptureHidden,
  setSeatPhotoHidden,
  unblockUploader,
} from '@/app/dashboard/[eventId]/studio/papic/moderation/actions';
import { setVendorCapturesHidden } from '@/app/dashboard/[eventId]/studio/papic/vendor-visibility-actions';
import {
  MEMORIES_ALBUMS,
  albumCountWords,
  canModerate,
  challengeGroups,
  inAlbum,
  isMemoriesAlbum,
  needsALook,
  type MemoriesAlbumKey,
  type MemoriesChallenge,
  type MemoriesItem,
} from '@/lib/event-memories';
import { formatCount } from '@/lib/format-number';
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

/** "Follow the moments in order" — a way of LOOKING, remembered on this device like the zoom (no shared state). */
const MOMENTS_KEY = 'sn-memories-moments';
const ALBUM_KEY = 'sn-memories-album';

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

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* per-viewer convenience only */
  }
}

/** The remembered column count for this scale — localStorage may be refused (a private window); then the default. */
function useColumns(scale: ZoomScale): [number, (next: number) => void] {
  const key = scale === 'desk' ? ZOOM_KEY_DESK : ZOOM_KEY_PHONE;
  const [cols, setCols] = useState<number>(() => defaultFor(scale));
  useEffect(() => setCols(readColumns(readLocal(key), scale)), [key, scale]);
  const setTo = useCallback(
    (next: number) => {
      setCols(next);
      writeLocal(key, String(next));
    },
    [key],
  );
  return [cols, setTo];
}

export type MemoriesChapter = { key: string; label: string; time: string | null; photoIds: string[] };
export type MemoriesSupplier = { vendorProfileId: string; vendorRowId: string; name: string; hidden: boolean };

export function EventMemoriesGallery({
  eventId,
  items,
  host,
  challenges = [],
  chapters = null,
  totals,
  footLine,
  cappedLine,
  emptyLine,
  unreadable,
  refusedParts = [],
  timeZone,
  settings = null,
  addPhotos = null,
  blockedGuests = [],
  suppliers = [],
}: {
  eventId: string;
  items: MemoriesItem[];
  /** The couple — the albums' moderation, ⚙ and + Add photos are theirs. */
  host: boolean;
  challenges?: MemoriesChallenge[];
  /** The day's moments, from the run of show — null when there is no schedule to follow. */
  chapters?: MemoriesChapter[] | null;
  /** Measured counts beyond what the page holds (`All`, `Papic`) — null when not measured. */
  totals: { all: number | null; papic: number | null };
  footLine: string | null;
  cappedLine: string | null;
  emptyLine: string;
  /** The photo read was refused — say so, never "nothing yet". */
  unreadable: boolean;
  /** Albums whose own read was refused ('hub' · 'challenges') — said in that album, not as an empty one. */
  refusedParts?: MemoriesAlbumKey[];
  timeZone: string | null;
  /** ⚙ Gallery settings — the shipped controls, drawn by the server (Photo wall · Thank-You · Guests see all · Drive · Keep full-res). */
  settings?: ReactNode;
  /** + Add photos — the shipped uploader (or its "Turn this on"), drawn by the server. Null = no door. */
  addPhotos?: ReactNode;
  blockedGuests?: string[];
  suppliers?: MemoriesSupplier[];
}) {
  const scale = useScale();
  const [cols, setCols] = useColumns(scale);
  const dense = isDense(cols);
  const [opened, setOpened] = useState<MemoriesItem | null>(null);
  const [viewing, setViewing] = useState<MemoriesItem | null>(null);
  const [q, setQ] = useState('');
  const [album, setAlbumState] = useState<MemoriesAlbumKey>('all');
  const [needsLook, setNeedsLook] = useState(false);
  const [moments, setMomentsState] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const gearHeading = useId();

  useEffect(() => {
    const a = readLocal(ALBUM_KEY);
    if (isMemoriesAlbum(a)) setAlbumState(a);
    setMomentsState(readLocal(MOMENTS_KEY) === '1');
  }, []);
  const setAlbum = (a: MemoriesAlbumKey) => {
    setAlbumState(a);
    writeLocal(ALBUM_KEY, a);
  };
  const setMoments = (on: boolean) => {
    setMomentsState(on);
    writeLocal(MOMENTS_KEY, on ? '1' : '0');
  };

  const challengeById = useMemo(() => new Map(challenges.map((c) => [c.id, c])), [challenges]);
  const challengeOf = (it: MemoriesItem) => (it.challengeId ? challengeById.get(it.challengeId) ?? null : null);

  const inThisAlbum = useMemo(
    () => items.filter((it) => inAlbum({ source: it.memSource, challengeId: it.challengeId }, album)),
    [items, album],
  );
  const needsCount = host ? inThisAlbum.filter(needsALook).length : 0;
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return inThisAlbum.filter((it) => {
      if (needsLook && !needsALook(it)) return false;
      if (!words) return true;
      const hay = [it.capturedBy, it.hubUse, it.challengeId ? challengeById.get(it.challengeId)?.title : null]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(words);
    });
  }, [inThisAlbum, needsLook, q, challengeById]);

  // ── PINCH (phone) and ⌃ + WHEEL (desktop): ONE step per gesture, the grid scaling live in between ──────────
  const gridRef = useRef<HTMLDivElement>(null);
  const stepFrom = useCallback((c: number, dir: 1 | -1) => stepColumns(c, dir, scale), [scale]);
  const { snap } = useGridPinch({ gridRef, cols, stepFrom, setCols });

  const steps = stepsFor(scale);
  const zoomWords =
    scale === 'desk' ? '+ / − change the columns' : 'Pinch to change the columns — 3 · 5 · 7, or one large';

  // The count is the album's: measured where it can be (All · Papic), what the page holds otherwise.
  const albumRefused = refusedParts.includes(album);
  const countN =
    album === 'all' && totals.all !== null ? totals.all : album === 'papic' && totals.papic !== null ? totals.papic : inThisAlbum.length;
  const countLine = unreadable || albumRefused ? null : albumCountWords(countN, album, formatCount);

  const tile = (it: MemoriesItem, tagged: boolean) => (
    <Tile
      key={it.id}
      item={it}
      dense={dense}
      large={cols === 1}
      roomy={cols <= 3}
      challengeTag={tagged && it.challengeId ? challengeOf(it)?.title ?? null : null}
      onOpen={() => (host ? setOpened(it) : setViewing(it))}
    />
  );
  const gridClass = 'grid gap-[1.5px] [grid-template-columns:repeat(var(--mem-cols),minmax(0,1fr))]';

  let body: ReactNode;
  if (unreadable || albumRefused) {
    body = (
      <p role="status" className="px-4 py-10 text-center text-[14px] text-ink/65" data-memories-unreadable="">
        We couldn’t load your photos just now. Nothing has changed — refresh to see them.
      </p>
    );
  } else if (shown.length === 0) {
    body = (
      <p className="px-4 py-10 text-center text-[14px] text-ink/60" data-memories-empty="">
        {q.trim() ? `Nothing here matches “${q.trim()}”.` : needsLook ? 'Nothing needs a look.' : album === 'all' ? emptyLine : 'Nothing in this album yet.'}
      </p>
    );
  } else if (album === 'challenges') {
    body = challengeGroups(shown, challenges).map(({ challenge, items: list }) => (
      <section key={challenge.id} data-memories-challenge={challenge.id}>
        <MomentHead
          label={`${challenge.title} · ${formatCount(list.length)}`}
          tip={challenge.supplier ? `Added by ${challenge.supplier}, a supplier you booked.` : null}
        />
        <div className={gridClass}>{list.map((it) => tile(it, false))}</div>
      </section>
    ));
  } else if (moments && chapters && chapters.length > 1 && !needsLook && (album === 'all' || album === 'papic')) {
    const byId = new Map(shown.map((it) => [it.id, it]));
    const used = new Set<string>();
    const groups = chapters.flatMap((c) => {
      const list = c.photoIds.map((id) => byId.get(id)).filter((x): x is MemoriesItem => Boolean(x));
      list.forEach((x) => used.add(x.id));
      return list.length ? [{ c, list }] : [];
    });
    const rest = shown.filter((it) => !used.has(it.id));
    body = (
      <>
        {groups.map(({ c, list }) => (
          <section key={c.key} data-memories-moment={c.key}>
            <MomentHead label={c.label} time={c.time} />
            <div className={gridClass}>{list.map((it) => tile(it, album === 'all'))}</div>
          </section>
        ))}
        {rest.length ? (
          <section data-memories-moment="rest">
            <MomentHead label="More" />
            <div className={gridClass}>{rest.map((it) => tile(it, album === 'all'))}</div>
          </section>
        ) : null}
      </>
    );
  } else {
    body = <div className={gridClass}>{shown.map((it) => tile(it, album === 'all'))}</div>;
  }

  const albumOptions = MEMORIES_ALBUMS.map((a) => ({ key: a.key, label: a.label }));

  return (
    <section data-event-memories="" data-memories-columns={cols} data-memories-album={album} className="pb-24">
      <h1 className="sr-only">Memories</h1>

      {/* TOP ROW — Albums ▾ · the count · Needs a look · (− / + on a desktop) · ⚙. */}
      <div className="flex min-h-[48px] items-center gap-2 pb-2.5" data-memories-top="">
        <span data-memories-albums="" className="shrink-0">
          <PickMenu label="Albums" value={album} options={albumOptions} onPick={(k) => isMemoriesAlbum(k) && setAlbum(k)} compact />
        </span>
        <p className="min-w-0 flex-1 truncate text-center text-[13px] text-ink/60" data-memories-count="">
          {unreadable || albumRefused ? 'couldn’t load' : <span className="font-medium text-ink">{countLine}</span>}
          {host && (needsCount > 0 || needsLook) ? (
            <>
              {' · '}
              <button
                type="button"
                aria-pressed={needsLook}
                onClick={() => setNeedsLook((v) => !v)}
                data-memories-needs-look=""
                className={`font-medium text-terracotta ${needsLook ? 'rounded-full bg-terracotta/10 px-2 py-0.5' : 'border-b border-dashed border-terracotta/60'}`}
              >
                Needs a look {formatCount(needsCount)}
              </button>
            </>
          ) : null}
        </p>
        {scale === 'desk' ? (
          <span className="inline-flex gap-1.5" data-memories-zoom="">
            <ActionButton tone="neutral" iconOnly icon={Minus} label="Fewer columns" disabled={cols === steps[0]} onClick={() => snap(-1)} />
            <ActionButton tone="neutral" iconOnly icon={Plus} label="More columns" disabled={cols === steps[steps.length - 1]} onClick={() => snap(1)} />
          </span>
        ) : null}
        {host ? (
          <ActionButton tone="neutral" iconOnly icon={Settings} label="Gallery settings" onClick={() => setGearOpen(true)} data-memories-gear="" />
        ) : null}
      </div>
      {needsLook ? (
        <p className="pb-1.5 text-[13px] text-ink/60">Only photos to review — screened or reported. Tap one to approve, hide, report or stop that guest shooting.</p>
      ) : null}

      {/* EDGE TO EDGE: the grid cancels the event layout's gutter (px-4 · sm:px-6 · lg:px-8). One wrapper carries the
          zoom (`--mem-cols`) so every group under it — moments, challenges — scales and snaps as one. */}
      <div
        ref={gridRef}
        data-memories-grid=""
        className="-mx-4 touch-pan-y sm:-mx-6 lg:-mx-8"
        style={{ ['--mem-cols' as string]: String(cols) }}
      >
        {body}
      </div>

      <p className="pt-2.5 text-[12px] text-ink/55" data-memories-foot="">
        {zoomWords} · remembered on this device{footLine ? ` · ${footLine}` : ''}
      </p>
      {cappedLine ? (
        <p className="pt-1 text-[12px] text-ink/55" data-memories-capped="">
          {cappedLine}
        </p>
      ) : null}

      <MemoriesThumbRow q={q} onSearch={setQ} addPhotos={host ? addPhotos : null} />

      {opened ? (
        <PhotoSheet
          eventId={eventId}
          item={opened}
          challenge={challengeOf(opened)}
          blocked={opened.guestId ? blockedGuests.includes(opened.guestId) : false}
          supplier={opened.vendorProfileId ? suppliers.find((s) => s.vendorProfileId === opened.vendorProfileId) ?? null : null}
          onView={() => {
            setViewing(opened);
            setOpened(null);
          }}
          onClose={() => setOpened(null)}
        />
      ) : null}
      {viewing ? <PapicLightbox photo={viewing} onClose={() => setViewing(null)} timeZone={timeZone} /> : null}

      {gearOpen ? (
        <Sheet open onClose={() => setGearOpen(false)} labelledById={gearHeading} title="Gallery settings" wide>
          <h2 id={gearHeading} className="sr-only">
            Gallery settings
          </h2>
          <div className="divide-y divide-ink/10" data-memories-settings="">
            {/* FOLLOW THE MOMENTS IN ORDER — the owner's word for the gallery grouped by the day's moments. */}
            <button
              type="button"
              role="switch"
              aria-checked={moments}
              onClick={() => setMoments(!moments)}
              disabled={!chapters || chapters.length < 2}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-60"
              data-memories-moments=""
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink">Follow the moments in order</span>
                <span className="block text-[12.5px] text-ink/60">
                  {!chapters || chapters.length < 2
                    ? 'Needs your schedule'
                    : moments
                      ? 'On · grouped by your schedule'
                      : 'Off · one stream, newest first'}
                </span>
              </span>
              <SwitchTrack on={moments} />
            </button>
            {settings}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

/** A sticky moment / challenge heading over the full-width grid. */
function MomentHead({ label, time = null, tip = null }: { label: string; time?: string | null; tip?: string | null }) {
  return (
    <div className="sticky top-14 z-[3] flex items-baseline justify-between gap-3 bg-paper/90 px-4 pb-1.5 pt-2.5 backdrop-blur sm:px-6 lg:px-8" data-memories-head="">
      {tip ? (
        <InfoTip label={label} labelClassName="text-[15px] font-semibold text-ink" align="start">
          {tip}
        </InfoTip>
      ) : (
        <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{label}</span>
      )}
      {time ? <span className="shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-ink/55">{time}</span> : null}
    </div>
  );
}

function Tile({
  item,
  dense,
  large,
  roomy,
  challengeTag,
  onOpen,
}: {
  item: MemoriesItem;
  dense: boolean;
  large: boolean;
  roomy: boolean;
  challengeTag: string | null;
  onOpen: () => void;
}) {
  const who = item.memSource === 'hub' ? item.hubUse : item.capturedBy ?? null;
  const src = large ? (item.largeUrl ?? item.url) : item.url;
  const screened = item.look === 'screened';
  const mark =
    item.memSource === 'hub'
      ? { text: 'Event Hub', cls: 'bg-[rgba(184,150,62,0.92)] text-[#17160F]' }
      : screened
        ? { text: 'Screened', cls: 'bg-[rgba(229,121,78,0.9)] text-white' }
        : item.look === 'reported'
          ? { text: 'Reported', cls: 'bg-black/55 text-white' }
          : item.look === 'hidden'
            ? { text: 'Hidden', cls: 'bg-black/55 text-white' }
            : challengeTag
              ? { text: 'Challenge', cls: 'bg-black/55 text-white' }
              : null;
  const label =
    item.memSource === 'hub'
      ? `${item.hubUse ?? 'A file'} — used on your Event Hub`
      : `${item.kind === 'clip' ? 'Clip' : 'Photo'}${who ? ` from ${who}` : ''}${challengeTag ? ` — challenge: ${challengeTag}` : ''}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      data-memories-tile=""
      data-memories-look={item.look}
      className={`relative block aspect-square w-full overflow-hidden bg-ink/[0.06] p-0 ${item.look === 'hidden' ? 'opacity-40 grayscale' : ''}`}
    >
      {/* 🗜 The small copy — the tile copy only one-across, where 320 px falls apart. Never an original. */}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover ${screened ? 'blur-[10px]' : ''}`}
        />
      ) : null}
      {mark ? (
        dense ? (
          <span aria-hidden className={`absolute left-[3px] top-[3px] h-2 w-2 rounded-full ${mark.cls}`} />
        ) : (
          <span
            aria-hidden
            data-memories-mark={mark.text}
            className={`absolute left-1 top-1 inline-flex h-4 max-w-[calc(100%-8px)] items-center overflow-hidden whitespace-nowrap rounded-full px-[5px] font-mono text-[8.5px] uppercase tracking-[0.08em] ${mark.cls}`}
          >
            {mark.text}
          </span>
        )
      ) : null}
      {item.kind === 'clip' ? (
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

const REPORT_REASONS = [
  { key: 'nudity_sexual', label: 'Nudity / sexual content' },
  { key: 'violence', label: 'Violence' },
  { key: 'hate_harassment', label: 'Hate / harassment' },
  { key: 'spam', label: 'Spam' },
  { key: 'not_my_event', label: 'Not from this event' },
  { key: 'other', label: 'Something else' },
];

/** One option of the photo's sheet — a full-width press (a frame only on what you press). */
const OPT = 'flex min-h-[48px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] text-ink hover:bg-ink/[0.04]';

/**
 * THE PHOTO'S OWN SHEET (owner 2026-10-23: moderation is on the photo, in the thumb zone). Every press is the shipped
 * server action (`moderation/actions.ts`, `vendor-visibility-actions.ts`) — `back=memories` brings it home here.
 */
function PhotoSheet({
  eventId,
  item,
  challenge,
  blocked,
  supplier,
  onView,
  onClose,
}: {
  eventId: string;
  item: MemoriesItem;
  challenge: MemoriesChallenge | null;
  blocked: boolean;
  supplier: MemoriesSupplier | null;
  onView: () => void;
  onClose: () => void;
}) {
  const heading = useId();
  const [reason, setReason] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const back = <input type="hidden" name="back" value="memories" />;
  const screened = item.look === 'screened';
  const hidden = item.look === 'hidden';
  const who = item.memSource === 'hub' ? item.hubUse : item.capturedBy;
  const title =
    item.memSource === 'hub'
      ? item.hubUse ?? 'Event Hub file'
      : item.memSource === 'uploads'
        ? 'Your upload'
        : item.memSource === 'suppliers'
          ? (supplier?.name ?? who ?? 'Your supplier')
          : who
            ? `From ${who}`
            : 'A guest’s photo';
  const sub =
    item.memSource === 'hub'
      ? 'Used on your Event Hub'
      : screened
        ? 'Held back by the content screen — only you can see it'
        : item.look === 'reported'
          ? 'Reported to the Setnayan team'
          : hidden
            ? 'Hidden from your Memories'
            : item.memSource === 'suppliers'
              ? 'Delivered by your supplier'
              : challenge
                ? `Challenge · ${challenge.title}`
                : null;

  return (
    <Sheet open onClose={onClose} labelledById={heading} title={title}>
      <div data-memories-photo-sheet={item.memSource}>
        <div className="flex items-center gap-3 pb-3">
          <button type="button" onClick={onView} aria-label="View full screen" className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-ink/[0.06]">
            {item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className={`h-full w-full object-cover ${screened ? 'blur-[8px]' : ''}`} />
            ) : null}
          </button>
          <div className="min-w-0">
            <h2 id={heading} className="truncate text-[16px] font-semibold text-ink">
              {title}
            </h2>
            {sub ? <p className="text-[13px] text-ink/60">{sub}</p> : null}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button type="button" className={OPT} onClick={onView}>
            <Eye aria-hidden className="h-4 w-4" strokeWidth={1.9} /> View
          </button>

          {item.memSource === 'hub' ? (
            item.downloadUrl ? (
              <a className={OPT} href={item.downloadUrl} download>
                <Download aria-hidden className="h-4 w-4" strokeWidth={1.9} /> Save to phone
              </a>
            ) : null
          ) : null}

          {item.memSource === 'suppliers' && supplier ? (
            <form action={setVendorCapturesHidden}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="vendor_id" value={supplier.vendorRowId} />
              <input type="hidden" name="hidden" value={supplier.hidden ? '0' : '1'} />
              <input type="hidden" name="back" value="memories" />
              <button type="submit" className={OPT}>
                {supplier.hidden ? <Eye aria-hidden className="h-4 w-4" strokeWidth={1.9} /> : <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
                {supplier.hidden ? `Show ${supplier.name}’s photos again` : `Hide ${supplier.name}’s photos`}
                <span className="ml-auto text-[12px] text-ink/55">{supplier.hidden ? '' : 'kept, not deleted'}</span>
              </button>
            </form>
          ) : null}

          {canModerate({ source: item.memSource }) && item.table !== 'hub' && item.table !== 'vendor_papic_captures' ? (
            <>
              {screened ? (
                <form action={approveScreenedCapture.bind(null, eventId)}>
                  {back}
                  <input type="hidden" name="table" value={item.table} />
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className={OPT}>
                    <Check aria-hidden className="h-4 w-4" strokeWidth={1.9} /> Approve — show this photo
                  </button>
                </form>
              ) : (
                <form action={(item.table === 'papic_photos' ? setSeatPhotoHidden : setCaptureHidden).bind(null, eventId)}>
                  {back}
                  <input type="hidden" name={item.table === 'papic_photos' ? 'photo_id' : 'capture_id'} value={item.id} />
                  <input type="hidden" name="hide" value={hidden ? '0' : '1'} />
                  <button type="submit" className={OPT}>
                    {hidden ? <Eye aria-hidden className="h-4 w-4" strokeWidth={1.9} /> : <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
                    {hidden ? 'Show in Memories again' : 'Hide from Memories'}
                    <span className="ml-auto text-[12px] text-ink/55">{hidden ? '' : 'kept, not deleted'}</span>
                  </button>
                </form>
              )}

              {/* REPORT — a guest's capture (the report names a guest capture; a camera seat's photo is hidden instead). */}
              {item.table === 'papic_guest_captures' && item.look !== 'reported' ? (
                <form action={reportCapture.bind(null, eventId)} className="flex min-h-[48px] items-center gap-2.5 px-3">
                  {back}
                  <input type="hidden" name="capture_id" value={item.id} />
                  <input type="hidden" name="reason" value={reason ?? ''} />
                  <Flag aria-hidden className="h-4 w-4 text-ink" strokeWidth={1.9} />
                  <span className="text-[15px] text-ink">Report</span>
                  <span className="ml-auto">
                    <PickMenu label="Why" value={reason} options={REPORT_REASONS} onPick={setReason} buttonText={reason ? undefined : 'Why'} compact />
                  </span>
                  {reason ? <ActionButton tone="danger" type="submit" label="Send" /> : null}
                </form>
              ) : null}

              {item.guestId && item.memSource === 'papic' ? (
                <form action={(blocked ? unblockUploader : blockUploader).bind(null, eventId)}>
                  {back}
                  <input type="hidden" name="guest_id" value={item.guestId} />
                  <button type="submit" className={`${OPT} ${blocked ? '' : 'text-terracotta'}`}>
                    <Ban aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                    {blocked ? `Let ${who ?? 'this guest'} shoot again` : `Stop ${who ?? 'this guest'} shooting`}
                    <span className="ml-auto text-[12px] text-ink/55">{blocked ? '' : 'this event only'}</span>
                  </button>
                </form>
              ) : null}

              {confirmDelete ? (
                <form action={deletePhotoForever.bind(null, eventId)} className="rounded-xl bg-terracotta/[0.06] p-3" data-memories-delete-confirm="">
                  {back}
                  <input type="hidden" name="table" value={item.table} />
                  <input type="hidden" name="id" value={item.id} />
                  <p className="text-[13.5px] text-ink">Delete this photo and every copy of it? This cannot be undone.</p>
                  <div className="mt-2 flex gap-2">
                    <ActionButton tone="danger" main type="submit" icon={Trash2} label="Delete forever" />
                    <ActionButton tone="neutral" icon={X} label="Keep it" onClick={() => setConfirmDelete(false)} />
                  </div>
                </form>
              ) : (
                <button type="button" className={`${OPT} text-terracotta`} onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.9} /> Delete forever
                  <span className="ml-auto text-[12px] text-ink/55">every copy</span>
                </button>
              )}
            </>
          ) : null}

          <button type="button" className={OPT} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * The one thumb row, drawn into <body> (the dashboard's page wrapper captures `position: fixed`), above the dock —
 * the Find row's seat (`find-thumb-row.tsx`). "Search memories" narrows on the device; ＋ Add photos is the one
 * upload door (the shipped uploader, in a sheet).
 */
function MemoriesThumbRow({ q, onSearch, addPhotos }: { q: string; onSearch: (v: string) => void; addPhotos: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [up, setUp] = useState(false);
  const [adding, setAdding] = useState(false);
  const heading = useId();
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
  return (
    <>
      {createPortal(
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
              label: 'Search memories — by who took them, a challenge, a place on your Event Hub',
              input: { value: q, onChange: (e) => onSearch(e.target.value), 'data-memories-search': '' },
            }}
            action={addPhotos ? { icon: Plus, label: 'Add photos', onClick: () => setAdding(true), testId: 'memories-add-photos' } : null}
          />
        </div>,
        host,
      )}
      {adding && addPhotos ? (
        <Sheet open onClose={() => setAdding(false)} labelledById={heading} title="Add photos" wide>
          <h2 id={heading} className="sr-only">
            Add photos
          </h2>
          {addPhotos}
        </Sheet>
      ) : null}
    </>
  );
}
