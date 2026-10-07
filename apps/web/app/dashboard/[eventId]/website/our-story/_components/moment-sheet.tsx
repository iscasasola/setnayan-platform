'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import {
  LOVE_STORY_CHAPTER_LABEL,
  MOMENT_MEDIA_MAX,
  MOMENT_TITLE_MAX,
  chapterOf,
  formatMomentDate,
  isMomentAnchor,
  readMomentDate,
  type LoveStoryChapter,
  type LoveStoryMoment,
  type MomentAnchor,
} from '@/lib/love-story-moments';
import { LOVE_STORY_OPEN_EVENT, takeQueuedOpen, type LoveStoryOpenAsk } from './love-story-open';
import { LoveStoryProLine } from './love-story-pro-line';
import { HubDraftField } from '../../_components/hub-draft-field';
import { useMaker } from '../../../launch/_components/maker-context';
import { InMakerReturnTo } from './in-maker-return-to';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '../../editor/_components/pick-menu';

/**
 * A moment the Maker's instant scrapbook could not keep (`love-story-live.tsx`
 * throws it) — its message is said on the sheet, which stays open. Declared
 * HERE, not beside the rule that raises it: this sheet is in the Maker's first
 * load, and the rule is not (it loads with Details).
 */
export class MomentNotKept extends Error {}

/**
 * ADD A MOMENT — the sheet (phone) / side panel (laptop) from the prototype
 * (`our_love_story_scrapbook_2026-09-25.html` → "Add to our love story").
 *
 * Every field but the year and the line is optional — "gentle prompts, never
 * required fields" (DECISION_LOG 2026-09-25). "Will sit in" answers live, from
 * the SAME `chapterOf` the server and the guest page use, so the chapter a
 * couple is shown is the chapter the moment lands in.
 *
 * Photos are Pro. A free couple sees the drop zone as the one Pro line, and the
 * server refuses any photo ref they post anyway (`loveStoryMomentAction`).
 * ⏭ Phase 4 owns the upload pipeline (compress-first, the 100 MB meter); this
 * mounts the shared `FileUpload`, which picks that up when it lands.
 */
type Precision = 'day' | 'month' | 'year';

/** Where a moment of this chapter must be dated — said only when the date puts it elsewhere. */
const CHAPTER_RULE: Record<LoveStoryChapter, string> = {
  before: 'Before us holds moments dated before How we met.',
  met: 'How we met holds the one moment marked How we met.',
  together: 'Together holds the one moment marked Together.',
  falling: 'Falling holds moments dated between How we met and The yes.',
  yes: 'The yes holds the one moment marked The yes.',
  toward: 'Toward the day holds moments dated after The yes.',
};

/** How exact a date is — ONE dropdown in the Studio, the shipped pill row elsewhere. */
const PRECISIONS = [
  ['day', 'Exact day'],
  ['month', 'Month'],
  ['year', 'Just a year'],
] as const;

/** "This one is…" — a plain moment, or one of the three chapter anchors. */
const ANCHORS = [
  ['', 'A moment'],
  ['met', 'How we met'],
  ['together', 'Together'],
  ['yes', 'The yes'],
] as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MomentSheet({
  action,
  moments,
  moment = null,
  partners,
  ownsPro,
  storeShell,
  proHref,
  proPrice,
  eventId,
  mediaUrls = {},
  trigger,
  triggerClassName,
  opensFor,
}: {
  /** Throws = the moment was NOT kept; its message says why (the Maker's instant scrapbook, `love-story-live.tsx`). */
  action: (formData: FormData) => void | Promise<void>;
  /** The whole list, for the live "Will sit in". */
  moments: readonly LoveStoryMoment[];
  /** Editing this one; null = adding. */
  moment?: LoveStoryMoment | null;
  partners: readonly string[];
  ownsPro: boolean;
  storeShell: boolean;
  proHref: string;
  proPrice: string | null;
  eventId: string;
  mediaUrls?: Readonly<Record<string, string>>;
  trigger: React.ReactNode;
  triggerClassName: string;
  /**
   * The Maker's Love Story panel may ask this sheet to open (`love-story-open.ts`):
   * a moment's id for its Edit sheet, `add` for the page's one add sheet. Only
   * ONE sheet per target may carry it — the ask is answered by whoever hears it.
   */
  opensFor?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /* The portal leaves the page's `--ls-*` theme properties behind; carry them. */
  const [vars, setVars] = useState<Record<string, string>>({});
  const openSheet = () => {
    const el = triggerRef.current;
    if (el) {
      const cs = getComputedStyle(el);
      const next: Record<string, string> = {};
      for (const k of ['canvas', 'surface', 'ink', 'muted', 'heading', 'accent', 'accent-ink', 'rule']) {
        const v = cs.getPropertyValue(`--ls-${k}`).trim();
        if (v) next[`--ls-${k}`] = v;
      }
      setVars(next);
    }
    setOpen(true);
  };
  /* Inside the Maker the moment opens IN PLACE (no sheet, no trap). */
  const maker = useMaker();
  const inMaker = maker !== null;
  /* 🧭 STUDIO › LOVE STORY (owner 2026-10-08, studio round 3): the new Maker's add form is the
     APP's — white, ink, standard inputs, each set of choices ONE dropdown, ✕ Not now · ✓ Keep this
     moment in the thumb zone — on the Schedule's add-a-moment sheet (`day-sheets.tsx`), never the
     event's palette (its placeholders were invisible) and never under the Studio's sticky bar. */
  const studio = maker?.stagesStudio === true;
  useModalA11y({ open: open && !inMaker, onClose: () => setOpen(false), containerRef: ref });
  const [addedBy, setAddedBy] = useState(moment?.added_by ?? partners[0] ?? '');
  /* ⚡ In the Maker a kept moment is on the page at the tap (`love-story-live.tsx`):
     the sheet closes; a moment that could not be kept says why and stays open. */
  const [refused, setRefused] = useState<string | null>(null);
  const keep = async (formData: FormData) => {
    setRefused(null);
    try {
      await action(formData);
    } catch (e) {
      /* A server action's redirect is not a refusal — let it through. */
      if (!(e instanceof MomentNotKept)) throw e;
      setRefused(e.message);
      return;
    }
    if (!inMaker) return;
    setOpen(false);
    /* The one "Add a moment" sheet opens empty next time. */
    if (!moment) {
      setYear('');
      setMonth('');
      setDay('');
      setAnchor('');
    }
  };

  const d = moment?.date;
  const [precision, setPrecision] = useState<Precision>(d?.d ? 'day' : d?.m ? 'month' : 'year');
  const [year, setYear] = useState(d ? String(d.y) : '');
  const [month, setMonth] = useState(d?.m ? String(d.m) : '');
  const [day, setDay] = useState(d?.d ? String(d.d) : '');
  const [anchor, setAnchor] = useState<MomentAnchor | ''>(moment?.anchor ?? '');
  /* The chapter the panel's "Add a moment" was pressed under — null otherwise. */
  const [target, setTarget] = useState<LoveStoryChapter | null>(null);

  /* 🧭 THE PANEL ASKS, THIS SHEET OPENS — never a second editor. */
  const openRef = useRef(openSheet);
  openRef.current = openSheet;
  useEffect(() => {
    if (!opensFor) return;
    const answer = (ask: LoveStoryOpenAsk) => {
      if (ask.chapter) {
        // The three anchors ARE their chapters; the other three follow the date.
        setTarget(ask.chapter);
        setAnchor(isMomentAnchor(ask.chapter) ? ask.chapter : '');
      }
      openRef.current();
      window.requestAnimationFrame(() =>
        triggerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      );
    };
    const queuedAsk = takeQueuedOpen(opensFor);
    if (queuedAsk) answer(queuedAsk);
    const onAsk = (e: Event) => {
      const ask = (e as CustomEvent<LoveStoryOpenAsk>).detail;
      if (!ask || ask.target !== opensFor) return;
      e.preventDefault();
      answer(ask);
    };
    window.addEventListener(LOVE_STORY_OPEN_EVENT, onAsk);
    return () => window.removeEventListener(LOVE_STORY_OPEN_EVENT, onAsk);
  }, [opensFor]);

  const sitsIn = useMemo(() => {
    const date = readMomentDate({
      y: year,
      m: precision === 'year' ? undefined : month,
      d: precision === 'day' ? day : undefined,
    });
    if (!date) return null;
    const draft: LoveStoryMoment = {
      id: moment?.id ?? '__draft',
      date,
      line: 'x',
      ...(anchor ? { anchor } : {}),
      canvas: {},
    };
    const rest = moments.filter((m) => m.id !== draft.id).map((m) =>
      anchor && m.anchor === anchor ? { ...m, anchor: undefined } : m,
    );
    const chapter = chapterOf(draft, [...rest, draft]);
    return { label: `${formatMomentDate(date)} · ${LOVE_STORY_CHAPTER_LABEL[chapter]}`, chapter };
  }, [year, month, day, precision, anchor, moment, moments]);

  const field = studio
    ? 'mt-1.5 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-[15px] text-ink placeholder:text-ink/45 focus:border-ink/40 focus:outline-none'
    : 'mt-1.5 w-full rounded-md border border-[color:var(--ls-rule)] bg-[color:var(--ls-surface)] px-3 py-2 text-[15px] text-[color:var(--ls-ink)] focus:border-[color:var(--ls-accent)] focus:outline-none';
  const eye = studio
    ? 'text-[10px] font-bold uppercase tracking-[0.16em] text-ink/55'
    : 'font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[color:var(--ls-muted)]';
  const quiet = studio ? 'text-ink/60' : 'text-[color:var(--ls-muted)]';
  const serif = studio ? '' : 'font-pahina';

  const body = (
    <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={eye}>A moment</p>
                {studio ? (
                  <h3 id="moment-sheet-title" className="mt-1 font-display text-[22px] leading-tight text-ink">
                    {moment ? 'Edit this moment' : 'Add to our love story'}
                  </h3>
                ) : (
                  <h3 id="moment-sheet-title" className="mt-1 font-pahina text-2xl font-light">
                    {moment ? 'Edit this ' : 'Add to '}
                    <i className="text-[color:var(--ls-heading)]">{moment ? 'moment' : 'our love story'}</i>
                  </h3>
                )}
              </div>
              {/* The Studio's sheet draws its own ✕ (the shared `Sheet`). */}
              {studio ? null : (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--ls-muted)] hover:bg-black/5"
                >
                  <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </button>
              )}
            </div>

            <form action={keep} className={studio ? 'mt-4 space-y-5' : 'mt-5 space-y-6'}>
              <HubDraftField />
              <InMakerReturnTo />
              <input type="hidden" name="intent" value={moment ? 'edit' : 'add'} />
              {moment ? <input type="hidden" name="id" value={moment.id} /> : null}

              {/* Photos — Pro */}
              <div>
                {ownsPro ? (
                  <FileUpload
                    bucket="media"
                    pathPrefix={`events/${eventId}/love-story`}
                    name="media"
                    unsavedHint="press Keep this moment below"
                    multiple
                    maxFiles={MOMENT_MEDIA_MAX}
                    maxSizeMB={10}
                    acceptedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
                    currentValue={moment?.media ?? []}
                    initialDisplayUrls={mediaUrls}
                    variant="wide"
                    label="Photos"
                    help="Up to four photos. Words, dates and places are always free — a moment with no picture still counts."
                  />
                ) : (
                  <div className="py-1">
                    <p className={eye}>Photos</p>
                    <LoveStoryProLine storeShell={storeShell} href={proHref} price={proPrice} />
                  </div>
                )}
              </div>

              {/* When */}
              <fieldset>
                <legend className={eye}>When</legend>
                <p className={`mt-1 text-[13px] ${quiet}`}>
                  Only as exact as you remember. A year on its own is enough.
                </p>
                {studio ? (
                  <div className="mt-2">
                    <PickMenu
                      label="How exact"
                      value={precision}
                      dataAttr="data-moment-when"
                      options={PRECISIONS.map(([key, label]) => ({ key, label }))}
                      onPick={(k) => setPrecision(k as Precision)}
                      className="ring-1 ring-ink/15"
                    />
                  </div>
                ) : (
                <div role="radiogroup" aria-label="How exact" className="mt-2 flex gap-1.5">
                  {PRECISIONS.map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={precision === k}
                      onClick={() => setPrecision(k)}
                      className={
                        precision === k
                          ? 'rounded-full bg-[color:var(--ls-accent)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--ls-accent-ink)]'
                          : 'rounded-full px-3 py-1.5 text-[13px] text-[color:var(--ls-muted)] ring-1 ring-inset ring-[color:var(--ls-rule)]'
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                )}
                <div className="mt-3 flex gap-2">
                  {precision === 'day' ? (
                    <label className="w-20">
                      <span className="sr-only">Day</span>
                      <input
                        name="date_d"
                        inputMode="numeric"
                        placeholder="Day"
                        value={day}
                        onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        className={field}
                      />
                    </label>
                  ) : null}
                  {precision !== 'year' ? (
                    <label className="flex-1">
                      <span className="sr-only">Month</span>
                      <select name="date_m" value={month} onChange={(e) => setMonth(e.target.value)} className={field}>
                        <option value="">Month</option>
                        {MONTHS.map((m, i) => (
                          <option key={m} value={String(i + 1)}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="w-28">
                    <span className="sr-only">Year</span>
                    <input
                      name="date_y"
                      required
                      inputMode="numeric"
                      placeholder="Year"
                      value={year}
                      onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className={field}
                    />
                  </label>
                </div>
              </fieldset>

              {/* 📖 The title (owner 2026-10-07, "THE MISSING FIELDS ARE APPROVED") */}
              <label className="block" data-moment-title="">
                <span className={eye}>Title · optional</span>
                <input
                  name="title"
                  maxLength={MOMENT_TITLE_MAX}
                  defaultValue={moment?.title ?? ''}
                  placeholder="The first date"
                  className={`${field} ${serif} ${studio ? '' : 'text-lg'}`}
                />
              </label>

              {/* The line */}
              <label className="block">
                <span className={eye}>A line or two</span>
                <textarea
                  name="line"
                  required
                  rows={3}
                  maxLength={600}
                  defaultValue={moment?.line ?? ''}
                  placeholder="What happened, in your words…"
                  className={`${field} ${serif} ${studio ? '' : 'text-lg'} leading-snug`}
                />
              </label>

              {/* Where */}
              <label className="block">
                <span className={eye}>Where · optional</span>
                <input
                  name="place"
                  maxLength={80}
                  defaultValue={moment?.place ?? ''}
                  placeholder="A town, a café, a road"
                  className={field}
                />
              </label>

              {/* Added by */}
              {partners.length > 0 && studio ? (
                <div data-moment-added-by="">
                  <p className={eye}>Added by</p>
                  <input type="hidden" name="added_by" value={addedBy} />
                  <div className="mt-2">
                    <PickMenu
                      label="Added by"
                      value={addedBy}
                      dataAttr="data-moment-added-by-pick"
                      options={partners.map((name) => ({ key: name, label: name }))}
                      onPick={setAddedBy}
                      className="ring-1 ring-ink/15"
                    />
                  </div>
                </div>
              ) : partners.length > 0 ? (
                <fieldset>
                  <legend className={eye}>Added by</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {partners.map((name, i) => (
                      <label
                        key={name}
                        className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[14px] ring-1 ring-inset ring-[color:var(--ls-rule)] has-[:checked]:bg-[color:var(--ls-surface)] has-[:checked]:ring-[color:var(--ls-accent)]"
                      >
                        <input
                          type="radio"
                          name="added_by"
                          value={name}
                          defaultChecked={moment ? moment.added_by === name : i === 0}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className="grid h-6 w-6 place-items-center rounded-full bg-[color:var(--ls-accent)] text-[11px] font-semibold text-[color:var(--ls-accent-ink)]"
                        >
                          {name.charAt(0).toUpperCase()}
                        </span>
                        {name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {/* This one is… */}
              <fieldset>
                <legend className={eye}>This one is…</legend>
                <p className={`mt-1 text-[13px] ${quiet}`}>
                  Three moments anchor the chapters: how you met, when you became a couple and the yes. Everything else finds its chapter from its date.
                </p>
                {studio ? (
                  <div className="mt-2">
                    <input type="hidden" name="anchor" value={anchor} />
                    <PickMenu
                      label="This one is"
                      value={anchor || 'moment'}
                      dataAttr="data-moment-anchor"
                      options={ANCHORS.map(([k, label]) => ({ key: k || 'moment', label }))}
                      onPick={(k) => setAnchor(k === 'moment' ? '' : (k as MomentAnchor))}
                      className="ring-1 ring-ink/15"
                    />
                  </div>
                ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ANCHORS.map(([k, label]) => (
                    <label
                      key={k || 'none'}
                      className="inline-flex min-h-10 cursor-pointer items-center rounded-full px-3 text-[14px] ring-1 ring-inset ring-[color:var(--ls-rule)] has-[:checked]:bg-[color:var(--ls-accent)] has-[:checked]:text-[color:var(--ls-accent-ink)] has-[:checked]:ring-[color:var(--ls-accent)]"
                    >
                      <input
                        type="radio"
                        name="anchor"
                        value={k}
                        checked={anchor === k}
                        onChange={() => setAnchor(k)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                )}
              </fieldset>

              {moment ? (
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" name="hidden" defaultChecked={moment.hidden === true} />
                  Keep this one off the Event Hub
                </label>
              ) : null}

              <div aria-live="polite" className={`border-t pt-4 ${studio ? 'border-ink/10' : 'border-[color:var(--ls-rule)]'}`}>
                <p className={eye}>Will sit in</p>
                <p className={studio ? 'mt-1 text-[16px] font-semibold text-ink' : 'mt-1 font-pahina text-xl'}>{sitsIn?.label ?? 'Add a year to find its place'}</p>
                {target && sitsIn && sitsIn.chapter !== target ? (
                  <p data-moment-chapter-rule={target} className={`mt-1 text-[13px] ${quiet}`}>
                    {CHAPTER_RULE[target]}
                  </p>
                ) : null}
              </div>

              {refused ? (
                <p role="alert" className="text-[14px] text-terracotta-700">
                  {refused}
                </p>
              ) : null}
              {studio ? (
                /* 👍 The thumb zone — pinned to the foot of the sheet, as the Schedule's add sheet (BUTTON-RULE:
                   icon + word, grey backs out, green keeps — until the shared ActionButton lands). */
                <div data-moment-sheet-foot="" className="sn-glass-row sticky bottom-0 -mx-5 flex justify-end gap-2 px-5 py-3">
                  <button
                    type="button"
                    data-moment-not-now=""
                    onClick={() => setOpen(false)}
                    className="sn-press inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15"
                  >
                    <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                    Not now
                  </button>
                  <SubmitButton
                    pendingLabel="Keeping…"
                    className="sn-press inline-flex h-11 items-center gap-1.5 rounded-full bg-success-700 px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                    Keep this moment
                  </SubmitButton>
                </div>
              ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-10 items-center rounded-full px-4 text-[14px] text-[color:var(--ls-muted)] hover:bg-black/5"
                >
                  Not now
                </button>
                <SubmitButton pendingLabel="Keeping…" className="button-primary">
                  Keep this moment
                </SubmitButton>
              </div>
              )}
            </form>
    </>
  );

  return (
    <div className={inMaker && open && !studio ? 'w-full basis-full' : 'contents'}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={inMaker && !studio ? open : undefined}
        className={triggerClassName}
        onClick={
          inMaker && open && !studio
            ? () => setOpen(false)
            : () => {
                // Opened by its own button: no chapter was asked for.
                if (target) {
                  setTarget(null);
                  setAnchor(moment?.anchor ?? '');
                }
                openSheet();
              }
        }
      >
        {trigger}
      </button>
      {open && studio && typeof document !== 'undefined' ? createPortal(
        /* 🧭 The Studio: the Schedule's sheet (`Sheet`, rise), portalled to <body> and lifted above the
           Maker's sticky bars, so the form starts below them and nothing overlaps its top. */
        <div data-moment-studio-sheet="" className="relative z-[90]">
          <Sheet open onClose={() => setOpen(false)} labelledById="moment-sheet-title" wide rise>
            <div className="px-5 pt-5">{body}</div>
          </Sheet>
        </div>,
        document.body,
      ) : open && inMaker ? (
        /* 🖼 IN PLACE inside the Event Hub Maker (owner 2026-09-25: "Love story,
           add and create your story" — the made-once pages never pop up): the
           moment opens right here, in the page, and the page keeps its theme. */
        <div
          data-moment-in-place=""
          aria-labelledby="moment-sheet-title"
          role="group"
          className="mt-3 w-full basis-full rounded-md bg-[color:var(--ls-canvas)] px-4 pb-6 pt-4 text-left text-[color:var(--ls-ink)] shadow-md ring-1 ring-inset ring-[color:var(--ls-rule)]"
        >
            {body}
        </div>
      ) : open && typeof document !== 'undefined' ? createPortal(
        /* Portalled to <body>: the dashboard's content column is its own
           stacking context, and a fixed sheet inside it slid UNDER the top bar
           (measured in the harness, 2026-09-25). */
        <div
          style={vars as React.CSSProperties}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 lg:items-stretch lg:justify-end"
        >
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="moment-sheet-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[color:var(--ls-canvas)] px-5 pb-8 pt-5 text-[color:var(--ls-ink)] shadow-2xl lg:max-h-none lg:w-[440px] lg:rounded-none lg:px-7"
          >
            {body}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

/** The phone dock / laptop FAB label, so both mounts read the same words. */
export function AddMomentLabel() {
  return (
    <>
      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add a moment
    </>
  );
}
