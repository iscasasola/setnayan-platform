'use client';

/**
 * 📅 THE SCHEDULE PAGE — ONE LINE, ONE DATE LINE, THEN THE MOMENTS.
 *
 * 🧹 This was Suppliers › Booked › Schedule's frame (`booked-schedule-frame.tsx`, 2026-10-31). On 2026-11-02 the owner
 * ruled "BOOKED IS JUST THE TEAM" (*"no just schedule"*): the Booked WRAPPER went — the Suppliers shell, the
 * `?part=schedule` part — and the page is the Schedule's own, opened from Home. The one-line layout itself is the
 * approved design (frames 19 · 19b · 20) the owner was using on his iPhone, so it is the page's look now, renamed; the
 * old stacked header (seven rows before the first moment) stays only inside the Maker's Details.
 *
 * Owner 2026-10-31, live iPhone, verbatim: *"so many design error on schedule. the pop up. design template. how the
 * space is strategically used. so many upper space not used."* At rest the Schedule stacked SEVEN rows before its
 * first moment (the segmented Find | Build | Booked, `Schedule ▾ · 3 moments`, the couple's names and the date, "● You
 * can edit ⓘ", the Journey | Preparation | Event Day segmented, "ⓘ Announce", "+ Add to schedule", a tinted "fills in
 * automatically" band). The approved final Suppliers design (frames 19 · 19b · 20) draws, under the page's one row:
 *
 *   [Event Day ▾]  …the day's tools…  (🔊)      ONE line: the view (a dropdown) · Announce, a round on the right
 *   Friday 18 December 2026 · 50 days to go ⓘ   the date line — who can edit, the couple's names and what feeds the
 *                                               agenda are INSIDE the ⓘ (house rule: title + one short line visible)
 *   the moments, right there                    "+ Add a moment" / "+ Add a step" is the pill in the thumb zone
 *
 * The views are Event Day · Planning Stage. (Journey was a third until the owner removed it on 2026-11-01 — an old
 * `?view=journey` lands on Planning Stage, `lib/schedule-view.ts`.) Every view is drawn by the server ONCE, with the page's one read, and kept: a pick
 * swaps what is shown in place — no request, no render — and writes `?view=` so a reload and Back come back to it.
 * 🔒 lib/the-schedule-page-is-one-line.test.ts
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Tip } from './day-ui';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { ScheduleViewOnScreen } from './schedule-sheet';
import { useChapters } from './chapters-context';
import { Settings, X } from 'lucide-react';
import { lensWords } from '@/lib/schedule-view-as';
import { chapterStage } from '@/lib/schedule-chapters';
import { formatCount } from '@/lib/format-number';
import { DEFAULT_CHAPTERS_TELL, DEFAULT_CHAPTERS_TIP, defaultChaptersUnfilled } from '@/lib/schedule';

export type ScheduleLineView = 'event-day' | 'preparation';

import { SCHEDULE_TOOLS_SLOT } from './schedule-tools-slot';

export function ScheduleOneLine({
  initial,
  views,
  dateLine,
  info,
  notes,
  announce,
  share,
  meetings,
  panels,
}: {
  initial: ScheduleLineView;
  /** In the dropdown's order, each with its count (the open list's trailing number). */
  views: ReadonlyArray<{ key: ScheduleLineView; label: string; count: number }>;
  /** "Friday 18 December 2026 · 50 days to go" — the ⓘ's label. */
  dateLine: string;
  /** What the ⓘ always says: whose day, who can edit and why. */
  info: ReactNode;
  /** What the ⓘ adds for the view on screen. */
  notes: Partial<Record<ScheduleLineView, ReactNode>>;
  /** Announce, as its round — null when this person cannot announce. */
  announce: ReactNode | null;
  /** 📤 Share the schedule as a PDF (`SharePdfButton`) — on the date line, right; null when there is no file to give. */
  share?: ReactNode | null;
  /** The supplier meetings, above Planning Stage (never above the day itself). */
  meetings?: ReactNode;
  panels: Record<ScheduleLineView, ReactNode>;
}) {
  const [view, setView] = useState<ScheduleLineView>(initial);
  /* 📖 The page's dropdown also lists every chapter and + New chapter (owner 2026-11-01, the approved prototype's
     `viewPick`): a chapter opens its page (`chapters-host.tsx`). */
  const chapters = useChapters();
  // `?view=` changed by Back/Forward (a pick only replaces it) — follow it.
  useEffect(() => {
    const onPop = () => {
      const v = new URLSearchParams(window.location.search).get('view');
      if (v === 'event-day' || v === 'preparation') setView(v);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const pick = (key: string) => {
    if (chapters && key === 'chapter:new') return chapters.add();
    if (chapters && key.startsWith('chapter:')) return chapters.open(key.slice('chapter:'.length));
    if (key !== 'event-day' && key !== 'preparation') return;
    if (key === view) return;
    setView(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', key);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // No history — the view still swaps, client-only.
    }
    window.scrollTo({ top: 0 });
  };
  const current = views.find((v) => v.key === view) ?? views[0];
  /* 📐 THE 4 NOV ROW (owner 2026-11-04, "Match the 4 Nov prototype", frames 1–2): on the chapters page the one line is
     [Event Day ▾] 4 chapters · 👤 · ⚙ — the date line, its ⓘ, Announce and Share live in Schedule settings (⚙). Where
     no chapters are drawn (the Maker, a failed read) the line stays as it was. */
  const settled = Boolean(chapters);
  const dayChapters = chapters
    ? chapters.chapters.filter((c) => chapterStage(c, chapters.eventDay) === (view === 'preparation' ? 'planning' : 'day'))
    : [];
  const chapterCount = dayChapters.length;
  /* 📌 Slice 8: the row is PINNED and never hides; once the page scrolls it cross-fades to a tighter face of the
     same doors (labels shrink to their counts) — the height never changes, so nothing jumps. */
  const [tight, setTight] = useState(false);
  useEffect(() => {
    if (!settled) return;
    const onScroll = () => setTight(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [settled]);
  const narrowed = chapters?.dayFilter ? (chapters.chapters.find((c) => c.block_id === chapters.dayFilter) ?? null) : null;
  const lensOn = chapters && chapters.viewAs && chapters.lens.kind !== 'everyone' ? lensWords(chapters.viewAs.data, chapters.lens) : null;
  const lineParts = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] text-ink/70" data-schedule-date-line="">
        <span>{dateLine}</span>
        <Tip>
          <span className="block space-y-1.5">
            {info}
            {notes[view] ? <span className="block">{notes[view]}</span> : null}
          </span>
        </Tip>
      </div>
      {announce || share ? (
        <div className="flex flex-wrap items-center gap-2" data-schedule-settings-line="">
          {announce}
          {share}
        </div>
      ) : null}
    </>
  );
  const hand = chapters?.setSettingsPart;
  useEffect(() => {
    if (hand) hand('line', lineParts);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handed up when what it shows changes
  }, [hand, view, dateLine, info, notes, announce, share]);

  return (
    <ScheduleViewOnScreen.Provider value={view}>
      <div data-schedule-one-line={view}>
        {/* ── THE ONE LINE: the view ▾ · the day's own tools (Event Day only) · 🔊 Announce. */}
        <div
          className={settled ? `sticky top-0 z-20 -mx-4 flex h-14 items-center gap-1 bg-cream px-4 transition-shadow duration-200 ${tight ? 'shadow-[0_1px_0_rgba(27,26,23,0.08)]' : ''}` : 'flex min-h-11 items-center gap-1.5'}
          data-schedule-line=""
          data-schedule-line-tight={settled && tight ? '' : undefined}
        >
          <span className={settled ? 'flex flex-none items-center' : 'flex min-w-0 shrink items-center'}>
            <PickMenu
              label="Schedule view"
              value={view}
              buttonText={current?.label}
              options={[
                ...views.map((v) => ({
                  key: v.key,
                  label: v.label,
                  group: chapters ? 'Schedule' : undefined,
                  trail: v.count > 0 ? { text: String(v.count), tone: 'muted' as const } : undefined,
                })),
                ...(chapters?.canEdit ? [{ key: 'chapter:new', label: '+ New chapter', group: 'Chapters' }] : []),
                ...(chapters?.chapters ?? []).map((c) => ({ key: `chapter:${c.block_id}`, label: c.label, group: 'Chapters' })),
              ]}
              onPick={pick}
              dataAttr="data-schedule-view"
              compact
            />
          </span>
          {/* The day's tools are the Event Day's only: `hidden` as a CLASS — a `flex` class beats the attribute. */}
          {/* 🔎 "4 chapters" is a DOOR (slice 8, "Changed 2"): it narrows the day to one chapter, and reads as a tinted
              chip with ✕ while narrowed. */}
          {settled && chapters && view === 'event-day' && narrowed ? (
            <span className="flex min-w-0 items-center rounded-full bg-terracotta/15" data-schedule-count-chip="">
              <span className="max-w-[7rem] truncate pl-3 text-[14px] font-semibold text-ink">{narrowed.label}</span>
              <button
                type="button"
                onClick={() => chapters.setDayFilter(null)}
                aria-label="Show every chapter"
                className="sn-press grid h-11 w-9 place-items-center rounded-full text-ink/70"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </span>
          ) : settled && chapters && view === 'event-day' && chapterCount > 1 ? (
            <span className="flex-none" data-schedule-count="">
              <PickMenu
                label="Show one chapter"
                value="all"
                buttonText={tight || lensOn ? `≡ ${formatCount(chapterCount)}` : `${formatCount(chapterCount)} chapters`}
                options={[
                  { key: 'all', label: 'Every chapter', trail: { text: formatCount(chapterCount), tone: 'muted' as const } },
                  ...dayChapters.map((c) => ({ key: c.block_id, label: c.label, group: 'Show one chapter' })),
                ]}
                onPick={(k) => chapters.setDayFilter(k === 'all' ? null : k)}
                dataAttr="data-schedule-chapter-door"
                compact
              />
            </span>
          ) : settled ? (
            <span className="min-w-0 truncate text-[14px] text-ink/60" data-schedule-count="">
              {formatCount(chapterCount)} chapter{chapterCount === 1 ? '' : 's'}
            </span>
          ) : null}
          <span
            id={SCHEDULE_TOOLS_SLOT}
            hidden={view !== 'event-day'}
            className={view === 'event-day' ? 'ml-auto flex min-w-0 items-center' : 'hidden'}
            data-schedule-tools-slot=""
          />
          {settled ? (
            <button
              type="button"
              onClick={() => chapters?.openSettings()}
              aria-label="Schedule settings"
              data-schedule-settings-open=""
              className={`sn-press grid h-10 w-10 flex-none place-items-center rounded-full border border-ink/15 text-ink${view !== 'event-day' ? ' ml-auto' : ''}`}
            >
              <Settings aria-hidden className="h-5 w-5" strokeWidth={1.8} />
            </button>
          ) : announce ? (
            <span className={`flex shrink-0 items-center${view !== 'event-day' ? ' ml-auto' : ''}`}>{announce}</span>
          ) : null}
        </div>

        {/* 📖 A new event's day opens with what to do with its four chapters (prototype frame 1) — under the one line,
            only while they are still the defaults, unfilled, and only for someone who may change them. */}
        {settled && view === 'event-day' && chapters?.canEdit && defaultChaptersUnfilled(chapters.chapters) ? (
          <p data-default-chapters-tell="" className="mt-2 border-b border-ink/10 pb-2 text-[15px] text-ink">
            {DEFAULT_CHAPTERS_TELL} <Tip>{DEFAULT_CHAPTERS_TIP}</Tip>
          </p>
        ) : null}

        {/* 📅 Slice 8 ("Changed 5"): the date line sits under the pinned row and scrolls away; it is in ⚙ too. A filter
            says what you are seeing and how to clear it, right under it. */}
        {settled ? (
          <div className="mt-1 space-y-1" data-schedule-under-line="">
            <p className="text-[13px] text-ink/60" data-schedule-date-under="">
              {dateLine}
            </p>
            {view === 'event-day' && (narrowed || lensOn) ? (
              <p className="text-[13px] text-ink/70" data-schedule-filter-line="">
                {lensOn ? (
                  <>
                    Seeing the day as <b className="font-semibold text-ink">{lensOn}</b> ·{' '}
                    <button type="button" className="font-semibold text-ink underline" onClick={() => chapters?.setLens({ kind: 'everyone' })}>
                      Show everyone
                    </button>
                  </>
                ) : narrowed ? (
                  <>
                    Showing <b className="font-semibold text-ink">{narrowed.label}</b> only ·{' '}
                    <button type="button" className="font-semibold text-ink underline" onClick={() => chapters?.setDayFilter(null)}>
                      Show every chapter
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}
        {/* ── THE DATE LINE — everything else about the day is inside its ⓘ (inside ⚙ on the chapters page). */}
        {settled ? null : (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-ink/60" data-schedule-date-line="">
          <span>{dateLine}</span>
          <Tip>
            <span className="block space-y-1.5">
              {info}
              {notes[view] ? <span className="block">{notes[view]}</span> : null}
            </span>
          </Tip>
          {share ? <span className="ml-auto">{share}</span> : null}
        </div>
        )}

        {/* ── THE VIEWS, each drawn once and kept; the moments start right here. */}
        <div className="mt-3">
          {meetings ? <div hidden={view === 'event-day'}>{meetings}</div> : null}
          {(Object.keys(panels) as ScheduleLineView[]).map((k) => (
            <div key={k} hidden={k !== view} data-schedule-panel={k}>
              {panels[k]}
            </div>
          ))}
        </div>
      </div>
    </ScheduleViewOnScreen.Provider>
  );
}
