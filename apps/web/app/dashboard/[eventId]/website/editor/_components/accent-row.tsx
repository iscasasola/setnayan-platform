'use client';

/**
 * 🕯 A SCENE'S ACCENT ◆ ▾ — owner 2026-10-16 (DECISION_LOG "AN ACCENT BELONGS TO ITS SCENE AND IS ADDED FROM THAT
 * SCENE'S STYLE"), verbatim: *"it is more like when i am at countdown, then on style we can add accent. the poles,
 * since that is part of the countdown"*.
 *
 * ONE house dropdown under the scene's Style cards (the toolbar prototype's B panel, row 3 — its chips, ＋ Add and
 * Spot ▾ dropped: one dropdown is enough). It lists ONLY this scene's accents (`SCENE_ACCENTS`, `lib/art-kits.ts`):
 * None · each piece or pair. Picking one puts its pieces in their designed slot — nothing to place. The pick goes to
 * the DRAFT through the one events door (`useHeldEventsSave`): the whole `scene_accents` map, so a pick on one scene
 * never drops another's, and guests see it at ✓ Apply. ◆ Event Hub Pro while `ART_KIT_IS_PRO`: tried free here,
 * named "Decorations" at Apply; None is always free.
 */
import { useEffect, useState, useTransition } from 'react';

import {
  ACCENT_NONE,
  SCENE_ACCENTS,
  SCENE_ACCENTS_PREF_KEY,
  resolvedAccent,
  type AccentScene,
  type SceneAccents,
} from '@/lib/art-kit-accents';
import type { InviteThemeId } from '@/lib/invite-themes';
import { Dd } from '../../../launch/_components/stage-panel/kit';
import type { ElementDraftAction } from './element-sheet';
import { useHeldEventsSave } from './use-scene-canvas';

/** The picture each choice carries — the first of its pieces, as it ships (the kit's own WebP). */
const PIECE_THUMB: Readonly<Record<string, string>> = {
  drape: '/art-kits/vintage/drape.webp',
  chandelier: '/art-kits/vintage/chandelier.webp',
  'countdown-frame': '/art-kits/vintage/countdown-frame.webp',
  'corner-floral': '/art-kits/vintage/corner-floral.webp',
  fan: '/art-kits/vintage/fan.webp',
  'rsvp-ornament': '/art-kits/vintage/rsvp-ornament.webp',
  'closing-frame': '/art-kits/vintage/closing-frame.webp',
};

export function AccentRow({
  eventId,
  scene,
  picks,
  theme,
  tryPro,
  draftAction,
}: {
  eventId: string;
  scene: AccentScene;
  /** Every scene's pick, drafted over live (`style_preferences.scene_accents`). */
  picks: SceneAccents;
  /** The look the page wears — a kit look starts each scene with its accent on. */
  theme: InviteThemeId | null;
  /** ◆ on the pill: the accents are Pro and this couple does not own Event Hub Pro yet (tried free). */
  tryPro: boolean;
  draftAction: ElementDraftAction;
}) {
  const save = useHeldEventsSave(eventId, draftAction);
  const [pending, start] = useTransition();
  const [mine, setMine] = useState<SceneAccents>(picks);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMine(picks), [picks]);
  const options = SCENE_ACCENTS[scene];
  const value = resolvedAccent(scene, mine, theme);
  return (
    <div data-look-row="accent" data-accent-row={scene} className="flex shrink-0 flex-col">
      <Dd
        small={tryPro ? '◆ Accent' : 'Accent'}
        label="Accent"
        data="scene-accent"
        stacked
        value={value}
        options={[
          { key: ACCENT_NONE, label: 'None' },
          ...options.map((o) => ({
            key: o.id,
            label: o.label,
            thumb: PIECE_THUMB[o.pieces[0] ?? ''],
            ...(tryPro ? { hint: 'Event Hub Pro — try it here, it is asked for at ✓ Apply' } : {}),
          })),
        ]}
        onPick={(id) => {
          if (pending || id === value) return;
          const before = mine;
          const next: SceneAccents = { ...mine, [scene]: id };
          setMine(next);
          setError(null);
          start(async () => {
            try {
              const res = await save({ style_preferences: { [SCENE_ACCENTS_PREF_KEY]: next } });
              if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok === false) {
                setMine(before);
                setError((res as { error?: string }).error ?? 'That did not save, so it is back as it was.');
              }
            } catch {
              setMine(before);
              setError('That did not save, so it is back as it was. Please try again.');
            }
          });
        }}
      />
      {error ? (
        <p role="alert" className="py-1 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
