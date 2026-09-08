/**
 * story-spine.tsx — the public page as the event's clock.
 *
 * Ported from `prototypes/story.html` · `01_The_Story.md` §1 + §3 + §6 + §7 ·
 * `08` step 2.1.
 *
 *     THE ROAD ──────────────┃ DAY 1 ┊ DAY 2 ─────────────┃ AFTER
 *     how the day was made   ┃ one segment per calendar day┃ what came after
 *
 * A server component. Everything a reader may not have is already GONE by the
 * time this runs: `redactStoryLayers` takes the withheld layers out of the
 * payload upstream, and `drawnBins` decides every bar's height. Nothing in here
 * re-asks "may they see it?" — a second opinion about that question is the
 * failure this repo has logged three separate times.
 *
 * ⚠ WHAT IT IS NOT, so nobody looks for it here. The six-stage light and the
 * floor-plan lens are S10; the eleven index tabs, find-in-this-day and Relive
 * are S11; the locked close, print and share are S12. This is the SPINE: the
 * cover, the dial, the road's dated entries, the days' minutes with their
 * layers, and the gaps drawn as gaps.
 */

import { type ReactElement, type ReactNode } from 'react';
import {
  afterX,
  blockAt,
  dayX,
  filmTimecode,
  formatClock,
  gapText,
  layOutDays,
  manilaInstantAt,
  manilaMinuteOfDay,
  mastheadEdition,
  roadX,
  venueStateAt,
  AFTER_BAND,
  DAY_BAND,
  ROAD_BAND,
  type SpineDay,
} from '@/lib/story-spine';
import { manilaDayOf } from '@/lib/story-day-window';
import {
  countForLayer,
  drawnBins,
  guestLayerAdmits,
} from '@/lib/the-guests-layer-is-theirs-until-you-publish';
import { STRANGER, type StoryViewer } from '@/lib/who-can-see-your-story';
import type { EventWords } from '../../_lib/event-words';
import type { DayChapter, EditorialData } from '../editorial/data';
import { StoryClock, type DialBar, type DialLabel } from './story-clock';
import { MinuteMedia } from './minute-media';
import type { RoadFact, StorySpineFacts } from './spine-data';

/** The tallest a bar is drawn, in axis units. `BASELINE_Y` in the clock is 50. */
const MAX_BAR = 46;

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${MONTH_LONG[m - 1]} ${d}, ${y}`;
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  if (!m || !d) return dateStr;
  return `${(MONTH_LONG[m - 1] ?? '').slice(0, 3).toUpperCase()} ${d}`;
}

/** A written minute of a day, placed. */
type Minute = {
  id: string;
  chapter: DayChapter;
  atMs: number;
  minuteOfDay: number;
  x: number;
};

export function StorySpine({
  data,
  facts,
  words,
  viewer = STRANGER,
  isSample,
  monogram,
  actions,
}: {
  data: EditorialData;
  facts: StorySpineFacts;
  words: EventWords;
  viewer?: StoryViewer;
  /**
   * A curated showcase story, not a real celebration. It says so ON THE COVER
   * (review finding) — buried in the colophon it is a disclosure nobody reaches,
   * on a page whose entire job is to look like somebody's real wedding.
   */
  isSample: boolean;
  /** The event's own mark, already resolved by the shipped loader. */
  monogram: ReactNode;
  /** Share / print / the host's own door — the shipped controls, unchanged. */
  actions: ReactNode;
}): ReactElement {
  // A sample carries no audience and exists to be read — the same exemption the
  // shipped gate and `redactStoryLayers` both make, for the same reason.
  const guestOpen = data.audience ? guestLayerAdmits(data.audience, viewer) : true;

  // ── the days, and their minutes ───────────────────────────────────────────
  const chaptersByDay = new Map<string, DayChapter[]>();
  for (const c of data.dayChapters) {
    const day = c.atIso ? manilaDayOf(c.atIso) : null;
    if (!day) continue;
    const list = chaptersByDay.get(day);
    if (list) list.push(c);
    else chaptersByDay.set(day, [c]);
  }

  const dayDates =
    facts.dayDates.length > 0
      ? facts.dayDates
      : // No usable event date ⇒ no day window. The chapters still know which
        // Manila day they are on, so the spine uses theirs rather than drawing
        // nothing: a story with a missing date is still a story.
        Array.from(chaptersByDay.keys()).sort();

  const days: SpineDay[] = layOutDays(
    dayDates.map((date) => ({
      date,
      minutes: (chaptersByDay.get(date) ?? [])
        .map((c) => manilaMinuteOfDay(c.atIso))
        .filter((m): m is number => m != null),
    })),
  );
  const dayByDate = new Map(days.map((d) => [d.date, d] as const));

  const minutesByDay = new Map<string, Minute[]>();
  for (const [date, chapters] of chaptersByDay) {
    const day = dayByDate.get(date);
    if (!day) continue;
    const placed: Minute[] = [];
    chapters.forEach((c, i) => {
      const m = manilaMinuteOfDay(c.atIso);
      const atMs = c.atIso ? Date.parse(c.atIso) : Number.NaN;
      if (m == null || !Number.isFinite(atMs)) return;
      placed.push({
        id: `minute-${date}-${i}`,
        chapter: c,
        atMs,
        minuteOfDay: m,
        x: dayX(day, m),
      });
    });
    placed.sort((a, b) => a.atMs - b.atMs);
    minutesByDay.set(date, placed);
  }
  // ── the road, and after ───────────────────────────────────────────────────
  const roadStart = facts.roadStartMs;
  const roadEnd = facts.roadEndMs;
  const road = facts.road.filter((f) => guestOpen || f.layer !== 'guest');
  const roadPlaced = road.map((f) => ({
    fact: f,
    x: roadStart != null && roadEnd != null ? roadX(f.atMs, roadStart, roadEnd) : ROAD_BAND.x1,
  }));

  const afterStart = facts.after.length ? Math.min(...facts.after.map((f) => f.atMs)) : null;
  const afterEnd = facts.after.length ? Math.max(...facts.after.map((f) => f.atMs)) : null;
  const afterPlaced = facts.after.map((f) => ({
    fact: f,
    x:
      afterStart != null && afterEnd != null && afterEnd > afterStart
        ? afterX(f.atMs, afterStart, afterEnd)
        : (AFTER_BAND.x0 + AFTER_BAND.x1) / 2,
  }));

  // ── the dial ──────────────────────────────────────────────────────────────
  const bars: DialBar[] = [];
  const labels: DialLabel[] = [];
  const dividers: Array<{ x: number; dashed: boolean }> = [];

  /*
    THE ROAD'S BARS ARE NOT CAPTURE BARS, AND THE DIFFERENCE IS DELIBERATE.

    🔴 `story_dial_bucket_counts` is bounded to the event's OWN days by design
    (08 step 0.2) — that bound is the fix for the read that starved, and widening
    it to six months of pre-day captures would undo it. So nothing here has
    measured how many photographs were taken in the third week of October, and a
    bar drawn at a height would be a number we invented. The road draws a
    baseline rule with a MARK at each dated fact; tapping anywhere on it opens
    the fact it is nearest. Not "we have no data yet" — a different question,
    honestly unanswered.
  */
  const ROAD_BINS = 26;
  if (roadPlaced.length > 0) {
    const w = (ROAD_BAND.x1 - ROAD_BAND.x0) / ROAD_BINS;
    for (let i = 0; i < ROAD_BINS; i += 1) {
      const x = ROAD_BAND.x0 + i * w;
      const near = nearestBy(roadPlaced, x + w / 2);
      bars.push({
        x,
        w: w - 1.2,
        h: null,
        label: near ? `${near.fact.stamp} ${near.fact.stampSuffix}` : 'The road to the day',
        captures: null,
        place: null,
        future: false,
        unmeasured: true,
        nearId: near ? near.fact.key : null,
        nearLabel: near ? near.fact.title : null,
      });
    }
    labels.push({ x: ROAD_BAND.x0 + 1, text: 'THE ROAD', kind: 'segment' });
    for (const r of roadPlaced) {
      labels.push({ x: r.x, text: r.fact.stamp, kind: 'mark' });
    }
  }

  // The day bins. Heights come from `drawnBins` and nowhere else.
  const drawn = drawnBins(facts.bins, {
    now: Date.now(),
    status: data.audience ?? 'published',
    viewer,
  });
  const tallest = Math.max(1, ...drawn.map((b) => b.height ?? 0));

  for (const day of days) {
    const span = Math.max(1, day.endMin - day.startMin);
    const binW = ((facts.bucketMinutes / span) * (day.x1 - day.x0)) as number;
    let drewAny = false;
    for (const bin of drawn) {
      if (manilaDayOf(new Date(bin.at).toISOString()) !== day.date) continue;
      const m = manilaMinuteOfDay(new Date(bin.at).toISOString());
      if (m == null || m < day.startMin || m >= day.endMin) continue;
      const near = nearestMinute(minutesByDay.get(day.date) ?? [], m);
      const state = venueStateAt(bin.at, facts.blocks);
      const block = blockAt(bin.at, facts.blocks);
      const clock = formatClock(m);
      bars.push({
        x: dayX(day, m),
        w: Math.max(0.8, binW - 0.6),
        h:
          bin.height == null
            ? null
            : bin.height === 0
              ? 0.8
              : Math.max(2, (bin.height / tallest) * MAX_BAR),
        label: `${shortDate(day.date)} · ${clock.t} ${clock.ap}`,
        captures: bin.captures,
        place:
          block?.location ??
          (state === 'no_venue' ? null : block?.label ?? null),
        future: bin.future,
        unmeasured: false,
        nearId: near?.id ?? null,
        nearLabel: near ? minuteHeadline(near) : null,
      });
      drewAny = true;
    }

    /*
      NOTHING WAS COUNTED FOR THIS DAY. A showcase fixture, or an event whose
      aggregate could not be read. The day still gets a strip, because the dial
      is where a reader learns the day exists and how to reach its minutes —
      but every bar is a BASELINE TICK carrying `unmeasured`, so the sheet says
      "nothing was counted here" rather than the sentence about a count sitting
      behind a gate. There is no number behind a gate; there is no number.
    */
    if (!drewAny) {
      const ticks = Math.max(6, Math.min(60, Math.round(span / Math.max(5, facts.bucketMinutes))));
      const w = (day.x1 - day.x0) / ticks;
      for (let i = 0; i < ticks; i += 1) {
        const m = day.startMin + (i / ticks) * span;
        const near = nearestMinute(minutesByDay.get(day.date) ?? [], m);
        const clock = formatClock(m);
        bars.push({
          x: day.x0 + i * w,
          w: Math.max(0.8, w - 0.6),
          h: null,
          label: `${shortDate(day.date)} · ${clock.t} ${clock.ap}`,
          captures: null,
          place: blockAt(manilaInstantAt(day.date, m), facts.blocks)?.label ?? null,
          future: false,
          unmeasured: true,
          nearId: near?.id ?? null,
          nearLabel: near ? minuteHeadline(near) : null,
        });
      }
    }
    labels.push({ x: day.x0 + 1, text: shortDate(day.date), kind: 'segment' });
    // Hour ticks — every second or third hour, so a phone gets four or five
    // legible ones rather than eleven overlapping ones.
    const hours = Math.max(1, Math.round(span / 60));
    const step = hours <= 6 ? 60 : hours <= 12 ? 120 : 180;
    for (let m = Math.ceil(day.startMin / step) * step; m < day.endMin; m += step) {
      labels.push({ x: dayX(day, m), text: formatClock(m).t, kind: 'tick' });
    }
    if (day.x0 > DAY_BAND.x0) dividers.push({ x: day.x0 - 6, dashed: true });
  }
  if (days.length > 0) dividers.push({ x: DAY_BAND.x0 - 6, dashed: false });

  if (afterPlaced.length > 0) {
    const w = (AFTER_BAND.x1 - AFTER_BAND.x0) / Math.max(1, afterPlaced.length);
    afterPlaced.forEach((a, i) => {
      bars.push({
        x: AFTER_BAND.x0 + i * w,
        w: w - 1.2,
        h: null,
        label: `${a.fact.stamp} ${a.fact.stampSuffix}`,
        captures: null,
        place: null,
        future: false,
        unmeasured: true,
        nearId: a.fact.key,
        nearLabel: a.fact.title,
      });
    });
    labels.push({ x: AFTER_BAND.x1 - 1, text: 'AFTER', kind: 'segment' });
    dividers.push({ x: AFTER_BAND.x0 - 5, dashed: false });
  }

  bars.sort((a, b) => a.x - b.x);

  // ── the cover's four facts ────────────────────────────────────────────────
  //
  // Captures and voices are the guests'; films and days told are the host's own
  // (§2). `countForLayer` renders a withheld one as an ABSENCE, never as zero —
  // "0 captures" is a claim about the day, and it is a false one while the
  // photographs sit behind the gate.
  const voices =
    data.kwentoQuotes.length + (data.guestColumns?.length ?? 0) + data.challengeAnswers.length;
  const daysTold =
    roadStart != null && roadEnd != null
      ? Math.max(1, Math.round((roadEnd - roadStart) / 86_400_000)) + days.length
      : days.length;

  const coverFacts: Array<{ n: number | null; label: string }> = [
    { n: countForLayer(data.metrics.photos, guestOpen), label: 'captures' },
    { n: facts.broadcasts.length, label: facts.broadcasts.length === 1 ? 'live film' : 'live films' },
    { n: countForLayer(voices, guestOpen), label: voices === 1 ? 'voice' : 'voices' },
    { n: daysTold, label: 'days told' },
  ];

  const opening = roadPlaced[0]?.fact ?? null;

  return (
    <div className="sn-story">
      {/* ═══════════ COVER ═══════════ */}
      <header className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {monogram}
            <span className="font-mono text-xs font-bold uppercase tracking-[0.24em]">
              Setnayan
              <small className="mt-0.5 block text-[9.5px] font-medium tracking-[0.14em] text-ink/55">
                {mastheadEdition(data.eventDate, data.editionNo, data.published)}
              </small>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {isSample ? (
            <span className="inline-flex items-center rounded-full border border-terracotta-700/50 bg-terracotta-700/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-terracotta-700">
              Sample story — not a real {words.host}
            </span>
          ) : null}
          {data.published ? (
            <span className="inline-flex items-center rounded-full border border-ink/30 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink/70">
              Complete
            </span>
          ) : null}
        </div>

        <div className="mt-6">
          {data.eventDateFormatted ? (
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
              {data.eventDateFormatted}
              {data.venueCity ? ` · ${data.venueCity}` : ''}
            </span>
          ) : null}
          <h1 className="mt-2 font-condensed text-[clamp(3.25rem,15vw,9rem)] font-black uppercase leading-[0.86] tracking-tight">
            {data.displayName}
          </h1>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <p className="max-w-[30ch] font-serif text-xl font-light leading-snug sm:text-2xl">
            {coverSentence(data, words)}
          </p>
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            {coverFacts.map((f) => (
              <div key={f.label}>
                <dd className="font-condensed text-3xl font-extrabold leading-none tabular-nums">
                  {f.n == null ? '—' : f.n.toLocaleString('en-PH')}
                </dd>
                <dt className="mt-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink/55">
                  {f.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ═══════════ THE DIAL ═══════════ */}
      {bars.length > 0 ? (
        <div className="mt-6">
          <StoryClock
            bars={bars}
            labels={labels}
            dividers={dividers}
            openingStamp={opening?.stamp ?? shortDate(dayDates[0] ?? '')}
            openingSuffix={opening?.stampSuffix ?? ''}
            openingLabel={opening?.title ?? 'The road to the day'}
            withheldNote={`What was shot at this minute is filling in for the people of this celebration. It publishes here when the ${words.host} says so.`}
          />
        </div>
      ) : null}

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ════ THE ROAD ════ */}
        {roadPlaced.length > 0 ? (
          <>
            <PartHead
              title="The road"
              note={`${daysTold - days.length} days · how the day was made`}
            />
            {roadPlaced.map((r) => (
              <RoadEntry key={r.fact.key} fact={r.fact} x={r.x} />
            ))}
          </>
        ) : null}

        {/* ════ THE DAYS ════ */}
        {days.map((day) => {
          const mins = minutesByDay.get(day.date) ?? [];
          return (
            <section key={day.date} aria-label={longDate(day.date)}>
              <PartHead
                title={days.length > 1 ? `Day ${days.indexOf(day) + 1}` : 'The day'}
                note={`${longDate(day.date)}${mins.length ? ' · by the minute' : ''}`}
              />
              {mins.length === 0 ? (
                <p className="py-6 font-serif text-lg italic text-ink/55">
                  {guestOpen
                    ? 'No minute of this day has been written up yet.'
                    : `The minutes of this day belong to the people who were there, until the ${words.host} publishes.`}
                </p>
              ) : null}
              {mins.map((m, i) => {
                const prev = mins[i - 1];
                const gap = prev ? gapText(prev.minuteOfDay, m.minuteOfDay) : null;
                return (
                  <div key={m.id}>
                    {gap ? <Gap text={gap} blocks={gapNote(prev!, m, facts)} /> : null}
                    <MinuteEntry
                      minute={m}
                      day={day}
                      facts={facts}
                      words={words}
                      data={data}
                      guestOpen={guestOpen}
                    />
                  </div>
                );
              })}
            </section>
          );
        })}

        {/* ════ AFTER ════ */}
        {afterPlaced.length > 0 ? (
          <>
            <PartHead title="After" note="the story keeps its date" />
            {afterPlaced.map((a) => (
              <RoadEntry key={a.fact.key} fact={a.fact} x={a.x} />
            ))}
          </>
        ) : null}
      </main>
    </div>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

function PartHead({ title, note }: { title: string; note: string }): ReactElement {
  return (
    <div className="mb-1.5 mt-10 flex items-baseline gap-3 border-b-2 border-ink pb-2">
      <h2 className="font-condensed text-[clamp(1.9rem,6vw,3.25rem)] font-black uppercase leading-[0.9] tracking-tight">
        {title}
      </h2>
      <span className="pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
        {note}
      </span>
    </div>
  );
}

/**
 * A dated entry on the road, or after it. Same grammar as a minute — a big
 * stamp, a title, a paragraph — at the resolution the road is drawn in.
 */
function RoadEntry({ fact, x }: { fact: RoadFact; x: number }): ReactElement {
  return (
    <article
      id={fact.key}
      data-story-entry
      data-story-x={x.toFixed(1)}
      data-story-stamp={fact.stamp}
      data-story-suffix={fact.stampSuffix}
      data-story-label={fact.title}
      {...(fact.layer === 'guest' ? { 'data-layer': 'guest' } : {})}
      className="scroll-mt-32 pt-7"
    >
      <div className="flex flex-wrap items-end gap-3.5">
        <span className="font-condensed text-[clamp(2.5rem,9vw,4.5rem)] font-black uppercase leading-[0.82] tabular-nums tracking-tighter">
          {fact.stamp}
          {fact.stampSuffix ? (
            <small className="ml-1.5 text-[0.28em] font-bold tracking-[0.1em] text-ink/55">
              {fact.stampSuffix}
            </small>
          ) : null}
        </span>
        <span className="pb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
          {fact.kicker}
        </span>
      </div>
      <h3 className="mt-2 font-condensed text-[clamp(1.75rem,6vw,3rem)] font-extrabold uppercase leading-[0.95] tracking-tight">
        {fact.title}
      </h3>
      {fact.body ? (
        <p className="mt-4 max-w-[62ch] font-serif text-lg leading-relaxed">{fact.body}</p>
      ) : null}
    </article>
  );
}

/**
 * The stretch between two written minutes, DRAWN AS A GAP.
 *
 * It carries the blocks the couple's own run-of-show says happened in it, so
 * "4 h 8 m · Golden hour · Reception" is the day's real shape rather than a
 * silence. A block the couple marked private is never named — `is_public` is in
 * the query that loads them.
 */
function Gap({ text, blocks }: { text: string; blocks: string | null }): ReactElement {
  return (
    <div aria-hidden className="flex items-center gap-3 py-2 text-ink/55">
      <span className="h-px flex-1 bg-ink/15" />
      <span className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
        <b className="mr-2 font-condensed text-[15px] tracking-wide text-ink">{text}</b>
        {blocks}
      </span>
      <span className="h-px flex-1 bg-ink/15" />
    </div>
  );
}

function gapNote(from: Minute, to: Minute, facts: StorySpineFacts): string | null {
  const names: string[] = [];
  for (const b of facts.blocks) {
    if (b.endMs <= from.atMs || b.startMs >= to.atMs) continue;
    const label = b.label?.trim();
    if (label && !names.includes(label)) names.push(label);
  }
  return names.length ? names.slice(0, 3).join(' · ') : null;
}

function minuteHeadline(m: Minute): string {
  const clock = formatClock(m.minuteOfDay);
  return m.chapter.title ? `${clock.t} · ${m.chapter.title}` : `${clock.t} ${clock.ap}`;
}

/**
 * ONE MINUTE. Big stamp · title · media · the write-up with a drop cap · then
 * the layers: Said · Asked · Made by · In the film · In the room.
 */
function MinuteEntry({
  minute,
  day,
  facts,
  words,
  data,
  guestOpen,
}: {
  minute: Minute;
  day: SpineDay;
  facts: StorySpineFacts;
  words: EventWords;
  data: EditorialData;
  guestOpen: boolean;
}): ReactElement {
  const clock = formatClock(minute.minuteOfDay);
  const block = blockAt(minute.atMs, facts.blocks);
  const state = venueStateAt(minute.atMs, facts.blocks);
  const film = filmTimecode(minute.atMs, facts.broadcasts);

  // Said / Asked belong to a minute by the SHUTTER of the capture they anchor
  // to — not by when the words were typed. Somebody writes their wish on the
  // drive home; it still belongs to the first dance.
  const window = minuteWindow(minute, facts.bucketMinutes);
  const said = data.kwentoQuotes.filter((q) => within(q.atIso, window));
  const asked = data.challengeAnswers.filter((a) => within(a.atIso, window));

  return (
    <article
      id={minute.id}
      data-story-entry
      data-story-x={minute.x.toFixed(1)}
      data-story-stamp={clock.t}
      data-story-suffix={clock.ap}
      data-story-label={minute.chapter.title ?? `${clock.t} ${clock.ap}`}
      data-story-minute={minute.minuteOfDay}
      data-layer="guest"
      className="scroll-mt-32 pt-7"
    >
      <div className="flex flex-wrap items-end gap-3.5">
        <span className="font-condensed text-[clamp(3.5rem,13vw,7rem)] font-black uppercase leading-[0.82] tabular-nums tracking-tighter">
          {/*
            The count-up writes into THIS node and nowhere else, and the value
            it starts from is the value already rendered — so with JS off, with
            motion turned down, or in a screenshot, the stamp is simply the
            correct time. It is never a placeholder waiting to be filled in.
          */}
          <span data-story-countup>{clock.t}</span>
          <small className="ml-1.5 text-[0.28em] font-bold tracking-[0.1em] text-ink/55">
            {clock.ap}
          </small>
        </span>
        {block?.location || block?.label ? (
          <span className="pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
            {block.location ?? block.label}
          </span>
        ) : null}
      </div>

      {minute.chapter.title ? (
        <h3 className="mt-2 font-condensed text-[clamp(1.75rem,6vw,3rem)] font-extrabold uppercase leading-[0.95] tracking-tight">
          {minute.chapter.title}
        </h3>
      ) : null}

      {minute.chapter.media.length > 0 ? (
        <MinuteMedia media={minute.chapter.media} names={data.firstNames} />
      ) : null}

      {minute.chapter.writeUp ? (
        <p className="sn-dropcap mt-4 max-w-[62ch] font-serif text-lg leading-relaxed">
          {minute.chapter.writeUp}
        </p>
      ) : null}

      <div className="mt-4 border-t border-ink/10">
        {said.length > 0 ? (
          <Layer name="Said">
            <div className="space-y-2.5">
              {said.map((q, i) => (
                <p key={i} className="font-serif text-[17px] italic leading-snug">
                  {q.body}
                  <small className="mt-1 block font-mono text-[10px] font-semibold uppercase not-italic tracking-[0.12em] text-ink/55">
                    {q.author ? <b className="text-terracotta-700">{q.author}</b> : 'A guest'}
                    {q.role ? ` · ${q.role}` : ''} · Kwento
                    {q.author ? ' · asked to be named' : ' · chose not to be named'}
                  </small>
                </p>
              ))}
            </div>
          </Layer>
        ) : null}

        {asked.length > 0 ? (
          <Layer name="Asked">
            <ul data-story-scroller className="flex gap-2 pb-1">
              {asked.map((a, i) => (
                <li key={i} className="w-[9.5rem] flex-none">
                  <p className="font-serif text-[15px] leading-snug">{a.prompt}</p>
                  {a.byline ? (
                    <small className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
                      {a.byline}
                    </small>
                  ) : null}
                </li>
              ))}
            </ul>
          </Layer>
        ) : null}

        {block && block.vendorNames.length > 0 ? (
          <Layer name="Made by">
            <ul className="flex flex-wrap gap-1.5">
              {block.vendorNames.map((n) => (
                <li
                  key={n}
                  className="inline-flex items-center rounded-full border border-ink/25 bg-white/50 px-3 py-1.5 text-[12.5px] font-semibold"
                >
                  {n}
                </li>
              ))}
            </ul>
          </Layer>
        ) : null}

        {film ? (
          <Layer name="In the film">
            <a
              href={`https://www.youtube.com/watch?v=${film.videoId}&t=${film.seconds}s`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 text-[12.5px] font-semibold"
            >
              <b className="rounded bg-ink px-1.5 py-0.5 font-condensed text-sm tracking-wide text-cream">
                {film.label}
              </b>
              Watch this minute in the broadcast it went out on →
            </a>
          </Layer>
        ) : null}

        <Layer name="In the room">
          <p className="text-[13px] text-ink/70">{roomSentence(state, block?.label ?? null)}</p>
        </Layer>
      </div>
      {guestOpen ? null : (
        <p className="mt-3 rounded-lg border border-dashed border-ink/25 px-3.5 py-3 text-[13.5px] text-ink/60">
          The captures of this minute belong to the people of this celebration, for now.
        </p>
      )}
    </article>
  );
}

function Layer({ name, children }: { name: string; children: ReactNode }): ReactElement {
  return (
    <div className="grid grid-cols-[5.75rem_1fr] gap-3 border-b border-ink/10 py-3">
      <span className="pt-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">
        {name}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * What the room was, at this minute — OWNER LOCK 6.
 *
 * 🔒 Assigned seats exist only while the reception venue is in use. Before it,
 * a photograph belongs to a person, not to a table, and saying otherwise puts a
 * guest at a table they had not sat down at yet.
 */
function roomSentence(state: string, blockLabel: string | null): string {
  switch (state) {
    case 'seated':
      return `The tables are in use${blockLabel ? ` — ${blockLabel}` : ''}. Assigned seats apply from here.`;
    case 'ceremony':
      return 'The ceremony — rows, not tables. Assigned seats begin when the reception opens.';
    case 'before':
      return 'The room was still being set. There is no seating to attribute a photograph to yet.';
    case 'no_venue':
      return 'This celebration kept no seating plan.';
    default:
      return 'Between the seated parts of the day — no table to attribute a photograph to.';
  }
}

/** The sentence under the names. The couple's own deck when they wrote one. */
function coverSentence(data: EditorialData, words: EventWords): string {
  const own = data.draft?.deck?.trim();
  if (own) return own;
  const first = data.draft?.leadParagraphs?.[0]?.trim() ?? data.loveStoryParagraphs[0]?.trim();
  if (first) return first.length > 260 ? `${first.slice(0, 257)}…` : first;
  return `A ${words.occasion} doesn't start on the day. Everything here is filed under the moment it happened — scroll, and the clock moves with it.`;
}

/** How wide a net a minute casts when it gathers the voices that are about it. */
function minuteWindow(m: Minute, bucketMinutes: number): { from: number; to: number } {
  const half = Math.max(5, bucketMinutes) * 60_000 * 3;
  return { from: m.atMs - half, to: m.atMs + half };
}

function within(iso: string | null, w: { from: number; to: number }): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= w.from && t <= w.to;
}

function nearestBy<T extends { x: number }>(items: readonly T[], x: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const it of items) {
    const d = Math.abs(it.x - x);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  // Only claim a mark when the bin is actually near it — otherwise every bin on
  // the road would report the same distant fact as "nearest".
  return best && bestD <= (ROAD_BAND.x1 - ROAD_BAND.x0) / 26 ? best : null;
}

function nearestMinute(minutes: readonly Minute[], minuteOfDay: number): Minute | null {
  let best: Minute | null = null;
  let bestD = Infinity;
  for (const m of minutes) {
    const d = Math.abs(m.minuteOfDay - minuteOfDay);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}
