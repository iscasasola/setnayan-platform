'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Image as ImageIcon, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { InfoTip } from '@/app/_components/info-tip';
import { PILL_ON_CLASS } from '@/app/_components/pill-selector';
import { TickerPill, WhenTicker } from '@/app/_components/ticker';
import { TIMELINE_BAND_CLASS, TIMELINE_ROW_CLASS, TimelineRow } from '@/app/_components/timeline-row';
import { formatCount } from '@/lib/format-number';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import { MAKER_STAY_FIELD } from '@/lib/maker-stay';
import { LOVE_STORY_CHAPTER_LABEL, MOMENT_LINE_MAX, MOMENT_TITLE_MAX, type ChapteredMoment, type LoveStoryMoment, type MomentAnchor, type MomentDate } from '@/lib/love-story-moments';
import { STUDIO_FOOT_BUTTON } from '@/lib/studio-skin';
import { WIDEST_WHEN_WORDS, whenWords, type TimelineWhen } from '@/lib/timeline';
import type { UploadSend } from '@/lib/upload-send';
import { PickSheetContext } from '../../editor/_components/pick-menu-place';
import { useMaker } from '../../../launch/_components/maker-context';
import { LoveStoryProLine } from './love-story-pro-line';
import { MomentNotKept, type MomentSheet } from './moment-sheet';
import type { OtherEvent } from './pick-from-our-events';
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

/** The most of a moment's words the row carries — the row itself cuts what does not fit, with "…". */
export const MOMENT_FIRST_LINE_MAX = 120;

/**
 * THE FIRST LINE OF A MOMENT'S WORDS, for the quiet line under its name (owner 2026-10-08, of a row with only a
 * name: *"i do not see the subtext?"*; gallery § 13). The first line the couple wrote — never a later one, never
 * words of ours. Null when there are none yet: the row then shows no second line at all. When more follows than is
 * handed over (a second line, or a very long first one), it ends in "…" so it never reads as the whole story.
 */
export function momentFirstLine(words: string | null | undefined): string | null {
  const lines = (words ?? '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const at = lines.findIndex(Boolean);
  if (at < 0) return null;
  const first = lines[at]!;
  const more = lines.slice(at + 1).some(Boolean);
  if (first.length <= MOMENT_FIRST_LINE_MAX) return more ? `${first.replace(/[\s.…]+$/, '')}…` : first;
  return `${first.slice(0, MOMENT_FIRST_LINE_MAX).replace(/\s+\S*$/, '').replace(/[\s.,;:—–-]+$/, '')}…`;
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

/* ── PHOTOS TWO WAYS: upload, or pick from their other events (owner 2026-10-08) ───────────────────────────────── */

/**
 * WHAT "PICK FROM OUR EVENTS" KNOWS SO FAR. Asked of the server ONCE per visit to this page — by the first tap that
 * opens it, never by opening Love Story — and kept for every moment's slots after that.
 */
export type EventsOffer = { state: 'idle' | 'asking' | 'failed' } | { state: 'have'; events: readonly OtherEvent[] };

/**
 * The pair's other events, asked through the moment action's own `intent=offer` (the one question it answers — it
 * writes nothing and re-draws nothing). Null when it could not be read: the screen then says so with Try again,
 * never "no other events".
 */
export async function askOurEvents(action: Action): Promise<readonly OtherEvent[] | null> {
  const fd = new FormData();
  fd.set('intent', 'offer');
  try {
    const answer = (await action(fd)) as unknown as { offer?: unknown } | undefined;
    return Array.isArray(answer?.offer) ? (answer.offer as OtherEvent[]) : null;
  } catch {
    return null;
  }
}

/** A pick, as the moment form carries it — the SHIPPED `intent=pick`: these photos join THIS moment. */
export function momentPickForm(momentId: string, refs: readonly string[]): FormData {
  const fd = new FormData();
  fd.set('intent', 'pick');
  fd.set('id', momentId);
  for (const ref of refs) fd.append('media', ref);
  return fd;
}

/**
 * A change only the server may decide (a new photo is screened; a pick is checked against what is theirs): into the
 * DRAFT, landing on the address the couple is already on (`lib/maker-stay.ts`) — so the Maker is re-drawn in place,
 * never reloaded from nothing. `here` is null outside the Maker.
 */
export function draftInPlace(fd: FormData, here: string | null): FormData {
  fd.set(HUB_DRAFT_FIELD, '1');
  if (here) {
    fd.set('return_to', here);
    fd.set(MAKER_STAY_FIELD, '1');
  }
  return fd;
}

/** How many more photos this moment has room for, given what its slots hold right now. */
export function momentPhotoRoom(held: number, now: number): number {
  return Math.max(0, momentPhotoSlots(held) - now);
}

/** Tick or untick one offered photo — never past the room there is. */
export function tickedPhotos(ticked: readonly string[], ref: string, room: number): readonly string[] {
  if (ticked.includes(ref)) return ticked.filter((r) => r !== ref);
  return ticked.length >= room ? ticked : [...ticked, ref];
}

/**
 * What a photo's square says when it was picked from ANOTHER event — or null for one of this moment's own. Such a
 * photo can be removed from the moment here; it is not this page's to change. The name is the event's; when it
 * could not be read the words say so plainly rather than guess.
 */
export function photoFromWords(photoFrom: Readonly<Record<string, string>> | undefined, ref: string): string | null {
  if (!photoFrom || !(ref in photoFrom)) return null;
  return photoFrom[ref] ? `From ${photoFrom[ref]}` : 'From another of your events';
}

/** An event's day, said in full ("December 12, 2026") — or nothing when it has no date yet. */
function eventDayWords(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? whenWords({ y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }, true) : '';
}

/** Everything a moment's when pill can read at its widest: a full date in any month — and "When", before one is set. */
export const MOMENT_WHEN_WIDEST: readonly string[] = [...WIDEST_WHEN_WORDS, 'When'];

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
  photoFrom,
  offer,
  onAskOffer,
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
  photoFrom?: Readonly<Record<string, string>>;
  offer: EventsOffer;
  onAskOffer: () => void;
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

  /** Resolves `false` when the change was refused (and said on the row). */
  const send = (fd: FormData) => {
    setProblem(null);
    return Promise.resolve(action(fd)).catch((e: unknown) => {
      if (isRedirect(e)) throw e;
      setProblem(whyNot(e));
      return false as const;
    });
  };
  /** A photo form for the server: into the DRAFT, re-drawn in place. */
  const photosForm = (refs: readonly string[]) => draftInPlace(momentEditForm(m, { media: refs }), maker ? `${window.location.pathname}${window.location.search}` : null);
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
    /* A NEW photo goes to the server (it screens it): into the DRAFT, and re-drawn where the couple is. */
    setKeeping(true);
    void send(photosForm(refs)).finally(() => setKeeping(false));
  };
  /**
   * PICKED FROM ANOTHER EVENT — the shipped `intent=pick`, with this moment's id. ONE write. If the slots also hold
   * something not kept yet (a photo just uploaded or removed), that is kept FIRST by its own save and the pick
   * follows it — one after the other, so neither can overwrite the other; a refused first save stops the second.
   */
  const pickFrom = (refs: readonly string[]) => {
    const pending = picked.current;
    picked.current = null;
    if (refs.length === 0) return;
    setKeeping(true);
    void (async () => {
      if (pending && !sameList(pending, media) && (await send(photosForm(pending))) === false) return;
      await send(draftInPlace(momentPickForm(m.id, refs), maker ? `${window.location.pathname}${window.location.search}` : null));
    })().finally(() => setKeeping(false));
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
      /* The start of its words, quiet, under the name (gallery § 13) — as they stand while they are being typed. */
      sub={momentFirstLine(line)}
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
          /* Every when in the list is one width, so the names start on one line. */
          widest={MOMENT_WHEN_WIDEST}
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
                photoFrom={photoFrom}
                offer={offer}
                onAskOffer={onAskOffer}
                onPick={(refs) => {
                  pickFrom(refs);
                  close();
                }}
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
  photoFrom,
  offer = { state: 'idle' },
  onAskOffer,
  onPick,
  onChange,
  onUploading,
  refusedClose = false,
  onDone,
}: {
  m: LoveStoryMoment;
  sheet: MomentSheetBase;
  mediaUrls: Readonly<Record<string, string>>;
  /** Photos here that were picked from another event: ref → its name ('' when unknown). */
  photoFrom?: Readonly<Record<string, string>>;
  /** What "Pick from our events" knows so far (the page's — asked once, shared by every moment). */
  offer?: EventsOffer;
  /** Ask for the pair's other events (the first opening; Try again). */
  onAskOffer?: () => void;
  /** These offered photos join this moment — and the slots close. */
  onPick?: (refs: readonly string[]) => void;
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
  /* What the slots hold right now (photos kept + added − removed), for the room a pick may fill. */
  const [now, setNow] = useState<readonly string[]>(media);
  /* The second way, opened IN this sheet — never a second screen. The uploader stays mounted behind it. */
  const [picking, setPicking] = useState(false);
  const room = momentPhotoRoom(media.length, now.length);
  /* They were asked and have none: the choice stays, quiet, and says why. */
  const none = offer.state === 'have' && offer.events.length === 0;
  return (
    <div data-moment-photos="" className="mx-auto w-full max-w-[300px]">
      {picking && onPick ? (
        <PickFromEvents offer={offer} onAsk={() => onAskOffer?.()} room={room} here={now} onBack={() => setPicking(false)} onAdd={onPick} />
      ) : null}
      <div hidden={picking}>
      <p className="pb-2.5 pt-0.5 text-center text-[13px] font-semibold text-ink/70">Up to {formatCount(MOMENT_PHOTOS_OFFERED)} photos. The first one shows first on your page.</p>
      {sheet.ownsPro ? (
        <>
        {/* THREE across on every width: the uploader's gallery goes to four on a computer, where this pop is 300 px
            wide — and at four a tile is too small for its pie and its ✕ to stand clear of each other. */}
        <div data-moment-photos-tiles="" className="[&_ul]:!grid-cols-3">
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
          /* 🔗 A photo picked from another event says where it is from. It can be removed here (✕); it is not
             this page's to change. */
          tileNote={(ref) => photoFromWords(photoFrom, ref)}
          onChange={(value) => {
            const refs = Array.isArray(value) ? value : value ? [value] : [];
            onChange(refs);
            /* The uploader tells of a change while it is being drawn; this sheet's own line follows a beat later
               (setting state inside another component's draw is refused by React, and said in the console). */
            queueMicrotask(() => {
              setChanged(true);
              setNow(refs);
            });
          }}
        />
        </div>
        {/* THE SECOND WAY — a photo one of their other events already shows. Asked for only when this is tapped. */}
        {onPick ? (
          <>
            {/* BUTTON-RULE */}
            <button
              type="button"
              data-moment-photos-pick=""
              disabled={busy || none || room === 0}
              onClick={() => {
                onAskOffer?.();
                setPicking(true);
              }}
              className="sn-press mt-2.5 flex min-h-11 w-full items-center justify-between gap-2 rounded-full bg-cream pl-4 pr-3 text-left text-[14px] font-semibold text-ink ring-1 ring-inset ring-ink/15 disabled:opacity-50"
            >
              Pick from our events
              <ChevronRight aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
            </button>
            {none || room === 0 ? (
              <p data-moment-photos-pick-why="" className="pt-1.5 text-center text-[12.5px] text-ink/60">
                {none ? 'You have no other events yet.' : 'This moment is full. Remove a photo to add another.'}
              </p>
            ) : null}
          </>
        ) : null}
        </>
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
    </div>
  );
}

const PICK_ROW = 'flex min-h-[52px] w-full items-center justify-between gap-2 border-t border-ink/10 py-2 pl-1 pr-0.5 text-left first:border-t-0';

/**
 * PICK FROM OUR EVENTS — in the slots' own sheet. First the pair's other events, one list row each (its name, its
 * day, what it can lend); open one and its photos are a grid of fixed squares to tick — as many as the moment has
 * room for — then ONE button adds them. An event that is someone else's, or shows no photos yet, is listed and says
 * so; it cannot be opened. Loading, none and "could not look" never look alike.
 */
export function PickFromEvents({
  offer,
  onAsk,
  room,
  here,
  onBack,
  onAdd,
}: {
  offer: EventsOffer;
  onAsk: () => void;
  /** How many more photos the moment has room for. */
  room: number;
  /** The photos the moment's slots hold now — one of these cannot be picked again. */
  here: readonly string[];
  onBack: () => void;
  onAdd: (refs: readonly string[]) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const event = offer.state === 'have' ? (offer.events.find((e) => e.eventId === open) ?? null) : null;
  const back = () => {
    if (!event) return onBack();
    setOpen(null);
    setTicked([]);
  };
  return (
    <div data-moment-pick={event ? 'photos' : 'events'}>
      <div className="flex items-center gap-1 pb-1">
        {/* BUTTON-RULE */}
        <button type="button" data-moment-pick-back="" onClick={back} className="sn-press -ml-1.5 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full pl-1 pr-2.5 text-[13.5px] font-semibold text-ink">
          <ChevronLeft aria-hidden className="h-[18px] w-[18px] text-sn-accent" strokeWidth={2} />
          {event ? 'Our events' : 'Photos'}
        </button>
        <p className="min-w-0 flex-1 truncate pr-1 text-right text-[13px] font-semibold text-ink/70">{event ? event.name : 'Pick from our events'}</p>
      </div>
      {event ? (
        <>
          <p role="status" data-moment-pick-room="" className="pb-2 text-center text-[12.5px] font-semibold text-ink/70">
            {ticked.length
              ? `${formatCount(ticked.length)} of ${formatCount(room)} picked.`
              : `Tap up to ${formatCount(room)} ${room === 1 ? 'photo' : 'photos'} — the room this moment has.`}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {event.photos.map((ph, i) => {
              const held = here.includes(ph.ref);
              const on = ticked.includes(ph.ref);
              return (
                <li key={ph.ref}>
                  {/* BUTTON-RULE */}
                  <button
                    type="button"
                    data-moment-pick-photo={ph.ref}
                    aria-pressed={on}
                    disabled={held || (!on && ticked.length >= room)}
                    aria-label={held ? `Photo ${formatCount(i + 1)} — already in this moment` : `Photo ${formatCount(i + 1)} from ${event.name}`}
                    onClick={() => setTicked((t) => tickedPhotos(t, ph.ref, room))}
                    className={`sn-press relative block aspect-square w-full overflow-hidden rounded-xl bg-ink/10 disabled:opacity-40 ${on ? 'ring-2 ring-sn-accent ring-offset-2 ring-offset-white' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="h-full w-full object-cover" />
                    {on ? (
                      <span aria-hidden data-moment-pick-tick="" className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full ${PILL_ON_CLASS}`}>
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                    {held ? <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-[10px] font-medium text-cream">Already here</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* BUTTON-RULE */}
          <button
            type="button"
            data-moment-pick-add=""
            disabled={ticked.length === 0}
            onClick={() => onAdd(ticked)}
            className={`sn-press mt-3 flex min-h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold disabled:cursor-default disabled:opacity-50 ${PILL_ON_CLASS}`}
          >
            {ticked.length ? `Add ${formatCount(ticked.length)} ${ticked.length === 1 ? 'photo' : 'photos'}` : 'Add photos'}
          </button>
        </>
      ) : offer.state === 'have' ? (
        offer.events.length === 0 ? (
          <p data-moment-pick-none="" className="px-2 py-6 text-center text-[13.5px] text-ink/70">
            You have no other events yet.
          </p>
        ) : (
          <ul data-moment-pick-list="" className="flex flex-col pb-1">
            {offer.events.map((e) => {
              const can = e.hosted && e.photos.length > 0;
              const lends = !e.hosted ? 'Someone else’s event' : e.photos.length === 0 ? 'No photos yet' : `${formatCount(e.photos.length)} ${e.photos.length === 1 ? 'photo' : 'photos'}`;
              const words = (
                <span className="min-w-0">
                  <span className={`block truncate text-[14.5px] font-semibold ${can ? 'text-ink' : 'text-ink/55'}`}>{e.name}</span>
                  <span className="block truncate text-[12.5px] text-ink/55">{[eventDayWords(e.date), lends].filter(Boolean).join(' · ')}</span>
                </span>
              );
              return (
                <li key={e.eventId} className="contents">
                  {can ? (
                    /* BUTTON-RULE */
                    <button type="button" data-moment-pick-event={e.eventId} onClick={() => setOpen(e.eventId)} className={`sn-press ${PICK_ROW}`}>
                      {words}
                      <ChevronRight aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
                    </button>
                  ) : (
                    <div data-moment-pick-event-closed={e.eventId} className={PICK_ROW}>
                      {words}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : offer.state === 'failed' ? (
        <div role="alert" data-moment-pick-failed="" className="flex flex-col items-center gap-2 px-2 py-5 text-center">
          <p className="text-[13.5px] font-semibold text-danger-700">We could not look up your other events.</p>
          {/* BUTTON-RULE */}
          <button type="button" data-moment-pick-retry="" onClick={onAsk} className="sn-press inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold text-ink ring-1 ring-inset ring-ink/20">
            Try again
          </button>
        </div>
      ) : (
        <div role="status" aria-busy="true" aria-label="Looking up your other events" data-moment-pick-loading="" className="flex animate-pulse flex-col motion-reduce:animate-none">
          {[0, 1].map((i) => (
            <div key={i} aria-hidden className={PICK_ROW}>
              <span className="flex flex-col gap-1.5">
                <span className={`h-3.5 rounded-full bg-ink/10 ${i ? 'w-32' : 'w-40'}`} />
                <span className="h-2.5 w-24 rounded-full bg-ink/10" />
              </span>
            </div>
          ))}
        </div>
      )}
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
  photoFrom,
  sheet,
  add,
}: {
  /** The moment action (the server's, or the Maker's instant one) — add · edit · delete · ONE `intent=order` per move. */
  action: Action;
  /** The story as guests read it (`sortMoments`). */
  moments: readonly ChapteredMoment[];
  mediaUrls: Readonly<Record<string, string>>;
  /** Photos that were picked from another event: ref → that event's name ('' when it could not be read). */
  photoFrom?: Readonly<Record<string, string>>;
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
  /* 🔎 THE PAIR'S OTHER EVENTS — asked ONCE, by the first "Pick from our events" opened on this page (never by
     opening Love Story), then shared by every moment's slots. A refusal can be tried again; nothing asks by itself. */
  const [offer, setOffer] = useState<EventsOffer>({ state: 'idle' });
  const asking = useRef(false);
  const askOffer = () => {
    if (asking.current || offer.state === 'have') return;
    asking.current = true;
    setOffer({ state: 'asking' });
    void askOurEvents(action).then((events) => {
      asking.current = false;
      setOffer(events ? { state: 'have', events } : { state: 'failed' });
    });
  };

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
              photoFrom={photoFrom}
              offer={offer}
              onAskOffer={askOffer}
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
                <TickerPill data="when" text={whenWords(fresh.when)} ariaLabel={`When: ${whenWords(fresh.when, true)}`} title="When" sheet={pickSheet} widest={MOMENT_WHEN_WIDEST} className="min-w-[72px]">
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
