'use client';

import { SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { revealLookKnobsFor, revealLooksFull, withRevealLook, type RevealEffects } from '@/lib/std-reveal-effects';
import { Dd } from './kit';

/**
 * 🎨 THE OPENING'S OWN DESIGNS: one row of the house stacked dropdowns (`Dd`) under Cover Scene › Style's opening row
 * (owner 23 Nov: *"they should all be customizable"*; drawing v24 + v25). It holds the classic's flap shape, the
 * gatefold's panel design, the fabric, and the gift box's lining, floor and what lies around it.
 *
 * It reads ONE list (`REVEAL_LOOK_OPTIONS`), the same the Save the Date's Step 5 offers, and writes through the
 * couple's one effects save (`withRevealLook`, stored sparse in `std_reveal_effects.looks`, Pro ◆). A reveal with no
 * designs of its own (the veil, which has Fold · Weave · Wind · Colour) draws nothing.
 */
export function RevealDesignsRow({ picked, effects, onEffects }: { picked: string; effects: RevealEffects; onEffects: (next: RevealEffects) => void }) {
  const knobs = revealLookKnobsFor(picked);
  if (knobs.length === 0) return null;
  const now = revealLooksFull(effects.looks);
  return (
    <div data-look-row="reveal-designs" className={`${SP_ROWS_ROW} h-[var(--sp-rh)] shrink-0`}>
      {knobs.map((k) => (
        <Dd
          key={k.key}
          small={`${k.label} ◆`}
          label={k.label}
          data={`reveal-look-${k.key}`}
          value={now[k.key]}
          options={k.choices.map(([key, label]) => ({ key, label }))}
          onPick={(v) => onEffects(withRevealLook(effects, k.key, v))}
          stacked
        />
      ))}
    </div>
  );
}
