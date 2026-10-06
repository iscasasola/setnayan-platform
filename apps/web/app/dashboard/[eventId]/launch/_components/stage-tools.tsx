'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brush, ChevronRight, Play, Sparkles, Square, X } from 'lucide-react';
import { GUEST_PAGE_ICON } from '../../website/editor/_components/page-pick';
import { RSVP_STAGE_KEY } from '@/lib/rsvp-stage-shared';
import { RSVP_STAGE_SCENES, type RsvpStageScene } from '@/lib/rsvp-stage';
import {
  MAKER_PARTS,
  MAKER_PART_TOOLS,
  MAKER_PART_TOOL_LABEL,
  makerPartOfTap,
  makerPartQuietRow,
  makerPartSource,
  makerPartsOnPage,
  makerPartsTappable,
  makerStepPart,
  type MakerPartKey,
  type MakerPartTool,
  type MakerStageKey,
} from '@/lib/maker-parts';
import {
  STAGE_GUEST_TAB,
  STAGE_ICON_BUTTON,
  STAGE_PANEL_MS,
  STAGE_PART_TILE,
  STAGE_QUIET_ROW,
  STAGE_ROW,
  STAGE_TOOL_BUTTON,
  stagePanelOpenPx,
} from '@/lib/maker-stage-room';
import type { StudioTileKey } from '@/lib/studio-tiles';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { NavSlotKey } from '@/app/[slug]/_lib/site-nav';
import { MAKER_OPEN_PART_EVENT, MAKER_STAGE_TOOL_EVENT, useMaker } from './maker-context';
import { MAKER_PLAY_SCENE_EVENT } from './maker-play-menu';
import { makerPagePick, makerPageValue, makerStageLabel } from './maker-bar';
import { StageItemMenu, type StagePageOption } from './stage-item-menu';

/**
 * 🎬 THE STAGES PANEL — the new Maker's lower third on the Stages side (owner
 * 2026-10-06, verbatim: *"swiping will proceed to the next element. with the
 * different tools Style | Text | Animate · Style are the presets, background ·
 * Text Font, Color, Size · Animate Build In - Action - Build Out · Swiping right
 * will go to the next element. Tapping on the screen will forward it to that
 * element. Changing text will be on the editing screen"*; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 2; prototype
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` — `S`, `tpill`,
 * `strip`, `paint()`). Behind `makerStagesStudioEnabled`, on a phone; loaded
 * lazily (`details-lazy.tsx`), so the shipped Maker's first load carries none.
 *
 *   ROW      [ stage ▾ ] · [ Style | Text | Animate ] · ▶   (× once a part is open)
 *   STRIP    nothing picked: "You're editing · Invitation › Details" and the
 *            page's parts (`lib/maker-parts.ts`), one tile each
 *   OPEN     a part tapped — on the page or in the strip — rises the panel to
 *            HALF the screen (~240 ms) with the SHIPPED tools for it: Style =
 *            the scene's Format (its styles as a carousel, its background) and
 *            Arrange, Text = Font · Colour · Size, Animate = Build in · Action ·
 *            Build out. × or a tap on nothing folds it.
 *   SWIPE    across the panel: the next / previous part, on into the next page.
 *   ▶        the part picked, or — nothing picked — the whole stage, scene by
 *            scene; the toolbars slide away and one tap stops it.
 *   TYPING   the words of a plain-text part are typed ON THE PAGE: the panel
 *            slides away, the keyboard takes the bottom half, Done brings it back
 *            (the shipped `type-in-place.tsx` bar; one draft value with Studio ›
 *            Info — `the-typing-door-is-the-info-door.test.ts`).
 *   TAB BAR  the guest's own tab bar, drawn at the foot of the page preview —
 *            a tap there changes page as a guest would.
 *
 * 🔑 A TILE TAP IS A PAGE TAP. A part's tile asks the work area exactly what a
 * tap on that part of the page asks (`{ t: 'edit', key, el }` — the canvas's own
 * message, `editor-bridge.tsx`), so the selection, the tools and the page's
 * outline are the shipped ones, from either door. Style | Text | Animate asks the
 * work area to show that tool (`MAKER_STAGE_TOOL_EVENT`).
 *
 * 🔒 NOTHING HERE WRITES. Every change is the shipped tools' own draft save,
 * shown at once, counted on ✓, published at Apply.
 */

/** Where Style's quiet row last took the couple — the panel picks the same part when they come back (‹). */
let resumeAt: { stage: MakerStageKey; page: string | null; part: MakerPartKey } | null = null;

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** The canvas keys the stage's page drew (its section markers) — what a tile can reach. */
function readPresent(): Set<string> {
  const out = new Set<string>();
  try {
    const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
    doc?.querySelectorAll('[data-maker-section]').forEach((m) => {
      const k = m.getAttribute('data-maker-section');
      if (k) out.add(k);
    });
    if (doc?.getElementById('site-entourage')) out.add('f:entourage');
    if (doc?.getElementById('site-story')) out.add('f:story');
  } catch {
    /* a canvas we cannot read offers no tiles — never a tile that does nothing */
  }
  return out;
}

/** To the canvas on screen (the stage's shown frame). */
function postToCanvas(message: unknown) {
  document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentWindow?.postMessage(message, window.location.origin);
}

export function StageTools({
  stage,
  rsvpOpen,
  options,
  value,
  onPickPage,
  onOpenStudio,
  suppliersHref,
  onPx,
}: {
  /** The lifecycle stage on screen. */
  stage: LifecyclePhase;
  /** The RSVP stage is open (its own three screens). */
  rsvpOpen: boolean;
  /** Every stage's pages — the shell's own Page ▾ options (`makerPageMenu`). */
  options: readonly StagePageOption[];
  /** The page on screen, as Page ▾ keys it. */
  value: string;
  /** The shell's Page ▾ door (`pickPage`). */
  onPickPage: (key: string) => void;
  /** Open a Studio tool in place — Style's quiet row (‹ in the top nav returns). */
  onOpenStudio: (key: StudioTileKey) => void;
  /** Suppliers, where the date and the venue are set. */
  suppliersHref: string;
  /** The panel's height (px) — null: the lower third's resting height. */
  onPx: (px: number | null) => void;
}) {
  const maker = useMaker();
  const openTool = maker?.tool ?? null;
  const stageKey: MakerStageKey = rsvpOpen ? RSVP_STAGE_KEY : stage;
  const [screen, setScreen] = useState<RsvpStageScene>('form');
  const [tool, setTool] = useState<MakerPartTool>('style');
  const [picked, setPicked] = useState<MakerPartKey | null>(null);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [present, setPresent] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  /* ── where we are ── */
  const pages = useMemo(
    () =>
      rsvpOpen
        ? RSVP_STAGE_SCENES.map((s) => ({ key: s.key as string, label: s.label, option: RSVP_STAGE_KEY as string }))
        : options.flatMap((o) => {
            const pk = makerPagePick(o.key);
            return pk?.kind === 'page' && pk.stage === stage && !o.disabledNote ? [{ key: pk.page, label: o.label, option: o.key }] : [];
          }),
    [options, rsvpOpen, stage],
  );
  const shownPage = (() => {
    if (rsvpOpen) return screen;
    const pk = makerPagePick(value);
    return pk?.kind === 'page' && pk.stage === stage && pk.page ? pk.page : (pages[0]?.key ?? null);
  })();
  const parts = useMemo(
    () => (rsvpOpen ? [...makerPartsOnPage(RSVP_STAGE_KEY, screen)] : makerPartsTappable(stage, shownPage, present)),
    [rsvpOpen, screen, stage, shownPage, present],
  );
  const pageLabel = pages.find((p) => p.key === shownPage)?.label ?? null;

  /* The canvas's sections, read again whenever a canvas says it is ready, or the page moves. */
  useEffect(() => {
    setPresent(readPresent());
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: unknown; t?: unknown } | null;
      if (d?.source === 'setnayan-site' && d.t === 'ready') window.setTimeout(() => setPresent(readPresent()), 60);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [stage, shownPage]);

  /* ── the panel's height: half the screen while a part's tools are open ── */
  const open = openTool !== null && !typing && !playing;
  useEffect(() => {
    /* ▶ The whole stage plays on the whole screen: the panel folds away entirely. */
    onPx(playing ? 0 : open ? stagePanelOpenPx(window.innerHeight) : null);
  }, [open, playing, onPx]);
  useEffect(() => () => onPx(null), [onPx]);
  /* Risen to half the screen, the page above is shorter: the picked part is brought back into view there. */
  const pickedKey = picked ? MAKER_PARTS[picked].canvas : null;
  useEffect(() => {
    if (!open || !pickedKey || rsvpOpen) return;
    const t = window.setTimeout(() => postToCanvas({ source: 'setnayan-editor', t: 'scrollTo', key: pickedKey }), STAGE_PANEL_MS + 60);
    return () => window.clearTimeout(t);
  }, [open, pickedKey, rsvpOpen]);
  /* Its tools closed (×, a tap on nothing): nothing is picked. */
  useEffect(() => {
    if (openTool !== null) return;
    /* One tool handing over to another (the part's sheet → the scene's) is not a close. */
    const t = window.setTimeout(() => setPicked(null), 400);
    return () => window.clearTimeout(t);
  }, [openTool]);

  /* ── asking the work area ── */
  const askTool = useCallback((t: MakerPartTool, k: MakerPartKey | null) => {
    /* After the work area has drawn the pick (two frames: its state, then its render). */
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        /* Text and Animate are a PART's own: one part of a bigger section (the names, the date)
           opens its own sheet — the shipped door the Apply sheet's "Go to" uses. */
        const def = k ? MAKER_PARTS[k] : null;
        if (t !== 'style' && def?.canvas && def.el && !rsvpOpenRef.current) {
          window.dispatchEvent(
            new CustomEvent(MAKER_OPEN_PART_EVENT, { detail: { key: def.canvas, widgetType: def.canvas === 'f:hero' ? 'hero' : def.canvas.slice(2), el: def.el } }),
          );
        }
        window.dispatchEvent(new CustomEvent(MAKER_STAGE_TOOL_EVENT, { detail: t }));
      }),
    );
  }, []);
  const rsvpOpenRef = useRef(rsvpOpen);
  rsvpOpenRef.current = rsvpOpen;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const pickPart = useCallback(
    (k: MakerPartKey) => {
      setPicked(k);
      if (rsvpOpen) {
        /* The RSVP stage's screens carry their own controls (`maker-rsvp-stage.tsx`). */
        document.querySelector<HTMLElement>(`[data-rsvp-stage-scene-tile="${screen}"]`)?.click();
        return;
      }
      const def = MAKER_PARTS[k];
      if (!def.canvas) return;
      /* 🔑 The canvas's own message — the same selection a tap on the page makes. */
      window.postMessage({ source: 'setnayan-site', t: 'edit', key: def.canvas, ...(def.el ? { el: def.el } : {}) }, window.location.origin);
      askTool(toolRef.current, k);
    },
    [askTool, rsvpOpen, screen],
  );

  /* A part tapped ON THE PAGE: the panel follows it (the work area has already opened its tools). */
  const where = useRef({ stageKey, shownPage });
  where.current = { stageKey, shownPage };
  useEffect(() => {
    const onCanvas = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source === window) return;
      const d = e.data as { source?: unknown; t?: unknown; key?: unknown; el?: unknown; phase?: unknown } | null;
      if (d?.source !== 'setnayan-site') return;
      if (d.t === 'edit' && typeof d.key === 'string') {
        const k = makerPartOfTap(where.current.stageKey, where.current.shownPage, d.key, typeof d.el === 'string' ? d.el : null);
        setPicked(k);
        askTool(toolRef.current, k);
      } else if (d.t === 'type' && d.phase === 'start') setTyping(true);
      else if (d.t === 'playDone') setPlaying(false);
    };
    window.addEventListener('message', onCanvas);
    return () => window.removeEventListener('message', onCanvas);
  }, [askTool]);

  /* ⌨️ Typing on the page: the panel is away until the words' bar is gone (Done). */
  useEffect(() => {
    if (!typing) return;
    const gone = () => !document.querySelector('[data-type-bar]');
    const first = window.setTimeout(() => gone() && setTyping(false), 900);
    const mo = new MutationObserver(() => {
      if (gone()) setTyping(false);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(first);
      mo.disconnect();
    };
  }, [typing]);

  /* ‹ Back from a Studio tool Style's quiet row opened: the same stage and part. */
  useEffect(() => {
    const r = resumeAt;
    if (!r || r.stage !== stageKey || r.page !== shownPage || !parts.includes(r.part)) return;
    resumeAt = null;
    pickPart(r.part);
  }, [parts, pickPart, shownPage, stageKey]);

  /* ── ⟷ swipe: the next / previous part, on into the next page ── */
  const pendingStep = useRef<1 | -1 | null>(null);
  const step = useCallback(
    (dir: 1 | -1) => {
      /* The page the picked part is ON — the canvas may have scrolled the page the bar names. */
      const home =
        picked && !parts.includes(picked) && !rsvpOpen
          ? (pages.find((p) => makerPartsTappable(stage, p.key, present).includes(picked))?.key ?? shownPage)
          : shownPage;
      const here = home === shownPage ? parts : makerPartsTappable(stage, home, present);
      const r = makerStepPart({ parts: here, at: picked, pages: pages.map((p) => p.key), page: home, dir });
      if (!r) return;
      if (r.part) return pickPart(r.part);
      pendingStep.current = dir;
      if (rsvpOpen) {
        setScreen(r.page as RsvpStageScene);
        document.querySelector<HTMLElement>(`[data-rsvp-stage-scene="${r.page}"]`)?.click();
      } else onPickPage(makerPageValue(stage, r.page));
    },
    [onPickPage, pages, parts, pickPart, picked, present, rsvpOpen, shownPage, stage],
  );
  /* The next page is on screen and its parts are read: pick its first (or, going back, its last). */
  useEffect(() => {
    const dir = pendingStep.current;
    if (dir === null || parts.length === 0) return;
    pendingStep.current = null;
    pickPart(dir === 1 ? parts[0]! : parts[parts.length - 1]!);
  }, [parts, pickPart]);
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    let from: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const inPanel = t?.closest?.('[data-stage-tools], [data-phone-chrome="panel"]');
      const skip = t?.closest?.('input, textarea, select, [role="slider"], [data-style-carousel], [data-stage-strip], [data-maker-sheet], [aria-expanded="true"]');
      from = inPanel && !skip ? { x: e.clientX, y: e.clientY } : null;
    };
    const up = (e: PointerEvent) => {
      const f = from;
      from = null;
      if (!f) return;
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      /* The prototype's rule: a clear sideways move — right = the next part. */
      if (Math.abs(dx) > 44 && Math.abs(dx) > 1.6 * Math.abs(dy)) stepRef.current(dx > 0 ? 1 : -1);
    };
    const cancel = () => {
      from = null;
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
    };
  }, []);

  /* ── ▶ play ── */
  const stopPlay = useCallback(() => {
    postToCanvas({ source: 'setnayan-editor', t: 'playStop' });
    setPlaying(false);
  }, []);
  const play = () => {
    if (playing) return stopPlay();
    const def = picked ? MAKER_PARTS[picked] : null;
    if (def?.canvas && def.el) return postToCanvas({ source: 'setnayan-editor', t: 'playEl', key: def.canvas, el: def.el });
    if (def?.canvas) return window.dispatchEvent(new Event(MAKER_PLAY_SCENE_EVENT));
    postToCanvas({ source: 'setnayan-editor', t: 'playStage' });
    setPlaying(true);
  };
  /* While the stage plays, one tap anywhere in the Maker stops it (a tap on the page is the canvas's own). */
  useEffect(() => {
    if (!playing) return;
    const shell = document.querySelector<HTMLElement>('[data-maker-shell]');
    shell?.setAttribute('data-stage-playing', '');
    /* The tap that stops is ONLY a stop — its click never reaches what lay under it. */
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const tap = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, true), 600);
      stopPlay();
    };
    document.addEventListener('pointerdown', tap, true);
    return () => {
      shell?.removeAttribute('data-stage-playing');
      document.removeEventListener('pointerdown', tap, true);
    };
  }, [playing, stopPlay]);

  /* ── the room the row (and the quiet row) take above an open tool ── */
  const quiet = open && tool === 'style' && picked && !rsvpOpen ? makerPartQuietRow(picked) : null;
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-maker-shell]');
    shell?.style.setProperty('--stage-top', `${quiet ? 104 : 60}px`);
    return () => {
      shell?.style.removeProperty('--stage-top');
    };
  }, [quiet]);

  const pickTool = (t: MakerPartTool) => {
    setTool(t);
    if (!picked && parts[0]) return pickPart(parts[0]);
    askTool(t, picked);
  };
  const away = typing || playing;
  const shellEl = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-maker-shell]');

  return (
    <div
      ref={rootRef}
      data-stage-tools=""
      data-stage-open={open ? '' : undefined}
      aria-hidden={away || undefined}
      className={`flex min-h-0 flex-1 flex-col gap-1.5 px-1 pb-1 pt-2 transition-transform ease-out motion-reduce:transition-none ${away ? 'pointer-events-none translate-y-[110%]' : ''}`}
      style={{ transitionDuration: `${STAGE_PANEL_MS}ms` }}
    >
      {/* One rule set, drawn only while this panel is: it takes the lower third's place,
          and an open tool sits under its row, full width. Phone only. */}
      <style>
        {'@media (max-width:1023.98px){' +
          '[data-maker-lower-third]:has(>[data-stage-tools])>:not([data-stage-tools]){display:none}' +
          '[data-maker-lower-third]:has(>[data-stage-tools]){transition:height 240ms ease-out}' +
          '[data-maker-shell]:has([data-stage-tools]) [data-phone-chrome="panel"]{left:4px;height:calc(var(--maker-lt-h) - var(--stage-top,60px))}' +
          '[data-maker-shell][data-stage-playing] [data-phone-chrome="bar"]{transform:translateY(-110%);transition:transform 240ms ease-out}' +
          '}@media (prefers-reduced-motion:reduce){[data-maker-lower-third]:has(>[data-stage-tools]),[data-maker-shell][data-stage-playing] [data-phone-chrome="bar"]{transition:none}}'}
      </style>

      {/* ══ THE ROW ══ */}
      <div className={STAGE_ROW} data-stage-row="">
        <StageItemMenu
          options={options}
          stage={stageKey}
          page={rsvpOpen ? null : shownPage}
          rsvpScreen={screen}
          onPick={onPickPage}
          onRsvpScreen={(s) => {
            setScreen(s);
            /* The RSVP stage draws its three screens itself; ask it for this one once it is up. */
            window.setTimeout(() => document.querySelector<HTMLElement>(`[data-rsvp-stage-scene="${s}"]`)?.click(), 60);
          }}
        />
        {rsvpOpen ? null : (
          <span role="group" aria-label="Edit with" className="inline-flex h-11 shrink-0 items-center rounded-full bg-white p-0.5 ring-1 ring-ink/10" data-stage-tpill="">
            {MAKER_PART_TOOLS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={open && tool === t}
                aria-label={MAKER_PART_TOOL_LABEL[t]}
                title={MAKER_PART_TOOL_LABEL[t]}
                data-stage-tool={t}
                onClick={() => pickTool(t)}
                className={STAGE_TOOL_BUTTON}
              >
                {t === 'style' ? (
                  <Brush aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
                ) : t === 'text' ? (
                  <em className="font-serif text-[17px] font-semibold not-italic leading-none">Aa</em>
                ) : (
                  <Sparkles aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
                )}
              </button>
            ))}
          </span>
        )}
        <button type="button" aria-label={playing ? 'Stop' : picked ? 'Play this part' : 'Play the stage'} data-stage-play="" onClick={play} className={`${STAGE_ICON_BUTTON} ml-auto`}>
          {playing ? <Square aria-hidden className="h-4 w-4" strokeWidth={2.2} /> : <Play aria-hidden className="h-4 w-4" strokeWidth={2.2} />}
        </button>
        {open ? (
          <button type="button" aria-label="Close the tools" data-stage-close="" onClick={() => openTool?.close()} className={STAGE_ICON_BUTTON}>
            <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

      {/* ══ STYLE'S ONE QUIET ROW — "Edit the Wedding March ›" (never a badge on the page) ══ */}
      {quiet ? (
        'suppliers' in quiet.to ? (
          <a href={suppliersHref} data-stage-quiet="suppliers" className={STAGE_QUIET_ROW}>
            {quiet.words}
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          </a>
        ) : (
          <button
            type="button"
            data-stage-quiet={quiet.to.studio}
            onClick={() => {
              const to = (quiet.to as { studio: StudioTileKey }).studio;
              resumeAt = picked ? { stage: stageKey, page: shownPage, part: picked } : null;
              onOpenStudio(to);
            }}
            className={STAGE_QUIET_ROW}
          >
            {quiet.words}
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          </button>
        )
      ) : null}

      {/* ══ NOTHING PICKED — where you are, and the page's parts ══ */}
      {open ? null : (
        <>
          <p className="truncate px-1 text-[12px] text-ink/60" data-stage-caption="">
            You’re editing · {makerStageLabel(stageKey as never)}
            {pageLabel && pages.length > 1 ? ` › ${pageLabel}` : ''}
          </p>
          <div role="group" aria-label="Parts of this page" data-stage-strip="" className="flex min-h-0 flex-1 items-start gap-2 overflow-x-auto overflow-y-hidden px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {parts.map((k) => {
              const src = makerPartSource(k);
              const tag = src.kind === 'info' ? 'Info' : src.kind === 'studio' ? 'Studio' : src.kind === 'supplier' ? 'Suppliers' : null;
              return (
                <button key={k} type="button" aria-pressed={picked === k} data-stage-part={k} onClick={() => pickPart(k)} className={STAGE_PART_TILE}>
                  <span className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-ink">{MAKER_PARTS[k].label}</span>
                  {tag ? <span className="text-[10.5px] text-ink/50">{tag}</span> : null}
                </button>
              );
            })}
            {parts.length === 0 && present.size > 0 ? <p className="px-1 py-3 text-[13px] text-ink/60">Nothing on this page to style yet.</p> : null}
          </div>
        </>
      )}

      {/* ══ THE GUEST'S TAB BAR, at the foot of the page preview ══ */}
      {shellEl && pages.length > 1 && !away
        ? createPortal(
            <nav
              aria-label="The guest's pages"
              data-stage-guest-bar=""
              className="absolute inset-x-0 z-[25] flex border-t border-ink/10 bg-cream/95 px-1 lg:hidden"
              /* It rides the panel's rise and fall (the same 240 ms), never across it. */
              style={{ bottom: 'calc(var(--maker-lt-h) + env(safe-area-inset-bottom))', transition: `bottom ${STAGE_PANEL_MS}ms ease-out` }}
            >
              {pages.map((p) => {
                const Icon = rsvpOpen ? null : (GUEST_PAGE_ICON[p.key as NavSlotKey] ?? null);
                const here = p.key === shownPage;
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-current={here ? 'page' : undefined}
                    data-stage-guest-tab={p.key}
                    onClick={() => {
                      if (here) return;
                      if (rsvpOpen) {
                        setScreen(p.key as RsvpStageScene);
                        document.querySelector<HTMLElement>(`[data-rsvp-stage-scene="${p.key}"]`)?.click();
                      } else onPickPage(p.option);
                    }}
                    className={STAGE_GUEST_TAB}
                  >
                    {Icon ? <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={here ? 2.2 : 1.75} /> : null}
                    <span className="max-w-full truncate">{p.label}</span>
                  </button>
                );
              })}
            </nav>,
            shellEl,
          )
        : null}
    </div>
  );
}
