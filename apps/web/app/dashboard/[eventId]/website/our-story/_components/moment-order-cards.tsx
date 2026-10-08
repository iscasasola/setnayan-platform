'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { LOVE_STORY_CHAPTER_LABEL, MOMENT_LINE_MAX, MOMENT_TITLE_MAX, type ChapteredMoment, type LoveStoryMoment, type MomentAnchor } from '@/lib/love-story-moments';
import { STUDIO_FOOT_BUTTON } from '@/lib/studio-skin';
import { MomentNotKept, type MomentSheet } from './moment-sheet';
/* 🧭 The Studio's own add/edit sheet (owner 2026-10-08) — rides this lazy chunk, never the first load. */
import { MomentSheetStudio } from './moment-sheet-studio';

/**
 * ✋ STUDIO › LOVE STORY — ONE CARD PER MOMENT (owner 2026-10-06 DECISION_LOG
 * "STUDIO › SCHEDULE AND LOVE STORY": *"one card per moment — photo · year · title
 * · first line · grip"*; the couple's own order approved 2026-10-07, "THE MISSING
 * FIELDS ARE APPROVED"; redrawn to the prototype 2026-10-07, *"1. okay"* · *"2.
 * bands? full width"*, DECISION_LOG "STUDIO REDRAW ANSWERS").
 *
 * Prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `EDITORS.story`: each moment a row — photo · year · title · first line · grip;
 * TAP IT and it opens IN PLACE (Year · Title · the words · Change photo · Remove);
 * + Add a moment at the foot. On full-width white BANDS with hairlines — the
 * prototype's rows and words, never its rounded cards (owner: *"bands? full width"*).
 *
 * 🔑 NO NEW WRITE. Every change is a moment form through the moment action's own
 * intents (`applyMomentIntent`): `edit` (every field the moment holds is carried,
 * so an edit of the year never drops its place or photos), `delete`, and `order` —
 * a drag of the grip (finger or mouse) moves the card as it goes; letting go sends
 * ONE `intent=order` with every id, first to last, into the DRAFT like every
 * other moment edit; guests see it at Apply. The grip answers ↑ / ↓ too. Change
 * photo and + Add a moment open the shipped `MomentSheet` (photos are screened by
 * the server — `momentNeedsServer`).
 *
 * Drawn only in the new Maker's Studio (`makerStagesStudioEnabled` →
 * `LoveStoryBook studio`). Nothing is written by opening it.
 */

/** What `MomentSheet` needs besides its moment — the book's own `sheetProps`. */
export type MomentSheetBase = Omit<React.ComponentProps<typeof MomentSheet>, 'moment' | 'trigger' | 'triggerClassName' | 'opensFor'>;

/** Every field a moment holds, as the moment form carries it — an edit of one keeps the rest. */
export function momentEditForm(m: LoveStoryMoment, change: { y?: string; title?: string; line?: string }): FormData {
  const fd = new FormData();
  fd.set('intent', 'edit');
  fd.set('id', m.id);
  fd.set('date_y', change.y ?? (m.date?.y ? String(m.date.y) : ''));
  if (m.date?.m) fd.set('date_m', String(m.date.m));
  if (m.date?.d) fd.set('date_d', String(m.date.d));
  fd.set('title', change.title ?? m.title ?? '');
  fd.set('line', change.line ?? m.line);
  if (m.place) fd.set('place', m.place);
  for (const ref of m.media ?? []) fd.append('media', ref);
  if (m.added_by) fd.set('added_by', m.added_by);
  if (m.anchor) fd.set('anchor', m.anchor);
  if (m.hidden) fd.set('hidden', 'on');
  return fd;
}

function OpenMoment({
  m,
  action,
  sheet,
}: {
  m: ChapteredMoment;
  action: (formData: FormData) => void | Promise<void>;
  sheet: MomentSheetBase;
}) {
  const [y, setY] = useState(m.date?.y ? String(m.date.y) : '');
  const [title, setTitle] = useState(m.title ?? '');
  const [line, setLine] = useState(m.line);
  const [error, setError] = useState<string | null>(null);
  /* A refusal (or a fresh story) puts the words back. */
  useEffect(() => setY(m.date?.y ? String(m.date.y) : ''), [m.date?.y]);
  useEffect(() => setTitle(m.title ?? ''), [m.title]);
  useEffect(() => setLine(m.line), [m.line]);
  const save = (change: { y?: string; title?: string; line?: string }) => {
    const same =
      (change.y === undefined || change.y.trim() === String(m.date?.y ?? '')) &&
      (change.title === undefined || change.title.trim() === (m.title ?? '')) &&
      (change.line === undefined || change.line.trim() === m.line);
    if (same) return;
    setError(null);
    Promise.resolve(action(momentEditForm(m, change))).catch((e: unknown) => {
      setError(e instanceof MomentNotKept ? e.message : 'That did not save. Nothing changed — please try again.');
      setY(m.date?.y ? String(m.date.y) : '');
      setTitle(m.title ?? '');
      setLine(m.line);
    });
  };
  const box = 'min-h-11 w-full rounded-md border border-ink/10 bg-[color-mix(in_srgb,rgb(var(--color-gild))_9%,rgb(var(--color-cream)))] px-3 text-[15px] text-ink outline-none focus:border-ink/30';
  return (
    <div data-studio-story-editor={m.id} className="flex flex-col gap-2 pb-3 pl-4 pr-4">
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <input
          value={y}
          inputMode="numeric"
          maxLength={4}
          aria-label="Year"
          placeholder="Year"
          onChange={(e) => setY(e.target.value.replace(/\D/g, ''))}
          onBlur={(e) => save({ y: e.target.value })}
          className={box}
        />
        <input
          value={title}
          maxLength={MOMENT_TITLE_MAX}
          aria-label="A title"
          placeholder="A title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={(e) => save({ title: e.target.value })}
          className={box}
        />
      </div>
      <textarea
        value={line}
        maxLength={MOMENT_LINE_MAX}
        aria-label="The words"
        rows={3}
        onChange={(e) => setLine(e.target.value)}
        onBlur={(e) => save({ line: e.target.value })}
        className={`${box} min-h-[76px] resize-none py-2.5 leading-snug`}
      />
      {error ? (
        <p role="alert" className="text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        {/* BUTTON-RULE */}
        <MomentSheetStudio
          {...sheet}
          moment={m}
          trigger="Change photo"
          triggerClassName="sn-press flex h-10 flex-1 items-center justify-center rounded-full bg-cream text-[13px] font-semibold text-ink ring-1 ring-ink/15"
        />
        {/* BUTTON-RULE */}
        <button
          type="button"
          data-studio-story-remove={m.id}
          onClick={() => {
            const fd = new FormData();
            fd.set('intent', 'delete');
            fd.set('id', m.id);
            void action(fd);
          }}
          className="sn-press flex h-10 shrink-0 items-center justify-center rounded-full bg-cream px-4 text-[13px] font-semibold text-danger-700 ring-1 ring-danger-300"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/* A moment's card — ONE set of boxes for a real moment and for the sample of one (`SampleStory`),
   so the sample cannot drift from the arrangement it stands for. */
const CARD_BAND = 'border-t border-ink/10 bg-cream';
const CARD_ROW = 'flex items-center gap-3 py-2.5 pl-4 pr-1';
const CARD_PHOTO = 'h-16 w-16 shrink-0 rounded-md';
const CARD_WORDS = 'flex min-w-0 flex-1 flex-col';
const CARD_GRIP = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/35';

/** The three chapters a story is anchored by — `MOMENT_ANCHORS`, spelled (its type holds it): the list itself is not
    read by anything the Maker loads first, and asking for it here would add it to that first load (507 KB). */
const SAMPLE_CHAPTERS = ['met', 'together', 'yes'] as const satisfies readonly MomentAnchor[];

/** The sample lines' widths — a year, a title, a first line — a little different on each card. */
const SAMPLE_LINES = [
  ['w-11', 'w-28', 'w-44'],
  ['w-11', 'w-20', 'w-36'],
  ['w-11', 'w-24', 'w-40'],
] as const;

/**
 * 🩶 AN EMPTY STORY SHOWS WHAT IT WILL LOOK LIKE (owner 2026-10-08 on the preview, of an event with
 * no moments: *"i cannot see it is blank"*; his standing rule for empty things, the same day:
 * *"maybe show what it could look like with boxes?"*). The approved prototype draws no empty state
 * (`EDITORS.story` maps the moments it has), so this is the shipped card itself — the same band,
 * photo box, three lines and grip (`CARD_*`) — in grey shapes, one under each of the three chapters
 * a story is anchored by (`SAMPLE_CHAPTERS`: How we met · Together · The yes, the real labels).
 *
 * Unmistakably a sample: shapes only (no name, no year, no words of a moment), `aria-hidden`, not
 * tappable — and drawn ONLY while there is no moment, so the first real one replaces it. Editor
 * only: these cards exist in the new Maker's Studio and nowhere a guest can open.
 */
function SampleStory() {
  return (
    <ol data-studio-story-sample="" aria-hidden className="pointer-events-none flex select-none flex-col border-b border-ink/10">
      {SAMPLE_CHAPTERS.map((chapter, i) => (
        <li key={chapter} data-studio-story-sample-card={chapter} className={CARD_BAND}>
          <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">{LOVE_STORY_CHAPTER_LABEL[chapter]}</p>
          <div className={CARD_ROW}>
            <span data-sample-shape="photo" className={`${CARD_PHOTO} bg-ink/10`} />
            <span className={CARD_WORDS}>
              <span data-sample-shape="year" className={`h-4 ${SAMPLE_LINES[i]![0]} rounded-sm bg-ink/15`} />
              <span data-sample-shape="title" className={`mt-2 h-3 ${SAMPLE_LINES[i]![1]} rounded-sm bg-ink/15`} />
              <span data-sample-shape="line" className={`mt-2 h-2.5 ${SAMPLE_LINES[i]![2]} max-w-full rounded-sm bg-ink/10`} />
            </span>
            <span className={`${CARD_GRIP} opacity-50`}>
              <GripVertical className="h-5 w-5" strokeWidth={1.75} />
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MomentOrderCards({
  action,
  moments,
  mediaUrls,
  sheet,
  add,
}: {
  /** The moment action (the server's, or the Maker's instant one) — edit · delete · ONE `intent=order` per drop that changed the order. */
  action: (formData: FormData) => void | Promise<void>;
  /** The story as guests read it (`sortMoments`). */
  moments: readonly ChapteredMoment[];
  mediaUrls: Readonly<Record<string, string>>;
  /** What the shipped `MomentSheet` needs (Change photo, + Add a moment). */
  sheet: MomentSheetBase;
  /** The foot: + Add a moment, or the free-stories line once they are told. */
  add: { can: true } | { can: false; line: ReactNode };
}) {
  const ids = moments.map((m) => m.id);
  const key = ids.join(',');
  const [order, setOrder] = useState<string[]>(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const start = useRef<string>(key);
  /* A save (or a refusal putting it back) re-draws from the story. */
  useEffect(() => {
    if (!dragging) setOrder(key ? key.split(',') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const byId = new Map(moments.map((m) => [m.id, m]));

  const finish = (next: string[]) => {
    setDragging(null);
    if (next.join(',') === start.current) return;
    /* Every id, first to last — the moment action's own `intent=order`. */
    const fd = new FormData();
    fd.set('intent', 'order');
    fd.set('order', next.join(','));
    void action(fd);
  };
  /** Which place the pointer is over, from the cards' own boxes. */
  const placeAt = (y: number): number => {
    const cards = [...(list.current?.querySelectorAll<HTMLElement>('[data-moment-card]') ?? [])];
    let i = 0;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (y > r.top + r.height / 2) i += 1;
    }
    return Math.min(i, cards.length - 1);
  };
  const moveTo = (id: string, to: number, from: readonly string[]) => {
    const rest = from.filter((x) => x !== id);
    rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id);
    return rest;
  };

  return (
    <section data-moment-order-cards="" aria-label="Your moments, in order" className="-mx-4 flex min-h-full flex-col text-ink sm:-mx-6">
      <div className="flex items-center px-4 pb-2 pt-3 text-[13px] text-ink/60">
        <InfoTip label={`${moments.length} ${moments.length === 1 ? 'moment' : 'moments'}`} align="center">
          Your story, one moment at a time — a photo, a year, a few lines. Tap one to change it; drag the grip to reorder.
        </InfoTip>
      </div>
      {moments.length ? (
        <ol ref={list} className="flex flex-col border-b border-ink/10">
          {order.map((id, i) => {
            const m = byId.get(id);
            if (!m) return null;
            const photo = (m.media ?? []).map((r) => mediaUrls[r]).find(Boolean) ?? null;
            const isOpen = open === id;
            return (
              <li
                key={id}
                data-moment-card={id}
                data-studio-story-card={isOpen ? 'open' : ''}
                className={`${CARD_BAND} ${dragging === id ? 'relative z-10 opacity-90 shadow-[0_10px_24px_-18px_rgba(30,26,18,.6)]' : ''}`}
              >
                <div className={CARD_ROW}>
                  <button
                    type="button"
                    data-studio-story-head={id}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className={`${CARD_PHOTO} object-cover`} />
                    ) : (
                      <span aria-hidden className={`${CARD_PHOTO} bg-[linear-gradient(135deg,rgb(var(--color-gild)/.35),rgb(var(--color-cream)))]`} />
                    )}
                    <span className={CARD_WORDS}>
                      <b className="font-serif text-[20px] font-medium leading-none text-gild">{m.date?.y ?? '—'}</b>
                      {m.title ? (
                        <em className="mt-0.5 truncate text-[14.5px] font-semibold not-italic text-ink">{m.title}</em>
                      ) : null}
                      {isOpen ? null : <small className="truncate text-[12.5px] text-ink/70">{m.line.split('\n')[0]}</small>}
                      {m.hidden ? <small className="text-[11px] text-ink/45">Off the Event Hub</small> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${m.title || 'this moment'} — drag, or use the arrow keys`}
                    data-moment-grip={id}
                    className={`${CARD_GRIP} cursor-grab touch-none active:cursor-grabbing`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      start.current = order.join(',');
                      setDragging(id);
                    }}
                    onPointerMove={(e) => {
                      if (dragging !== id) return;
                      const to = placeAt(e.clientY);
                      setOrder((o) => (o.indexOf(id) === to ? o : moveTo(id, to, o)));
                    }}
                    onPointerUp={() => dragging === id && finish(order)}
                    onPointerCancel={() => {
                      setDragging(null);
                      setOrder(start.current.split(','));
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                      e.preventDefault();
                      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
                      if (to < 0 || to >= order.length) return;
                      start.current = order.join(',');
                      const next = moveTo(id, to, order);
                      setOrder(next);
                      finish(next);
                    }}
                  >
                    <GripVertical aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </div>
                {isOpen ? <OpenMoment m={m} action={action} sheet={sheet} /> : null}
              </li>
            );
          })}
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
          <MomentSheetStudio
            {...sheet}
            opensFor="add"
            trigger={
              <span data-studio-add-moment="" className="contents">
                <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                Add a moment
              </span>
            }
            triggerClassName={STUDIO_FOOT_BUTTON}
          />
        ) : (
          <div data-love-story-cap="reached" className="px-1 py-1 text-[13px] text-ink/70">
            {add.line}
          </div>
        )}
      </div>
    </section>
  );
}
