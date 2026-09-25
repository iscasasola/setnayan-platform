'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Eye, EyeOff, QrCode, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { QrActions } from '@/app/_components/qr-actions';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import type { RowStatus } from './rail-rows';
import { unlockLabel } from './unlock-label';
import {
  MAKER_MORE_ROWS_ID,
  useMaker,
  type MakerSceneTab,
  type MakerSelection,
} from '../../../launch/_components/maker-context';
import { MAKER_COMING_NEXT } from '../../../launch/_components/maker-bar';
import { HubDraftField, HubSavesImmediately } from '../../_components/hub-draft-field';
import { SceneTemplatePicker } from './scene-template-picker';

/**
 * THE MAKER'S WORK AREA — navigator · canvas · inspector (Event Hub Maker,
 * Phase 1). The editor page builds every panel on the server with its OWN
 * bound action and hands them here as elements; this component only decides
 * which one is showing. It never owns a write path.
 *
 * ── THE NAVIGATOR ────────────────────────────────────────────────────────
 * One numbered thumbnail per section of the page (`invitation_widgets`), in
 * `display_order`, with "Main" pinned on top. The EYE (lower-right) is the
 * section's visibility; the transition between two scenes is marked between
 * them. Drag a scene to move it (or long-press / right-click → Move up · Move
 * down · Hide). It resizes by its edge and collapses from the toolbar.
 *
 * 🔑 EVERY WRITE IS A FORM POST TO AN ACTION THAT ALREADY SHIPS —
 * `toggleWidgetVisibility`, `setSectionMode`, `moveWidgetUp/Down` — with a
 * `return_to` back to this page, and `draft=1` (`HubDraftField`), so each one
 * lands in the DRAFT (Maker Phase 2): guests see nothing until Apply. The
 * scenes this component is handed are the draft laid over the live rows
 * (`website/editor/page.tsx`), so the eye and the order read what was drafted. A drag of N places is N single swaps, CHAINED
 * through the address (`?chain=`): each post redirects here carrying the rest,
 * and this component fires the next on arrival. So a move is the same write a
 * couple could make by hand, one step at a time, and a refused step stops the
 * chain rather than skipping ahead.
 *
 * 👁 WHAT THE EYE MEANS, MEASURED — not assumed. The guest page has two gates:
 * `is_visible` (the default render path) and `mode` (open browsing, where
 * `hidden`/`shown` override and `auto` falls back to `is_visible`). An eye that
 * wrote only one of them would hide a scene on one path and leave it showing on
 * the other. So hiding a `shown` scene sets `mode` back first AND THEN
 * `is_visible`, and showing a `hidden` one does the reverse — both gates agree
 * after every press.
 */

/*
  ══ 2026-09-25 · THIS FILE IS NOW THE EVENT HUB MAKER'S WORK AREA ══
  It held `EditorShell` — the two-pane rail + preview. The Maker replaced that
  shell (Phase 1 of EVENT_HUB_MAKER_BUILD_PLAN), and what the rail did is
  PORTED here, not dropped: the rows and their chips (the ⋯ sheet), the live
  preview (the canvas), scan-to-view, and the one Pro CTA. The row types stay
  exported from this path because the editor page and its guards name it.

  🔴 `done()`/`todo()` are NOT here and are not re-exported — see
  `rail-rows.ts`. This file is `'use client'`; the server page CALLING a client
  export returned a 500 for the whole editor (production 2026-09-23).
*/

export type RailRow = {
  key: string;
  label: string;
  blurb?: string;
  href: string;
  status?: RowStatus;
  /** Which preview section this row points at (EditorBridge SECTION_IDS key). */
  anchor?: string;
  /** Website Pro item — gold tag; `locked` adds the lock affordance. */
  pro?: boolean;
  locked?: boolean;
  /** The inline panel — rendered by the SERVER page with the feature's own
   *  bound server action; this client file only decides where it shows. */
  panel?: React.ReactNode;
};

export type RailGroup = {
  key: string;
  title: string;
  hint?: string;
  rows: RailRow[];
};

export type MakerScene = {
  id: string;
  type: string;
  label: string;
  mode: 'auto' | 'shown' | 'hidden';
  isVisible: boolean;
  hasContent: boolean;
  /** Scroll · Scrub · Auto — the transition INTO the next scene. */
  transitionLabel: string;
};

export type MakerRowPanel = {
  label: string;
  blurb?: string;
  anchor?: string;
  /** The row's own claim — filled or not. The chip's colour follows it. */
  status?: RowStatus;
  node: ReactNode;
};

type FormAction = (formData: FormData) => void | Promise<void>;

/** Which content panel a section is written in. Absent = written elsewhere. */
const CONTENT_ROW_FOR_TYPE: Record<string, string> = {
  hero: 'hero',
  event_details: 'details',
  schedule: 'details',
  venue_map: 'details',
  countdown: 'details',
  dress_code: 'dress-code',
  photo_moments: 'photo-moments',
  special_message: 'special-message',
  what_to_bring: 'what-to-bring',
  our_photos: 'gallery',
  our_love_story: 'story',
};

/**
 * The made-once group (Phase 6) — Logo · Hero · Reveal — each a workspace of its
 * own (`launch/_components/maker-made-once.tsx`), handed in as `madeOnce`.
 */
export type MadeOnceKey = 'logo' | 'hero' | 'reveal';

const TOOL_ROWS: Record<string, string[]> = {
  hero: ['hero'],
  reveal: ['save-the-date'],
  'love-story': ['story'],
  'post-event': ['editorial'],
};

const MAIN_ROWS = ['colors', 'music', 'backdrop'];
const MORE_ROWS = ['go-live', 'visibility', 'launch-phase', 'open-browse'];

export function MakerWork({
  eventId,
  publicLandingUrl,
  scenes,
  scenePanels,
  rows,
  themes,
  themeHref,
  ownsPro,
  initialScene = null,
  initialOpenRow = null,
  chain = null,
  toggleAction,
  setModeAction,
  moveUpAction,
  moveDownAction,
  proUnlockHref,
  proPriceLabel,
  showProCta,
  addScene = null,
  sceneFacts = null,
  madeOnce = null,
}: {
  /** Logo · Hero · Reveal — the made-once workspaces (Phase 6). Server-rendered
   *  panels; an absent key falls back to the row the tool used to open. */
  madeOnce?: Partial<Record<MadeOnceKey, ReactNode>> | null;
  /** The event's names, monogram and days to go, for the built-on template tiles. */
  sceneFacts?: { names?: string | null; monogram?: string | null; days?: number | null } | null;
  /**
   * "+ ADD A SCENE" — the 25 templates (Event Hub Maker Phase 5). The action
   * (`addCustomSection`) and where it lands; null when a scene cannot be added
   * here (not Pro, all six in use, or the store shell) — the `note` form then
   * says why, in the same place, instead of a button that would be refused.
   */
  addScene?: { action: FormAction; returnTo: string } | { note: string } | null;
  proUnlockHref: string;
  /** The live catalogue price, formatted — null when unread (never remembered). */
  proPriceLabel: string | null;
  /** False once they own Pro, and always in the store shell. */
  showProCta: boolean;
  eventId: string;
  publicLandingUrl: string | null;
  scenes: MakerScene[];
  scenePanels: Record<string, ReactNode>;
  rows: Record<string, MakerRowPanel>;
  themes: Array<{ id: string; name: string; ready: boolean; current: boolean }>;
  themeHref: string;
  ownsPro: boolean;
  initialScene?: string | null;
  initialOpenRow?: string | null;
  chain?: string | null;
  toggleAction: FormAction;
  setModeAction: FormAction;
  moveUpAction: FormAction;
  moveDownAction: FormAction;
}) {
  const maker = useMaker();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [navWidth, setNavWidth] = useState(168);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moreHost, setMoreHost] = useState<HTMLElement | null>(null);

  const stage = maker?.stage ?? 'rsvp';
  const selection = maker?.selection ?? null;
  const select = maker?.select;

  /* The first selection comes from the address (a save lands back here with
     `?scene=` or `?open=`). After that the shell's state owns it. */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !select) return;
    seeded.current = true;
    if (initialScene && scenes.some((s) => s.id === initialScene)) {
      select({ kind: 'scene', id: initialScene });
    } else if (initialOpenRow && rows[initialOpenRow]) {
      select(
        MAIN_ROWS.includes(initialOpenRow) ? { kind: 'main' } : { kind: 'row', key: initialOpenRow },
      );
    }
  }, [initialScene, initialOpenRow, scenes, rows, select]);

  useEffect(() => {
    setMoreHost(document.getElementById(MAKER_MORE_ROWS_ID));
  }, []);

  /* ── the preview ─────────────────────────────────────────────────────── */
  /* VIEW AS (toolbar) re-points the canvas at a role's own door; otherwise the
     host's editing preview, which shows the draft. */
  const previewSrc = publicLandingUrl ? `${publicLandingUrl}?phase=${stage}&editor=1` : null;
  const canvasSrc = maker?.viewAsHref ?? previewSrc;
  const scrollPreviewTo = useCallback((anchor?: string) => {
    if (!anchor) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: 'setnayan-editor', t: 'scrollTo', key: anchor },
      window.location.origin,
    );
  }, []);

  /* Preview → inspector: a section tapped on the page opens its panel. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string; key?: string } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'edit' || typeof data.key !== 'string') return;
      const match = Object.entries(rows).find(([, r]) => r.anchor === data.key);
      if (match) select?.({ kind: 'row', key: match[0] });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [rows, select]);

  /* ── the one hidden form every navigator write goes through ────────────── */
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const back = (sceneId: string, rest?: string) => {
    const q = new URLSearchParams({ stage, scene: sceneId });
    if (rest) q.set('chain', rest);
    return `/dashboard/${eventId}/launch?${q.toString()}`;
  };
  const post = (
    which: 'toggle' | 'mode' | 'up' | 'down',
    fields: Record<string, string>,
  ) => {
    const form = formRef.current;
    if (!form || pending) return;
    for (const [name, val] of Object.entries(fields)) {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = val;
    }
    setPending(true);
    /* A refused write redirects nowhere new; never leave the controls locked. */
    window.setTimeout(() => setPending(false), 10_000);
    (form.querySelector(`button[data-op="${which}"]`) as HTMLButtonElement | null)?.click();
  };

  const eyeWrite = (scene: MakerScene) => {
    const showing = sceneShowing(scene);
    if (showing && scene.mode === 'shown') {
      post('mode', { widget_id: scene.id, next_mode: 'hidden', return_to: back(scene.id, `vis.${scene.id}.0`) });
    } else if (!showing && scene.mode === 'hidden') {
      post('mode', { widget_id: scene.id, next_mode: 'auto', return_to: back(scene.id, `vis.${scene.id}.1`) });
    } else {
      post('toggle', {
        widget_id: scene.id,
        widget_type: scene.type,
        next_visible: scene.isVisible ? '0' : '1',
        return_to: back(scene.id),
      });
    }
  };

  const move = (id: string, delta: number) => {
    if (delta === 0) return;
    const dir = delta < 0 ? 'up' : 'down';
    const n = Math.abs(delta);
    post(dir, { widget_id: id, return_to: back(id, n > 1 ? `${dir}.${id}.${n - 1}` : undefined) });
  };

  /* The rest of a chain, fired once per arrival. */
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!chain || fired.current === chain) return;
    fired.current = chain;
    const [op, id, arg] = chain.split('.');
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !op) return;
    if (op === 'vis') {
      const want = arg === '1';
      if (scene.isVisible === want) return;
      post('toggle', { widget_id: id!, widget_type: scene.type, next_visible: want ? '1' : '0', return_to: back(id!) });
    } else if (op === 'up' || op === 'down') {
      const n = Number(arg);
      if (!Number.isFinite(n) || n < 1 || n > 40) return;
      post(op, { widget_id: id!, return_to: back(id!, n > 1 ? `${op}.${id}.${n - 1}` : undefined) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per chain value
  }, [chain]);

  /* A new server render means the write landed — unlock the controls. */
  useEffect(() => {
    setPending(false);
  }, [maker?.renderStamp]);

  /* ── resize the navigator by its edge ─────────────────────────────────── */
  const startResize = (e: React.PointerEvent) => {
    const x0 = e.clientX;
    const w0 = navWidth;
    const onMove = (ev: PointerEvent) => setNavWidth(Math.max(112, Math.min(320, w0 + ev.clientX - x0)));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const navOpen = maker?.navOpen ?? true;
  const device = maker?.device ?? 'desktop';
  const selectedScene = selection?.kind === 'scene' ? scenes.find((s) => s.id === selection.id) ?? null : null;

  if (!maker) {
    return (
      <p className="p-6 text-sm text-ink/70">
        This part of the Event Hub Maker opens inside it —{' '}
        <Link href={`/dashboard/${eventId}/launch`} className="underline underline-offset-2">
          open the Event Hub Maker
        </Link>
        .
      </p>
    );
  }

  const moreRows = MORE_ROWS.filter((k) => rows[k]);

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* ══ 2 · THE NAVIGATOR ══ */}
      <nav
        aria-label="Scenes"
        style={{ ['--maker-nav-w' as string]: `${navWidth}px` }}
        className={`relative order-2 shrink-0 bg-cream/80 lg:order-1 lg:w-[var(--maker-nav-w)] ${
          navOpen ? '' : 'lg:hidden'
        }`}
      >
        <ol className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:h-full lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden lg:px-3 lg:py-4">
          <li className="shrink-0 lg:mb-3">
            <button
              type="button"
              onClick={() => select?.({ kind: 'main' })}
              aria-pressed={selection?.kind === 'main'}
              className={`sn-press flex h-full min-h-11 w-24 items-center gap-2 rounded-md px-2 text-left text-[12px] font-semibold transition-colors duration-sn-control ease-sn lg:w-full ${
                selection?.kind === 'main' ? 'bg-ink text-cream' : 'bg-white/70 text-ink/75 hover:bg-white'
              }`}
            >
              <span aria-hidden className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-cream-200 to-terracotta/30" />
              Main
            </button>
          </li>
          {stage === 'editorial' && rows['editorial'] ? (
            <li className="shrink-0 lg:mb-3">
              <button
                type="button"
                onClick={() => select?.({ kind: 'tool', key: 'post-event' })}
                aria-pressed={selection?.kind === 'tool' && selection.key === 'post-event'}
                className="sn-press flex min-h-11 w-28 items-center rounded-md bg-white/70 px-2 text-left text-[12px] font-semibold text-ink/75 hover:bg-white lg:w-full"
              >
                The story after the day
              </button>
            </li>
          ) : null}
          {scenes.map((scene, i) => {
            const on = selectedScene?.id === scene.id;
            const showing = sceneShowing(scene);
            return (
              <li
                key={scene.id}
                className="relative shrink-0"
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setDropAt(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId) return;
                  const from = scenes.findIndex((s) => s.id === dragId);
                  setDragId(null);
                  setDropAt(null);
                  if (from >= 0) move(dragId, i - from);
                }}
              >
                {dropAt === i && dragId && dragId !== scene.id ? (
                  <span aria-hidden className="absolute -top-1 left-0 right-0 h-0.5 rounded-full bg-terracotta lg:left-4" />
                ) : null}
                <div
                  draggable={!pending}
                  onDragStart={(e) => {
                    setDragId(scene.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropAt(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuFor(scene.id);
                  }}
                  className="relative flex items-start gap-1.5 lg:py-1"
                >
                  <span aria-hidden className="w-3 pt-1 text-right font-mono text-[10px] font-bold text-ink/50">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    data-maker-scene={scene.type}
                    aria-pressed={on}
                    aria-label={`${scene.label}${showing ? '' : ' (hidden from guests)'}`}
                    onClick={() => {
                      select?.({ kind: 'scene', id: scene.id });
                      const row = CONTENT_ROW_FOR_TYPE[scene.type];
                      scrollPreviewTo(row ? rows[row]?.anchor : undefined);
                    }}
                    onPointerDown={(e) => {
                      if (e.pointerType !== 'touch') return;
                      const t = window.setTimeout(() => setMenuFor(scene.id), 550);
                      const clear = () => window.clearTimeout(t);
                      e.currentTarget.addEventListener('pointerup', clear, { once: true });
                      e.currentTarget.addEventListener('pointerleave', clear, { once: true });
                    }}
                    className={`sn-press flex aspect-[16/10] w-24 cursor-grab items-start justify-center overflow-hidden break-words rounded-md bg-white px-2 pb-6 pt-2 text-center font-serif text-[12px] leading-tight shadow-[0_1px_2px_rgba(40,34,24,.06),0_12px_28px_-18px_rgba(30,26,18,.45)] outline outline-2 outline-offset-2 transition-[outline-color,opacity] duration-sn-control ease-sn lg:w-full ${
                      on ? 'outline-terracotta' : 'outline-transparent'
                    } ${showing ? 'text-ink' : 'text-ink/40 opacity-60'}`}
                  >
                    {scene.label}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => eyeWrite(scene)}
                    aria-label={showing ? `Hide ${scene.label} from guests` : `Show ${scene.label} to guests`}
                    title={
                      scene.mode === 'auto' && showing
                        ? 'Showing (Auto) · tap to hide from guests'
                        : showing
                          ? 'Showing · tap to hide from guests'
                          : 'Hidden · tap to show to guests'
                    }
                    className={`sn-press absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors duration-sn-control ease-sn hover:text-ink disabled:opacity-40 ${
                      showing ? (scene.mode === 'auto' ? 'text-ink/55' : 'text-ink') : 'text-terracotta'
                    }`}
                  >
                    {showing ? (
                      <Eye aria-hidden className="h-4 w-4" strokeWidth={scene.mode === 'auto' ? 1.5 : 2.25} />
                    ) : (
                      <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
                    )}
                  </button>
                  {menuFor === scene.id ? (
                    <SceneMenu
                      onClose={() => setMenuFor(null)}
                      canUp={i > 0}
                      canDown={i < scenes.length - 1}
                      showing={showing}
                      onUp={() => move(scene.id, -1)}
                      onDown={() => move(scene.id, 1)}
                      onEye={() => eyeWrite(scene)}
                    />
                  ) : null}
                </div>
                {i < scenes.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => select?.({ kind: 'scene', id: scene.id, tab: 'transition' })}
                    title="The transition into the next scene"
                    className="sn-press mx-auto hidden h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink lg:ml-5 lg:flex"
                  >
                    {scene.transitionLabel}
                  </button>
                ) : null}
              </li>
            );
          })}
          <li className="shrink-0 self-center lg:mt-2 lg:self-stretch">
            {addScene && 'action' in addScene ? (
              /* 🎬 "+" opens the 25 templates, headed with the stage being
                 edited and drawn in the view being edited (owner 2026-09-24). */
              <div className="pl-4">
                <SceneTemplatePicker
                  overlay
                  action={addScene.action}
                  hidden={{ event_id: eventId, return_to: addScene.returnTo }}
                  stageLabel={stage === 'rsvp' ? `the ${PUBLIC_STAGE_LABELS.rsvp}` : PUBLIC_STAGE_LABELS[stage]}
                  heading="Add a scene to"
                  triggerLabel="+ Add a scene"
                  initialView={maker?.device === 'phone' ? 'phone' : 'desktop'}
                  facts={sceneFacts}
                />
              </div>
            ) : addScene && 'note' in addScene ? (
              <span className="flex items-center gap-1 pl-4 text-[11px] text-ink/60">
                <InfoTip label="New scene" align="start">
                  {addScene.note}
                </InfoTip>
              </span>
            ) : null}
          </li>
        </ol>
        {/* the edge you drag to make the navigator wider or narrower */}
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the scenes"
          onPointerDown={startResize}
          className="absolute inset-y-0 right-0 hidden w-1.5 cursor-col-resize hover:bg-terracotta/30 lg:block"
        />
      </nav>

      {/* ══ 3 · THE CANVAS — the real page, one stage at a time ══ */}
      {/* A labelled <section>, not a second <main>: the event layout owns the
          one landmark (`couple-screens-keep-the-shell.test.ts`). */}
      <section
        aria-label="Preview"
        data-maker-stage={stage}
        className="order-1 flex min-h-0 flex-1 flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-2 pb-2 pt-2 lg:order-2 lg:px-6 lg:pb-5 lg:pt-4"
      >
        {canvasSrc ? (
          <iframe
            ref={frameRef}
            key={`${stage}:${maker.renderStamp}:${maker.viewAsHref ?? ''}`}
            src={canvasSrc}
            title={`Your Event Hub — ${PUBLIC_STAGE_LABELS[stage]}`}
            className={`h-full w-full rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] transition-[max-width] duration-sn-elem ease-sn ${
              device === 'phone' ? 'max-w-[430px]' : 'max-w-none'
            }`}
          />
        ) : (
          <p className="max-w-sm text-center text-sm text-ink/70">
            Set your Event Hub address (⋯ in the toolbar) to see your page here.
          </p>
        )}
      </section>

      {/* ══ 4 · THE INSPECTOR — only when something is selected ══ */}
      {selection ? (
        <Inspector
          selection={selection}
          scene={selectedScene}
          scenePanel={selectedScene ? scenePanels[selectedScene.id] : null}
          rows={rows}
          themes={themes}
          themeHref={themeHref}
          eventId={eventId}
          madeOnce={madeOnce}
          showMotionTabs={ownsPro || !maker.storeShell}
          onClose={() => select?.(null)}
          onTab={(tab) => selectedScene && select?.({ kind: 'scene', id: selectedScene.id, tab })}
        />
      ) : null}

      {/* The one form every navigator write goes through. 💾 It carries the
          draft field: the eye, Auto/Shown/Hidden and every drag step land in the
          draft, and guests see none of it until Apply. */}
      <form ref={formRef} hidden aria-hidden>
        <HubDraftField />
        <input type="hidden" name="event_id" value={eventId} readOnly />
        <input type="hidden" name="widget_id" defaultValue="" />
        <input type="hidden" name="widget_type" defaultValue="" />
        <input type="hidden" name="next_visible" defaultValue="" />
        <input type="hidden" name="next_mode" defaultValue="" />
        <input type="hidden" name="return_to" defaultValue="" />
        <button type="submit" data-op="toggle" formAction={toggleAction} tabIndex={-1} />
        <button type="submit" data-op="mode" formAction={setModeAction} tabIndex={-1} />
        <button type="submit" data-op="up" formAction={moveUpAction} tabIndex={-1} />
        <button type="submit" data-op="down" formAction={moveDownAction} tabIndex={-1} />
      </form>

      {/* The address rows live in the ⋯ sheet, with the rest of "your Event Hub". */}
      {moreHost
        ? createPortal(
            <>
              {moreRows.map((key) => (
                <RowBlock key={key} row={rows[key]!} />
              ))}
              <MoreExtras
                liveHref={publicLandingUrl}
                proUnlockHref={proUnlockHref}
                proPriceLabel={proPriceLabel}
                showProCta={showProCta}
              />
            </>,
            moreHost,
          )
        : null}
    </div>
  );
}

/** Is this scene on the guest page right now? Both gates, the way the page reads them. */
export function sceneShowing(scene: Pick<MakerScene, 'mode' | 'isVisible'>): boolean {
  if (scene.mode === 'hidden') return false;
  if (scene.mode === 'shown') return true;
  return scene.isVisible;
}

function SceneMenu({
  onClose,
  canUp,
  canDown,
  showing,
  onUp,
  onDown,
  onEye,
}: {
  onClose: () => void;
  canUp: boolean;
  canDown: boolean;
  showing: boolean;
  onUp: () => void;
  onDown: () => void;
  onEye: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const item =
    'sn-press block w-full rounded-md px-3 py-2 text-left text-[13px] font-medium text-ink hover:bg-ink/5 disabled:opacity-40';
  return (
    <div ref={ref} role="menu" className="sn-glass-bare absolute left-4 top-full z-30 mt-1 w-40 rounded-md p-1">
      <button type="button" role="menuitem" disabled={!canUp} className={item} onClick={() => { onClose(); onUp(); }}>
        Move up
      </button>
      <button type="button" role="menuitem" disabled={!canDown} className={item} onClick={() => { onClose(); onDown(); }}>
        Move down
      </button>
      <button type="button" role="menuitem" className={item} onClick={() => { onClose(); onEye(); }}>
        {showing ? 'Hide from guests' : 'Show to guests'}
      </button>
    </div>
  );
}

function RowBlock({ row }: { row: MakerRowPanel }) {
  return (
    <section className="rounded-md bg-white/70">
      <header className="flex items-start gap-2 px-3 pt-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{row.label}</span>
          {row.blurb ? <span className="block text-[12.5px] text-ink/65">{row.blurb}</span> : null}
        </span>
        {/* 🔑 The chip colours on the row's own CLAIM, never on its wording —
            "Private", "0 showing" and "No schedule" once painted success-green
            (`a-chip-tells-the-truth-about-empty.test.ts`). */}
        {row.status ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              row.status.filled
                ? 'bg-success-100 text-success-800'
                : 'bg-ink/5 text-ink/65'
            }`}
          >
            {row.status.label}
          </span>
        ) : null}
      </header>
      {row.node}
    </section>
  );
}

/**
 * Scan-to-view and the one Pro CTA — the rail's topbar and foot, ported into
 * the Maker's ⋯ sheet. The QR is the master event QR `/api/website/qr` already
 * serves, with the one control strip every link-QR carries. The CTA is the
 * umbrella unlock — one CTA for all nine Pro items (`WEBSITE_PRO_ITEMS`) — shown
 * only while they do not own it, and never in the store shell.
 */
function MoreExtras({
  liveHref,
  proUnlockHref,
  proPriceLabel,
  showProCta,
}: {
  liveHref: string | null;
  proUnlockHref: string;
  proPriceLabel: string | null;
  showProCta: boolean;
}) {
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  useEffect(() => {
    setLiveUrl(liveHref ? new URL(liveHref, window.location.origin).toString() : null);
  }, [liveHref]);
  return (
    <>
      {liveHref ? (
        <section className="rounded-md bg-white/70 px-3 py-3">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <QrCode aria-hidden className="h-4 w-4" strokeWidth={2} /> Scan to view
          </p>
          <p className="text-[12.5px] text-ink/65">Point a phone camera here to open your Event Hub.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic same-origin PNG from our QR route */}
          <img
            src={`/api/website/qr${liveHref}`}
            alt="QR code that opens your live Event Hub"
            width={168}
            height={168}
            className="mt-2 h-auto w-40 rounded-md"
          />
          {liveUrl ? (
            <QrActions
              url={liveUrl}
              download={{ href: `/api/website/qr${liveHref}`, filename: 'setnayan-event-qr.png' }}
              className="mt-2 flex flex-wrap gap-1.5"
            />
          ) : null}
        </section>
      ) : null}
      {showProCta ? (
        <section className="rounded-md bg-ink px-4 py-3.5 text-cream">
          <p className="text-[13px] font-semibold text-cream">Event Hub Pro</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-cream/80">
            One unlock for every stage — the look, the reveal, your own photos and film, music and the
            animated logo.
          </p>
          <Link
            href={proUnlockHref}
            className="sn-press mt-2.5 inline-flex min-h-10 items-center rounded-full bg-amber-400 px-4 text-[13px] font-semibold text-ink hover:bg-amber-300"
          >
            {unlockLabel(proPriceLabel)}
          </Link>
        </section>
      ) : null}
    </>
  );
}

const TABS: Array<{ key: MakerSceneTab; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'animate', label: 'Animate' },
  { key: 'transition', label: 'Transition' },
  { key: 'content', label: 'Content' },
];

function Inspector({
  selection,
  scene,
  scenePanel,
  rows,
  themes,
  themeHref,
  eventId,
  madeOnce,
  showMotionTabs,
  onClose,
  onTab,
}: {
  madeOnce: Partial<Record<MadeOnceKey, ReactNode>> | null;
  selection: NonNullable<MakerSelection>;
  scene: MakerScene | null;
  scenePanel: ReactNode;
  rows: Record<string, MakerRowPanel>;
  themes: Array<{ id: string; name: string; ready: boolean; current: boolean }>;
  themeHref: string;
  eventId: string;
  showMotionTabs: boolean;
  onClose: () => void;
  onTab: (tab: MakerSceneTab) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const tab: MakerSceneTab = selection.kind === 'scene' ? (selection.tab ?? 'format') : 'format';

  /* Format · Animate · Transition are the three parts of ONE panel (the
     section's own controls); a tab brings its part into view. */
  useEffect(() => {
    if (selection.kind !== 'scene' || tab === 'content' || tab === 'format') {
      bodyRef.current?.scrollTo({ top: 0 });
      return;
    }
    const target = bodyRef.current?.querySelector(`[data-maker-part="${tab}"]`);
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [selection, tab]);

  const title =
    selection.kind === 'scene'
      ? (scene?.label ?? 'Scene')
      : selection.kind === 'main'
        ? 'Main · behind every scene'
        : selection.kind === 'tool'
          ? { logo: 'Logo', hero: 'Hero', reveal: 'Reveal', 'love-story': 'Love Story', 'post-event': 'Post Event', prints: 'Prints & Tickets', details: 'Details' }[selection.key]
          : (rows[selection.key]?.label ?? 'Edit');

  const tabs = TABS.filter((t) => showMotionTabs || (t.key !== 'animate' && t.key !== 'transition'));
  const contentRow = scene ? CONTENT_ROW_FOR_TYPE[scene.type] : undefined;

  let body: ReactNode = null;
  if (selection.kind === 'scene') {
    body =
      tab === 'content' ? (
        /* The hero scene's words and photo ARE the one hero (Phase 6): made
           once, in the Hero workspace — not a second, live-writing copy. */
        scene?.type === 'hero' && madeOnce?.hero ? (
          madeOnce.hero
        ) : contentRow && rows[contentRow] ? (
          <RowBlock row={rows[contentRow]!} />
        ) : (
          <p className="px-1 text-[13px] text-ink/70">
            This scene is written for you from your event — your guest list, your schedule and your replies —
            so there is nothing to type here.
          </p>
        )
      ) : (
        scenePanel ?? <p className="px-1 text-[13px] text-ink/70">This scene has no settings of its own.</p>
      );
  } else if (selection.kind === 'main') {
    body = (
      <>
        <ThemePanel themes={themes} href={themeHref} />
        {MAIN_ROWS.filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
      </>
    );
  } else if (
    selection.kind === 'tool' &&
    (selection.key === 'logo' || selection.key === 'hero' || selection.key === 'reveal') &&
    madeOnce?.[selection.key]
  ) {
    // 🧩 The made-once group: the tool's own workspace, drafted, never live.
    body = madeOnce[selection.key];
  } else if (selection.kind === 'tool' && selection.key === 'love-story') {
    /* 💌 THE BAR'S "LOVE STORY" OPENS THE SCRAPBOOK (Maker Phase 7). Each
       moment there is one scene on the Invitation; the words form stays below
       for the invitation's story paragraph. */
    body = (
      <section className="space-y-3 px-1">
        <p className="text-[13.5px] text-ink/75">
          Our Love Story — your moments, each one a scene on your Invitation. A year is enough; five stories in your
          words are free.
        </p>
        <Link
          href={`/dashboard/${eventId}/website/our-story`}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          Open Our Love Story
          <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
        {/* The scrapbook writes `events.love_story` live — the draft does not hold
            it yet (moments carry photos that Apply would have to re-screen). */}
        <HubSavesImmediately className="ml-2" />
        {(TOOL_ROWS['love-story'] ?? []).filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
      </section>
    );
  } else if (selection.kind === 'tool' && selection.key === 'logo') {
    body = (
      <section className="space-y-3 px-1">
        <p className="text-[13.5px] text-ink/75">
          Your logo — the monogram on your hero, your seal and every page — is designed once, in the Logo Maker.
        </p>
        <Link
          href={`/dashboard/${eventId}/monogram`}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          Open the Logo Maker
          <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
        <p className="text-[12px] text-ink/60">
          <InfoTip label="Coming next" align="start">
            {MAKER_COMING_NEXT.logo}
          </InfoTip>
        </p>
      </section>
    );
  } else {
    const keys = selection.kind === 'tool' ? (TOOL_ROWS[selection.key] ?? []) : [selection.key];
    const note =
      selection.kind === 'tool' && selection.key === 'hero'
        ? MAKER_COMING_NEXT[selection.key]
        : null;
    body = (
      <>
        {keys.filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
        {keys.every((k) => !rows[k]) ? (
          <p className="px-1 text-[13px] text-ink/70">Nothing to set here for this event.</p>
        ) : null}
        {note ? (
          <p className="px-1 text-[12px] text-ink/60">
            <InfoTip label="Coming next" align="start">
              {note}
            </InfoTip>
          </p>
        ) : null}
      </>
    );
  }

  return (
    <aside
      aria-label="Inspector"
      className="sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col rounded-t-3xl lg:static lg:z-auto lg:order-3 lg:max-h-none lg:w-[340px] lg:shrink-0 lg:rounded-none"
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <p className="min-w-0 flex-1 truncate font-serif text-lg text-ink">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the inspector"
          className="sn-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      {selection.kind === 'scene' ? (
        <div role="tablist" aria-label="Edit this scene" className="flex gap-0.5 px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={`sn-press min-h-9 flex-1 whitespace-nowrap rounded-md px-1 text-[12.5px] font-semibold transition-colors duration-sn-control ease-sn ${
                tab === t.key ? 'bg-ink text-cream' : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-6 pt-3">
        {body}
      </div>
    </aside>
  );
}

/**
 * THE THEME PANEL — a placeholder that reads the theme registry as it stands.
 * The whole-hub picker (ten themes) is Phase 3's; until it lands this names the
 * themes that ship, marks the couple's, and opens the picker that already
 * writes `events.invite_theme`.
 */
function ThemePanel({
  themes,
  href,
}: {
  themes: Array<{ id: string; name: string; ready: boolean; current: boolean }>;
  href: string;
}) {
  const ready = themes.filter((t) => t.ready);
  return (
    <section className="rounded-md bg-white/70 px-3 py-3" data-maker-theme-panel="">
      <p className="text-[14px] font-semibold text-ink">Theme</p>
      <p className="mt-0.5 text-[12.5px] text-ink/65">Pick a theme and the whole Event Hub is dressed.</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {ready.map((t) => (
          <li
            key={t.id}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
              t.current ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/75'
            }`}
          >
            {t.name}
            {t.current ? ' · yours' : ''}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="sn-press mt-3 inline-flex min-h-10 items-center gap-1 rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink hover:bg-ink/10"
      >
        Choose your theme
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
      {/* `events.invite_theme` is painted by the guest layout, which cannot see
          the host's draft — so the picker writes live, and says so here. */}
      <HubSavesImmediately className="ml-2" />
      <p className="mt-2 text-[12px] text-ink/60">
        <InfoTip label="Coming next" align="start">
          All ten themes, each dressing every stage at once, arrive in the next build.
        </InfoTip>
      </p>
    </section>
  );
}
