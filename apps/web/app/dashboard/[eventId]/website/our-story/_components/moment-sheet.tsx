'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import {
  LOVE_STORY_CHAPTER_LABEL,
  MOMENT_MEDIA_MAX,
  chapterOf,
  formatMomentDate,
  readMomentDate,
  type LoveStoryMoment,
  type MomentAnchor,
} from '@/lib/love-story-moments';
import { LoveStoryProLine } from './love-story-pro-line';
import { HubDraftField } from '../../_components/hub-draft-field';

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
}: {
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
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: ref });

  const d = moment?.date;
  const [precision, setPrecision] = useState<Precision>(d?.d ? 'day' : d?.m ? 'month' : 'year');
  const [year, setYear] = useState(d ? String(d.y) : '');
  const [month, setMonth] = useState(d?.m ? String(d.m) : '');
  const [day, setDay] = useState(d?.d ? String(d.d) : '');
  const [anchor, setAnchor] = useState<MomentAnchor | ''>(moment?.anchor ?? '');

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
    return `${formatMomentDate(date)} · ${LOVE_STORY_CHAPTER_LABEL[chapterOf(draft, [...rest, draft])]}`;
  }, [year, month, day, precision, anchor, moment, moments]);

  const field =
    'mt-1.5 w-full rounded-md border border-[color:var(--ls-rule)] bg-[color:var(--ls-surface)] px-3 py-2 text-[15px] text-[color:var(--ls-ink)] focus:border-[color:var(--ls-accent)] focus:outline-none';
  const eye = 'font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[color:var(--ls-muted)]';

  return (
    <>
      <button ref={triggerRef} type="button" className={triggerClassName} onClick={openSheet}>
        {trigger}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={eye}>A moment</p>
                <h3 id="moment-sheet-title" className="mt-1 font-pahina text-2xl font-light">
                  {moment ? 'Edit this ' : 'Add to '}
                  <i className="text-[color:var(--ls-heading)]">{moment ? 'moment' : 'our love story'}</i>
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-[color:var(--ls-muted)] hover:bg-black/5"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            <form action={action} className="mt-5 space-y-6">
              <HubDraftField />
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
                <p className="mt-1 text-[13px] text-[color:var(--ls-muted)]">
                  Only as exact as you remember. A year on its own is enough.
                </p>
                <div role="radiogroup" aria-label="How exact" className="mt-2 flex gap-1.5">
                  {(
                    [
                      ['day', 'Exact day'],
                      ['month', 'Month'],
                      ['year', 'Just a year'],
                    ] as const
                  ).map(([k, label]) => (
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
                  className={`${field} font-pahina text-lg leading-snug`}
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
              {partners.length > 0 ? (
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
                <p className="mt-1 text-[13px] text-[color:var(--ls-muted)]">
                  Two moments anchor the chapters: how you met and the yes. Everything else finds its chapter from its date.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ['', 'A moment'],
                      ['met', 'How we met'],
                      ['yes', 'The yes'],
                    ] as const
                  ).map(([k, label]) => (
                    <label
                      key={k || 'none'}
                      className="cursor-pointer rounded-full px-3 py-1.5 text-[14px] ring-1 ring-inset ring-[color:var(--ls-rule)] has-[:checked]:bg-[color:var(--ls-accent)] has-[:checked]:text-[color:var(--ls-accent-ink)] has-[:checked]:ring-[color:var(--ls-accent)]"
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
              </fieldset>

              {moment ? (
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" name="hidden" defaultChecked={moment.hidden === true} />
                  Keep this one off the Event Hub
                </label>
              ) : null}

              <div aria-live="polite" className="border-t border-[color:var(--ls-rule)] pt-4">
                <p className={eye}>Will sit in</p>
                <p className="mt-1 font-pahina text-xl">{sitsIn ?? 'Add a year to find its place'}</p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-4 py-2 text-[14px] text-[color:var(--ls-muted)] hover:bg-black/5"
                >
                  Not now
                </button>
                <SubmitButton pendingLabel="Keeping…" className="button-primary">
                  Keep this moment
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
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
