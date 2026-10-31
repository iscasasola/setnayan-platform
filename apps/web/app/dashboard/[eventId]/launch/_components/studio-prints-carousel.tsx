'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Share, Loader2, RefreshCw, UserRound } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { StatusLine } from '@/app/_components/status-line';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';
import { PAPER_EMPTY, paperPageSrc, type PrintPaperFacts } from '@/lib/print-paper';
import { PRINTED_CHANGED_EVENT, changedSincePrinted, readPrintedStamp } from '@/lib/printed-stamp';
import { MAX_PICKED_GUESTS } from '@/lib/print-picked-guests';
import { GUEST_TOKEN, GUEST_WORD_TOKEN, guestFileWord, type PrintGuest } from '@/lib/studio-prints-settings';
import { studioPrintsPieces, type StudioPrintsPiece } from '@/lib/studio-details';
import type { DetailsItemGroup, DetailsItemKey } from '@/lib/maker-details-items';
import { DetailsSelectContext } from './details-go';
import { chartHeadLine } from '@/lib/print-head-line';
import { chartAddresses, useChartPick, usePaper, type StudioPaper, type StudioPaperDoor } from './print-paper';
import { usePrintSave, type PrintSaveState } from './print-save-button';
import { usePassLookPick } from './pass-card-design-picker';
import { DEFAULT_PASS_CARD_DESIGN, PASS_CARD_DESIGNS, PASS_CARD_DESIGN_LABEL, PASS_CARD_WORDS, type PassCardDesign } from '@/lib/pass-card';
import { usePrintGuest, usePrintSlides, type AllInOneF, type PrintSlide } from './prints-view-store';

/**
 * 🎠 STUDIO › PRINTS IS A SWIPE CAROUSEL — owner, verbatim, 2026-10-26, looking at the Prints screen: *"So we can make like a swipe
 * carousel type where they can see the preview larger then under is the toolbar to pick style? and download options?"* · *"Does it
 * have print setting icon also"* · *"Ok build it"* (DECISION_LOG "APPROVED — PRINTS IS A SWIPE CAROUSEL"; prototype
 * `prototypes/prints_carousel_2026-10-26/index.html`, frames 2–6).
 *
 * THE DELTA over the shipped Prints (the files, the routes, the pickers and the sheets are the shipped ones):
 *   1 · ONE PRINT PER SLIDE — the print LARGE at its true paper proportions; swipe (touch and trackpad: CSS scroll-snap), ‹ › and the
 *       arrow keys on a computer; dots · its name ▾ (the grouped piece list — a jump) · ⓘ · one spec line.
 *   2 · THE TOOLBAR IN THE LOWER THIRD, two rows: row 1 chooses — the print's size ▾ (or Colours ▾ · File ▾ · Chart ▾), and View as ▾
 *       on the four guest prints; row 2 acts — ONE wide Download (▾ on a guest print: This one · All guests · N · Pick guests…, the
 *       shared Pick guests sheet). ⚙ Print settings (the shipped sheet; its first row is "Your Event Hub look ◆") was here until
 *       2026-10-31 — it is now the page's ONE ⚙, the top bar's (owner, relayed: *"the ⚙ on Prints opens Prints' own settings"*).
 *       Under it the count line, word for word (`guestPrintCountLine`) — the number is the file.
 *   3 · WHAT WENT: the long row list, the bottom piece bar (‹ · piece ▾ · › · ⬇) and the tap-to-enlarge paper sheet — the slide IS
 *       the large preview (pinch / double-tap to zoom stay on it).
 *   4 · ≥ 1024 px: the piece list left, the slide centre with ‹ ›, the same toolbar right as Form rows.
 *
 * ⚡ CHEAP TO SWIPE: only the slide on screen and its two neighbours ask for their picture (the one on screen at once and high, the
 * neighbours low — `usePaper`); every other slide is its paper's shape, empty. A picture asked once is never asked again.
 *
 * 🔒 Every print's slide is REGISTERED by its own part (`prints-view-store.ts`), drawn by the server from the shipped files — this
 * file never builds an address.
 */

const GuestPickSheet = dynamic(() => import(/* webpackChunkName: "prints-guest-sheet" */ './print-guest-sheet').then((m) => m.GuestPickSheet), { ssr: false });
const GuestManySheet = dynamic(() => import(/* webpackChunkName: "prints-guest-sheet" */ './print-guest-sheet').then((m) => m.GuestManySheet), { ssr: false });

/** A 40-px control reaches 44 px all round (the house floor), without growing its face. */
const REACH_44 = "relative after:absolute after:-inset-[3px] after:content-['']";

/** The guest a guest print's addresses name — `GUEST_TOKEN` / `GUEST_WORD_TOKEN` swapped for theirs (the row's own rule). */
const swap = (s: string, g: PrintGuest) => s.split(GUEST_TOKEN).join(encodeURIComponent(g.id)).split(GUEST_WORD_TOKEN).join(guestFileWord(g.name));
/** A picture with no guest to draw — the token taken out (the address then draws the first guest, as the row did). */
const unguest = (s: string) => s.split(`&pass_guest=${GUEST_TOKEN}`).join('').split(GUEST_TOKEN).join('');

/**
 * 🎫 The Digital ticket's picture in the look being edited — its own address with `design=` set to that look (the route draws the look
 * asked for, `passCardDesignFor`). A pick redraws the slide at once; the guests' own files keep the live look until Apply.
 */
export function withTicketLook(src: string, design: PassCardDesign): string {
  return /[?&]design=/.test(src) ? src.replace(/([?&]design=)[^&]*/, `$1${design}`) : `${src}${src.includes('?') ? '&' : '?'}design=${design}`;
}

/** "PDF" · "PNG" · ".zip" — a file's kind, read from its name. */
function fileKind(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'zip') return '.zip';
  return ext ? ext.toUpperCase() : '';
}

/** The plain print's file line — its kind and, once the route has said, its pages ("PDF · 6 pages"). */
export function printFileLine(file: string, facts: PrintPaperFacts | null): string {
  const kind = fileKind(file);
  const pages = facts?.pages ?? null;
  if (kind !== 'PDF' || pages === null) return kind;
  return `${kind} · ${formatCount(pages)} ${pages === 1 ? 'page' : 'pages'}`;
}

/**
 * 📥 DOWNLOAD ▾ ON A GUEST PRINT — the house dropdown's options (owner 2026-10-26: one button with its options, never a pill row):
 * This one (free, the guest View as ▾ shows) · All guests · N (the all-guests file, or its ◆ door) · Pick guests… (only where All
 * guests itself saves). Pure — the guard executes it (`prints-carousel-follows-the-prototype.test.ts`).
 */
export type GuestDownloadPick = 'one' | 'all' | 'pick';
export function guestDownloadOptions(slide: Pick<PrintSlide, 'guest'>, guest: PrintGuest | null): Array<PickOption & { key: GuestDownloadPick }> {
  const g = slide.guest;
  if (!g) return [];
  const list = g.guests ?? [];
  const out: Array<PickOption & { key: GuestDownloadPick }> = [];
  const noun = g.pickNoun?.one ?? 'one';
  if (guest) out.push({ key: 'one', label: `This ${noun}`, hint: `${guest.name} · free`, trail: { text: fileKind(swap(g.one.file, guest)), tone: 'muted' } });
  if (g.all) {
    out.push({
      key: 'all',
      label: list.length ? `All guests · ${formatCount(list.length)}` : 'All guests',
      hint: g.holds,
      ...(g.all.kind === 'save' ? { trail: { text: fileKind(g.all.file), tone: 'muted' as const } } : { icon: g.all.icon }),
    });
  }
  if (g.pickNoun !== null && g.all?.kind === 'save' && list.length > 0) {
    out.push({ key: 'pick', label: 'Pick guests…', hint: `Only the guests you tick, in one file · up to ${formatCount(MAX_PICKED_GUESTS)}` });
  }
  return out;
}

/** The words under the toolbar — the count line, word for word, or the file line. */
function countLine(slide: PrintSlide, facts: PrintPaperFacts | null): string {
  if (slide.guest) {
    if (slide.guest.guests === null) return 'Your guest list could not be read just now — reopen Prints in a moment.';
    if (slide.guest.guests.length === 0) return slide.guest.none;
    return slide.guest.holds;
  }
  if (slide.everything) return slide.everything.holds ?? slide.everything.line;
  if (slide.download) return printFileLine(slide.download.file, facts);
  return '';
}

/* ═══ THE CAROUSEL ════════════════════════════════════════════════════════════════════════════════════════════════════════ */

export function StudioPrintsCarousel({
  items,
  at,
  onSelect,
}: {
  /** The Prints form's items, in the form's order. */
  items: ReadonlyArray<{ key: DetailsItemKey; label: string; group: DetailsItemGroup }>;
  /** The item the workspace has picked — where the carousel opens. */
  at: DetailsItemKey;
  /** The workspace's `select(k)` — a swipe, ‹ › or a jump keeps the item in the address. */
  onSelect: (key: DetailsItemKey) => void;
}) {
  const pieces = useMemo(() => studioPrintsPieces(items), [items]);
  const slides = usePrintSlides();
  /* 🎫 The Digital ticket's look — the ONE pick (the Maker's draft store + the draft save); its slide and its Style ▾ read the same. */
  const ticket = slides.get('digital-ticket');
  const look = usePassLookPick(ticket?.guest?.eventId ?? '', ticket?.ticketStyle?.saved ?? DEFAULT_PASS_CARD_DESIGN);
  const ticketLook: PassCardDesign | null = ticket?.ticketStyle ? look.shown : null;
  const start = Math.max(0, pieces.findIndex((p) => p.key === at));
  const [i, setI] = useState(start);
  const track = useRef<HTMLDivElement>(null);
  const deskTrack = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const here = pieces[Math.min(i, pieces.length - 1)]!;
  const slide: PrintSlide = slides.get(here.key) ?? {};

  /** The visible track — the phone's or the computer's (one is `display:none`). */
  const visibleTrack = () => [track.current, deskTrack.current].find((t) => t && t.clientWidth > 0) ?? null;

  /* Opens on the item the workspace picked — at once, before paint, never a visible slide from the first print. */
  useLayoutEffect(() => {
    for (const t of [track.current, deskTrack.current]) if (t && t.clientWidth) t.scrollLeft = start * t.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const go = useCallback(
    (to: number, smooth = true) => {
      const n = Math.max(0, Math.min(pieces.length - 1, to));
      setI(n);
      onSelect(pieces[n]!.key);
      /* After the frame — a jump picked from the name ▾ closes its sheet first (its scroll lock and focus return would cancel a
         scroll started under it); and if the smooth scroll was cut short anyway, the slide is put in place. */
      window.requestAnimationFrame(() => {
        const t = visibleTrack();
        if (!t) return;
        const left = n * t.clientWidth;
        t.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
        window.setTimeout(() => {
          if (Math.abs(t.scrollLeft - left) > 2 && Math.round(t.scrollLeft / t.clientWidth) !== n) t.scrollTo({ left, behavior: 'auto' });
        }, 600);
      });
    },
    [pieces, onSelect],
  );

  /* A swipe settles on a slide: read where it stopped (the snap's own place) and name it — the item follows, once it has settled. */
  useEffect(() => {
    const ts = [track.current, deskTrack.current].filter((t): t is HTMLDivElement => t !== null);
    let timer = 0;
    const settle = (t: HTMLDivElement) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!t.clientWidth) return;
        const n = Math.round(t.scrollLeft / t.clientWidth);
        setI((cur) => {
          if (n !== cur && pieces[n]) onSelect(pieces[n]!.key);
          return pieces[n] ? n : cur;
        });
      }, 90);
    };
    const off = ts.map((t) => {
      const on = () => settle(t);
      t.addEventListener('scroll', on, { passive: true });
      return () => t.removeEventListener('scroll', on);
    });
    /* A width change (a rotation, the desktop's columns) keeps the same slide in place. */
    const ro = new ResizeObserver(() => {
      for (const t of ts) if (t.clientWidth) t.scrollLeft = Math.round(t.scrollLeft / t.clientWidth) * t.clientWidth;
    });
    for (const t of ts) ro.observe(t);
    return () => {
      window.clearTimeout(timer);
      off.forEach((f) => f());
      ro.disconnect();
    };
  }, [pieces, onSelect]);

  /* The item moved from elsewhere (a door that names a print) — the carousel follows. */
  useEffect(() => {
    const n = pieces.findIndex((p) => p.key === at);
    if (n >= 0 && n !== i) {
      setI(n);
      const t = visibleTrack();
      if (t) t.scrollTo({ left: n * t.clientWidth, behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the workspace's pick moves
  }, [at]);

  /* ⌨ ← → on a computer — not while typing, and not under an open sheet. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (!root.current || root.current.offsetParent === null) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const open = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="listbox"]')].some((d) => d.offsetParent !== null && !root.current!.contains(d));
      if (open) return;
      e.preventDefault();
      go(i + (e.key === 'ArrowRight' ? 1 : -1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, i]);

  /* The one save every Download press runs — so the one button wears "Preparing…" · "Tap to save" · the plain error. */
  const save = usePrintSave();
  const [guestOpen, setGuestOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [door, setDoor] = useState<Extract<AllInOneF, { kind: 'door' }> | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  /* A new slide starts with no word on its button from the last one. */
  const [savedFor, setSavedFor] = useState<string | null>(null);

  const g = slide.guest;
  const list = g?.guests ?? [];
  const [pickedGuest, setPickedGuest] = usePrintGuest(g?.eventId ?? '', list[0]?.id ?? null);
  const guest = list.find((x) => x.id === pickedGuest) ?? list[0] ?? null;
  const facts = useSlideFacts(slide, guest, ticketLook);

  const run = (href: string, file: string) => {
    setSavedFor(here.key);
    void save.save(href, file);
  };
  const state: PrintSaveState = savedFor === here.key ? save.state : { k: 'idle' };
  const actions = {
    onGuestPick: (k: string) => {
      if (!g) return;
      if (k === 'one' && guest) run(swap(g.one.href, guest), swap(g.one.file, guest));
      else if (k === 'all' && g.all?.kind === 'save') run(g.all.href, g.all.file);
      else if (k === 'all' && g.all?.kind === 'door') setDoor(g.all);
      else if (k === 'pick') setPickOpen(true);
    },
    onPlain: () => {
      const f = plainFile(slide, choices, here.key);
      if (f) run(f.href, f.file);
    },
    onEverything: () => {
      const all = slide.everything?.all;
      if (all?.kind === 'save') run(all.href, all.file);
      else if (all?.kind === 'door') setDoor(all);
    },
    onHref: (href: string, file: string) => run(href, file),
  };

  const tools = {
    here,
    slide,
    look: slide.ticketStyle ? look : null,
    guest,
    state,
    facts,
    choices,
    setChoice: (v: string) => setChoices((c) => ({ ...c, [here.key]: v })),
    openGuests: () => setGuestOpen(true),
    actions,
  };

  return (
    <div
      ref={root}
      data-prints-carousel=""
      data-prints-at={here.key}
      className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]"
    >
      {/* ≥ 1024 · the piece list — the navigator column (prototype frame 6). */}
      <nav aria-label="Prints" data-prints-navi="" className="hidden min-h-0 overflow-y-auto overscroll-contain border-r border-ink/10 px-2 py-2.5 lg:block">
        {groupsOf(pieces).map(([head, ps]) => (
          <div key={head}>
            <p className="px-3 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">{head.split(' · ')[0]}</p>
            {ps.map((p) => {
              const s = slides.get(p.key);
              const a = s?.paper?.aspect ?? s?.chart?.sizes.find((x) => x.key === s.chart?.defaultSize)?.aspect ?? 0.7;
              const on = p.key === here.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  data-prints-navi-item={p.key}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => go(pieces.indexOf(p))}
                  className={`sn-press flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] text-ink ${on ? 'bg-cream font-bold shadow-[inset_0_0_0_1px_rgb(var(--color-ink)/0.1)]' : ''}`}
                >
                  <span aria-hidden style={{ aspectRatio: String(a), width: a >= 1 ? 26 : 20 }} className="shrink-0 rounded-sm border border-ink/20 bg-white" />
                  <span className="min-w-0 truncate">{p.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* The slides — the phone's (full width), and on a computer the centre column with ‹ ›. */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:min-w-0">
        <Track refEl={track} pieces={pieces} slides={slides} at={i} guest={guest} ticketLook={ticketLook} onEdit={() => setEditOpen(true)} className="flex lg:hidden" />
        <Track refEl={deskTrack} pieces={pieces} slides={slides} at={i} guest={guest} ticketLook={ticketLook} onEdit={() => setEditOpen(true)} className="hidden lg:flex" desk />
        <span className="absolute left-5 top-1/2 hidden -translate-y-1/2 lg:block">
          <ActionButton tone="neutral" iconOnly icon={ChevronLeft} label="Previous print" disabled={i === 0} onClick={() => go(i - 1)} />
        </span>
        <span className="absolute right-5 top-1/2 hidden -translate-y-1/2 lg:block">
          <ActionButton tone="neutral" iconOnly icon={ChevronRight} label="Next print" disabled={i === pieces.length - 1} onClick={() => go(i + 1)} />
        </span>
        <Under pieces={pieces} at={i} slide={slide} onJump={(k) => go(pieces.findIndex((p) => p.key === k))} onEdit={() => setEditOpen(true)} />
      </div>

      {/* The toolbar — the lower third on a phone; the right column's Form rows on a computer. */}
      <PhoneTools {...tools} />
      <DeskTools {...tools} />

      {guestOpen && g && list.length ? (
        <GuestPickSheet guests={list} value={guest?.id ?? null} onPick={setPickedGuest} onClose={() => setGuestOpen(false)} />
      ) : null}
      {pickOpen && g?.all?.kind === 'save' && g.pickNoun ? (
        <GuestManySheet guests={list} href={g.all.href} file={g.all.file} noun={g.pickNoun} onClose={() => setPickOpen(false)} />
      ) : null}
      {editOpen && slide.edit ? <EditSheet title={slide.edit.label} onClose={() => setEditOpen(false)}>{slide.edit.body}</EditSheet> : null}
      <ProNote door={door} onClose={() => setDoor(null)} />
    </div>
  );
}

/** The pieces under their group words, in order. */
function groupsOf(pieces: readonly StudioPrintsPiece[]): Array<[string, StudioPrintsPiece[]]> {
  const out: Array<[string, StudioPrintsPiece[]]> = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last && last[0] === p.group) last[1].push(p);
    else out.push([p.group, [p]]);
  }
  return out;
}

/** A plain print's file — its one Download, or (Colours ▾ · File ▾) the file picked, or the chart's for its pick. */
function plainFile(slide: PrintSlide, choices: Record<string, string>, item: string): { href: string; file: string } | null {
  if (slide.choice) {
    const o = slide.choice.options.find((c) => c.key === choices[item]) ?? slide.choice.options[0];
    return o ? { href: o.href, file: o.file } : null;
  }
  return slide.download ?? null;
}

/* ═══ ONE SLIDE ═══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/** The slide's picture address — the guest's own on a guest print, the chart's for its pick. */
function useSlideSrc(slide: PrintSlide | undefined, guest: PrintGuest | null, ticketLook: PassCardDesign | null = null): { src: string | null; aspect: number } {
  const chart = slide?.chart;
  const [pick] = useChartPick(chart?.eventId ?? '', { layout: 'table', size: chart?.defaultSize ?? '' });
  if (chart) {
    const spec = chart.sizes.find((s) => s.key === pick.size) ?? chart.sizes[0]!;
    return { src: chartAddresses(chart.route, pick, chart.defaultSize).preview, aspect: spec.aspect };
  }
  const paper = slide?.paper;
  if (!paper) return { src: null, aspect: 0.7 };
  if (slide.guest) {
    const drawn = guest && slide.guest.guestPicture ? swap(paper.src, guest) : unguest(paper.src);
    return { src: slide.ticketStyle && ticketLook ? withTicketLook(drawn, ticketLook) : drawn, aspect: paper.aspect };
  }
  return { src: paper.src, aspect: paper.aspect };
}

/** What the route said about the slide's paper (pages · empty · fits) — read from the picture already asked for. */
function useSlideFacts(slide: PrintSlide, guest: PrintGuest | null, ticketLook: PassCardDesign | null): PrintPaperFacts | null {
  const { src } = useSlideSrc(slide, guest, ticketLook);
  const [state] = usePaper(src, false);
  return state.loaded?.facts ?? null;
}

function Track({
  refEl,
  pieces,
  slides,
  at,
  guest,
  ticketLook,
  onEdit,
  className,
  desk = false,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  pieces: readonly StudioPrintsPiece[];
  slides: ReadonlyMap<string, PrintSlide>;
  at: number;
  guest: PrintGuest | null;
  ticketLook: PassCardDesign | null;
  onEdit: () => void;
  className: string;
  desk?: boolean;
}) {
  return (
    <div
      ref={refEl}
      aria-label="Your prints — swipe"
      aria-roledescription="carousel"
      data-prints-track={desk ? 'desk' : 'phone'}
      className={`${className} min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      {pieces.map((p, j) => (
        <Slide key={p.key} piece={p} slide={slides.get(p.key)} near={Math.abs(j - at) <= 1} current={j === at} guest={guest} ticketLook={ticketLook} onEdit={onEdit} desk={desk} />
      ))}
    </div>
  );
}

const ZOOM_IN = 2.5;
const ZOOM_MAX = 4;

function Slide({
  piece,
  slide,
  near,
  current,
  guest,
  ticketLook,
  onEdit,
  desk,
}: {
  piece: StudioPrintsPiece;
  slide: PrintSlide | undefined;
  near: boolean;
  current: boolean;
  guest: PrintGuest | null;
  ticketLook: PassCardDesign | null;
  onEdit: () => void;
  desk: boolean;
}) {
  const { src, aspect } = useSlideSrc(slide, slide?.guest ? guest : null, ticketLook);
  const [page, setPage] = useState(1);
  const [first, retryFirst] = usePaper(src, near, current);
  const pages = slide?.paper?.pages ? Math.max(1, first.loaded?.facts?.pages ?? 1) : 1;
  const [other, retryOther] = usePaper(page > 1 && src ? paperPageSrc(src, page) : null, near && page > 1, current);
  const shown = page > 1 ? other : first;
  useEffect(() => setPage(1), [src]);
  const facts = first.loaded?.facts ?? null;
  const empty = slide?.paper?.empty ?? (facts?.empty ? PAPER_EMPTY[facts.empty] : null);
  const emptyDoor: StudioPaperDoor | null =
    slide?.paper?.empty?.door ?? (facts?.empty ? (PAPER_EMPTY[facts.empty].door === 'seating' ? { kind: 'item', item: 'seating', label: 'Open Seat plan' } : { kind: 'guests', label: 'Open Guest list' }) : null);
  /* The paper's largest box at its shape (prototype `fitPaper`): the slide's room, never past 346 px wide (landscape) / 300 (portrait) on a phone. */
  const cap = desk ? 620 : aspect >= 1 ? 346 : 300;
  const name = (slide?.name ?? piece.label).replace(/^the\s+/i, '');

  return (
    <div
      data-prints-slide={piece.key}
      data-prints-slide-near={near ? '' : undefined}
      aria-hidden={current ? undefined : true}
      className={`flex h-full w-full shrink-0 snap-center snap-always flex-col items-center ${desk ? 'px-[90px] py-6' : 'px-[22px] pb-1.5 pt-3.5'}`}
    >
      <div className="grid min-h-0 w-full flex-1 place-items-center [container-type:size]">
        <Zoomable on={current} pages={pages} page={page} onPage={setPage}>
          <div
            data-prints-paper={piece.key}
            data-prints-paper-state={near ? shown.status : 'far'}
            style={{ aspectRatio: String(aspect), width: `min(100cqw, calc(100cqh * ${aspect}), ${cap}px)` }}
            className={`relative overflow-hidden shadow-[0_14px_34px_-14px_rgba(30,26,18,.45),0_1px_0_rgba(0,0,0,.05)] ${near && shown.status === 'error' ? 'bg-cream ring-1 ring-ink/10' : 'bg-white'} ${aspect === 1 || piece.key === 'digital-ticket' ? 'rounded-md' : 'rounded-sm'}`}
          >
            {near && shown.status === 'loaded' && shown.loaded ? (
              // eslint-disable-next-line @next/next/no-img-element -- the print's own picture from its route (an SVG/PNG/JPEG blob)
              <img src={shown.loaded.url} alt={`${name}${pages > 1 ? ` — page ${formatCount(page)} of ${formatCount(pages)}` : ''}`} draggable={false} decoding="async" className="block h-full w-full select-none object-contain" />
            ) : near && shown.status === 'error' ? (
              <span role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                <AlertTriangle aria-hidden className="h-5 w-5 text-danger-700" strokeWidth={1.75} />
                <span className="text-[12.5px] font-medium text-danger-800">We couldn’t draw your {name.toLowerCase()}. Nothing is wrong with your event.</span>
                <ActionButton tone="neutral" icon={RefreshCw} label="Try again" onClick={page > 1 ? retryOther : retryFirst} />
              </span>
            ) : (
              /* The paper is always white (it is a print), in dark mode too — so its waiting words are dark on it, never the theme's ink. */
              <span aria-hidden className={`absolute inset-0 grid place-items-center bg-black/[0.05] text-[11px] font-semibold tracking-[0.04em] text-black/45 ${near ? 'animate-pulse' : ''}`}>
                {near ? 'Drawing…' : ''}
              </span>
            )}
          </div>
        </Zoomable>
      </div>
      {empty ? (
        <p data-prints-slide-empty={piece.key} className="flex flex-none flex-wrap items-center justify-center gap-x-2 pt-2 text-center text-[12.5px]">
          <b className="font-semibold text-sn-accent">{empty.title}</b>
          {emptyDoor && current ? <SlideDoor door={emptyDoor} eventId={slide?.paper?.eventId ?? ''} onEdit={onEdit} /> : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Pinch, double-tap or ctrl + wheel to zoom, drag to look around — on the slide being looked at (the retired paper sheet's gestures).
 * Not zoomed, a one-finger drag is the carousel's swipe (`touch-action: pan-x`); zoomed, it moves the paper. A file of several pages
 * keeps its page badge — a press turns the page.
 */
function Zoomable({ on, pages, page, onPage, children }: { on: boolean; pages: number; page: number; onPage: (p: number) => void; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  useEffect(() => setView({ z: 1, x: 0, y: 0 }), [on, page]);
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
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ dist: 0, z: 1, lastX: 0, lastY: 0, moved: false, lastTap: 0 });
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!on) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.moved = false;
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      g.dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      g.z = view.z;
    } else {
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      if (view.z > 1) e.currentTarget.setPointerCapture?.(e.pointerId);
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
    } else if (Math.abs(e.clientX - g.lastX) + Math.abs(e.clientY - g.lastY) > 8) {
      g.moved = true;
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (pts.current.size === 1 && !g.moved) {
      const now = Date.now();
      if (now - g.lastTap < 320) {
        zoomTo(view.z > 1 ? 1 : ZOOM_IN, e.clientX, e.clientY);
        g.lastTap = 0;
      } else g.lastTap = now;
    }
    pts.current.delete(e.pointerId);
  };
  return (
    <div
      ref={stage}
      data-prints-zoom={view.z > 1 ? 'in' : 'out'}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={(e) => pts.current.delete(e.pointerId)}
      onWheel={(e) => {
        if (!on || (!e.ctrlKey && !e.metaKey)) return;
        zoomTo(view.z * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY);
      }}
      style={{ touchAction: view.z > 1 ? 'none' : 'pan-x' }}
      className="relative grid h-full w-full select-none place-items-center"
    >
      <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }} className="relative origin-center transition-transform duration-75 will-change-transform">
        {children}
        {pages > 1 ? (
          <button
            type="button"
            data-prints-pages={pages}
            aria-label={`Page ${formatCount(page)} of ${formatCount(pages)} — next page`}
            onClick={() => onPage(page >= pages ? 1 : page + 1)}
            className={`absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-[3px] text-[10px] font-semibold tracking-[0.06em] text-cream ${REACH_44}`}
          >
            {page === 1 ? `${formatCount(pages)} pages` : `${formatCount(page)} of ${formatCount(pages)}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The door out of an empty slide: where it is fixed — the Menu's editor here, the Love Story or the Seat plan in place, the Guest list. */
function SlideDoor({ door, eventId, onEdit }: { door: StudioPaperDoor; eventId: string; onEdit: () => void }) {
  const select = useContext(DetailsSelectContext);
  if (door.kind === 'edit') return <ActionButton tone="neutral" label={door.label} icon={ChevronRight} onClick={onEdit} />;
  if (door.kind === 'guests') return <ActionButton tone="neutral" href={`/dashboard/${eventId}/guests`} label={door.label} icon={ChevronRight} />;
  if (!select) return null;
  return <ActionButton tone="neutral" label={door.label} icon={ChevronRight} onClick={() => (select as (k: string) => void)(door.item)} />;
}

/* ═══ UNDER THE SLIDE: dots · name ▾ ⓘ · spec ═════════════════════════════════════════════════════════════════════════════ */

function Under({
  pieces,
  at,
  slide,
  onJump,
  onEdit,
}: {
  pieces: readonly StudioPrintsPiece[];
  at: number;
  slide: PrintSlide;
  onJump: (key: string) => void;
  onEdit: () => void;
}) {
  const here = pieces[at]!;
  const name = (slide.name ?? here.label).replace(/^the\s+/i, '');
  const changed = useChanged(slide.printed);
  return (
    <div data-prints-under="" className="relative flex flex-none flex-col items-center gap-1 px-4 pb-0.5 pt-1 lg:pb-4">
      <div aria-hidden className="flex h-4 items-center gap-[5px]" data-prints-dots={pieces.length}>
        {pieces.map((p, j) => (
          <i key={p.key} className={`h-1.5 rounded-full transition-all duration-200 ${j === at ? 'w-[18px] bg-sn-accent' : 'w-1.5 bg-ink/20'}`} />
        ))}
      </div>
      <div className="flex min-h-11 items-center gap-1">
        <PickMenu
          label="Prints — which print"
          value={here.key}
          options={pieces.map((p) => ({ key: p.key, label: p.label, group: p.group }))}
          onPick={onJump}
          stickyGroups
          dataAttr="data-prints-jump"
          className="sn-press inline-flex h-10 max-w-[70vw] items-center gap-1.5 rounded-full bg-cream/80 pl-3 pr-2.5 text-[17px] font-bold tracking-[-0.01em] text-ink lg:max-w-none"
          trigger={
            <>
              <span className="min-w-0 truncate">{name}</span>
              {changed ? <span aria-label="Changed since you printed" data-prints-changed-dot="" className="h-2 w-2 shrink-0 rounded-full bg-warn-600" /> : null}
              <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-sn-accent" strokeWidth={2.6} />
            </>
          }
        />
        {/* ⓘ — its popover spans the slide's width just above the name (prototype `.tip`): the tip is placed against this row, not its dot. */}
        <span
          className="inline-flex h-11 w-11 items-center justify-center [&_.sn-tip]:!bottom-full [&_.sn-tip]:!left-4 [&_.sn-tip]:!right-4 [&_.sn-tip]:!top-auto [&_.sn-tip]:!w-auto [&_.sn-tip]:!max-w-[26rem] [&_.sn-tip]:!pb-2 [&_.sn-tip]:!pt-0 [&_.sn-tip]:![translate:0_0] lg:[&_.sn-tip]:!left-1/2 lg:[&_.sn-tip]:!w-[22rem] lg:[&_.sn-tip]:!-translate-x-1/2"
          data-prints-tip=""
        >
          <InfoTip label={name} labelClassName="sr-only" ariaLabel={`About ${name}`} className="!static">
            <b className="block font-semibold text-ink">{name}</b>
            {slide.tip ?? null}
            {slide.guest?.pickNoun && slide.guest.all?.kind === 'save' ? (
              <span className="mt-1 block">Pick guests prints only the guests you tick, in one file (up to {formatCount(MAX_PICKED_GUESTS)}).</span>
            ) : null}
            {slide.changed ? <span className="mt-1 block">{slide.changed}</span> : null}
            {slide.edit ? (
              <span className="mt-2 block">
                <ActionButton tone="neutral" label={slide.edit.label} icon={ChevronRight} onClick={onEdit} />
              </span>
            ) : null}
          </InfoTip>
        </span>
      </div>
      <p data-prints-spec="" className="max-w-full truncate text-center text-[12.5px] text-ink/65">
        {slide.chart ? <ChartSpec chart={slide.chart} /> : specLine(slide)}
      </p>
    </div>
  );
}

/** The one spec line — the chosen size, never every size. */
function specLine(slide: PrintSlide): string {
  if (slide.everything) return 'one file · Event Hub Pro';
  return slide.line ?? '';
}

/** 🪧 The entrance chart's spec line — the CHOSEN size only ("A2 · one sheet for the door", `chartHeadLine`), the chart's own pick. */
function ChartSpec({ chart }: { chart: NonNullable<PrintSlide['chart']> }) {
  const [pick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  const spec = chart.sizes.find((s) => s.key === pick.size) ?? chart.sizes[0]!;
  return <>{chartHeadLine(spec)}</>;
}

/** "Changed since you printed" applies to this piece (this browser saved it, and its inputs moved on). */
function useChanged(printed: PrintSlide['printed']): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!printed) {
      setOn(false);
      return;
    }
    const read = () => setOn(changedSincePrinted(readPrintedStamp(printed.eventId, printed.piece), printed.version));
    read();
    window.addEventListener(PRINTED_CHANGED_EVENT, read);
    return () => window.removeEventListener(PRINTED_CHANGED_EVENT, read);
  }, [printed?.eventId, printed?.piece, printed?.version]); // eslint-disable-line react-hooks/exhaustive-deps -- the stamp's address
  return on;
}

/* ═══ THE TOOLBAR ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */

type ToolsProps = {
  here: StudioPrintsPiece;
  slide: PrintSlide;
  /** 🎫 The Digital ticket's look and its pick (only on that slide). */
  look: ReturnType<typeof usePassLookPick> | null;
  guest: PrintGuest | null;
  state: PrintSaveState;
  facts: PrintPaperFacts | null;
  choices: Record<string, string>;
  setChoice: (v: string) => void;
  openGuests: () => void;
  actions: { onGuestPick: (k: string) => void; onPlain: () => void; onEverything: () => void; onHref: (href: string, file: string) => void };
};

/** The pill every row-1 choice wears (prototype `.pill`) — the house dropdown's button, 44 px. */
const PILL = 'sn-press inline-flex h-11 min-w-0 max-w-full items-center gap-[7px] whitespace-nowrap rounded-full border border-ink/20 bg-cream pl-3.5 pr-3 text-[13.5px] font-semibold text-ink';
const CARET = <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-sn-accent" strokeWidth={2.6} />;

/** Row 1's dropdowns, for either look: `kind` names which, `node` draws it. */
function choiceControls(p: ToolsProps, look: 'pill' | 'row'): Array<{ key: string; name: string; node: ReactNode }> {
  const { slide, here } = p;
  const out: Array<{ key: string; name: string; node: ReactNode }> = [];
  const cls = look === 'pill' ? PILL : `${PILL} !h-10 border-transparent !bg-ink/[0.05]`;
  if (slide.choice) {
    const c = slide.choice;
    const value = p.choices[here.key] ?? c.options[0]?.key ?? '';
    const label = c.options.find((o) => o.key === value)?.label ?? '';
    out.push({
      key: 'choice',
      name: c.label,
      node: (
        <PickMenu
          label={c.label}
          value={value}
          options={c.options.map((o) => ({ key: o.key, label: o.label }))}
          onPick={p.setChoice}
          dataAttr="data-prints-choice"
          className={cls}
          trigger={
            <>
              {look === 'pill' ? <span className="font-medium text-ink/55">{c.label}</span> : null}
              <span className="min-w-0 truncate">{label}</span>
              {CARET}
            </>
          }
        />
      ),
    });
  }
  if (slide.chart) out.push(...chartControls(slide.chart, cls, look));
  if (slide.size) {
    const s = slide.size;
    out.push({
      key: 'size',
      name: 'Size',
      node: <SizePick size={s} className={cls} />,
    });
  }
  if (slide.ticketStyle && p.look) {
    out.push({ key: 'style', name: PASS_CARD_WORDS.style, node: <TicketStylePick style={slide.ticketStyle} look={p.look} className={cls} /> });
  }
  if (slide.guest && p.guest) {
    const name = p.guest.name;
    out.push({
      key: 'view',
      name: 'View as',
      node: (
        <button type="button" data-prints-view-as="" aria-haspopup="dialog" aria-label={`View as — which guest: ${name}`} onClick={p.openGuests} className={`${cls} ${look === 'pill' ? 'flex-1' : ''}`}>
          {look === 'pill' ? (
            <>
              <UserRound aria-hidden className="h-[18px] w-[18px] shrink-0 min-[381px]:hidden" strokeWidth={2} />
              <span className="font-medium text-ink/55 max-[380px]:hidden">View as</span>
            </>
          ) : null}
          <span className="min-w-0 truncate">{name}</span>
          {CARET}
        </button>
      ),
    });
  }
  return out;
}

/**
 * 🎫 THE DIGITAL TICKET'S STYLE ▾ (owner 2026-10-26, verbatim: *"The 3 designs for the digital ticket should be on the carousel and not
 * on settings."*) — the house dropdown, Classic · Ticket · Photo poster, each with its small picture in the list, beside View as ▾ (the
 * Event pass's Calling card ▾ is its twin). A pick redraws the slide for the guest shown at once and WAITS FOR APPLY — said in the open
 * list — through the ONE ticket-style pick (`usePassLookPick`: the Maker's draft store, the draft save); a refused save is put back
 * and said under the toolbar.
 */
function TicketStylePick({ style, look, className }: { style: NonNullable<PrintSlide['ticketStyle']>; look: NonNullable<ToolsProps['look']>; className: string }) {
  return (
    <PickMenu
      label={PASS_CARD_WORDS.style}
      value={look.shown}
      options={PASS_CARD_DESIGNS.map((d) => ({ key: d, label: PASS_CARD_DESIGN_LABEL[d], thumb: style.previews[d] }))}
      onPick={look.pick}
      dataAttr="data-prints-ticket-style"
      className={className}
      head={
        <li role="none" data-prints-ticket-style-line="" className="px-3 pb-1.5 pt-1 text-[12px] text-ink/60">
          What each guest saves · waits for Apply
        </li>
      }
      trigger={
        <>
          <span className="min-w-0 truncate" aria-busy={look.pending || undefined}>
            {PASS_CARD_DESIGN_LABEL[look.shown]}
          </span>
          {CARET}
        </>
      }
    />
  );
}

/** 📐 The size ▾ — a pick NAVIGATES to the address the row's `PrintChoicePicker` always went to (the piece redraws in that size). */
function SizePick({ size, className }: { size: NonNullable<PrintSlide['size']>; className: string }) {
  const router = useContext(AppRouterContext);
  const label = size.options.find((o) => o.key === size.value)?.label ?? size.value;
  return (
    <PickMenu
      label={size.label}
      value={size.value}
      options={size.options.map(({ href: _h, ...o }) => o)}
      onPick={(key) => {
        const hit = size.options.find((o) => o.key === key);
        if (!hit || key === size.value) return;
        if (router) router.push(hit.href, { scroll: false });
        else window.location.assign(hit.href);
      }}
      dataAttr={size.dataAttr ?? 'data-print-format-picker'}
      className={className}
      trigger={
        <>
          <span className="min-w-0 truncate">{label}</span>
          {CARET}
        </>
      }
    />
  );
}

/** 🪧 The entrance chart's Chart ▾ (By table · A to Z) and size ▾ — the chart's own pick (`useChartPick`). */
function chartControls(chart: NonNullable<PrintSlide['chart']>, cls: string, look: 'pill' | 'row'): Array<{ key: string; name: string; node: ReactNode }> {
  return [
    { key: 'chart', name: 'Chart', node: <ChartLayoutPick chart={chart} className={cls} look={look} /> },
    { key: 'size', name: 'Size', node: <ChartSizePick chart={chart} className={cls} /> },
  ];
}
function ChartLayoutPick({ chart, className, look }: { chart: NonNullable<PrintSlide['chart']>; className: string; look: 'pill' | 'row' }) {
  const [pick, setPick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  const label = chart.layouts.find((l) => l.key === pick.layout)?.label ?? '';
  return (
    <PickMenu
      label="Entrance chart layout"
      value={pick.layout}
      options={chart.layouts.map((l) => ({ key: l.key, label: l.label }))}
      onPick={(k) => setPick({ ...pick, layout: k as typeof pick.layout })}
      dataAttr="data-chart-layout-picker"
      className={className}
      trigger={
        <>
          {look === 'pill' ? <span className="font-medium text-ink/55">Chart</span> : null}
          <span className="min-w-0 truncate">{label}</span>
          {CARET}
        </>
      }
    />
  );
}
function ChartSizePick({ chart, className }: { chart: NonNullable<PrintSlide['chart']>; className: string }) {
  const [pick, setPick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  const spec = chart.sizes.find((s) => s.key === pick.size) ?? chart.sizes[0]!;
  return (
    <PickMenu
      label="Chart size"
      value={pick.size}
      options={chart.sizes.map((s) => ({ key: s.key, label: s.label, hint: s.mm }))}
      onPick={(k) => setPick({ ...pick, size: k })}
      dataAttr="data-chart-size-picker"
      className={className}
      trigger={
        <>
          <span className="min-w-0 truncate">{spec.label}</span>
          {CARET}
        </>
      }
    />
  );
}

/** The words a Download wears for its save's state — the shipped save button's own. */
function saveWord(state: PrintSaveState, idle: string): string {
  return state.k === 'working' ? 'Preparing…' : state.k === 'ready' ? 'Tap to save' : idle;
}
function SaveSaid({ state }: { state: PrintSaveState }) {
  if (state.k === 'error')
    return (
      <span role="alert" data-prints-save-said="error" className="block text-xs text-danger-700">
        {state.message}
      </span>
    );
  if (state.k === 'ready')
    return (
      <span role="status" data-prints-save-said="ready" className="block text-xs text-ink/60">
        Your file is ready.
      </span>
    );
  if (state.k === 'saved')
    return (
      <span role="status" data-prints-save-said="saved" className="block text-xs text-ink/60">
        {state.via === 'share' ? 'Saved.' : 'Sent to your downloads.'}
      </span>
    );
  return null;
}

/**
 * ⬇ THE ROW'S MAIN VERB — ONE wide Download. A guest print: Download ▾, the house dropdown (`guestDownloadOptions`). A plain print:
 * one press, one file. Everything: ◆ Download everything (the file, or the ◆ door). The chart, too full for its size: withheld — the
 * chart's own words say why, with the size that fits one tap away.
 */
function DownloadControl(p: ToolsProps & { wide?: boolean }) {
  const { slide, state } = p;
  const busy = state.k === 'working';
  const main = actionButtonClass('brand', { main: true, extra: 'min-h-12 w-full justify-center !text-[15px]' });
  const icon = busy ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : <Share aria-hidden strokeWidth={1.9} />;
  if (slide.guest) {
    const options = guestDownloadOptions(slide, p.guest);
    if (!options.length) return <ActionButton tone="brand" main icon={Share} label="Download" disabled className="min-h-12 w-full justify-center" />;
    return (
      <PickMenu
        label="Download"
        value={null}
        options={options}
        onPick={p.actions.onGuestPick}
        dataAttr="data-prints-download"
        className={main}
        buttonText={saveWord(state, 'Download')}
        trigger={
          <>
            {icon}
            <span className="lbl">{saveWord(state, 'Download')}</span>
            <ChevronDown aria-hidden data-caret="" className="-ml-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.8} />
          </>
        }
      />
    );
  }
  if (slide.everything) {
    const all = slide.everything.all;
    if (all === null) return null;
    return (
      <span data-prints-download="everything" className="flex w-full">
        <ActionButton tone="brand" main icon={busy ? icon : all.icon ?? Share} label={saveWord(state, 'Download everything')} waiting={busy} onClick={p.actions.onEverything} className="min-h-12 w-full justify-center" />
      </span>
    );
  }
  if (slide.chart) return <ChartDownload {...p} />;
  const f = plainFile(slide, p.choices, p.here.key);
  return (
    <span data-prints-download="plain" className="flex w-full">
      <ActionButton tone="brand" main icon={busy ? icon : Share} label={saveWord(state, 'Download')} waiting={busy} disabled={!f} onClick={p.actions.onPlain} className="min-h-12 w-full justify-center" />
    </span>
  );
}

function ChartDownload(p: ToolsProps) {
  const chart = p.slide.chart!;
  const [pick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  const at = chartAddresses(chart.route, pick, chart.defaultSize);
  const busy = p.state.k === 'working';
  const tooFull = p.facts?.fits === false;
  if (tooFull) return <ActionButton tone="brand" main icon={Share} label="Download" disabled className="min-h-12 w-full justify-center" />;
  return (
    <span data-prints-download="chart" className="flex w-full">
      <ActionButton
        tone="brand"
        main
        icon={busy ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : Share}
        label={saveWord(p.state, 'Download')}
        waiting={busy}
        onClick={() => p.actions.onHref(at.pdf, chart.files[pick.layout])}
        className="min-h-12 w-full justify-center"
      />
    </span>
  );
}

/** The chart's "too full" words, with the size that fits one tap away — in place of the count line. */
function ChartFull({ chart, facts }: { chart: NonNullable<PrintSlide['chart']>; facts: PrintPaperFacts | null }) {
  const [pick, setPick] = useChartPick(chart.eventId, { layout: 'table', size: chart.defaultSize });
  if (facts?.fits !== false) return null;
  const suggest = facts.suggest ? chart.sizes.find((s) => s.key === facts.suggest) ?? null : null;
  return (
    <StatusLine tone="bad" data="chart-too-full" action={suggest ? { label: `Use ${suggest.label}`, onClick: () => setPick({ ...pick, size: suggest.key }) } : undefined}>
      {(facts.tooFull ?? []).join(' ')}
    </StatusLine>
  );
}

/* ⚙ The slides' own ⚙ (the phone's, beside Download) and the computer's "Print settings" row are gone (owner 2026-10-31): the
   Prints page's ONE ⚙ is its top bar's (`StudioPrintSettingsDoor`, `maker-shell.tsx`) — the same sheet, one ⚙ per page. */

function CountLine(p: ToolsProps) {
  if (p.slide.chart && p.facts?.fits === false) return <ChartFull chart={p.slide.chart} facts={p.facts} />;
  /* 🎫 A ticket style that did not save is put back — and said here, in place of the count, until the next pick. */
  if (p.look?.error) return <StatusLine tone="bad" data="pass-style">{p.look.error}</StatusLine>;
  const words = p.slide.chart ? '' : countLine(p.slide, p.facts);
  return (
    <p data-prints-count={p.here.key} className="line-clamp-2 min-h-4 px-0.5 text-[12px] leading-[1.35] text-ink/65">
      {words}
    </p>
  );
}

/** 📱 The phone's toolbar — the lower third (prototype `.tools`): row 1 chooses, row 2 acts, the count line under it. */
function PhoneTools(p: ToolsProps) {
  const row1 = choiceControls(p, 'pill');
  return (
    <div
      data-prints-tools="phone"
      className="flex flex-none flex-col gap-2 border-t border-ink/10 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      {row1.length ? (
        <div data-prints-row="choose" className="flex min-w-0 items-center gap-2">
          {row1.map((c) => (
            <span key={c.key} data-prints-choose={c.key} className={`flex min-w-0 ${c.key === 'view' ? 'flex-1' : 'flex-none'}`}>
              {c.node}
            </span>
          ))}
        </div>
      ) : null}
      <div data-prints-row="act" className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1">
          <DownloadControl {...p} />
        </span>
      </div>
      <SaveSaid state={p.state} />
      <CountLine {...p} />
    </div>
  );
}

/** 🖥 The computer's toolbar — the right column, the same controls as Form rows (prototype frame 6 `.panel`). */
function DeskTools(p: ToolsProps) {
  const rows = choiceControls(p, 'row');
  return (
    <aside data-prints-tools="desk" aria-label="Tools" className="hidden min-h-0 flex-col gap-2.5 overflow-y-auto border-l border-ink/10 px-3 pb-4 pt-3 lg:flex">
      <FormRows data="prints-choose">
        {rows.length ? (
          rows.map((c) => (
            <FormRow key={c.key} name={c.name} data={`prints-${c.key}`}>
              {c.node}
            </FormRow>
          ))
        ) : (
          <FormRow name="Nothing to choose — one file" data="prints-none" />
        )}
      </FormRows>
      <div className="flex flex-col gap-2 border-t border-ink/10 px-2.5 pb-1 pt-3">
        <DownloadControl {...p} />
        <SaveSaid state={p.state} />
        <CountLine {...p} />
      </div>
    </aside>
  );
}

/* ═══ SHEETS ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/** The Menu's dishes (its shipped editor — it saves as you go), in the house sheet, above the Maker. */
function EditSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const headId = useId();
  const node = (
    <div data-prints-edit-layer="" className="relative z-[96]">
      <Sheet open onClose={onClose} title={title} labelledById={headId}>
        <div data-prints-edit-sheet="" className="max-h-[78dvh] overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </Sheet>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

/** ◆ An all-guests file that is Event Hub Pro: the prints' own centred note (`StudioProDoor`'s), "Event Hub Pro" follows its link. */
function ProNote({ door, onClose }: { door: Extract<AllInOneF, { kind: 'door' }> | null; onClose: () => void }) {
  const router = useContext(AppRouterContext);
  return (
    <ConfirmDialog
      open={door !== null}
      title={door?.note.title ?? ''}
      body={door?.note.body ?? ''}
      confirmLabel="Event Hub Pro"
      cancelLabel="Not now"
      onConfirm={() => {
        const href = door?.href;
        onClose();
        if (!href) return;
        if (router) router.push(href);
        else window.location.assign(href);
      }}
      onCancel={onClose}
    />
  );
}
