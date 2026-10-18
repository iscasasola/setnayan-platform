'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
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
  PICTURE_BLUR_LABEL,
  PICTURE_LINE,
  effectsSummary,
  type PictureBlur,
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
import { STUDIO_ROW, STUDIO_ROW_PICK } from '@/lib/studio-skin';

/** A Studio row holding a name with its line under it — the hairline row, the control at its end. */
const STUDIO_ROW_FLAT = `${STUDIO_ROW} justify-between gap-3`;
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
 *   · the nine cards (None + the eight, 2026-10-14) → Style card: one size (112 × 149, `.sn-phone-card`), no frame, the picked
 *     one ringed and named in the accent and centred in its row — `BgCard` / `BgCards`, the shipped template;
 *   · ◆ on every effect → Pro mark (kind 20; owner 2026-10-16 "all … effects … are pro"): shown, tappable, tried free
 *     like any Pro choice — written to the draft, worn by the sample, named at ✓ Apply (the #6623 pattern; no note here);
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
  locked,
  swatch,
  picture,
  onPick,
  onChange,
  treatment: treat = null,
}: {
  /**
   * 🖼 THE PICTURE (Look restudy row 8; the approved amendment's Effects sheet "The picture"): Parallax ◆ · Blur ▾ —
   * the background's OWN motion and softness, beside the overlays. On a background with no picture (a colour, a
   * pattern) both are SHOWN OFF with the reason, never hidden. Null: not offered here (the shipped Maker's panel).
   */
  treatment?: {
    /** The background has a picture to move and blur. */
    takes: boolean;
    parallax: boolean;
    /** ◆ on Parallax while tried (no Event Hub Pro) — tried free, named at Apply. */
    proMark: boolean;
    onParallax: (on: boolean) => void;
    blur: PictureBlur;
    onBlur: (blur: PictureBlur) => void;
  } | null;
  eventId: string;
  /** The effect the draft holds — the ringed card. */
  effect: HubMainEffect | null;
  /** The couple does not own Event Hub Pro: every card wears ◆ (tried free, named at ✓ Apply). */
  locked: boolean;
  /** The real background, as a card draws it: its CSS fallback, and its picture over that. */
  swatch: string;
  picture: ReactNode;
  /** A card was tapped — `'none'` takes the effect off. */
  onPick: (kind: HubMainEffectKind | typeof EFFECT_NONE) => void;
  /** How much ▾ or Colour ▾ (`colour: null` = the effect's own). */
  onChange: (change: { intensity?: HubMainEffectIntensity; colour?: HubMainEffectColour | null }) => void;
}) {
  const worn = useSyncExternalStore(
    subscribeLookSampleWorn,
    () => readLookSampleWorn(eventId),
    () => null,
  );
  /* What the rows are about: the effect that is on (drafted). */
  const shown = effect;
  const dark = worn ? ambientGroundIsDark(worn.ground) : false;
  const dot = (colour: string | undefined) => (
    <span aria-hidden className="block h-[18px] w-[18px] rounded-full ring-1 ring-ink/15" style={{ backgroundColor: colour }} />
  );
  const words = (
    <span aria-hidden className={`pointer-events-none absolute inset-x-0 top-[38%] z-[1] flex flex-col items-center gap-1.5 px-1 ${dark ? 'text-cream' : 'text-ink'}`}>
      <span data-ambient-names="" className="max-w-full truncate font-serif text-[11px] leading-none">{worn?.names ?? 'Your names'}</span>
      <span className="h-2.5 w-11 rounded-full" style={{ backgroundColor: worn?.five[2] }} />
    </span>
  );
  const under = (
    <>
      {picture}
      {worn?.veil ? <span aria-hidden className="absolute inset-0" style={{ backgroundColor: worn.veil }} /> : null}
    </>
  );
  return (
    <div data-bg-effects={effect?.kind ?? EFFECT_NONE} className="flex flex-col">
      <BgRow label="Effects" data="effects" info={EFFECTS_INFO}>
        <span data-bg-effects-now="" className="truncate text-[13px] text-ink/60">
          {effectsSummary(effect ? AMBIENT_EFFECT_LABEL[effect.kind] : null, treat?.takes ? { parallax: treat.parallax, blur: treat.blur } : null)}
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
      {treat ? (
        <>
          <p data-bg-picture-head="" className="pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/50">
            The picture
          </p>
          {/* Parallax ◆ — a two-state control is a switch (INTERACTION_RULES § 9, kind 3), the app's ONE drawing. */}
          <div data-bg-row="parallax" data-bg-picture-off={treat.takes ? undefined : ''} className={`${STUDIO_ROW_FLAT} ${treat.takes ? '' : 'opacity-55'}`}>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[14px] text-ink">
                Parallax{treat.proMark ? <span aria-label="Event Hub Pro" className="ml-1 text-[12px] text-ink/50">◆</span> : null}
              </span>
              <small className="text-[11.5px] text-ink/55">{treat.takes ? PICTURE_LINE.parallax : PICTURE_LINE.parallaxOff}</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={treat.takes && treat.parallax}
              aria-label="Parallax"
              data-bg-parallax=""
              disabled={!treat.takes}
              onClick={() => treat.onParallax(!treat.parallax)}
              className={SWITCH_BUTTON}
            >
              <SwitchTrack on={treat.takes && treat.parallax} />
            </button>
          </div>
          {/* Blur ▾ — a set of word choices is ONE dropdown that OPENS (owner round 4: "open choices"). */}
          <div data-bg-row="blur" data-bg-picture-off={treat.takes ? undefined : ''} className={`${STUDIO_ROW_FLAT} ${treat.takes ? '' : 'opacity-55'}`}>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[14px] text-ink">Blur</span>
              <small className="text-[11.5px] text-ink/55">{treat.takes ? PICTURE_LINE.blur : PICTURE_LINE.blurOff}</small>
            </span>
            {treat.takes ? (
              <PickMenu
                label="Blur"
                dataAttr="data-studio-blur-pick"
                className={STUDIO_ROW_PICK}
                value={treat.blur}
                options={(Object.keys(PICTURE_BLUR_LABEL) as PictureBlur[]).map((k) => ({ key: k, label: PICTURE_BLUR_LABEL[k] }))}
                onPick={(k) => k !== treat.blur && treat.onBlur(k as PictureBlur)}
              />
            ) : (
              <span data-bg-blur-off="" className="text-[13px] text-ink/45">
                {PICTURE_BLUR_LABEL.none}
              </span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
