'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { InfoTip } from '@/app/_components/info-tip';
import { PILL_ON_CLASS } from '@/app/_components/pill-selector';
import { TickerPill, WhenTicker } from '@/app/_components/ticker';
import { TIMELINE_BAND_CLASS, TIMELINE_ROW_CLASS, TimelineRow } from '@/app/_components/timeline-row';
import { formatCount } from '@/lib/format-number';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import { LOVE_STORY_CHAPTER_LABEL, MOMENT_LINE_MAX, MOMENT_TITLE_MAX, type ChapteredMoment, type LoveStoryMoment, type MomentAnchor, type MomentDate } from '@/lib/love-story-moments';
import { STUDIO_FOOT_BUTTON } from '@/lib/studio-skin';
import { whenWords, type TimelineWhen } from '@/lib/timeline';
import type { UploadSend } from '@/lib/upload-send';
import { PickSheetContext } from '../../editor/_components/pick-menu-place';
import { useMaker } from '../../../launch/_components/maker-context';
import { LoveStoryProLine } from './love-story-pro-line';
import { MomentNotKept, type MomentSheet } from './moment-sheet';
/* 🧭 The Studio's own add/edit sheet (owner 2026-10-08) — rides this lazy chunk, never the first load. */
import { MomentSheetStudio } from './moment-sheet-studio';

/**
 * 📖 STUDIO › LOVE STORY — ONE TIMELINE ROW PER MOMENT (owner 2026-10-08, `INTERACTION_RULES.md` § 9; approved
 * gallery `prototypes/control_templates_2026-10-08.html` § 13). Owner, verbatim: *"can also be love story form"* ·
 * *"add optional for the day it can be month and year only or month year and day or year only"* · *"up to 3 media
 * files."*
 *
 *   WHEN (only as exact as they chose) · the moment's NAME · one PICTURE SQUARE with a count · ⋯
 *
 * 🗣 THE WORD: an entry is a MOMENT; a story's six sections (Before us · How we met · Together · Falling · The yes ·
 * Toward the day) are its CHAPTERS. The gallery drew this row with "chapter" for the entry — the controller's word,
 * not the owner's — and on this page that made one word mean two things. The app's own words win.
 *
 * The row is the app's ONE `TimelineRow` and the when rolls on its ONE ticker — the SAME pieces Studio › Schedule
 * wears. This file only says what they mean for a story:
 *   · WHEN — a year, a month and year, or a full date. It is stored as it always was (`events.love_story.moments[]
 *     .date = { y, m?, d? }`): the precision IS the shape, so "June 2019" has no day in it to be wrong.
 *   · NAME — the moment's `title`.
 *   · THE SQUARE — its photos (`media`, already up to four in storage; the sheet offers THREE — a moment that holds
 *     four keeps all four). Photos only: no video is accepted, screened or drawn anywhere today, so none is promised.
 *     The upload is the shared `FileUpload` (device → storage, its own real 0–100 % per file, ✕ to remove).
 *   · ⋯ — the rest, in place under the row, exactly what the open card held: THE WORDS (a moment's line), More…
 *     (the shipped sheet: Where · Added by · This one is… · Keep off the Event Hub), Move up / Move down (the
 *     couple's own order, owner 2026-10-07 — the list is drawn in the order guests get, `sortMoments`), Remove.
 *
 * 🔑 NO NEW WRITE. Every change is a moment form through the moment action's own intents (`applyMomentIntent`):
 * `edit` (every field the moment holds is carried, so a when rolled never drops its place or photos), `add`,
 * `delete`, `order`. In the Maker they are applied at the tap and saved to the DRAFT (one save after the pause;
 * guests see nothing until ✓ Apply). A NEW photo is the one thing only the server may keep (it is screened first) —
 * that form goes to the server action, as it always has.
 *
 * Drawn only in the new Maker's Studio (`makerStagesStudioEnabled` → `LoveStoryBook studio`). Opening it writes
 * nothing.
 */

/** What `MomentSheet` needs besides its moment — the book's own `sheetProps`. */
export type MomentSheetBase = Omit<React.ComponentProps<typeof MomentSheet>, 'moment' | 'trigger' | 'triggerClassName' | 'opensFor'>;

/** How many photos the Studio offers for a moment (owner 2026-10-08: *"up to 3 media files."*). Storage holds four. */
export const MOMENT_PHOTOS_OFFERED = 3;

/** Every field a moment holds, as the moment form carries it — an edit of one keeps the rest. */
export function momentEditForm(
  m: LoveStoryMoment,
  change: { y?: string; date?: MomentDate; title?: string; line?: string; media?: readonly string[] },
): FormData {
  const fd = new FormData();
  fd.set('intent', 'edit');
  fd.set('id', m.id);
  /* A when is sent as EXACTLY the parts it has: a year alone sends no month, a month no day. */
  const date = change.date ?? m.date;
  fd.set('date_y', change.date ? String(change.date.y) : (change.y ?? (date?.y ? String(date.y) : '')));
  if (date?.m) fd.set('date_m', String(date.m));
  if (date?.m && date.d) fd.set('date_d', String(date.d));
  fd.set('title', change.title ?? m.title ?? '');
  fd.set('line', change.line ?? m.line);
  if (m.place) fd.set('place', m.place);
  for (const ref of change.media ?? m.media ?? []) fd.append('media', ref);
  if (m.added_by) fd.set('added_by', m.added_by);
  if (m.anchor) fd.set('anchor', m.anchor);
  if (m.hidden) fd.set('hidden', 'on');
  return fd;
}

/** A new moment, as the moment form carries it. */
export function momentAddForm(fresh: { when: MomentDate; title: string; line: string }): FormData {
  const fd = new FormData();
  fd.set('intent', 'add');
  fd.set('date_y', String(fresh.when.y));
  if (fresh.when.m) fd.set('date_m', String(fresh.when.m));
  if (fresh.when.m && fresh.when.d) fd.set('date_d', String(fresh.when.d));
  fd.set('title', fresh.title);
  fd.set('line', fresh.line);
  return fd;
}

/** How many photo slots a moment shows: three — or all it already holds, when that is more. */
export function momentPhotoSlots(held: number): number {
  return Math.max(MOMENT_PHOTOS_OFFERED, held);
}

/** The story with one moment moved one place — every id, first to last (the moment action's own `intent=order`). */
export function movedOrder(ids: readonly string[], id: string, by: 1 | -1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

const sameWhen = (a: MomentDate | undefined, b: MomentDate | undefined) => (a?.y ?? 0) === (b?.y ?? 0) && (a?.m ?? 0) === (b?.m ?? 0) && (a?.d ?? 0) === (b?.d ?? 0);
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const whyNot = (e: unknown) => (e instanceof MomentNotKept ? e.message : 'That did not save. Nothing changed — please try again.');
/** A server action's redirect is not a refusal — it is let through. */
const isRedirect = (e: unknown) => typeof (e as { digest?: unknown } | null)?.digest === 'string' && (e as { digest: string }).digest.startsWith('NEXT_REDIRECT');

const SQUARE = 'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl';
const QUIET_BUTTON = 'sn-press inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-cream px-3.5 text-[13px] font-semibold text-ink ring-1 ring-ink/15 disabled:opacity-40';
const WORDS_BOX = 'min-h-[76px] w-full resize-none rounded-2xl bg-white px-3.5 py-2.5 text-[15px] leading-snug text-ink outline-none ring-1 ring-inset ring-ink/20 placeholder:text-ink/40 focus:ring-2 focus:ring-ink/40';

type Action = (formData: FormData) => void | Promise<void>;

/** The new row, before it is saved. */
const NEW_ROW = '__new';

function MomentRow({
  m,
  ids,
  action,
  sheet,
  mediaUrls,
  editing,
  onEdit,
  onEndEdit,
  open,
  onOpen,
}: {
  m: ChapteredMoment;
  /** Every moment's id, in the order drawn — for Move up / Move down. */
  ids: readonly string[];
  action: Action;
  sheet: MomentSheetBase;
  mediaUrls: Readonly<Record<string, string>>;
  editing: boolean;
  onEdit: () => void;
  onEndEdit: () => void;
  /** Is this row's ⋯ open? One at a time. */
  open: boolean;
  onOpen: () => void;
}) {
  const pickSheet = useContext(PickSheetContext);
  const maker = useMaker();
  const [rolled, setRolled] = useState<{ when: TimelineWhen; kept: boolean } | null>(null);
  const [line, setLine] = useState(m.line);
  const [problem, setProblem] = useState<string | null>(null);
  const [keeping, setKeeping] = useState(false);
  /* The photos as the open slots hold them — kept ONCE, when the slots close (three new photos are one save). */
  const picked = useRef<readonly string[] | null>(null);
  /* 🚧 A PHOTO IS NEVER LOST SILENTLY: while a file is on its way the slots cannot be closed (closing unmounts the
     uploader and would drop it) — and a refused closing is said, in words. */
  const [uploading, setUploading] = useState(false);
  const [refusedClose, setRefusedClose] = useState(false);
  /* A refusal (or a fresh story) puts the words back. */
  useEffect(() => setLine(m.line), [m.line]);
  const media = m.media ?? [];
  const shown: TimelineWhen | null = rolled?.when ?? m.date ?? null;

  const send = (fd: FormData) => {
    setProblem(null);
    return Promise.resolve(action(fd)).catch((e: unknown) => {
      if (isRedirect(e)) throw e;
      setProblem(whyNot(e));
    });
  };
  /** ONE write for whatever the when rolled to — when its ticker closes, and only if it changed. */
  const writeRolled = () => {
    const r = rolled;
    setRolled(null);
    if (!r || (sameWhen(r.when, m.date) && !(r.kept && !m.date))) return;
    void send(momentEditForm(m, { date: r.when }));
  };
  const saveLine = (value: string) => {
    const text = value.trim();
    /* A moment keeps its words: emptied, they are put back. */
    if (!text) return setLine(m.line);
    if (text !== m.line) void send(momentEditForm(m, { line: text }));
  };
  const savePhotos = () => {
    const refs = picked.current;
    picked.current = null;
    if (!refs || sameList(refs, media)) return;
    const fd = momentEditForm(m, { media: refs });
    /* A NEW photo goes to the server (it screens it): into the DRAFT, and back to this page. */
    fd.set(HUB_DRAFT_FIELD, '1');
    if (maker) fd.set('return_to', `/dashboard/${maker.eventId}/launch?tool=love-story`);
    setKeeping(true);
    void send(fd).finally(() => setKeeping(false));
  };
  const move = (by: 1 | -1) => {
    const next = movedOrder(ids, m.id, by);
    if (!next) return;
    const fd = new FormData();
    fd.set('intent', 'order');
    fd.set('order', next.join(','));
    void send(fd);
  };
  const first = media.map((ref) => mediaUrls[ref]).find(Boolean) ?? null;
  const named = m.title ? ` · ${m.title}` : '';
  const place = ids.indexOf(m.id);
  return (
    <TimelineRow
      data="moment"
      attrs={{ 'data-moment-card': m.id, 'data-studio-story-card': open ? 'open' : '' }}
      name={m.title ?? ''}
      placeholder="Name this moment"
      nameLabel="Name of this moment"
      maxLength={MOMENT_TITLE_MAX}
      editing={editing}
      onEdit={onEdit}
      onKeep={(text) => {
        onEndEdit();
        /* Emptied: as it was. */
        if (text && text !== (m.title ?? '')) void send(momentEditForm(m, { title: text }));
      }}
      onLeave={onEndEdit}
      /* A plain save says its words — never an invented percentage. */
      note={keeping ? 'Keeping your photos…' : m.hidden ? 'Off the Event Hub — guests do not see this moment.' : null}
      problem={problem}
      when={
        <TickerPill
          data="when"
          text={shown ? whenWords(shown) : 'When'}
          ariaLabel={shown ? `When: ${whenWords(shown, true)}` : 'Set when this was'}
          title={`When${named}`}
          sheet={pickSheet}
          onClosed={writeRolled}
          className={`min-w-[72px] ${shown ? '' : '!text-ink/55'}`}
        >
          {(close) => {
            const thisYear = new Date().getFullYear();
            const value = shown ?? { y: thisYear };
            return (
              <WhenTicker
                value={value}
                thisYear={thisYear}
                onChange={(when) => setRolled({ when, kept: false })}
                /* Done on a moment with no when yet KEEPS the one the ticker shows. */
                onDone={() => {
                  setRolled((r) => ({ when: r?.when ?? value, kept: true }));
                  close();
                }}
              />
            );
          }}
        </TickerPill>
      }
      trailing={
        <>
          <TickerPill
            data="photos"
            align="end"
            text={
              first ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={first} alt="" className="h-full w-full rounded-xl object-cover" />
                  <PhotoCount n={media.length} />
                </>
              ) : media.length ? (
                <PhotoCount n={media.length} />
              ) : (
                <ImageIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              )
            }
            ariaLabel={media.length ? `${formatCount(media.length)} of ${momentPhotoSlots(media.length)} photos. Tap to change` : `Add photos, up to ${formatCount(MOMENT_PHOTOS_OFFERED)}`}
            title={`Photos${named}`}
            sheet={pickSheet}
            onClosed={savePhotos}
            hold={uploading}
            onHeld={() => setRefusedClose(true)}
            face={`sn-press sn-press-ring ${SQUARE} ${media.length ? 'bg-ink/10' : 'border border-dashed border-ink/25 bg-white text-sn-accent'}`}
          >
            {(close) => (
              <MomentPhotos
                m={m}
                sheet={sheet}
                mediaUrls={mediaUrls}
                onChange={(refs) => (picked.current = refs)}
                onUploading={(busy) => {
                  setUploading(busy);
                  if (!busy) setRefusedClose(false);
                }}
                refusedClose={refusedClose}
                onDone={close}
              />
            )}
          </TickerPill>
          {/* BUTTON-RULE */}
          <button
            type="button"
            data-studio-story-more={m.id}
            aria-expanded={open}
            aria-label={`More for ${m.title || 'this moment'} — its words, where, order, remove`}
            onClick={onOpen}
            className="sn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sn-accent hover:bg-ink/5"
          >
            <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </>
      }
      below={
        open && !editing ? (
          <div data-studio-story-editor={m.id} className="flex flex-col gap-2 pb-3 pl-3 pr-3">
            <textarea
              value={line}
              maxLength={MOMENT_LINE_MAX}
              aria-label="The words"
              placeholder="What happened, in your words…"
              rows={3}
              onChange={(e) => setLine(e.target.value)}
              onBlur={(e) => saveLine(e.target.value)}
              className={WORDS_BOX}
            />
            <div className="flex flex-wrap gap-2">
              {/* BUTTON-RULE */}
              <MomentSheetStudio {...sheet} moment={m} trigger="More…" triggerClassName={QUIET_BUTTON} />
              {/* BUTTON-RULE */}
              <button type="button" data-studio-story-up={m.id} disabled={place <= 0} onClick={() => move(-1)} className={QUIET_BUTTON}>
                <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2} />
                Move up
              </button>
              {/* BUTTON-RULE */}
              <button type="button" data-studio-story-down={m.id} disabled={place < 0 || place >= ids.length - 1} onClick={() => move(1)} className={QUIET_BUTTON}>
                <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={2} />
                Move down
              </button>
              {/* BUTTON-RULE */}
              <button
                type="button"
                data-studio-story-remove={m.id}
                onClick={() => {
                  const fd = new FormData();
                  fd.set('intent', 'delete');
                  fd.set('id', m.id);
                  void send(fd);
                }}
                className="sn-press inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-cream px-3.5 text-[13px] font-semibold text-danger-700 ring-1 ring-danger-300"
              >
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                Remove
              </button>
            </div>
          </div>
        ) : null
      }
    />
  );
}

/**
 * 🧪 A STAND-IN FOR STORAGE, for these slots — ONLY the dev lab provides one (it has no storage, so there a photo
 * could never land and the owner could never see one). Null everywhere a person can reach: the slots then send to
 * real storage. `lib/the-lab-can-upload.test.ts` holds that nothing outside `app/dev/` provides it.
 */
export const SlotsUploadStandIn = createContext<UploadSend | null>(null);

/** What a photo's tile says when it did not upload (owner 2026-10-08: *"it does not upload"*). */
export const PHOTO_NOT_UPLOADED = 'Couldn’t upload this photo.';
/** How long a photo may move nothing before the slots stop waiting for it. */
export const PHOTO_STALL_MS = 15_000;

/** Done's words while a file is on its way: the uploader's measured figure once it has one — never an invented one. */
export function uploadingWords(pct: number | null): string {
  return pct === null ? 'Uploading…' : `Uploading… ${pct}%`;
}

/** How many photos the moment holds — on the picture square. */
function PhotoCount({ n }: { n: number }) {
  return (
    <span data-moment-photo-count="" className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold ring-2 ring-cream ${PILL_ON_CLASS}`}>
      {n}
    </span>
  );
}

/**
 * THE PHOTO SLOTS — in the same pop as every other pick. The shared `FileUpload` draws them: a square per photo with
 * ✕, a square per upload in flight with its own REAL 0–100 % (measured from the upload itself, never invented), and
 * its drop zone while there is room. It tells this file the set as it stands; the moment keeps it ONCE, when the
 * slots close — so three new photos are one save, not three.
 */
export function MomentPhotos({
  m,
  sheet,
  mediaUrls,
  onChange,
  onUploading,
  refusedClose = false,
  onDone,
}: {
  m: LoveStoryMoment;
  sheet: MomentSheetBase;
  mediaUrls: Readonly<Record<string, string>>;
  onChange: (refs: readonly string[]) => void;
  /** A file is on its way (or the last one has landed) — the slots are held open meanwhile. */
  onUploading?: (busy: boolean) => void;
  /** A closing was just refused because a photo is still uploading — said in one line. */
  refusedClose?: boolean;
  onDone: () => void;
}) {
  const media = m.media ?? [];
  const [changed, setChanged] = useState(false);
  /* The uploader's own words about what is on its way: busy from the pick to the landing, and its measured figure. */
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const standIn = useContext(SlotsUploadStandIn);
  return (
    <div data-moment-photos="" className="mx-auto w-full max-w-[300px]">
      <p className="pb-2.5 pt-0.5 text-center text-[13px] font-semibold text-ink/70">Up to {formatCount(MOMENT_PHOTOS_OFFERED)} photos. The first one shows first on your page.</p>
      {sheet.ownsPro ? (
        <FileUpload
          bucket="media"
          pathPrefix={`events/${sheet.eventId}/love-story`}
          multiple
          maxFiles={momentPhotoSlots(media.length)}
          maxSizeMB={10}
          acceptedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
          currentValue={[...media]}
          initialDisplayUrls={{ ...mediaUrls }}
          variant="gallery"
          /* 🚫 A photo that did not upload SAYS SO on its tile, with Try again and ✕ — never a spinner that stays,
             never nothing. And one that stops moving is given up on after 15 seconds, not left to spin. */
          failedSays={PHOTO_NOT_UPLOADED}
          stallMs={PHOTO_STALL_MS}
          send={standIn ?? undefined}
          onBusy={(next) => {
            setBusy(next);
            onUploading?.(next);
          }}
          onProgress={setPct}
          onChange={(value) => {
            setChanged(true);
            onChange(Array.isArray(value) ? value : value ? [value] : []);
          }}
        />
      ) : (
        <div className="text-center">
          <LoveStoryProLine storeShell={sheet.storeShell} href={sheet.proHref} price={sheet.proPrice} />
        </div>
      )}
      {/* Said, never silent: what the slots hold is kept when they close. */}
      {refusedClose && busy ? (
        <p role="status" data-moment-photos-still-uploading="" className="pt-2 text-center text-[12.5px] font-semibold text-warn-700">
          A photo is still uploading.
        </p>
      ) : changed && !busy ? (
        <p role="status" data-moment-photos-not-kept="" className="pt-2 text-center text-[12.5px] font-semibold text-warn-700">
          Not kept yet — press Done.
        </p>
      ) : null}
      {/* BUTTON-RULE */}
      {/* While a file is on its way Done is not available: it says so with the uploader's own figure. */}
      <button
        type="button"
        data-moment-photos-done=""
        disabled={busy}
        onClick={onDone}
        className={`sn-press mt-3 flex min-h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold disabled:cursor-default disabled:opacity-60 ${PILL_ON_CLASS}`}
      >
        {busy ? uploadingWords(pct) : 'Done'}
      </button>
    </div>
  );
}

/** The three chapters a story is anchored by — `MOMENT_ANCHORS`, spelled (its type holds it): the list itself is not
    read by anything the Maker loads first, and asking for it here would add it to that first load (507 KB). */
const SAMPLE_CHAPTERS = ['met', 'together', 'yes'] as const satisfies readonly MomentAnchor[];
/** The sample name's width — a little different on each row. */
const SAMPLE_NAME = ['w-28', 'w-20', 'w-24'] as const;

/**
 * 🩶 AN EMPTY STORY SHOWS WHAT IT WILL LOOK LIKE (owner 2026-10-08 on the preview, of an event with no moments: *"i
 * cannot see it is blank"*; his rule for empty things, the same day: *"maybe show what it could look like with
 * boxes?"*). The real row itself — the same band and line (`TIMELINE_BAND_CLASS` / `TIMELINE_ROW_CLASS`): a when
 * pill, a name, a picture square — in grey shapes, one under each of the three chapters a story is anchored by.
 *
 * Unmistakably a sample: shapes only (no name, no year, no words of a moment), `aria-hidden`, not tappable, STILL
 * (loading shimmers; this does not) — and drawn ONLY while there is no moment, so the first real one replaces it.
 */
function SampleStory() {
  return (
    <ol data-studio-story-sample="" aria-hidden className="pointer-events-none flex select-none flex-col border-y border-ink/10">
      {SAMPLE_CHAPTERS.map((chapter, i) => (
        <li key={chapter} data-studio-story-sample-card={chapter} className={TIMELINE_BAND_CLASS}>
          <p className="px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">{LOVE_STORY_CHAPTER_LABEL[chapter]}</p>
          <div className={TIMELINE_ROW_CLASS}>
            <span data-sample-shape="when" className="h-10 w-[72px] shrink-0 rounded-full bg-ink/10" />
            <span className="flex min-w-0 flex-1 px-1">
              <span data-sample-shape="name" className={`h-3.5 ${SAMPLE_NAME[i]} rounded-full bg-ink/15`} />
            </span>
            <span data-sample-shape="photo" className={`${SQUARE} mr-12 bg-ink/10`} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The new moment before it is saved — it lives only on this screen until it has a name AND its words. */
type Fresh = { when: TimelineWhen; title: string };

export function MomentOrderCards({
  action,
  moments,
  mediaUrls,
  sheet,
  add,
}: {
  /** The moment action (the server's, or the Maker's instant one) — add · edit · delete · ONE `intent=order` per move. */
  action: Action;
  /** The story as guests read it (`sortMoments`). */
  moments: readonly ChapteredMoment[];
  mediaUrls: Readonly<Record<string, string>>;
  /** What the shipped `MomentSheet` needs (More…). */
  sheet: MomentSheetBase;
  /** The foot: + Add a moment, or the free-stories line once they are told. */
  add: { can: true } | { can: false; line: ReactNode };
}) {
  const ids = moments.map((m) => m.id);
  /* ONE row's name is open at a time; ONE row's ⋯ is open at a time. */
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [freshLine, setFreshLine] = useState('');
  const [freshProblem, setFreshProblem] = useState<string | null>(null);
  const words = useRef<HTMLTextAreaElement>(null);
  const pickSheet = useContext(PickSheetContext);

  const startFresh = () => {
    const now = new Date();
    setFresh({ when: { y: now.getFullYear(), m: now.getMonth() + 1 }, title: '' });
    setFreshLine('');
    setFreshProblem(null);
    setOpen(null);
    setEditing(NEW_ROW);
  };
  const dropFresh = () => {
    setFresh(null);
    setEditing((cur) => (cur === NEW_ROW ? null : cur));
  };
  /** The new moment has its words: add it — ONE moment form. Without words it stays here, unsaved, and says so. */
  const keepFresh = (value: string) => {
    const line = value.trim();
    if (!fresh || !fresh.title || !line) return;
    setFreshProblem(null);
    Promise.resolve(action(momentAddForm({ when: fresh.when, title: fresh.title, line }))).then(
      () => setFresh(null),
      (e: unknown) => setFreshProblem(whyNot(e)),
    );
  };

  return (
    <section data-moment-order-cards="" aria-label="Your moments, in order" className="-mx-4 flex min-h-full flex-col text-ink sm:-mx-6">
      <div className="flex items-center px-4 pb-2 pt-3 text-[13px] text-ink/60">
        <InfoTip label={`${moments.length} ${moments.length === 1 ? 'moment' : 'moments'}`} align="center">
          Tap the date, the name or the picture to change it. ⋯ holds its words and the rest.
        </InfoTip>
      </div>
      {moments.length || fresh ? (
        <ol className="flex flex-col border-y border-ink/10">
          {moments.map((m) => (
            <MomentRow
              key={m.id}
              m={m}
              ids={ids}
              action={action}
              sheet={sheet}
              mediaUrls={mediaUrls}
              editing={editing === m.id}
              onEdit={() => setEditing(m.id)}
              onEndEdit={() => setEditing((cur) => (cur === m.id ? null : cur))}
              open={open === m.id}
              onOpen={() => setOpen((cur) => (cur === m.id ? null : m.id))}
            />
          ))}
          {fresh ? (
            <TimelineRow
              data="new"
              attrs={{ 'data-studio-story-new': '' }}
              name={fresh.title}
              placeholder="Name this moment"
              nameLabel="Name of this moment"
              maxLength={MOMENT_TITLE_MAX}
              editing={editing === NEW_ROW}
              onEdit={() => setEditing(NEW_ROW)}
              onKeep={(text) => {
                setEditing(null);
                /* Left unnamed: dropped — nothing was ever sent. */
                if (!text && !fresh.title) return dropFresh();
                if (text) setFresh({ ...fresh, title: text });
                window.setTimeout(() => words.current?.focus(), 0);
              }}
              onLeave={() => (fresh.title ? setEditing(null) : dropFresh())}
              problem={freshProblem}
              when={
                <TickerPill data="when" text={whenWords(fresh.when)} ariaLabel={`When: ${whenWords(fresh.when, true)}`} title="When" sheet={pickSheet} className="min-w-[72px]">
                  {(close) => <WhenTicker value={fresh.when} thisYear={new Date().getFullYear()} onChange={(when) => setFresh({ ...fresh, when })} onDone={close} />}
                </TickerPill>
              }
              below={
                editing === NEW_ROW ? null : (
                  <div data-studio-story-new-words="" className="flex flex-col gap-2 pb-3 pl-3 pr-3">
                    <textarea
                      ref={words}
                      value={freshLine}
                      maxLength={MOMENT_LINE_MAX}
                      aria-label="The words"
                      placeholder="What happened, in your words…"
                      rows={3}
                      onChange={(e) => setFreshLine(e.target.value)}
                      onBlur={(e) => keepFresh(e.target.value)}
                      className={WORDS_BOX}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {/* Said, never silent: a moment with a name and no words is not saved yet. */}
                      <p role="status" data-studio-story-not-saved="" className="text-[12.5px] font-semibold text-warn-700">
                        Not saved yet — a moment needs a line or two.
                      </p>
                      {/* BUTTON-RULE */}
                      <button type="button" data-studio-story-new-drop="" onClick={dropFresh} className={QUIET_BUTTON}>
                        <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                        Remove
                      </button>
                    </div>
                  </div>
                )
              }
            />
          ) : null}
        </ol>
      ) : (
        <>
          <p className="px-4 pb-3 pt-1 text-[14px] text-ink/60">No moments yet.</p>
          <SampleStory />
        </>
      )}
      {/* The editor's own bottom (prototype `.ebot`): pinned to the foot of a phone's screen, room kept above it. */}
      <div aria-hidden className="h-20 shrink-0 lg:hidden" />
      <div className={`z-30 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:pb-[max(.5rem,env(safe-area-inset-bottom))] lg:sticky lg:bottom-0 lg:mt-4 sn-glass-row shrink-0 px-2.5 py-2`}>
        {add.can ? (
          /* BUTTON-RULE */
          <button type="button" data-studio-add-moment="" disabled={fresh !== null} onClick={startFresh} className={`${STUDIO_FOOT_BUTTON} disabled:opacity-50`}>
            <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
            Add a moment
          </button>
        ) : (
          <div data-love-story-cap="reached" className="px-1 py-1 text-[13px] text-ink/70">
            {add.line}
          </div>
        )}
      </div>
    </section>
  );
}
