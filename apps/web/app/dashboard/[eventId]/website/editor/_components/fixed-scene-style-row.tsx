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

import type { FixedStyleScene } from '@/lib/fixed-scene-styles';
import type { HubStage } from '@/lib/hub-canvas';
import { makerNeedsRender, makerRedrawSave } from '@/lib/maker-refresh';
import { resolveSceneStyle, sceneStyleOptions } from '@/lib/scene-styles';
import { recommendedStageSceneStyle } from '@/lib/scene-styles-stages';

import type { ElementDraftAction } from './element-sheet';
import { SceneStyleRow } from './scene-style-row';

export function FixedSceneStyleRow({
  eventId,
  scene,
  stage,
  eventType,
  picked,
  draftAction,
}: {
  eventId: string;
  scene: FixedStyleScene;
  stage: HubStage;
  eventType: string | null;
  /** The pick as the canvas draws it — live with the draft laid on. */
  picked: string | null;
  draftAction: ElementDraftAction;
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
      preview={{ canvasKey: `f:${scene}`, sceneType: scene }}
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
