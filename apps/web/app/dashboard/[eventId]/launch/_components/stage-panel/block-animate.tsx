'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FEEL_OFF, partFeel, partSpeedOf } from '@/lib/animate-feel';
import { BLOCK_LOOKS_MESSAGE, BLOCK_LOOKS_PREF_KEY, blockLooksWith, readBlockLooks, type BlockLookBlock } from '@/lib/block-looks';
import { HUB_EL_DURING_LABEL, sanitizeHubElementMotion, type HubElementMotion } from '@/lib/element-style';
import { makerSave } from '@/lib/maker-refresh';
import { motionFxOn, type MotionFx } from '@/lib/motion-effects';
import { hubDraftAction } from '../../../website/hub-draft-actions';
import { useMaker } from '../maker-context';
import { StageAnimate } from './stage-animate';

/** Delay's three, in seconds — the cover line's own steps (`element-sheet.tsx` `PART_DELAY_S`). */
const DELAY_S = { none: 0, short: 0.3, long: 0.8 } as const;
const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';
/** The canvas on screen redraws the blocks' looks from what it is sent, read strictly there (`editor-bridge.tsx`). */
const showOnCanvas = (looks: unknown) =>
  document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentWindow?.postMessage({ source: 'setnayan-editor', t: BLOCK_LOOKS_MESSAGE, looks }, window.location.origin);

/**
 * ✨ ANIMATE FOR A FIXED BLOCK — the Wedding March, The details, E-Gifts, Happening now (owner 2026-10-09: Animate
 * for every element; `lib/block-looks.ts`).
 *
 * The toolbar's own Animate with every phase — Build in · Action · Build out, Movement, Plays, Delay — wired exactly
 * as a cover line's is (`element-sheet.tsx`), because it IS that motion: the same stored shape, the same closed-set
 * reader, the same rules on the page. Only where it is kept differs: `events.style_preferences.block_looks`,
 * through the Maker's one draft door — on the canvas at the tap, in the draft behind it, live on Apply.
 * No Leaves ◆: a block is not a scene and hands over to nothing.
 */
export function BlockAnimateRows({ block }: { block: BlockLookBlock }) {
  const maker = useMaker();
  const router = useRouter();
  const eventId = maker?.eventId ?? null;
  /* The stored value, live with the draft laid on — carried whole, so another block's look and any key this build
     does not know stay as they are. */
  const savedKey = JSON.stringify(maker?.lookPages?.blocks ?? {});
  const [prefs, setPrefs] = useState<Record<string, unknown>>(() => ({ [BLOCK_LOOKS_PREF_KEY]: JSON.parse(savedKey) }));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setPrefs({ [BLOCK_LOOKS_PREF_KEY]: JSON.parse(savedKey) }), [savedKey]);
  const motion: HubElementMotion = readBlockLooks(prefs)[block]?.motion ?? {};

  const moveTo = (part: keyof HubElementMotion, value: string | MotionFx | null) => {
    if (!eventId) return;
    const next: Record<string, unknown> = { ...motion };
    if (value === null) delete next[part];
    else next[part] = value;
    saveWhole(blockLooksWith(prefs, block, sanitizeHubElementMotion(next)));
  };

  return (
    <div className="contents" data-block-animate={block}>
      <StageAnimate
        pending={pending}
        error={error}
        move={{
          in: { value: partFeel(motion.speed), onPick: (f) => moveTo('speed', partSpeedOf(f)), off: motionFxOn(motion.in) ? null : FEEL_OFF.noEffect },
          out: {
            value: partFeel(motion.outSpeed),
            onPick: (f) => moveTo('outSpeed', partSpeedOf(f)),
            off: motion.timeline !== 'scroll' ? FEEL_OFF.arrival : !motionFxOn(motion.out) ? FEEL_OFF.noEffect : null,
          },
        }}
        plays={{ value: motion.timeline === 'scroll' ? 'scroll' : 'arrival', onPick: (d) => moveTo('timeline', d === 'scroll' ? 'scroll' : null) }}
        inFx={motion.in ?? null}
        outFx={motion.out ?? null}
        onIn={(fx) => moveTo('in', fx)}
        onOut={(fx) => {
          /* A Build out plays as guests scroll on — choosing one makes the block follow the scroll (one save). */
          if (!eventId) return;
          if (fx && motion.timeline !== 'scroll') {
            const looks = blockLooksWith(prefs, block, sanitizeHubElementMotion({ ...motion, timeline: 'scroll', out: fx }));
            return saveWhole(looks);
          }
          moveTo('out', fx);
        }}
        delay={
          motionFxOn(motion.in) && motion.timeline !== 'scroll'
            ? {
                value: DELAY_S[motion.delay ?? 'none'],
                steps: Object.values(DELAY_S),
                onPick: (sec) => {
                  const v = (Object.keys(DELAY_S) as Array<keyof typeof DELAY_S>).find((k) => DELAY_S[k] === sec) ?? 'none';
                  moveTo('delay', v === 'none' ? null : v);
                },
              }
            : null
        }
        does={{
          value: motion.during ?? 'still',
          options: (['still', 'drift'] as const).map((v) => ({ key: v, label: HUB_EL_DURING_LABEL[v] })),
          onPick: (v) => moveTo('during', v === 'still' ? null : v),
        }}
      />
    </div>
  );

  /** One save of a whole next value (Build out + "follow the scroll" together). */
  function saveWhole(looks: Record<string, unknown>) {
    if (!eventId) return;
    const was = prefs;
    setPrefs({ [BLOCK_LOOKS_PREF_KEY]: looks });
    setError(null);
    showOnCanvas(looks);
    start(async () => {
      const back = (words: string) => {
        setPrefs(was);
        showOnCanvas(was[BLOCK_LOOKS_PREF_KEY]);
        setError(words);
      };
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { style_preferences: { [BLOCK_LOOKS_PREF_KEY]: looks } } }));
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) back(r.error);
      } catch {
        back('That change could not be saved. Please try again — nothing was lost.');
      }
    });
  }
}
