'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import { PRINT_PAPER_HEADER, parsePrintPaper, type PrintPaperFacts } from '@/lib/print-paper';
import { PrintPreview } from './print-preview';
import { useRegisterSlide } from './prints-view-store';

/**
 * 🖨 STUDIO › PRINTS — EVERY PRINT SHOWS WHAT IT LOOKS LIKE (owner 2026-10-14, verbatim: *"i cannot see what the different prints
 * look like"*; approved prototype `prototypes/maker_prints_previews_2026-10-14_fable.html`) — and since 2026-10-26 it shows it LARGE:
 * one print per slide of the Prints carousel (owner: *"So we can make like a swipe carousel type where they can see the preview
 * larger"*; prototype `prints_carousel_2026-10-26`, `studio-prints-carousel.tsx`). The row's thumbnail and its tap-to-enlarge sheet
 * are gone with the list: the slide IS the large preview.
 *
 * What stays here:
 *   1. `loadPaper` / `usePaper` — a print's picture: the SAME address the route already draws (and the Download saves from), asked
 *      once per address, three at a time at low priority, at once and high for the slide being looked at, with what the route said
 *      about its paper (`x-print-paper`: pages, sides, empty, fits).
 *   2. `StudioPaper` — what a print tells its slide, all of it plain data drawn by the server (`maker-prints.tsx`).
 *   3. 🪧 The entrance chart's pick (By table · A to Z, its size), one per event, read by its slide and Print settings alike.
 *
 * 🔑 NOTHING HERE DRAWS A PRINT. The pictures are the routes'; this file only shows them (`print-paper-is-the-routes.test.ts`).
 * Rides the one lazy Studio door (`StudioTool` → `studio-tools.tsx`) — not one byte in the Maker's first load.
 */

/* ── THE PICTURES — fetched once per address, three at a time ──────────────── */

type Loaded = { url: string; facts: PrintPaperFacts | null };

/** One fetch per address for the whole page — the thumbnail's picture IS the sheet's page 1 (no second fetch). */
const PAPERS = new Map<string, Promise<Loaded>>();
const DRAWN = new Map<string, Loaded>();
const MAX_AT_ONCE = 3;
let running = 0;
const waiting: Array<() => void> = [];

function inTurn<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const go = () => {
      running += 1;
      job()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          waiting.shift()?.();
        });
    };
    if (running < MAX_AT_ONCE) go();
    else waiting.push(go);
  });
}

/**
 * The picture at `src`, and what its route said about its paper. `urgent`: the one the couple is looking at (the sheet's page) —
 * asked at once and high; a thumbnail waits its turn, low. A failure is forgotten, so Retry asks again.
 */
export function loadPaper(src: string, urgent = false): Promise<Loaded> {
  const hit = PAPERS.get(src);
  if (hit) return hit;
  const ask = () =>
    fetch(src, { credentials: 'same-origin', priority: urgent ? 'high' : 'low' } as RequestInit).then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const facts = parsePrintPaper(r.headers.get(PRINT_PAPER_HEADER));
      const blob = await r.blob();
      const loaded = { url: URL.createObjectURL(blob), facts };
      DRAWN.set(src, loaded);
      return loaded;
    });
  const p = urgent ? ask() : inTurn(ask);
  PAPERS.set(src, p);
  p.catch(() => PAPERS.delete(src));
  return p;
}

type PaperState = { status: 'idle' | 'loading' | 'loaded' | 'error'; loaded: Loaded | null };

export function usePaper(src: string | null, active: boolean, urgent = false): [PaperState, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ src: string | null; s: PaperState }>({ src, s: { status: 'idle', loaded: null } });
  useEffect(() => {
    if (!src || !active) return;
    const done = DRAWN.get(src);
    if (done) {
      setState({ src, s: { status: 'loaded', loaded: done } });
      return;
    }
    let dead = false;
    setState({ src, s: { status: 'loading', loaded: null } });
    loadPaper(src, urgent).then(
      (loaded) => {
        if (!dead) setState({ src, s: { status: 'loaded', loaded } });
      },
      () => {
        if (!dead) setState({ src, s: { status: 'error', loaded: null } });
      },
    );
    return () => {
      dead = true;
    };
  }, [src, active, urgent, attempt]);
  const now: PaperState = state.src === src ? state.s : { status: active && src ? 'loading' : 'idle', loaded: src ? (DRAWN.get(src) ?? null) : null };
  return [now.loaded && now.status !== 'error' ? { status: 'loaded', loaded: now.loaded } : now, useCallback(() => setAttempt((n) => n + 1), [])];
}

/* ── 1 · WHAT A PRINT TELLS ITS SLIDE ──────────────────────────────────────── */

export type StudioPaperDoor =
  | { kind: 'item'; item: string; label: string }
  | { kind: 'guests'; label: string }
  /** The slide's own content editor (the Menu's dishes — `PrintSlide.edit`), opened in a sheet. */
  | { kind: 'edit'; label: string };

/** What a print tells its slide's picture — all of it plain data, drawn by the server (`maker-prints.tsx`). */
export type StudioPaper = {
  /** The print's Details item. */
  item: string;
  eventId: string;
  /** THE route's picture of this print — the address the body draws and the Save's route draws from. */
  src: string;
  /** The paper's shape, width ÷ height. */
  aspect: number;
  /** "The Invitation" — the sheet's title and the picture's name. */
  title: string;
  /** The paper line's chips the page knows (size · theme or free); the pages / sides chip comes from the route. */
  chips: string[];
  /** The route draws `?page=N` — the slide flips its pages. */
  pages?: boolean;
  /** What the PAGE knows is missing (no menu, no Love Story) — the route then draws the paper's own empty words. */
  empty?: { title: string; line: string; door?: StudioPaperDoor | null } | null;
};

/* ── 3 · THE ENTRANCE SEATING CHART — its own slide ──────────────────────────── */

export type ChartLayoutKey = 'table' | 'az';
type ChartPick = { layout: ChartLayoutKey; size: string };

/** The chart's pick, one per event — the row, its sheet and (on a computer) the left column read the same one. */
const CHART_PICKS = new Map<string, ChartPick>();
const CHART_LISTENERS = new Set<() => void>();
function chartPickFor(eventId: string, fallback: ChartPick): ChartPick {
  return CHART_PICKS.get(eventId) ?? fallback;
}
function setChartPick(eventId: string, next: ChartPick) {
  CHART_PICKS.set(eventId, next);
  for (const l of CHART_LISTENERS) l();
}
export function useChartPick(eventId: string, fallback: ChartPick): [ChartPick, (next: ChartPick) => void] {
  const pick = useSyncExternalStore(
    (l) => {
      CHART_LISTENERS.add(l);
      return () => CHART_LISTENERS.delete(l);
    },
    () => chartPickFor(eventId, fallback),
    () => fallback,
  );
  return [pick, (next) => setChartPick(eventId, next)];
}

export type StudioChartInput = {
  eventId: string;
  /** `/dashboard/<id>/seating/print` — the ONE route that draws and saves the chart (and the pack). */
  route: string;
  sizes: ReadonlyArray<{ key: string; label: string; mm: string; aspect: number }>;
  defaultSize: string;
  layouts: ReadonlyArray<{ key: ChartLayoutKey; label: string }>;
  /** The saved files' names, per layout — the route's own (`chartFileStem`). */
  files: Record<ChartLayoutKey, string>;
  /** The Save's words, per layout — the words the row always had. */
  saveLabels: Record<ChartLayoutKey, string>;
  title: string;
  blurb: string;
};

/** The chart's picture and file addresses for one pick — the SAME route, `format=preview` and `format=pdf`. */
export function chartAddresses(route: string, pick: ChartPick, defaultSize: string): { preview: string; pdf: string } {
  const size = pick.size === defaultSize ? '' : `&size=${encodeURIComponent(pick.size)}`;
  return { preview: `${route}?chart=${pick.layout}${size}&format=preview`, pdf: `${route}?chart=${pick.layout}${size}&format=pdf` };
}

/**
 * 🪧 The entrance seating chart's slide (owner 2026-10-14: "the entrance seating chart is its own row"; a slide since 2026-10-26):
 * registered here, drawn by the carousel — its Chart ▾ (By table · A to Z) and its size ▾ are the chart's own pick (`useChartPick`),
 * and when the names do not fit on the size the chart's own words say so, the Download is withheld, and the size that fits is one
 * tap — never a chart that loses a name.
 */
export function StudioChartPaper({ chart }: { chart: StudioChartInput }) {
  useRegisterSlide('seating-chart', 'chart', { name: chart.title, chart, tip: chart.blurb });
  return null;
}

/**
 * 🪧 ENTRANCE CHART LAYOUT ▾ — By table · A to Z — in ⚙ Print settings › Seat plan & the door (owner 2026-10-17; prototype `chart_layout`):
 * the house dropdown over the SAME pick the chart's row draws from (`useChartPick`), so the row's picture and Download follow it. A
 * view of the file, not a stored setting: nothing posts.
 */
export function StudioChartLayoutSetting({ eventId, defaultSize, layouts }: Pick<StudioChartInput, 'eventId' | 'defaultSize' | 'layouts'>) {
  const [pick, setPick] = useChartPick(eventId, { layout: 'table', size: defaultSize });
  return (
    <FormRows data="chart-layout" attrs={{ 'data-studio-print-rows': '' }}>
      <ChosenRow
        name="Entrance chart layout"
        label="Entrance chart layout"
        value={pick.layout}
        options={layouts.map((l) => ({ key: l.key, label: l.label }))}
        onPick={(k) => setPick({ ...pick, layout: k as ChartLayoutKey })}
        dataAttr="data-chart-layout-picker"
        data="chart-layout"
      />
    </FormRows>
  );
}

/** 🪧 On a computer, the chart's picture in the left column — the pick the row holds (`useChartPick`), the same route. */
export function StudioChartBody({ chart }: { chart: StudioChartInput }) {
  const [pick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  const spec = chart.sizes.find((s) => s.key === pick.size) ?? chart.sizes[0]!;
  const at = chartAddresses(chart.route, pick, chart.defaultSize);
  return (
    <div data-print-piece="seating-chart" className="flex flex-col items-center gap-2">
      <PrintPreview src={at.preview} alt={`${chart.title} — ${spec.label}`} label="seating chart" aspect={spec.aspect} />
      <p className="text-xs text-ink/60">
        {spec.label} · {spec.mm} · {chart.layouts.find((l) => l.key === pick.layout)?.label}
      </p>
    </div>
  );
}
