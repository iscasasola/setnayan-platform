'use client';

import Link from 'next/link';
import { useSyncExternalStore, type ReactNode } from 'react';
import { PILL_ON_CLASS } from '@/app/_components/pill-selector';
import { AmbientEffectLayer, AmbientEffectStyle } from '@/app/[slug]/_components/ambient-effect';
import {
  AMBIENT_COLOUR_LABEL,
  AMBIENT_EFFECT_IS_PRO,
  AMBIENT_EFFECT_LABEL,
  AMBIENT_INTENSITY_LABEL,
  ambientEffectSpec,
  ambientGroundIsDark,
  ambientSwatch,
} from '@/lib/ambient-effects';
import {
  EFFECTS_INFO,
  EFFECT_COLOUR_INFO,
  EFFECT_COLOUR_ORIGINAL,
  EFFECT_COLOUR_ORIGINAL_LABEL,
  EFFECT_NONE,
  EFFECT_NONE_LABEL,
  effectProNote,
} from '@/lib/background-effect';
import {
  HUB_MAIN_EFFECTS,
  HUB_MAIN_EFFECT_COLOURS,
  HUB_MAIN_EFFECT_INTENSITIES,
  type HubMainEffect,
  type HubMainEffectColour,
  type HubMainEffectIntensity,
  type HubMainEffectKind,
} from '@/lib/hub-canvas';
import { readLookSampleWorn, subscribeLookSampleWorn } from '@/lib/look-sample-store';
import { STUDIO_ROW_PICK } from '@/lib/studio-skin';
import { BgCard, BgCards, BgRow } from './background-cards';
import { PickMenu } from './pick-menu';

/**
 * ✨ STUDIO › LOOK › BACKGROUND › EFFECTS — a carousel of LIVE miniatures, then How much ▾ and Colour ▾.
 *
 * Owner, 2026-10-08 (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"; approved prototype
 * `background_sources_amend_2026-10-08_fable.html`, frames A07 · A21–A29): *"improve the overall look of these
 * effect"* · *"show color choice"* · *"open choices not just switch automatically"*.
 *
 * control → kind (`INTERACTION_RULES.md` § 9):
 *   · the seven cards (None + the six) → Style card: one size (112 × 149, `.sn-phone-card`), no frame, the picked
 *     one ringed and named in the accent and centred in its row — `BgCard` / `BgCards`, the shipped template;
 *   · ◆ on a Pro effect → Pro mark (kind 20): shown, tappable, TRIED on the sample, never applied; one note offers
 *     See Pro / Not now;
 *   · How much ▾ · Colour ▾ → Dropdown (`PickMenu`): each OPENS its choices, never cycles.
 *
 * 🔑 A CARD IS THE SAMPLE'S OWN DRAWING, SMALLER. Each miniature is `ambientEffectSpec` over the ground and the
 * five the SAMPLE SCREEN measured (`lib/look-sample-store.ts` `readLookSampleWorn`) — the same light or dark
 * variant, the same pulled colour — on the couple's real background (`picture`, the panel's own). Until the sample
 * has said what it is drawing over, a card shows the background alone: never a guessed effect.
 *
 * ⚡ Nothing here asks for anything: the cards are shapes and one stylesheet (drawn once for the strip), and a tap
 * is handed up — the panel's ONE pick path writes it (one draft write, no render).
 */
export function BgEffects({
  eventId,
  effect,
  trying,
  locked,
  proHref,
  swatch,
  picture,
  onPick,
  onChange,
  onTryEnd,
}: {
  eventId: string;
  /** The effect the draft holds — the ringed card. */
  effect: HubMainEffect | null;
  /** ◆ A Pro effect being tried on the sample screen. NOT written anywhere. */
  trying: HubMainEffect | null;
  /** The couple does not own Event Hub Pro: a ◆ effect is tried, never applied. */
  locked: boolean;
  /** Where "See Pro" goes. */
  proHref: string;
  /** The real background, as a card draws it: its CSS fallback, and its picture over that. */
  swatch: string;
  picture: ReactNode;
  /** A card was tapped — `'none'` takes the effect off. */
  onPick: (kind: HubMainEffectKind | typeof EFFECT_NONE) => void;
  /** How much ▾ or Colour ▾ (`colour: null` = the effect's own). */
  onChange: (change: { intensity?: HubMainEffectIntensity; colour?: HubMainEffectColour | null }) => void;
  onTryEnd: () => void;
}) {
  const worn = useSyncExternalStore(
    subscribeLookSampleWorn,
    () => readLookSampleWorn(eventId),
    () => null,
  );
  /* What the rows are about: the effect being tried, else the one that is on. */
  const shown = trying ?? effect;
  const dark = worn ? ambientGroundIsDark(worn.ground) : false;
  const dot = (colour: string | undefined) => (
    <span aria-hidden className="block h-[18px] w-[18px] rounded-full ring-1 ring-ink/15" style={{ backgroundColor: colour }} />
  );
  const words = (
    <span aria-hidden className={`pointer-events-none absolute inset-x-0 top-[38%] z-[1] flex flex-col items-center gap-1.5 px-1 ${dark ? 'text-cream' : 'text-ink'}`}>
      <span className="max-w-full truncate font-serif text-[11px] leading-none">{worn?.names ?? 'Your names'}</span>
      <span className="h-2.5 w-11 rounded-full" style={{ backgroundColor: worn?.five[2] }} />
    </span>
  );
  const under = (
    <>
      {picture}
      {worn?.veil ? <span aria-hidden className="absolute inset-0" style={{ backgroundColor: worn.veil }} /> : null}
    </>
  );
  const note = trying ? effectProNote(trying.kind) : null;
  return (
    <div data-bg-effects={effect?.kind ?? EFFECT_NONE} {...(trying ? { 'data-bg-effects-trying': trying.kind } : {})} className="flex flex-col">
      <BgRow label="Effects" data="effects" info={EFFECTS_INFO}>
        <span data-bg-effects-now="" className="truncate text-[13px] text-ink/60">
          {effect ? AMBIENT_EFFECT_LABEL[effect.kind] : 'Off'}
        </span>
      </BgRow>
      <BgCards label="Effect" source="effects">
        {/* One stylesheet for the whole strip — each card's layer is told not to draw its own. */}
        <AmbientEffectStyle />
        <BgCard name={EFFECT_NONE_LABEL} data={`fx:${EFFECT_NONE}`} on={!effect} swatch={swatch} onPick={() => onPick(EFFECT_NONE)}>
          {under}
          {words}
        </BgCard>
        {HUB_MAIN_EFFECTS.map((kind) => (
          <BgCard
            key={kind}
            name={AMBIENT_EFFECT_LABEL[kind]}
            data={`fx:${kind}`}
            on={effect?.kind === kind}
            pro={locked && AMBIENT_EFFECT_IS_PRO[kind]}
            {...(trying?.kind === kind ? { note: 'trying' } : {})}
            swatch={swatch}
            onPick={() => onPick(kind)}
          >
            {under}
            {worn ? (
              <AmbientEffectLayer
                spec={ambientEffectSpec({ kind, intensity: shown?.intensity ?? 'standard', ...(shown?.colour ? { colour: shown.colour } : {}) }, worn.ground, worn.five, true)}
                className="absolute inset-0"
                css={false}
              />
            ) : null}
            {words}
          </BgCard>
        ))}
      </BgCards>
      {/* ◆ TRIED, NEVER APPLIED — the approved gallery's note, in place (never a toast, never a layer over the cards). */}
      {note ? (
        <div role="status" data-bg-effects-pro="" className="flex flex-col gap-2 border-t border-ink/10 py-2.5">
          <p className="text-[13.5px] font-semibold text-ink">{note.title}</p>
          <p className="text-[12.5px] leading-snug text-ink/65">{note.body}</p>
          <div className="flex gap-2">
            <button type="button" data-bg-effects-pro-later="" onClick={onTryEnd} className="sn-press inline-flex h-10 min-h-0 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-ink ring-1 ring-ink/15">
              {note.later}
            </button>
            <Link href={proHref} prefetch={false} data-bg-effects-pro-see="" className={`sn-press inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold ${PILL_ON_CLASS}`}>
              {note.see}
            </Link>
          </div>
        </div>
      ) : null}
      {shown ? (
        <>
          <BgRow label="How much" data="effect-intensity">
            <PickMenu
              label="How much"
              dataAttr="data-studio-effect-intensity-pick"
              className={STUDIO_ROW_PICK}
              value={shown.intensity}
              options={HUB_MAIN_EFFECT_INTENSITIES.map((k) => ({ key: k, label: AMBIENT_INTENSITY_LABEL[k] }))}
              onPick={(k) => k !== shown.intensity && onChange({ intensity: k as HubMainEffectIntensity })}
            />
          </BgRow>
          <BgRow label="Colour" data="effect-colour" info={EFFECT_COLOUR_INFO}>
            <PickMenu
              label="Effect colour"
              dataAttr="data-studio-effect-colour-pick"
              className={STUDIO_ROW_PICK}
              value={shown.colour ?? EFFECT_COLOUR_ORIGINAL}
              options={[
                { key: EFFECT_COLOUR_ORIGINAL, label: EFFECT_COLOUR_ORIGINAL_LABEL, icon: dot(worn ? ambientSwatch({ kind: shown.kind }, worn.ground, worn.five) : undefined) },
                /* The five as the couple set them — the Mood Board's own circles; no free picker. */
                ...HUB_MAIN_EFFECT_COLOURS.map((k, i) => ({ key: k, label: AMBIENT_COLOUR_LABEL[k], icon: dot(worn?.five[i]) })),
              ]}
              onPick={(k) => k !== (shown.colour ?? EFFECT_COLOUR_ORIGINAL) && onChange({ colour: k === EFFECT_COLOUR_ORIGINAL ? null : (k as HubMainEffectColour) })}
            />
          </BgRow>
        </>
      ) : null}
    </div>
  );
}
