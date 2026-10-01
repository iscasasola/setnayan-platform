'use client';

import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, makerProUsable, paidMarkLabel } from '@/lib/paid-mark';
import { useSceneCanvas } from './use-scene-canvas';
import { ArrowDown, ArrowUp, Lock, PencilLine, Play } from 'lucide-react';
import {
  HUB_ARRANGEMENTS,
  HUB_ARRANGEMENT_LABEL,
  HUB_DEFAULT_ARRANGEMENT,
  HUB_DIRECTIONS,
  HUB_IN,
  HUB_IN_DIRECTION_LABEL,
  HUB_IN_LABEL,
  HUB_MOTION_PRESETS,
  HUB_MOTION_PRESET_LABEL,
  HUB_OUT,
  HUB_OUT_DIRECTION_LABEL,
  HUB_OUT_LABEL,
  HUB_SEQUENCE_LABEL,
  HUB_TIMELINE_LABEL,
  hubInMoves,
  hubOutMoves,
  resolveHubMotion,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import { canvasHasMotion, HUB_CANVAS_MOTION_KEYS } from '@/lib/hub-look-pro';
import {
  HUB_AUTO_SPEEDS,
  HUB_AUTO_SPEED_LABEL,
  HUB_DEFAULT_AUTO_SPEED,
  HUB_TRANSITIONS,
  HUB_TRANSITION_HINT,
  HUB_TRANSITION_LABEL,
  nextTransition,
  resolveTransition,
} from '@/lib/hub-scenes';
import { HUB_ELEMENT_LABEL, type HubElementKey } from '@/lib/element-style';
import type { ElementDraftAction } from './element-sheet';
import { IButton, IHint, IReset, IRow, ISection, ISeg, ISegmented } from './inspector-kit';

/**
 * 🎬 THE SCENE INSPECTOR'S TABS — Keynote's slide inspector for one scene
 * (owner 2026-09-27: *"ALL THE MAKER'S TOOLBARS TAKE KEYNOTE AND PAGES AS THEIR
 * MODEL"*; approved prototype frame A): **Format · Animate · Arrange ·
 * Content**. The Transition tab is folded into Animate (answer 4: *"fold it"*
 * — Keynote keeps transitions under Animate too).
 *
 *   FORMAT   Background (`scene-background-row.tsx`) · Layout (a scene of their own)
 *   ANIMATE  How it moves (Auto · Still · Calm · Editorial · Cinematic) · Into
 *            the next scene (Scroll · Scrub · Auto-scroll) · Speed · ▶ Preview,
 *            and — nothing lost — the fine-tune rows that shipped under a
 *            preset: Timing · Comes in / From · Goes out / Toward · Parts
 *   ARRANGE  Show (Shown · Auto · Hidden) · Order (Move up · Move down) ·
 *            Remove… for a scene of their own
 *   CONTENT  the scene's words (their own box) and its parts, each opening the
 *            part's toolbar
 *
 * 💾 THE DRAFT, NEVER LIVE. How a scene moves and lays out is ITS CANVAS, so
 * those rows save the scene's whole canvas through `hubDraftAction` (the one
 * draft door the element sheet uses) — no page reload, the canvas refreshes
 * behind it. Show and Order are not canvas: they go through the navigator's
 * own draft form (the shell's `post` / `move`), exactly as the navigator's ⋯
 * menu does. Remove is the scene's existing confirm-first form.
 *
 * 💎 PRO, TRIED HERE, PAID AT APPLY (owner 2026-09-28, verbatim: *"they can edit
 * it with pro features. but need to upgrade to pro when clicked on apply and
 * point out the effect chosen that caused them to upgrade to pro"*). How a scene
 * moves is still Event Hub Pro, but every row saves to the DRAFT, so a couple
 * without it uses the same controls — marked ◆ PRO, never locked — and the
 * Apply sheet names what they chose ("Animation · Schedule"). In the app-store
 * shell a couple without Pro is shown only "Reset how it moves" (the one motion
 * change that is always free); a Pro control there is hidden, never locked.
 */

export type SceneTab = 'format' | 'animate' | 'arrange' | 'content';
export const SCENE_TABS: ReadonlyArray<{ key: SceneTab; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'animate', label: 'Animate' },
  { key: 'arrange', label: 'Arrange' },
  { key: 'content', label: 'Content' },
];

/* `useSceneCanvas` lives in its own small module so a lazy piece (the scene's
   Style row, `maker-details`) can use it without pulling this whole inspector —
   a first-screen module — into that chunk group (train n: that made the
   inspector + the template picker one more async chunk in the runtime every
   page loads, 5 B over the shared-bundle ceiling). */
export { useSceneCanvas } from './use-scene-canvas';

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
      {error}
    </p>
  ) : null;
}

/* ── ANIMATE ────────────────────────────────────────────────────────────── */

export function SceneAnimateTab({
  eventId,
  widgetType,
  canvas,
  draftAction,
  ownsPro,
  hideLocked,
  isLast,
  onPreview,
}: {
  eventId: string;
  widgetType: string;
  canvas: HubSectionCanvas;
  draftAction: ElementDraftAction;
  ownsPro: boolean;
  /** The store shell: a Pro control is hidden, never shown locked. */
  hideLocked: boolean;
  /** The stage's last scene has no next scene — no transition to set. */
  isLast: boolean;
  /** ▶ Preview — play this scene, then the move into the next. */
  onPreview: () => void;
}) {
  const { shown, save, pending, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction);

  const mark = makerProMark({ owns: ownsPro, storeShell: hideLocked });
  if (!makerProUsable({ owns: ownsPro, storeShell: hideLocked })) {
    return (
      <div data-scene-tab="animate" aria-busy={pending}>
        {canvasHasMotion(shown as Record<string, unknown>) ? (
          /* 🔓 A free couple may always take a look off. */
          <IReset data="scene-motion" onClick={() => save((c) => { for (const k of HUB_CANVAS_MOTION_KEYS) delete c[k]; })}>
            Reset how it moves
          </IReset>
        ) : null}
        <ErrorLine error={error} />
      </div>
    );
  }

  const preset = shown.preset ?? null;
  const m = resolveHubMotion(shown);
  const transition = resolveTransition(shown);
  const speed = shown.autoSpeed ?? HUB_DEFAULT_AUTO_SPEED;
  const setTransition = (t: string | null, s: string | null) =>
    save((c) => {
      const step = nextTransition(shown, t, s);
      delete c.transition;
      delete c.autoSpeed;
      if (step.transition) c.transition = step.transition;
      if (step.autoSpeed) c.autoSpeed = step.autoSpeed;
    });

  return (
    <div data-scene-tab="animate" aria-busy={pending}>
      {/* 💎 How a scene moves is Event Hub Pro — the diamond for an owning couple,
          ◆ PRO for one trying it (their pick waits in the draft for Apply). */}
      <ISection>
        <span className="inline-flex items-center gap-1.5">
          How it moves
          {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null}
        </span>
      </ISection>
      <IRow wrap data="scene-preset">
        <ISegmented label="How it moves">
          <ISeg on={!preset} onClick={() => save((c) => { delete c.preset; })}>
            Auto
          </ISeg>
          {HUB_MOTION_PRESETS.map((p) => (
            <ISeg key={p} on={preset === p} onClick={() => save((c) => { c.preset = p; })}>
              {HUB_MOTION_PRESET_LABEL[p]}
            </ISeg>
          ))}
        </ISegmented>
      </IRow>
      <IHint>Auto follows the theme. The rest sets how this scene’s parts arrive.</IHint>

      {/* The fine-tune rows that shipped under a preset — kept, one step down. */}
      {preset ? (
        <>
          <IRow label="Timing" wrap data="scene-timing">
            <ISegmented label="Timing">
              {(['auto', 'time', 'scrub'] as const).map((t) => (
                <ISeg
                  key={t}
                  on={t === 'auto' ? !shown.timeline : shown.timeline === t}
                  onClick={() => save((c) => { if (t === 'auto') delete c.timeline; else c.timeline = t; })}
                >
                  {t === 'auto' ? 'Auto' : HUB_TIMELINE_LABEL[t]}
                </ISeg>
              ))}
            </ISegmented>
          </IRow>
          <ChipRow label="Comes in" values={HUB_IN} labels={HUB_IN_LABEL} isAuto={!shown.in} current={m.in} onPick={(v) => save((c) => { if (v === 'auto') { delete c.in; delete c.inFrom; } else { c.in = v; } })} />
          {hubInMoves(m.in) ? (
            <ChipRow label="From" values={HUB_DIRECTIONS} labels={HUB_IN_DIRECTION_LABEL} isAuto={!shown.inFrom} current={m.inFrom} onPick={(v) => save((c) => { if (v === 'auto') delete c.inFrom; else c.inFrom = v; })} />
          ) : null}
          <ChipRow label="Goes out" values={HUB_OUT} labels={HUB_OUT_LABEL} isAuto={!shown.out} current={m.out} onPick={(v) => save((c) => { if (v === 'auto') { delete c.out; delete c.outTo; } else { c.out = v; } })} />
          {hubOutMoves(m.out) ? (
            <ChipRow label="Toward" values={HUB_DIRECTIONS} labels={HUB_OUT_DIRECTION_LABEL} isAuto={!shown.outTo} current={m.outTo} onPick={(v) => save((c) => { if (v === 'auto') delete c.outTo; else c.outTo = v; })} />
          ) : null}
          <IRow label="Parts" wrap data="scene-sequence">
            <ISegmented label="How its parts arrive">
              {(['auto', 'together', 'one_after_another'] as const).map((q) => (
                <ISeg key={q} on={q === 'auto' ? !shown.sequence : shown.sequence === q} onClick={() => save((c) => { if (q === 'auto') delete c.sequence; else c.sequence = q; })}>
                  {q === 'auto' ? 'Auto' : HUB_SEQUENCE_LABEL[q]}
                </ISeg>
              ))}
            </ISegmented>
          </IRow>
        </>
      ) : null}

      <ISection>
        <span className="inline-flex items-center gap-1.5">
          Into the next scene
          {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null}
        </span>
      </ISection>
      {isLast ? (
        <IHint data="last-scene">The last scene — nothing comes after it, so there is no move to set.</IHint>
      ) : (
        <>
          <IRow wrap data="scene-transition">
            <ISegmented label="Into the next scene">
              {HUB_TRANSITIONS.map((t) => (
                <ISeg key={t} on={transition === t} title={HUB_TRANSITION_HINT[t]} onClick={() => setTransition(t, null)}>
                  {HUB_TRANSITION_LABEL[t]}
                </ISeg>
              ))}
            </ISegmented>
          </IRow>
          {transition === 'auto' ? (
            <IRow label="Speed" data="scene-speed">
              <ISegmented label="Speed">
                {HUB_AUTO_SPEEDS.map((v) => (
                  <ISeg key={v} on={speed === v} onClick={() => setTransition('auto', v)}>
                    {HUB_AUTO_SPEED_LABEL[v]}
                  </ISeg>
                ))}
              </ISegmented>
            </IRow>
          ) : null}
          {transition !== 'scroll' ? <IHint>{HUB_TRANSITION_HINT[transition]}</IHint> : null}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2 py-2.5">
        <IButton fill onClick={onPreview} data="scene-preview">
          <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Preview
        </IButton>
        <span className="text-[12px] text-ink/55">Plays this scene, then the move into the next.</span>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function ChipRow<V extends string>({
  label,
  values,
  labels,
  isAuto,
  current,
  onPick,
}: {
  label: string;
  values: readonly V[];
  labels: Record<V, string>;
  isAuto: boolean;
  current: V;
  onPick: (v: V | 'auto') => void;
}) {
  return (
    <IRow label={label} wrap>
      <ISegmented label={label}>
        <ISeg on={isAuto} onClick={() => onPick('auto')}>
          Auto
        </ISeg>
        {values.map((v) => (
          <ISeg key={v} on={!isAuto && current === v} onClick={() => onPick(v)}>
            {labels[v]}
          </ISeg>
        ))}
      </ISegmented>
    </IRow>
  );
}

/* ── FORMAT · LAYOUT (a scene of their own) ─────────────────────────────── */

export function SceneLayoutRow({
  eventId,
  widgetType,
  canvas,
  draftAction,
}: {
  eventId: string;
  widgetType: string;
  canvas: HubSectionCanvas;
  draftAction: ElementDraftAction;
}) {
  const { shown, save, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction);
  /* 🎬 A scene made from a TEMPLATE lays itself out — the four arrangements
     would move nothing there, so the row is not drawn. */
  if (shown.template) return null;
  const arrangement = shown.arrangement ?? HUB_DEFAULT_ARRANGEMENT;
  return (
    <>
      <IRow label="Layout" wrap data="scene-layout">
        <ISegmented label="Layout">
          {HUB_ARRANGEMENTS.map((a) => (
            <ISeg key={a} on={arrangement === a} onClick={() => save((c) => { c.arrangement = a; })}>
              {HUB_ARRANGEMENT_LABEL[a]}
            </ISeg>
          ))}
        </ISegmented>
      </IRow>
      <ErrorLine error={error} />
    </>
  );
}

/* ── ARRANGE ────────────────────────────────────────────────────────────── */

export function SceneArrangeTab({
  mode,
  isVisible,
  hasContent,
  openBrowse,
  pending,
  onMode,
  onEye,
  canUp,
  canDown,
  onUp,
  onDown,
  removeForm,
}: {
  mode: 'auto' | 'shown' | 'hidden';
  isVisible: boolean;
  hasContent: boolean;
  /** Which ONE visibility control governs this event (`visibility-control-is-singular.test.ts`). */
  openBrowse: boolean;
  pending: boolean;
  onMode: (mode: 'auto' | 'shown' | 'hidden') => void;
  onEye: () => void;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  /** A scene of their own: its confirm-first Remove (a server form). */
  removeForm?: React.ReactNode;
}) {
  return (
    <div data-scene-tab="arrange" aria-busy={pending}>
      <ISection>Show</ISection>
      {openBrowse ? (
        <>
          <IRow data="scene-show">
            <ISegmented label="Show this scene">
              {(['shown', 'auto', 'hidden'] as const).map((m) => {
                const blocked = m === 'shown' && !hasContent;
                return (
                  <ISeg
                    key={m}
                    on={mode === m}
                    disabled={pending || blocked}
                    title={blocked ? 'Add content to this scene first.' : undefined}
                    onClick={() => mode !== m && onMode(m)}
                    data={`mode-${m}`}
                  >
                    {blocked ? <Lock aria-hidden className="h-3 w-3" strokeWidth={2.5} /> : null}
                    {m === 'shown' ? 'Shown' : m === 'auto' ? 'Auto' : 'Hidden'}
                  </ISeg>
                );
              })}
            </ISegmented>
          </IRow>
          <IHint>Auto shows it as soon as it has content. Hidden keeps it back.</IHint>
        </>
      ) : (
        <IRow data="scene-eye">
          <ISegmented label="Show this scene">
            <ISeg on={isVisible} disabled={pending} onClick={() => !isVisible && onEye()} data="visible">
              Shown
            </ISeg>
            <ISeg on={!isVisible} disabled={pending} onClick={() => isVisible && onEye()} data="hidden">
              Hidden
            </ISeg>
          </ISegmented>
        </IRow>
      )}
      <ISection>Order</ISection>
      <IRow data="scene-order">
        <IButton disabled={pending || !canUp} onClick={onUp} data="move-up">
          <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2} />
          Move up
        </IButton>
        <IButton disabled={pending || !canDown} onClick={onDown} data="move-down">
          <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={2} />
          Move down
        </IButton>
      </IRow>
      <IHint>Or drag a scene in the list. Same thing.</IHint>
      {removeForm ? <div className="py-1">{removeForm}</div> : null}
    </div>
  );
}

/* ── CONTENT · THE SCENE'S PARTS ────────────────────────────────────────── */

/**
 * "This scene's words are its parts. Tap one on the scene, or pick it here — it
 * opens the part's toolbar." The same sheet a tap on the part opens.
 */
export function SceneParts({
  keys,
  onElement,
  onOpenHero,
}: {
  keys: readonly HubElementKey[];
  onElement: (el: HubElementKey) => void;
  onOpenHero?: () => void;
}) {
  /* 💎 No Pro mark here any more (owner 2026-09-28): styling a part is free —
     colour, size, the Text rows — and only its Font ▾ and Animate wear the
     mark, inside the part's own sheet. */
  return (
    <div data-scene-parts="" className="pt-1">
      <IHint>
        This scene’s words are its parts. Tap one on the scene, or pick it here — it opens the part’s toolbar.
      </IHint>
      <div className="flex flex-wrap gap-1.5 pb-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            data-maker-element={k}
            onClick={() => onElement(k)}
            className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink/5 px-3.5 text-[13px] font-semibold text-ink/80 transition-colors duration-sn-control ease-sn hover:bg-ink/10 lg:min-h-9"
          >
            {HUB_ELEMENT_LABEL[k]}
          </button>
        ))}
      </div>
      {onOpenHero ? (
        <IButton onClick={onOpenHero} data="open-hero">
          <PencilLine aria-hidden className="h-4 w-4" strokeWidth={2} />
          Open the Hero editor
        </IButton>
      ) : null}
    </div>
  );
}
