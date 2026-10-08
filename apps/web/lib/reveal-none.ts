/**
 * 🚫 THE REVEAL'S "NONE" — ONE FACT, ONE HOME (owner, live Maker 2026-10-08, on the Reveal's Look strip showing a
 * single opening and no way to pick nothing: *"and none."*).
 *
 * "No reveal plays anywhere" already has a home: `events.reveal_stages = []` — every stage switch off
 * (`lib/reveal-stages.ts`, *"An EMPTY list is a real answer: the couple switched every stage off"*). The None
 * card is that same fact drawn as a card, so the card and the three switches can never disagree:
 *
 *   · None is PICKED  ⇔ every switch is off (or the older "No reveal" value, `std_reveal_template = 'none'`,
 *                        which the pre-Stages list wrote — still honoured, never written here);
 *   · picking None     → every switch off. The opening the couple chose is KEPT, so switching a stage back on
 *                        brings their own opening back;
 *   · picking an opening from None → that opening, on the stage being edited (never silently everywhere);
 *   · a switch turned on from the older "none" value → the opening that would play by default, on that stage.
 *
 * No new column, no migration: two keys that exist, written through the one draft door. Pure.
 */
import { revealStagesWith, type RevealStage } from '@/lib/reveal-stages';

export const REVEAL_NONE_ID = 'none';

export type RevealNow = { effective: string; stages: readonly RevealStage[] };
export type RevealPatch = { std_reveal_template?: string; reveal_stages?: RevealStage[] };

/** No reveal plays on any stage. */
export function revealIsNone(now: RevealNow): boolean {
  return now.effective === REVEAL_NONE_ID || now.stages.length === 0;
}

/** Is this stage's switch drawn ON? Never while nothing can play. */
export function revealSwitchOn(now: RevealNow, stage: RevealStage): boolean {
  return now.effective !== REVEAL_NONE_ID && now.stages.includes(stage);
}

/** A tap on a card of the Look strip → what goes into the draft (null: nothing to change). */
export function revealPickPatch(pick: string, now: RevealNow, onStage: RevealStage): RevealPatch | null {
  if (pick === REVEAL_NONE_ID) return revealIsNone(now) && now.stages.length === 0 ? null : { reveal_stages: [] };
  if (now.effective === REVEAL_NONE_ID || now.stages.length === 0) return { std_reveal_template: pick, reveal_stages: [onStage] };
  return pick === now.effective ? null : { std_reveal_template: pick };
}

/**
 * A tap on a stage's switch. From the older "none" value a switch cannot simply go on — nothing would play —
 * so it takes `fallback` (the opening that plays by default, when it is one the event may use); with no opening
 * to give, the tap changes nothing (null) rather than draw a switch on over no reveal.
 */
export function revealSwitchPatch(stage: RevealStage, now: RevealNow, fallback: string | null): RevealPatch | null {
  if (now.effective === REVEAL_NONE_ID) return fallback ? { std_reveal_template: fallback, reveal_stages: [stage] } : null;
  return { reveal_stages: revealStagesWith(now.stages, stage, !now.stages.includes(stage)) };
}
