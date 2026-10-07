'use client';

/**
 * 🎨 A FIXED PART'S STYLE — the entourage, Find your seat, each guest's own
 * photos, the announcements and the live hub (owner 2026-09-29, "every scene …
 * at least three premade styles"). The same ONE Style row every scene wears
 * (`SceneStyleRow`, a PickMenu); the pick goes to the DRAFT through the one
 * draft door (`hubDraftAction` intent=save, `fixedStyles`), and Apply writes it
 * into `events.style_preferences.scene_styles`. Free — no ◆. Never live before
 * Apply.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { FixedSceneStyles, FixedStyleScene, StyledScene } from '@/lib/fixed-scene-styles';
import { MAKER_PARTS } from '@/lib/maker-parts';
import { useStagePanelNow } from '../../../launch/_components/stage-panel/store';
import type { HubStage } from '@/lib/hub-canvas';
import { makerNeedsRender, makerRedrawSave } from '@/lib/maker-refresh';
import { resolveSceneStyle, sceneStyleOptions } from '@/lib/scene-styles';
import { recommendedStageSceneStyle } from '@/lib/scene-styles-stages';

import type { ElementDraftAction } from './element-sheet';
import { SceneStyleRow } from './scene-style-row';

/**
 * 🎨 THE PARTS' OWN STYLES (owner 2026-10-07, `lib/scene-styles-parts.ts`) — a fixed SECTION that holds
 * parts with their own styles: the hero (Logo · Title · Names · Date · Place, one per picked part), E-Gifts,
 * and the guest's look (What to wear). Its Look carousel is the PICKED part's styles, saved the same way.
 */
export const PART_LOOK_HOSTS = ['hero', 'gifts', 'look'] as const;
export type PartLookHost = (typeof PART_LOOK_HOSTS)[number];
export function isPartLookHost(v: unknown): v is PartLookHost {
  return typeof v === 'string' && (PART_LOOK_HOSTS as readonly string[]).includes(v);
}

/** The picked part (`lib/maker-parts.ts`) on a host → its style type, or null (the hero's Joiner, Line …). */
function partLookOf(host: PartLookHost, picked: string | null): { scene: StyledScene; el: string | null } | null {
  if (host === 'gifts') return { scene: 'gifts', el: null };
  if (host === 'look') return { scene: 'my_wear', el: null };
  const def = picked && picked in MAKER_PARTS ? MAKER_PARTS[picked as keyof typeof MAKER_PARTS] : null;
  if (!def || def.canvas !== 'f:hero' || def.layouts.kind !== 'scene') return null;
  return { scene: def.layouts.type as StyledScene, el: def.el ?? null };
}

/** A part host's Look: the carousel of the picked part's styles — or nothing for a part with none. */
function PartLookStyleRow(props: {
  eventId: string;
  host: PartLookHost;
  stage: HubStage;
  eventType: string | null;
  styles: FixedSceneStyles | null;
  draftAction: ElementDraftAction;
}) {
  const now = useStagePanelNow();
  const at = partLookOf(props.host, now.picked);
  if (!at) return null;
  return (
    <StyledSceneRow
      key={at.scene}
      eventId={props.eventId}
      scene={at.scene}
      stage={props.stage}
      eventType={props.eventType}
      picked={props.styles?.[at.scene] ?? null}
      draftAction={props.draftAction}
      previewKey={`f:${props.host}${at.el ? `.${at.el}` : ''}`}
    />
  );
}

/**
 * The ONE lazy door (`scene-styles-lazy.tsx`): a fixed part's Style row, or — 🎨 for a part host (the hero,
 * E-Gifts, the guest's look) — the picked part's own (`PartLookStyleRow`). One stand-in, so the Maker's
 * first load carries no second `dynamic()`.
 */
export function FixedSceneStyleRow(
  props:
    | (Parameters<typeof StyledSceneRow>[0] & { scene: FixedStyleScene })
    | { eventId: string; scene: PartLookHost; stage: HubStage; eventType: string | null; styles: FixedSceneStyles | null; draftAction: ElementDraftAction },
) {
  if (isPartLookHost(props.scene)) {
    const p = props as Extract<typeof props, { styles: unknown }>;
    return <PartLookStyleRow eventId={p.eventId} host={p.scene as PartLookHost} stage={p.stage} eventType={p.eventType} styles={p.styles} draftAction={p.draftAction} />;
  }
  return <StyledSceneRow {...(props as Parameters<typeof StyledSceneRow>[0])} />;
}

function StyledSceneRow({
  eventId,
  scene,
  stage,
  eventType,
  picked,
  draftAction,
  previewKey = null,
}: {
  eventId: string;
  scene: StyledScene;
  stage: HubStage;
  eventType: string | null;
  /** The pick as the canvas draws it — live with the draft laid on. */
  picked: string | null;
  draftAction: ElementDraftAction;
  /** 🖼 What each miniature frames (`?only=`) — absent: the fixed part's own marker (`f:<scene>`). */
  previewKey?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* What the couple just picked, shown at once while the save round-trips. */
  const [shown, setShown] = useState<string | null>(picked);
  const options = sceneStyleOptions(scene, stage, eventType);
  if (options.length < 2) return null;
  return (
    <SceneStyleRow
      options={options}
      value={resolveSceneStyle(scene, stage, shown, eventType)}
      recommendedId={recommendedStageSceneStyle(scene, stage, eventType)}
      /* 🧭 The new Maker's miniatures are copied from this fixed part on the canvas. */
      preview={{ canvasKey: previewKey ?? `f:${scene as FixedStyleScene}`, sceneType: scene }}
      pending={pending}
      error={error}
      onPick={(id) => {
        /* Drawn at the tap, then saved behind it (`every-maker-edit-shows-before-it-saves`). */
        setError(null);
        setShown(id);
        start(async () => {
          try {
            const fd = new FormData();
            fd.set('intent', 'save');
            fd.set('patch', JSON.stringify({ fixedStyles: { [scene]: id } }));
            /* 🖼 Redrawn on the canvas in place once it lands (`makerRedrawSave`);
               the Maker's own props (this row's `picked`) still catch up with
               one render at the end of the burst — the canvas keeps its page. */
            const r = await makerRedrawSave(() => draftAction(eventId, fd), () => router.refresh());
            if (r.ok) makerNeedsRender();
            if (!r.ok) {
              setShown(picked);
              setError(r.error);
            }
          } catch {
            setShown(picked);
            setError('That change could not be saved. Please try again — nothing was lost.');
          }
        });
      }}
    />
  );
}
