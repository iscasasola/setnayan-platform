'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRow, FormRows } from '@/app/_components/form-row';
import { PillSelector } from '@/app/_components/pill-selector';
import { StatusLine } from '@/app/_components/status-line';
import {
  PAPER_EMPTY,
  PRINT_PAPER_HEADER,
  PRINT_THUMB_PX,
  paperPageSrc,
  parsePrintPaper,
  printThumbSize,
  type PrintPaperFacts,
} from '@/lib/print-paper';
import { DetailsSelectContext } from './details-go';
import { PrintPreview } from './print-preview';
import { PrintSaveButton } from './print-save-button';

/**
 * 🖨 STUDIO › PRINTS — EVERY PRINT SHOWS WHAT IT LOOKS LIKE (owner 2026-10-14, verbatim: *"i cannot see what the different prints
 * look like"*; approved prototype `prototypes/maker_prints_previews_2026-10-14_fable.html`).
 *
 * MEASURED CAUSE: on a phone `lib/studio-details.ts` steps the picture aside (`[data-details-body]{display:none}`) for every
 * full-screen form tool, and a print's row head was its name · size line · size ▾ only — the approved 2026-10-13 paper icon was
 * dropped in the build. So a couple on a phone saw no print at all.
 *
 * THE DELTA, and only it:
 *   1. `PrintThumb` — every print row's head carries the REAL picture: the SAME address the route already draws (and the Save
 *      downloads from), shrunk, at true paper proportions (`printThumbSize`), asked lazily (when the row scrolls near) at low
 *      priority, three at a time, from the browser's cache when it is there (a versioned set piece is `immutable`). A page badge
 *      when the file has more than one page (the route's own count, `x-print-paper`).
 *   2. `PrintPaperSheet` — a tap on the picture (or the name) opens it full size on a phone: pinch, double-tap or ⌕ to zoom, drag
 *      to look around, ‹ › and dots for the pages (swipe when not zoomed), the size ▾, the paper's chips, how many, and the SAME
 *      Save buttons and "Changed since you printed" line the row already has. On a computer the picture is already the left
 *      column (`PrintPieceBody`), so a tap there picks that print — the left column shows it.
 *   3. Empty — the route still draws the paper (its own empty words); the sheet says what is missing and opens where it is fixed.
 *   4. 🪧 The entrance chart is its own row (owner 2026-10-14) — By table | A to Z, its size ▾, and the chart's own "too full"
 *      words with the size that fits one tap away (`StudioChartPaper`).
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

function usePaper(src: string | null, active: boolean, urgent = false): [PaperState, () => void] {
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

/** Once near the screen, stays asked — a thumbnail is fetched when its row scrolls within reach, never all at once on open. */
function useNear<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

/** A 40-px icon button reaches 44 px all round (the house floor), without growing its face. */
const REACH_44 = "relative after:absolute after:-inset-[3px] after:content-['']";

/** The phone — where the picture steps aside and the sheet is the way to see it (the Studio skin's own breakpoint). */
const PHONE = '(max-width: 1023.98px)';

/* ── 1 · THE THUMBNAIL ─────────────────────────────────────────────────────── */

export type StudioPaperDoor =
  | { kind: 'item'; item: string; label: string }
  | { kind: 'guests'; label: string }
  /** A field of the same row (the Menu's dishes) — the sheet closes onto it. */
  | { kind: 'here'; selector: string; label: string };

/** What a print row tells its picture — all of it plain data, drawn by the server (`maker-prints.tsx`). */
export type StudioPaper = {
  /** The row's Details item — on a computer, a tap picks it (the left column shows it). */
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
  /** The route draws `?page=N` — the sheet flips its pages. */
  pages?: boolean;
  /** What the PAGE knows is missing (no menu, no Love Story) — the route then draws the paper's own empty words. */
  empty?: { title: string; line: string; door?: StudioPaperDoor | null } | null;
};

/** `PrintThumb` — the head's picture: a button, 72 px (56 on a computer), the paper at its true shape inside it. */
export function PrintThumb({ paper, onOpen, facts }: { paper: StudioPaper; onOpen: () => void; facts?: (f: PrintPaperFacts | null) => void }) {
  const [ref, near] = useNear<HTMLButtonElement>();
  const [state, retry] = usePaper(paper.src, near);
  const size = printThumbSize(paper.aspect, PRINT_THUMB_PX);
  const pages = state.loaded?.facts?.pages ?? 1;
  const tell = useRef(facts);
  tell.current = facts;
  useEffect(() => {
    if (state.status === 'loaded') tell.current?.(state.loaded?.facts ?? null);
  }, [state.status, state.loaded]);
  const name = paper.title.replace(/^the\s+/i, '');
  return (
    <button
      ref={ref}
      type="button"
      data-print-thumb={paper.item}
      data-print-thumb-src={paper.src}
      data-print-thumb-state={state.status}
      aria-label={state.status === 'error' ? `${name} — could not draw it. Tap to try again` : `See ${name} full size`}
      onClick={() => {
        if (state.status === 'error') retry();
        onOpen();
      }}
      className="sn-press relative grid h-[72px] w-[72px] flex-none place-items-center rounded-xl lg:h-14 lg:w-14"
    >
      <span
        aria-hidden
        data-print-thumb-paper=""
        style={{ width: size.w, height: size.h, maxWidth: '100%', maxHeight: '100%' }}
        className={`relative block overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,.14),0_6px_14px_-8px_rgba(0,0,0,.35)] ${
          state.status === 'loaded' ? '' : 'animate-pulse bg-[#EFEAE1]'
        }`}
      >
        {state.status === 'loaded' && state.loaded ? (
          // eslint-disable-next-line @next/next/no-img-element -- the print's own picture from its route (an SVG/PNG/JPEG blob), shrunk
          <img src={state.loaded.url} alt="" decoding="async" className="block h-full w-full object-contain" />
        ) : state.status === 'error' ? (
          <span className="absolute inset-0 grid place-items-center text-danger-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[9px] font-semibold tracking-[0.04em] text-[#8E8880]">Drawing…</span>
        )}
      </span>
      {pages > 1 ? (
        <span data-print-thumb-pages={pages} className="absolute -bottom-1 -right-1 min-w-5 rounded-full bg-ink px-1.5 text-center text-[10.5px] font-bold leading-5 text-cream shadow-[0_1px_2px_rgba(0,0,0,.3)]">
          {pages}
        </span>
      ) : null}
    </button>
  );
}

/* ── THE HEAD: the picture beside the row, and the sheet it opens ─────────── */

export type PrintSheetParts = {
  /** The row's size ▾ — the SAME pick (it navigates to the same address); drawn again in the sheet. */
  size?: ReactNode;
  /** The same Save buttons the row already has. */
  actions?: ReactNode;
  /** The same "Changed since you printed · Save again" line. */
  changed?: ReactNode;
};

/**
 * The head of a print row with its picture: the picture · the row (name, size line, size ▾). A tap on the picture — or on the
 * row's name — opens the sheet on a phone; on a computer it picks the print, so the left column shows it.
 */
export function PrintPaperHead({ paper, row, sheet }: { paper: StudioPaper; row: ReactNode; sheet: PrintSheetParts }) {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<PrintPaperFacts | null>(null);
  const select = useContext(DetailsSelectContext);
  const show = useCallback(() => {
    if (typeof window !== 'undefined' && !window.matchMedia(PHONE).matches && select) {
      select(paper.item as Parameters<typeof select>[0]);
      return;
    }
    setOpen(true);
  }, [paper.item, select]);
  const empty = paper.empty ?? (facts?.empty ? PAPER_EMPTY[facts.empty] : null);
  return (
    <div data-print-paper-head={paper.item} className="flex items-center gap-3">
      <PrintThumb paper={paper} onOpen={show} facts={setFacts} />
      <div
        className="min-w-0 flex-1"
        onClick={(e) => {
          /* The row's NAME opens the picture too (prototype `.tx`) — never its size ▾, which is its own button. */
          if ((e.target as Element).closest('[data-form-row-name]')) show();
        }}
      >
        {row}
        {empty ? (
          <p data-print-paper-empty-line="" className="-mt-2 pb-2 text-[12px] font-semibold text-sn-accent">
            {empty.title}
          </p>
        ) : null}
      </div>
      {open ? <PrintPaperSheet paper={paper} facts={facts} onFacts={setFacts} sheet={sheet} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/* ── 2 · THE PREVIEW SHEET ─────────────────────────────────────────────────── */

const ZOOM_IN = 2.5;
const ZOOM_MAX = 4;

/** The pages flipped as dots up to this many, then "Page n of N". */
export const PAPER_DOTS_MAX = 12;

function chipsFor(paper: StudioPaper, facts: PrintPaperFacts | null): string[] {
  const [size, ...rest] = paper.chips;
  const pages = facts?.pages ?? 1;
  const middle = pages > 1 ? `${pages} pages` : (facts?.sides ?? 1) > 1 ? 'Front · Back' : '1 sheet';
  return [size, middle, ...rest].filter((c): c is string => Boolean(c));
}

export function PrintPaperSheet({
  paper,
  facts,
  onFacts,
  sheet,
  onClose,
  extra = null,
  blocked = false,
}: {
  paper: StudioPaper;
  facts: PrintPaperFacts | null;
  onFacts?: (f: PrintPaperFacts | null) => void;
  sheet: PrintSheetParts;
  onClose: () => void;
  /** More of the footer, the row's own (the chart's By table | A to Z). */
  extra?: ReactNode;
  /** The Saves are withheld (the chart is too full for this size) — the sheet says why instead. */
  blocked?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pages = paper.pages ? Math.max(1, facts?.pages ?? 1) : 1;
  /* Page 1 is the thumbnail's own picture — already here; page N is asked when it is shown, at once and high. */
  const [first, retryFirst] = usePaper(paper.src, true, true);
  const [other, retryOther] = usePaper(page > 1 ? paperPageSrc(paper.src, page) : null, page > 1, true);
  const shown = page > 1 ? other : first;
  const tellFacts = useRef(onFacts);
  tellFacts.current = onFacts;
  useEffect(() => {
    if (first.status === 'loaded') tellFacts.current?.(first.loaded?.facts ?? null);
  }, [first.status, first.loaded]);
  /* A new picture (a size picked in the sheet) starts back on its page 1. */
  useEffect(() => setPage(1), [paper.src]);

  /* ── zoom · pan · pinch · double-tap · swipe ── */
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const zoomTo = useCallback((z: number, ax?: number, ay?: number) => {
    setView((v) => {
      const nz = Math.max(1, Math.min(ZOOM_MAX, z));
      if (nz === 1) return { z: 1, x: 0, y: 0 };
      const r = stage.current?.getBoundingClientRect();
      if (!r || ax === undefined || ay === undefined) return { ...v, z: nz };
      const px = ax - r.left - r.width / 2;
      const py = ay - r.top - r.height / 2;
      return { z: nz, x: px - (px - v.x) * (nz / v.z), y: py - (py - v.y) * (nz / v.z) };
    });
  }, []);
  useEffect(() => setView({ z: 1, x: 0, y: 0 }), [page, paper.src]);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ dist: 0, z: 1, lastX: 0, lastY: 0, swipeX: null as number | null, moved: false, lastTap: 0 });
  const go = useCallback((d: number) => setPage((p) => Math.max(1, Math.min(pages, p + d))), [pages]);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const g = gesture.current;
    g.moved = false;
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      g.dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.z = view.z;
    } else {
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.swipeX = view.z === 1 ? e.clientX : null;
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      zoomTo(g.z * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      g.moved = true;
    } else if (view.z > 1) {
      const dx = e.clientX - g.lastX;
      const dy = e.clientY - g.lastY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 1) g.moved = true;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (g.swipeX !== null && Math.abs(e.clientX - g.swipeX) > 8) {
      g.moved = true;
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (pts.current.size === 1) {
      if (view.z === 1 && g.swipeX !== null && Math.abs(e.clientX - g.swipeX) > 48) {
        go(e.clientX - g.swipeX < 0 ? 1 : -1);
      } else if (!g.moved) {
        const now = Date.now();
        if (now - g.lastTap < 320) {
          zoomTo(view.z > 1 ? 1 : ZOOM_IN, e.clientX, e.clientY);
          g.lastTap = 0;
        } else g.lastTap = now;
      }
    }
    pts.current.delete(e.pointerId);
  };

  /* Escape closes; ← → turn the pages. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onClose]);

  /* "Pinch or double-tap to zoom" — said once, the first time a sheet opens. */
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (TIP_SAID.done) return;
    TIP_SAID.done = true;
    setTip(true);
    const t = window.setTimeout(() => setTip(false), 2600);
    return () => window.clearTimeout(t);
  }, []);

  const select = useContext(DetailsSelectContext);
  const empty = paper.empty ?? (facts?.empty ? PAPER_EMPTY[facts.empty] : null);
  const emptyDoor: StudioPaperDoor | null =
    paper.empty?.door ?? (facts?.empty ? (PAPER_EMPTY[facts.empty].door === 'seating' ? { kind: 'item', item: 'seating', label: 'Open Seat plan' } : { kind: 'guests', label: 'Open Guest list' }) : null);
  const name = paper.title.replace(/^the\s+/i, '').toLowerCase();
  const line =
    shown.status === 'loading' || shown.status === 'idle'
      ? page > 1
        ? `Drawing page ${page}…`
        : `Opening your ${name}…`
      : pages > 1
        ? `Page ${page} of ${pages}`
        : chipsFor(paper, facts)[0] ?? '';

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${paper.title} — preview`}
      data-print-paper-sheet={paper.item}
      className="fixed inset-0 z-[88] flex flex-col bg-cream"
    >
      <div className="flex h-[52px] flex-none items-center gap-1.5 border-b border-ink/10 bg-cream px-1.5">
        <ActionButton tone="neutral" quiet iconOnly icon={ChevronLeft} label="Back to Prints" onClick={onClose} className={REACH_44} />
        <div className="min-w-0 flex-1 text-center">
          <b className="block truncate text-[15px] font-semibold text-ink">{paper.title}</b>
          <span
            data-print-paper-line=""
            role="status"
            className={`block min-h-4 truncate text-[12px] ${shown.status === 'loaded' ? 'text-ink/55' : 'font-semibold text-sn-accent'}`}
          >
            {line}
          </span>
        </div>
        <ActionButton
          tone="neutral"
          quiet
          iconOnly
          icon={view.z > 1 ? ZoomOut : ZoomIn}
          label={view.z > 1 ? 'Zoom out' : 'Zoom in'}
          aria-pressed={view.z > 1}
          onClick={() => zoomTo(view.z > 1 ? 1 : ZOOM_IN)}
          className={REACH_44}
        />
      </div>

      <div
        ref={stage}
        data-print-paper-stage=""
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => pts.current.delete(e.pointerId)}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          zoomTo(view.z * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY);
        }}
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden p-4"
      >
        {shown.status === 'loaded' && shown.loaded ? (
          // eslint-disable-next-line @next/next/no-img-element -- the print's own picture from its route, full size
          <img
            src={shown.loaded.url}
            alt={`${paper.title}${pages > 1 ? ` — page ${page} of ${pages}` : ''}`}
            draggable={false}
            data-print-paper-picture={page}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
            className="block max-h-full max-w-full origin-center bg-white object-contain shadow-[0_2px_4px_rgba(0,0,0,.14),0_24px_40px_-18px_rgba(0,0,0,.45)] transition-transform duration-75 will-change-transform"
          />
        ) : shown.status === 'error' ? (
          <div role="alert" className="flex max-w-xs flex-col items-center gap-2 text-center">
            <AlertTriangle aria-hidden className="h-5 w-5 text-danger-700" strokeWidth={1.75} />
            <p className="text-sm font-medium text-danger-800">We couldn’t draw your {name}. Nothing is wrong with your event — please try again.</p>
            <ActionButton tone="neutral" icon={RefreshCw} label="Try again" onClick={page > 1 ? retryOther : retryFirst} />
          </div>
        ) : (
          /* The paper's own shape while it is drawn — the box never jumps when the picture lands. */
          <span
            aria-hidden
            data-print-paper-waiting=""
            style={{ aspectRatio: String(paper.aspect) }}
            className={`block max-h-full max-w-full animate-pulse rounded-sm bg-[#EFEAE1] ${paper.aspect >= 1 ? 'w-full' : 'h-full'}`}
          />
        )}
        <p
          aria-hidden
          className={`pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full border border-ink/10 bg-cream px-3 py-1 text-[11.5px] font-semibold text-ink/55 transition-opacity duration-300 ${tip ? 'opacity-100' : 'opacity-0'}`}
        >
          Pinch or double-tap to zoom
        </p>
      </div>

      {pages > 1 ? (
        <div data-print-paper-pager="" className="flex min-h-[52px] flex-none items-center justify-center gap-1 px-2">
          <ActionButton tone="neutral" iconOnly icon={ChevronLeft} label="Previous page" disabled={page <= 1} onClick={() => go(-1)} className={REACH_44} />
          <div className="flex min-w-0 items-center gap-[5px] overflow-hidden px-2" aria-hidden>
            {pages <= PAPER_DOTS_MAX ? (
              Array.from({ length: pages }, (_, i) => (
                <i key={i} className={`h-1.5 w-1.5 flex-none rounded-full transition-transform ${i + 1 === page ? 'scale-150 bg-sn-accent' : 'bg-ink/25'}`} />
              ))
            ) : (
              <b className="whitespace-nowrap px-1 text-[12.5px] font-semibold text-ink/70">
                Page {page} of {pages}
              </b>
            )}
          </div>
          <ActionButton tone="neutral" iconOnly icon={ChevronRight} label="Next page" disabled={page >= pages} onClick={() => go(1)} className={REACH_44} />
        </div>
      ) : null}

      <div
        data-print-paper-foot=""
        className="max-h-[46%] flex-none overflow-y-auto overscroll-contain border-t border-ink/10 bg-cream px-4 pb-[max(10px,env(safe-area-inset-bottom))]"
      >
        <p data-print-paper-chips="" className="flex flex-wrap items-center gap-1.5 pb-0.5 pt-2.5">
          {chipsFor(paper, facts).map((c) => (
            <span key={c} className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-[12px] font-semibold ${c.startsWith('◆') ? 'bg-gild/20 text-ink' : 'bg-ink/[0.06] text-ink/70'}`}>
              {c}
            </span>
          ))}
        </p>
        <FormRows data="print-paper-foot">
          {extra}
          {sheet.size ?? null}
          {facts?.how ? <FormRow name="How many" line={facts.how} data="print-paper-how" /> : null}
        </FormRows>
        {empty ? (
          <div data-print-paper-empty="" className="flex flex-col items-start gap-1.5 py-2.5">
            <b className="text-[14.5px] text-ink">{empty.title}</b>
            <p className="text-[13px] text-ink/70">{empty.line}</p>
            {emptyDoor ? <PaperDoor door={emptyDoor} eventId={paper.eventId} onLeave={onClose} select={select} /> : null}
          </div>
        ) : null}
        {blocked ? null : (
          <div data-print-paper-actions="" className="flex flex-col gap-1 pb-1 pt-2">
            {sheet.changed ?? null}
            <div className="flex flex-wrap gap-1.5">{sheet.actions ?? null}</div>
          </div>
        )}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

const TIP_SAID = { done: false };

/** The door out of an empty state: where it is fixed, in place in the Maker; the Guest list is its own page. */
function PaperDoor({ door, eventId, onLeave, select }: { door: StudioPaperDoor; eventId: string; onLeave: () => void; select: ((key: never) => void) | null }) {
  if (door.kind === 'guests') {
    return <ActionButton tone="neutral" href={`/dashboard/${eventId}/guests`} label={door.label} icon={ChevronRight} />;
  }
  if (door.kind === 'here') {
    return (
      <ActionButton
        tone="neutral"
        label={door.label}
        icon={ChevronRight}
        onClick={() => {
          onLeave();
          window.requestAnimationFrame(() => document.querySelector<HTMLElement>(door.selector)?.focus());
        }}
      />
    );
  }
  if (!select) return null;
  return (
    <ActionButton
      tone="neutral"
      label={door.label}
      icon={ChevronRight}
      onClick={() => {
        onLeave();
        (select as (k: string) => void)(door.item);
      }}
    />
  );
}

/* ── 4 · THE ENTRANCE SEATING CHART — its own row ──────────────────────────── */

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
function useChartPick(eventId: string, fallback: ChartPick): [ChartPick, (next: ChartPick) => void] {
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
 * 🪧 The entrance seating chart's row (owner 2026-10-14: "the entrance seating chart is its own row"): its picture · its name and
 * blurb · its size ▾; under it By table | A to Z (the two-way pill) and ONE Save for the layout picked. When the names do not fit on
 * the size, the chart's own words say so, the Save is withheld, and the size that fits is one tap — never a chart that loses a name.
 */
export function StudioChartPaper({ chart }: { chart: StudioChartInput }) {
  const [pick, setPick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<{ src: string; f: PrintPaperFacts | null } | null>(null);
  const select = useContext(DetailsSelectContext);
  const spec = chart.sizes.find((s) => s.key === pick.size) ?? chart.sizes[0]!;
  const at = chartAddresses(chart.route, pick, chart.defaultSize);
  const f = facts?.src === at.preview ? facts.f : null;
  const tooFull = f?.fits === false;
  const suggest = tooFull && f?.suggest ? chart.sizes.find((s) => s.key === f.suggest) ?? null : null;
  const layoutLabel = chart.layouts.find((l) => l.key === pick.layout)?.label ?? '';
  const paper: StudioPaper = {
    item: 'seating-chart',
    eventId: chart.eventId,
    src: at.preview,
    aspect: spec.aspect,
    title: chart.title,
    chips: [`${spec.label} · ${spec.mm}`, layoutLabel, 'free'],
  };
  const show = () => {
    if (typeof window !== 'undefined' && !window.matchMedia(PHONE).matches && select) {
      (select as (k: string) => void)('seating-chart');
      return;
    }
    setOpen(true);
  };
  const sizeRow = (
    <ChosenRow
      name="Size"
      label="Chart size"
      value={pick.size}
      options={chart.sizes.map((s) => ({ key: s.key, label: s.label, hint: s.mm }))}
      onPick={(k) => setPick({ ...pick, size: k })}
      dataAttr="data-chart-size-picker"
      data="chart-size"
    />
  );
  const layoutRow = (
    <FormRow name="Layout" data="chart-layout">
      <PillSelector
        label="Chart layout"
        value={pick.layout}
        grow={false}
        options={chart.layouts.map((l) => ({ key: l.key, label: l.label }))}
        onPick={(k) => setPick({ ...pick, layout: k })}
        data="chart-layout"
      />
    </FormRow>
  );
  const fullLine = tooFull ? (
    <StatusLine
      tone="bad"
      data="chart-too-full"
      action={suggest ? { label: `Use ${suggest.label}`, onClick: () => setPick({ ...pick, size: suggest.key }) } : undefined}
    >
      {(f?.tooFull ?? []).join(' ')}
    </StatusLine>
  ) : null;
  const save = tooFull ? null : (
    <PrintSaveButton href={at.pdf} file={chart.files[pick.layout]} variant="action" main label={chart.saveLabels[pick.layout]} icon={<Download aria-hidden strokeWidth={1.9} />} />
  );
  return (
    <div data-studio-chart="" data-print-studio="" className="flex flex-col gap-1">
      <FormRows data="print-head" attrs={{ 'data-studio-print-rows': '' }}>
        <div data-print-paper-head="seating-chart" className="flex items-center gap-3">
          <PrintThumb paper={paper} onOpen={show} facts={(x) => setFacts({ src: at.preview, f: x })} />
          <div
            className="min-w-0 flex-1"
            onClick={(e) => {
              if ((e.target as Element).closest('[data-form-row-name]')) show();
            }}
          >
            <ChosenRow
              name={chart.title}
              line={chart.blurb}
              label="Chart size"
              value={pick.size}
              options={chart.sizes.map((s) => ({ key: s.key, label: s.label, hint: s.mm }))}
              onPick={(k) => setPick({ ...pick, size: k })}
              dataAttr="data-chart-size-picker"
              data="chart-head"
            />
          </div>
        </div>
      </FormRows>
      <FormRows data="chart-layout" attrs={{ 'data-studio-print-rows': '' }}>
        {layoutRow}
      </FormRows>
      {fullLine}
      {save ? (
        <div className="flex flex-wrap gap-1.5 pb-2" data-print-piece-saves="seating-chart">
          {save}
        </div>
      ) : null}
      {open ? (
        <PrintPaperSheet
          paper={paper}
          facts={f}
          onFacts={(x) => setFacts({ src: at.preview, f: x })}
          sheet={{ size: sizeRow, actions: save }}
          extra={
            <>
              {layoutRow}
              {fullLine ? <div className="py-2">{fullLine}</div> : null}
            </>
          }
          blocked={tooFull}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
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
