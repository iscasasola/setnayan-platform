'use client';

import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, makerProUsable, paidMarkLabel } from '@/lib/paid-mark';
import { useSceneCanvas } from './use-scene-canvas';
import { Play } from 'lucide-react';
import {
  HUB_MOTION_PRESETS,
  HUB_MOTION_PRESET_LABEL,
  HUB_SEQUENCE_LABEL,
  HUB_TIMELINE_LABEL,
  hubSceneFxFields,
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
import type { ElementDraftAction } from './element-sheet';
import { IButton, IHint, IReset, IRow, ISection } from './inspector-kit';
import { PickMenu } from './pick-menu';
import { MotionFxRows } from './motion-fx-rows';
import type { MotionFx } from '@/lib/motion-effects';
import { HUB_DURING_LABEL, HUB_SEQUENCES } from '@/lib/hub-canvas';
import { makerSceneHasRows } from '@/lib/maker-parts';
import { useMaker } from '../../../launch/_components/maker-context';
import { StageAnimate } from '../../../launch/_components/stage-panel/stage-animate';

/**
 * 🎬 A SCENE'S ANIMATE TAB — the scene inspector's (`scene-inspector.tsx`, whose
 * docblock describes the four tabs), in its own module so it loads when a
 * scene's Animate first opens (`details-lazy.tsx`, the `maker-details` chunk),
 * never in the Maker's first load (`scripts/check-maker-js-budget.mjs`). Every
 * choice is ONE dropdown (owner: any set of choices is a dropdown — five pills
 * clipped "Cinematic" on a phone, handoff NEXT BUILDS 3). 💾 The draft, never live.
 */

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
      {error}
    </p>
  ) : null;
}


/** A dropdown that takes its row (the part inspector's own row class). */
const ROW_PICK = 'min-h-11 min-w-0 flex-1 lg:min-h-9';

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
  /* 🧭 The new Maker draws these same saves as the prototype's one column (`stage-panel/stage-animate.tsx`). */
  const ss = useMaker()?.stagesStudio === true;

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

  if (ss) {
    return (
      <div data-scene-tab="animate" className="contents">
        <StageAnimate
          pending={pending}
          error={error}
          pro={mark ? 'How a scene moves is Event Hub Pro — try it here; it goes live when you Apply with it.' : null}
          how={{
            value: preset ?? 'auto',
            options: [{ key: 'auto', label: 'Auto' }, ...HUB_MOTION_PRESETS.map((p) => ({ key: p, label: HUB_MOTION_PRESET_LABEL[p] }))],
            onPick: (k) => save((c) => { if (k === 'auto') delete c.preset; else c.preset = k; }),
          }}
          inFx={m.inFx}
          outFx={m.outFx}
          onIn={(fx) => save((c) => sceneFx(c, 'in', fx))}
          onOut={(fx) => save((c) => sceneFx(c, 'out', fx))}
          rows={
            makerSceneHasRows(widgetType)
              ? {
                  value: shown.sequence ?? 'auto',
                  options: [
                    { key: 'auto', label: 'Auto' },
                    ...HUB_SEQUENCES.map((q) => ({ key: q, label: q === 'one_after_another' ? 'One after another' : HUB_SEQUENCE_LABEL[q] })),
                  ],
                  onPick: (q) => save((c) => { if (q === 'auto') delete c.sequence; else c.sequence = q; }),
                }
              : null
          }
          does={{
            value: shown.during ?? 'auto',
            options: [{ key: 'auto', label: 'Auto' }, ...(['still', 'lift'] as const).map((d) => ({ key: d, label: HUB_DURING_LABEL[d] }))],
            onPick: (d) => save((c) => { if (d === 'auto') delete c.during; else c.during = d; }),
          }}
          timing={{
            value: shown.timeline ?? 'auto',
            options: (['auto', 'time', 'scrub'] as const).map((t) => ({ key: t, label: t === 'auto' ? 'Auto' : HUB_TIMELINE_LABEL[t] })),
            onPick: (t) => save((c) => { if (t === 'auto') delete c.timeline; else c.timeline = t; }),
          }}
          next={
            isLast
              ? null
              : {
                  value: transition,
                  options: HUB_TRANSITIONS.map((t) => ({ key: t, label: HUB_TRANSITION_LABEL[t] })),
                  onPick: (t) => setTransition(t, null),
                }
          }
        />
      </div>
    );
  }

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
      {/* ▾ ONE dropdown, never a pill row (owner: any set of choices is a dropdown) —
          five pills clipped "Cinematic" in the phone's tool (handoff NEXT BUILDS 3). */}
      <IRow data="scene-preset">
        <PickMenu
          label="How it moves"
          dataAttr="data-scene-preset"
          value={preset ?? 'auto'}
          options={[{ key: 'auto', label: 'Auto' }, ...HUB_MOTION_PRESETS.map((p) => ({ key: p, label: HUB_MOTION_PRESET_LABEL[p] }))]}
          onPick={(k) => save((c) => { if (k === 'auto') delete c.preset; else c.preset = k; })}
          className={ROW_PICK}
        />
      </IRow>
      <IHint>Auto follows the theme. The rest sets how this scene’s parts arrive.</IHint>

      {/* The fine-tune rows that shipped under a preset — kept, one step down. */}
      {preset ? (
        <>
          <IRow label="Timing" data="scene-timing">
            <PickMenu
              label="Timing"
              dataAttr="data-scene-timing"
              value={shown.timeline ?? 'auto'}
              options={(['auto', 'time', 'scrub'] as const).map((t) => ({ key: t, label: t === 'auto' ? 'Auto' : HUB_TIMELINE_LABEL[t] }))}
              onPick={(t) => save((c) => { if (t === 'auto') delete c.timeline; else c.timeline = t; })}
              className={ROW_PICK}
            />
          </IRow>
          {/* 🎛 The same four effects as a part (owner 2026-10-04: "scenes share
              the vocabulary") — Fade · Move ▾ (the arrow grid, 8 directions) ·
              Size · Blur, for the In and for the Out. Stored in the shipped
              fields whenever they can say it (`hubSceneFxFields`). */}
          <div data-motion-step="scene-in">
            <ISection>Comes in</ISection>
            <MotionFxRows end="in" fx={m.inFx} onChange={(fx) => save((c) => sceneFx(c, 'in', fx))} />
            {shown.in || shown.inFx ? (
              <IReset data="scene-in-auto" onClick={() => save((c) => { delete c.in; delete c.inFrom; delete c.inFx; })}>
                Back to Auto
              </IReset>
            ) : null}
          </div>
          <div data-motion-step="scene-out">
            <ISection>Goes out</ISection>
            <MotionFxRows end="out" fx={m.outFx} onChange={(fx) => save((c) => sceneFx(c, 'out', fx))} />
            {shown.out || shown.outFx ? (
              <IReset data="scene-out-auto" onClick={() => save((c) => { delete c.out; delete c.outTo; delete c.outFx; })}>
                Back to Auto
              </IReset>
            ) : null}
          </div>
          <IRow label="Parts" data="scene-sequence">
            <PickMenu
              label="How its parts arrive"
              dataAttr="data-scene-sequence"
              value={shown.sequence ?? 'auto'}
              options={(['auto', 'together', 'one_after_another'] as const).map((q) => ({ key: q, label: q === 'auto' ? 'Auto' : HUB_SEQUENCE_LABEL[q] }))}
              onPick={(q) => save((c) => { if (q === 'auto') delete c.sequence; else c.sequence = q; })}
              className={ROW_PICK}
            />
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
          <IRow data="scene-transition">
            <PickMenu
              label="Into the next scene"
              dataAttr="data-scene-transition"
              value={transition}
              options={HUB_TRANSITIONS.map((t) => ({ key: t, label: HUB_TRANSITION_LABEL[t], hint: HUB_TRANSITION_HINT[t] }))}
              onPick={(t) => setTransition(t, null)}
              className={ROW_PICK}
            />
          </IRow>
          {transition === 'auto' ? (
            <IRow label="Speed" data="scene-speed">
              <PickMenu
                label="Speed"
                dataAttr="data-scene-speed"
                value={speed}
                options={HUB_AUTO_SPEEDS.map((v) => ({ key: v, label: HUB_AUTO_SPEED_LABEL[v] }))}
                onPick={(v) => setTransition('auto', v)}
                className={ROW_PICK}
              />
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

/** One end of the scene's motion, written as `hubSceneFxFields` stores it — one answer per end. */
function sceneFx(c: Record<string, unknown>, end: 'in' | 'out', fx: MotionFx | null) {
  if (end === 'in') {
    delete c.in;
    delete c.inFrom;
    delete c.inFx;
  } else {
    delete c.out;
    delete c.outTo;
    delete c.outFx;
  }
  Object.assign(c, hubSceneFxFields(end, fx));
}
