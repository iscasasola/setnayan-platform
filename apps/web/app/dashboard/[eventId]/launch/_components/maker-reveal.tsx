'use client';

import { makerSave } from '@/lib/maker-refresh';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from 'react';
import { Check, Play, RotateCcw } from 'lucide-react';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { REVEAL_STAGE_CHOICES, revealStagesWith, type RevealStage } from '@/lib/reveal-stages';
import { REVEAL_EXTRA_LABEL, revealEffectsWithExtra, revealExtraOf, revealExtrasFor } from '@/lib/reveal-extras';
import {
  revealTuneKnobsFor,
  type RevealEffects,
  type RevealTuneHouse,
  type RevealTuneKnob,
} from '@/lib/std-reveal-effects';
import { InfoTip } from '@/app/_components/info-tip';
import { Slider } from '@/app/_components/slider';
import { SwitchTrack } from '@/app/_components/switch-track';
import { ActionButton } from '@/components/action-button';
import { MAKER_STAGE_SAY_EVENT, useMaker } from './maker-context';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { IRow, ISection, ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { ColourSheet } from '../../website/editor/_components/colour-well';
import { StageStyle } from './stage-panel/stage-style';
import { About, Dd, Swatch } from './stage-panel/kit';
import {
  VEIL_FOLDS,
  VEIL_FOLD_ORDER,
  VEIL_WEAVES,
  VEIL_WEAVE_ORDER,
  VEIL_WINDS,
  VEIL_WIND_ORDER,
  veilFoldOf,
  veilWeaveOf,
  veilWindOf,
  withVeilFold,
  withVeilWeave,
  withVeilWind,
  type VeilFold,
  type VeilWeave,
  type VeilWind,
} from '@/lib/veil-style';
import { RevealPicture } from './stage-panel/reveal-picture';
import { REVEAL_NONE_ID, revealCoverPickPatch, revealCoverPicked, type RevealPatch } from '@/lib/reveal-none';
import { setStageRevealKind, useStageRevealLook } from './stage-panel/store';
import { SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { StyleCards } from './stage-panel/style-carousel';
import { StylePreview } from './stage-panel/style-preview';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';

/** 🌫 The prototype's openings after the Sheer veil (`cover_scene_edit_animate_2026-10-16.html` `OPENINGS`, owner 2026-10-15). */
const REVEAL_COVER_SOON: readonly string[] = ['four-flap', 'church-doors'];
const REVEAL_COVER_SOON_SAYS = 'After the envelope proof — not yet';

/**
 * 🎭 THE REVEAL AS A PART (the new Maker's Stages side, plan PR 3 — owner
 * 2026-10-06: *"Reveal must be placed as the first scenes for the Save the
 * Date, Inviting and The Day. So we can say if it will show or be hidden"* ·
 * *"reveal only stays on top of the cover and the next slide will not have the
 * reveal anymore"*). The Stages panel wraps the SAME picker the work area
 * registered (`MakerLookPages.reveal`) in this context, naming the stage it is
 * the first part of; the picker then draws its part's tools — its kinds (the
 * openings) as the layouts, Extras ▾ and Arrange › Hidden on this stage — with
 * the SAME draft saves. Null: the picker as it always was.
 */
export const MakerRevealStageContext = createContext<RevealStage | null>(null);

/**
 * THE REVEAL — chosen once, in the Maker (Phase 6).
 *
 * "No reveal" is free; every opening is Event Hub Pro (owner 2026-09-24, "all
 * reveal is paid"). A free couple may TRY an opening here — it goes into the
 * draft and plays in their own preview — and pays at Apply (owner 2026-09-25).
 * The couple's theme dresses whichever opening they choose; with none chosen,
 * the theme's own opening plays.
 *
 * 💾 THE DRAFT, NEVER LIVE: a pick posts `hubDraftAction` intent=save with
 * `events.std_reveal_template` — the one draft action; `chooseRevealTemplate`
 * (the Save-the-Date studio's live writer) is not called from here.
 *
 * 🔎 A REFUSED SAVE SAYS SO — the result's `error` renders as a line.
 *
 * 🎭 WHERE IT PLAYS (owner 2026-09-25, verbatim: *"they can pick where the want
 * to keep it. having it on the invitation and on the day will onlay be during
 * the hero scene (First page) after that, it will disappear"*): Save the Date ·
 * Invitation · On the Day, any of them, saved to the draft as
 * `events.reveal_stages` (`lib/reveal-stages.ts`). Choosing where is free;
 * the opening itself is still Pro.
 *
 * 🖼 This panel sits BESIDE the Reveal's page (the Maker's body shows the stage
 * it plays on, playing it in place) — never over it.
 *
 * ✂ FEWER WORDS (owner 2026-09-27: *"less words as our prompt says"* — design
 * brief 2026-09-24 "Zero Explanatory Clutter"). Each opening is its short label
 * and its marks; what it is, the intro and how "Where it plays" behaves sit
 * behind an ⓘ (`InfoTip`). Only status ("In your draft…") and errors stay out.
 *
 * 🎚 FINE-TUNE (owner 2026-09-27: *"where is the petal speed and other fine
 * tuning?"*). A fold, shut by default, under the chosen opening: the few
 * sliders THAT opening's engine reads (`revealTuneKnobsFor`), ranges clamped by
 * the house resolver. A slider saves to the DRAFT when let go; the save
 * refreshes the Maker and the Reveal page reloads, so the opening replays with
 * it. Pro at Apply like every other change to the reveal's effects.
 */
export type MakerRevealOpening = { id: string; label: string; blurb: string };

export function MakerRevealPicker({
  eventId,
  current: currentProp,
  drafted,
  stages: stagesProp,
  stagesDrafted,
  effects: effectsProp,
  effectsDrafted,
  tuneHouse,
  themeName,
  defaultOpening,
  defaultIsTheme,
  dressing,
  openings,
  ownsPro,
  storeShell,
  stdWindowDays,
  mainColours = NO_COLOURS,
  veilShown = VEIL_IVORY,
  part = 'all',
}: {
  /** 🧵 The veil's colour while the couple has chosen none — what guests see today (the Mood Board's, else ivory). */
  veilShown?: string;
  /** 🎨 The five main colours in slot order (`mainColoursOf`) — the veil's colour rows open the one picker on them. */
  mainColours?: readonly string[];
  /**
   * 🧩 Which of the picker's three parts to draw (DECISION_LOG "A TOOL MOVED
   * INTO THE MAKER IS REBUILT INTO THE THREE PARTS"): in Details the openings
   * are the NAVIGATOR ('options') and the rest — play, fine-tune, where it
   * plays — the RIGHT column ('settings'); the reveal playing is the middle.
   * 'all' draws both, as the Reveal page did. Same saves either way.
   */
  part?: 'all' | 'options' | 'settings';
  /** `STD_THRESHOLD_DAYS` — how long before the day the Save the Date is out. */
  stdWindowDays: number;
  /** Where it plays (drafted over live, resolved — the Save the Date alone when never chosen). */
  stages: readonly RevealStage[];
  /** The draft holds a different choice of stages from what guests see. */
  stagesDrafted: boolean;
  /** The reveal's effects (drafted over live, resolved) — the fine-tuning. */
  effects: RevealEffects;
  /** The draft holds different effects from what guests see. */
  effectsDrafted: boolean;
  /** The house look's value for every fine-tune knob (the Reveal Studio's). */
  tuneHouse: RevealTuneHouse;
  eventId: string;
  /** The drafted-over-live `std_reveal_template`: an id · 'none' · null (not chosen). */
  current: string | null;
  /** The draft holds a different reveal from what guests see. */
  drafted: boolean;
  themeName: string;
  /** What plays for a Pro couple who has chosen nothing (the theme's, or the house default). */
  defaultOpening: string;
  /** `defaultOpening` is the THEME's own opening (not the house default). */
  defaultIsTheme: boolean;
  /** The theme's materials, in words ("Kraft envelope, twine and a rust seal"); null = Classic. */
  dressing: string | null;
  /** The openings offered (the admin map applied; empty in the store shell without Pro). */
  openings: MakerRevealOpening[];
  ownsPro: boolean;
  storeShell: boolean;
}) {
  const router = useRouter();
  /* 🎭 The Stages panel's Reveal part — the stage it is the first part of. */
  const onStage = useContext(MakerRevealStageContext);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* ⚡ A PICK SHOWS AT ONCE (owner 2026-09-29: *"make sure 100% that there is
     no slow response on the maker"*): the opening, where it plays and its
     effects read the couple's pick here the moment it is made, not the server's
     props after the round trip. The server's values take over again as soon as
     a render brings them; a refused save puts the saved value back. */
  const [mine, setMine] = useState<{ current?: string | null; stages?: readonly RevealStage[]; effects?: RevealEffects }>({});
  const serverKey = JSON.stringify([currentProp, stagesProp, effectsProp]);
  useEffect(() => setMine({}), [serverKey]);
  const current = 'current' in mine ? (mine.current ?? null) : currentProp;
  const stages = mine.stages ?? stagesProp;
  const effects = mine.effects ?? effectsProp;
  const forget = (key: 'current' | 'stages' | 'effects') =>
    setMine((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
  /* What guests meet when nothing is chosen: the theme's opening for a Pro
     couple, and no reveal at all without Pro (`revealAllowedFor`). */
  const effective = current ?? (ownsPro ? defaultOpening : 'none');

  const choose = (value: string | null) => {
    setMine((m) => ({ ...m, current: value }));
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { std_reveal_template: value } }));
        // one-render: keep (batched) — a Maker draft save goes through `lib/maker-refresh.ts`, which refreshes ONCE after the last save in flight; draft intents revalidate nothing.
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) {
          forget('current');
          setError(r.error);
        }
      } catch {
        forget('current');
        setError('Your reveal could not be saved. Please try again.');
      }
    });
  };

  /* 🚫 One tap that may move BOTH the opening and where it plays (the None card, `lib/reveal-none.ts`) — one
     draft patch, so the card and the switches land together or not at all. */
  const savePick = (patch: RevealPatch | null) => {
    if (!patch) return;
    setMine((m) => ({
      ...m,
      ...(patch.std_reveal_template !== undefined ? { current: patch.std_reveal_template } : {}),
      ...(patch.reveal_stages !== undefined ? { stages: patch.reveal_stages } : {}),
    }));
    start(async () => {
      setError(null);
      const back = () => {
        if (patch.std_reveal_template !== undefined) forget('current');
        if (patch.reveal_stages !== undefined) forget('stages');
      };
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: patch }));
        // one-render: keep (batched) — a Maker draft save goes through `lib/maker-refresh.ts`, which refreshes ONCE after the last save in flight; draft intents revalidate nothing.
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) {
          back();
          setError(r.error);
        }
      } catch {
        back();
        setError('Your reveal could not be saved. Please try again.');
      }
    });
  };

  const setStages = (next: RevealStage[]) => {
    setMine((m) => ({ ...m, stages: next }));
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { reveal_stages: next } }));
        // one-render: keep (batched) — a Maker draft save goes through `lib/maker-refresh.ts`, which refreshes ONCE after the last save in flight; draft intents revalidate nothing.
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) {
          forget('stages');
          setError(r.error);
        }
      } catch {
        forget('stages');
        setError('Where your reveal plays could not be saved. Please try again.');
      }
    });
  };
  /* 🎛 FINE-TUNING (owner 2026-09-25: "pick a reveal and see the effects, fine
     tune it to your liking") — the couple's own effects, the same keys the
     Save-the-Date studio sets, saved to the DRAFT; the canvas replays with them. */
  const setEffects = (next: RevealEffects) => {
    setMine((m) => ({ ...m, effects: next }));
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { std_reveal_effects: next } }));
        // one-render: keep (batched) — a Maker draft save goes through `lib/maker-refresh.ts`, which refreshes ONCE after the last save in flight; draft intents revalidate nothing.
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) {
          forget('effects');
          setError(r.error);
        }
      } catch {
        forget('effects');
        setError('Your reveal’s effects could not be saved. Please try again.');
      }
    });
  };

  const toggleStage = (s: RevealStage) => setStages(revealStagesWith(stages, s, !stages.includes(s)));

  const replay = () => {
    /* The Reveal's page (the Maker's body) is the stage it plays on: playing it
       again is loading that page again, in place. That page loads the stage
       PREVIEW (`?preview=draft`, `makerPageCanvasSrc`), never the editing
       canvas — the canvas skips the opening by design (owner 2026-09-26:
       *"that role is for the preview stage"*). */
    const frame = document.querySelector<HTMLIFrameElement>(
      '[data-maker-page="reveal"] iframe[data-maker-page-frame], [data-details-look="reveal"] iframe[data-maker-page-frame]',
    );
    try {
      frame?.contentWindow?.location.reload();
    } catch {
      // one-render: keep (other-frame) — the reveal frame could not be reloaded in place; nothing was written here — this redraws the page that holds it.
      router.refresh();
    }
  };

  const Row = ({ id, label, note, pro }: { id: string; label: string; note: string; pro: boolean }) => {
    const on = effective === id;
    const mark = pro ? makerProMark({ owns: ownsPro, storeShell }) : null;
    /* The whole row picks (a button laid over it); the ⓘ sits above that
       button, so the note opens without picking. A picked row is ringed, not
       inked, so the ⓘ stays readable on it. */
    return (
      <li
        className={`relative flex min-h-12 items-center gap-3 rounded-md px-3 py-2 text-ink transition-colors duration-sn-control ease-sn ${
          part === 'options' ? 'w-52 shrink-0 self-center lg:w-auto lg:self-auto' : ''
        } ${on ? 'bg-white ring-2 ring-ink' : 'bg-white/70 hover:bg-white'}`}
      >
        <button
          type="button"
          aria-pressed={on}
          aria-label={label}
          data-maker-reveal={id}
          onClick={() => choose(id)}
          className="sn-press absolute inset-0 rounded-md disabled:cursor-wait"
        />
        <InfoTip
          label={label}
          align="start"
          className="pointer-events-none relative min-w-0 flex-1 [&_button]:pointer-events-auto"
          labelClassName="text-[13.5px] font-semibold"
        >
          {note}
        </InfoTip>
        {mark ? (
          <span className="pointer-events-none relative">
            <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} tone="auto" />
          </span>
        ) : null}
        {on ? <Check aria-hidden className="pointer-events-none relative h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
      </li>
    );
  };

  const intro = (
    <InfoTip label="Opening" labelAs="h3" labelClassName="text-[13px] font-semibold text-ink" align="start">
      How your Event Hub opens for a guest — once, before the page. Your {themeName} theme dresses it
      {dressing ? `: ${dressing.charAt(0).toLowerCase()}${dressing.slice(1)}.` : '.'}
      {!ownsPro && !storeShell && openings.length > 0
        ? ' Every opening is part of Event Hub Pro — try one here; guests see it after you Apply with Pro.'
        : null}
    </InfoTip>
  );
  const choices = (
    <ul
      className={part === 'options' ? 'contents lg:flex lg:flex-col lg:gap-1.5' : 'flex flex-col gap-1.5'}
      aria-label="Choose how your Event Hub opens"
      data-maker-reveal-options=""
    >
      <Row id="none" label="No reveal" note="Your page opens straight away. Always free." pro={false} />
      {openings.map((o) => (
        <Row
          key={o.id}
          id={o.id}
          label={o.label}
          note={o.id === defaultOpening && defaultIsTheme ? `Your theme’s opening · ${o.blurb}` : o.blurb}
          pro
        />
      ))}
    </ul>
  );
  const failed = error ? (
    <p role="alert" className="text-[13px] text-terracotta-700">
      {error}
    </p>
  ) : null;
  /* 🎭 The Stages panel's Opening — Cover Scene › Style (owner-approved 2026-10-16): the openings as cards over the
     couple's own cover, then Extras ◆ ▾ (`RevealStagePart`). No Background: the opening plays over the cover. */
  if (onStage) {
    return <RevealStagePart onStage={onStage} openings={openings} effective={effective} savePick={savePick} stages={stages} effects={effects} setEffects={setEffects} ownsPro={ownsPro} storeShell={storeShell} failed={failed} mainColours={mainColours} veilShown={veilShown} />;
  }
  /* 🧩 The navigator's part: the openings alone. */
  if (part === 'options') {
    return (
      <>
        {choices}
        {failed}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-3 px-1" data-made-once="reveal">
      {intro}
      {part === 'all' ? choices : null}
      {drafted ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
      {effective !== 'none' ? (
        <ActionButton tone="neutral" icon={Play} label="Play the opening" onClick={replay} className="self-start" />
      ) : null}
      {effective !== 'none' ? (
        <FineTune
          opening={effective}
          effects={effects}
          tuneHouse={tuneHouse}
          drafted={effectsDrafted}
          /* Never locked: each change is shown at once and saved behind it. */
          pending={false}
          colours={mainColours}
          onChange={setEffects}
        />
      ) : null}
      <fieldset className="flex flex-col gap-1.5" data-maker-reveal-stages="">
        <legend className="mb-1">
          <InfoTip label="Where it plays" labelClassName="text-[13px] font-semibold text-ink" align="start">
            On the {PUBLIC_STAGE_LABELS.save_the_date} (more than {stdWindowDays} days before the day) it opens your
            film. On the {PUBLIC_STAGE_LABELS.rsvp} and {PUBLIC_STAGE_LABELS.event} it plays on the first page only —
            once opened, it is gone.
          </InfoTip>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {REVEAL_STAGE_CHOICES.map((s) => {
            const on = stages.includes(s);
            return (
              <button
                key={s}
                type="button"
                role="switch"
                aria-checked={on}
                data-maker-reveal-stage={s}
                onClick={() => toggleStage(s)}
                className="sn-press inline-flex min-h-11 items-center gap-2 rounded-full bg-white/70 pl-3.5 pr-2 text-[13px] font-semibold text-ink hover:bg-white disabled:opacity-60"
              >
                {PUBLIC_STAGE_LABELS[s]}
                {/* The app's ONE switch (`SwitchTrack`): grey off, the accent on — where an ink pill with a tick stood. */}
                <SwitchTrack on={on} />
              </button>
            );
          })}
        </div>
        {stagesDrafted ? (
          <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
            In your draft — guests see it after you Apply.
          </p>
        ) : null}
      </fieldset>
      {failed}
    </section>
  );
}

const NO_COLOURS: readonly string[] = [];
/** Today's veil with no Mood Board colour to lighten (`veilColorFromPalette`'s own fallback). */
const VEIL_IVORY = '#f3ece1';
const ENVELOPES = new Set(['four-flap', 'two-flap-vertical', 'two-flap-horizontal']);

/**
 * The opening's own fine-tuning — only what THIS opening uses (an envelope lets
 * butterflies out; the doors and the veil let petals fall; the veil takes its
 * tulle and petal colours). Every change saves to the draft and replays.
 */
function FineTune({
  opening,
  effects,
  tuneHouse,
  drafted,
  pending,
  colours,
  onChange,
}: {
  /** The five main colours — the colour rows' picker offers them first. */
  colours: readonly string[];
  opening: string;
  effects: RevealEffects;
  tuneHouse: RevealTuneHouse;
  drafted: boolean;
  pending: boolean;
  onChange: (next: RevealEffects) => void;
}) {
  const envelope = ENVELOPES.has(opening);
  const veil = opening === 'veil-sheer';
  const Switch = ({ on, label, flip }: { on: boolean; label: string; flip: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={flip}
      className="sn-press flex min-h-12 w-full items-center gap-3 rounded-md bg-white/70 px-3 py-2 text-left hover:bg-white disabled:opacity-60"
    >
      <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">{label}</span>
      {/* The app's ONE switch (`SwitchTrack`) — its "on" was the gold `terracotta-700`, a colour of this file's own. */}
      <SwitchTrack on={on} />
    </button>
  );
  return (
    <fieldset className="flex flex-col gap-1.5" data-maker-reveal-finetune={opening}>
      <legend className="mb-1 text-[13px] font-semibold text-ink">Effects</legend>
      {envelope ? (
        <Switch
          on={effects.butterflies}
          label="Butterflies"
          flip={() => onChange({ ...effects, butterflies: !effects.butterflies })}
        />
      ) : (
        <Switch
          on={effects.petals}
          label="Falling petals"
          flip={() => onChange({ ...effects, petals: !effects.petals })}
        />
      )}
      {veil ? (
        <>
          <ColourRow
            label="Veil colour"
            value={effects.veilColor}
            disabled={pending}
            palette={colours}
            onCommit={(hex) => onChange({ ...effects, veilColor: hex })}
          />
          <ColourRow
            label="Petal colour"
            value={effects.petalColor}
            disabled={pending}
            palette={colours}
            onCommit={(hex) => onChange({ ...effects, petalColor: hex })}
          />
        </>
      ) : null}
      <TuneFold
        knobs={revealTuneKnobsFor(opening, effects)}
        house={tuneHouse}
        effects={effects}
        pending={pending}
        onChange={onChange}
      />
      {drafted ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * 🎚 THE FINE-TUNE FOLD — shut by default (the Monogram Maker's own fold,
 * `monogram/animate-rows.tsx`). Only the knobs this opening's engine reads.
 * A slider moves freely and SAVES WHEN LET GO (pointer or keyboard), never on
 * every tick; the save refreshes the Maker, which reloads the Reveal page, so
 * the opening replays with the new value. Unset → the house look's value.
 */
function TuneFold({
  knobs,
  house,
  effects,
  pending,
  onChange,
}: {
  knobs: RevealTuneKnob[];
  house: RevealTuneHouse;
  effects: RevealEffects;
  pending: boolean;
  onChange: (next: RevealEffects) => void;
}) {
  const [open, setOpen] = useState(false);
  if (knobs.length === 0) return null;
  const commit = (knob: RevealTuneKnob, value: number) => {
    if (effects.tune?.[knob.key] === value) return;
    onChange({ ...effects, tune: { ...(effects.tune ?? {}), [knob.key]: value } });
  };
  return (
    <div className="rounded-md bg-white/70" data-maker-reveal-tune="">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="sn-press flex min-h-11 w-full items-center justify-between px-3 text-left text-[13px] font-semibold text-ink"
      >
        Fine-tune
        <span aria-hidden className={`transition-transform duration-sn-control ease-sn ${open ? 'rotate-90' : ''}`}>
          ▸
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-4 px-3 pb-3">
          {knobs.map((knob) => (
            <TuneSlider
              key={knob.key}
              knob={knob}
              value={effects.tune?.[knob.key] ?? null}
              house={house[knob.key]}
              disabled={pending}
              onCommit={(v) => commit(knob, v)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TuneSlider({
  knob,
  value,
  house,
  disabled,
  onCommit,
}: {
  knob: RevealTuneKnob;
  value: number | null;
  /** The house look's value for this knob (the Reveal Studio's). */
  house: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  /* A never-tuned slider rests on the house look's own value — what plays now. */
  const [local, setLocal] = useState(value ?? house);
  useEffect(() => setLocal(value ?? house), [value, house]);
  return (
    <label className="block" data-maker-reveal-knob={knob.key}>
      <span className="text-[12.5px] font-semibold text-ink">{knob.label}</span>
      <span className="mt-1 flex items-center gap-3 text-[12px] text-ink/60">
        <span className="w-12 shrink-0">{knob.lo}</span>
        {/* The app's ONE slider (`Slider`): it moves freely (`onChange`) and SAVES WHEN LET GO (`onCommit`). */}
        <Slider label={knob.label} data={knob.key} className="flex-1" min={knob.min} max={knob.max} step={knob.step} value={local} disabled={disabled} onChange={setLocal} onCommit={onCommit} />
        <span className="w-12 shrink-0 text-right">{knob.hi}</span>
      </span>
    </label>
  );
}

/**
 * A colour, or "from your Mood Board" (null). The row opens the ONE colour picker — the Mood
 * Board's sheet (owner 2026-10-08: *"apply that same concept on … any other color rules parts"*);
 * a pick is saved at once, as the native wheel's settled value was.
 */
function ColourRow({
  label,
  value,
  disabled,
  palette,
  onCommit,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  /** The five main colours, in slot order — the picker's "Your Mood Board" shelf. */
  palette: readonly string[];
  onCommit: (hex: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = value ?? '#f3ece1';
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-md bg-white/70 px-3 py-2">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-reveal-colour=""
        onClick={() => setOpen(true)}
        className="sn-press flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span aria-hidden className="h-10 w-10 shrink-0 rounded-full border border-ink/15" style={{ background: shown }} />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
          <span className="block text-[12px] text-ink/60">{value ? value.toUpperCase() : 'From your Mood Board'}</span>
        </span>
      </button>
      {value ? (
        <ActionButton tone="neutral" quiet icon={RotateCcw} label="Reset" disabled={disabled} onClick={() => onCommit(null)} />
      ) : null}
      {open ? (
        <ColourSheet title={label} what="" value={value} shown={shown} palette={palette} slots={palette.length > 0} onPick={onCommit} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

/** The opening's one sentence — on the row, or behind ⓘ when the veil's own choices take the row. */
const OPENING_SAYS = 'Opens once, over this cover. Behind it, nothing shows or plays.';
const FOLD_OPTIONS = VEIL_FOLD_ORDER.map((k) => ({ key: k, label: VEIL_FOLDS[k].label, hint: VEIL_FOLDS[k].hint }));
const WEAVE_OPTIONS = VEIL_WEAVE_ORDER.map((k) => ({ key: k, label: VEIL_WEAVES[k].label, hint: VEIL_WEAVES[k].hint }));
const WIND_OPTIONS = VEIL_WIND_ORDER.map((k) => ({ key: k, label: VEIL_WINDS[k].label, hint: VEIL_WINDS[k].hint }));

function RevealStagePart({
  onStage,
  openings,
  effective,
  savePick,
  stages,
  effects,
  setEffects,
  ownsPro,
  storeShell,
  failed,
  mainColours,
  veilShown,
}: {
  /** 🎨 The five main colours — the veil's Colour opens the one picker on them. */
  mainColours: readonly string[];
  /** 🧵 What the veil is painted while no colour is chosen (today's). */
  veilShown: string;
  /** 🚫 One patch for the opening and where it plays (`lib/reveal-none.ts` `revealCoverPickPatch`). */
  savePick: (patch: RevealPatch | null) => void;
  /** Where the reveal plays — the ONE source (`events.reveal_stages`, drafted). */
  stages: readonly RevealStage[];
  onStage: RevealStage;
  openings: MakerRevealOpening[];
  effective: string;
  effects: RevealEffects;
  setEffects: (next: RevealEffects) => void;
  ownsPro: boolean;
  storeShell: boolean;
  failed: ReactNode;
}) {
  const look = useStageRevealLook();
  const now = { effective, stages };
  /* 🎭 THE CARD PICKED IS WHAT PLAYS ON THIS STAGE'S COVER (`revealCoverPicked`) — and the cover's corner names the same
     (`stage-tools.tsx`; None too: "No opening"), and ▶ plays a veil only when one does. None keeps the event's opening
     and only takes this stage out (`revealCoverPickPatch`), so `effective` alone kept saying "Sheer veil ◆ opens over
     it" after None was picked (walk 2026-10-17). */
  const picked = revealCoverPicked(now, onStage);
  useEffect(() => {
    setStageRevealKind(picked);
  }, [picked]);
  const extras = picked !== REVEAL_NONE_ID ? revealExtrasFor(picked) : [];
  const veil = picked === 'veil-sheer';
  const [pickingColour, setPickingColour] = useState(false);
  const mark = makerProMark({ owns: ownsPro, storeShell });
  /* 🌫 The prototype's cards after the Sheer veil — the envelope and the doors exist (`REVEAL_LIBRARY`), but an opening
     the house has not switched on is drawn faint and says why (prototype `.lc.soon`: "After the envelope proof — not
     yet"); switched on, it is an ordinary card. */
  const soon = REVEAL_COVER_SOON.filter((id) => !openings.some((o) => o.id === id));
  const options = [
    { id: REVEAL_NONE_ID, name: 'None' },
    ...openings.map((o) => ({ id: o.id, name: o.label })),
    ...soon.map((id) => ({ id, name: REVEAL_LIBRARY.find((r) => r.id === id)?.label ?? id })),
  ];
  return (
    <section className="contents" data-maker-reveal-part={onStage}>
      {/* 🎭 THE COVER SCENE'S STYLE IS THE OPENING (owner-approved 2026-10-16, prototype `drawOpening`): the cards ARE the
          couple's own cover — the shipped miniature every Style card draws (`StyleCards` › `StylePreview`, the cover
          `f:hero` as it is) — with the opening over it (`RevealPicture` `over`): None = the cover alone, Sheer veil = its
          sheer cloth and stripes. Under them ONE row: Extras ◆ ▾ and what the opening does, or, with None, what that
          means. Per stage: None takes THIS stage's cover out, never the others (the three switches are gone). */}
      <StageStyle
        rows
        look={
          <>
            <StyleCards
              data="reveal"
              label="Opening"
              options={options}
              value={picked}
              dim={soon}
              pending={false}
              canvasKey="f:hero"
              sceneType="opening"
              onPick={(id) => {
                if (soon.includes(id)) {
                  window.dispatchEvent(new CustomEvent(MAKER_STAGE_SAY_EVENT, { detail: REVEAL_COVER_SOON_SAYS }));
                  return;
                }
                savePick(revealCoverPickPatch(id, now, onStage));
              }}
              picture={(id, on) => (
                <>
                  <StylePreview canvasKey="f:hero" sceneType="opening" styleId={id} current={on} focus="header[data-pahina-first-screen]" screen hide={id === REVEAL_NONE_ID ? null : '[data-cover-line]'} />
                  {id !== REVEAL_NONE_ID ? <RevealPicture kind={id} colours={look.colours} fill over /> : null}
                  {id !== REVEAL_NONE_ID && mark ? (
                    <span data-reveal-kind-mark="" className="absolute right-1.5 top-1 z-[1]">
                      <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" />
                    </span>
                  ) : null}
                </>
              )}
            />
            <div data-look-row="opening" className={`${SP_ROWS_ROW} h-[var(--sp-rh)] shrink-0`}>
              {picked === REVEAL_NONE_ID ? (
                <span className="min-w-0 flex-1 px-1 text-[12.5px] leading-snug text-[var(--sp-ink2)]">No opening: the cover shows at once, its entrance plays on arrival.</span>
              ) : (
                <>
                  {extras.length > 1 ? (
                    <Dd
                      small="Extras ◆"
                      label="Extras"
                      data="reveal-extras"
                      value={revealExtraOf(effects, picked)}
                      options={extras.map((x) => ({ key: x, label: REVEAL_EXTRA_LABEL[x] }))}
                      onPick={(k) => setEffects(revealEffectsWithExtra(effects, picked, k as (typeof extras)[number]))}
                      stacked
                    />
                  ) : null}
                  {veil ? (
                    <>
                      {/* 🌬 Wind ▾ (owner 2026-10-17: *"wind speed/randomness"*) — beside Extras, two stacked pills to a row. */}
                      <Dd small="Wind ◆" label="Veil wind" data="veil-wind" value={veilWindOf(effects)} options={WIND_OPTIONS} onPick={(k) => setEffects(withVeilWind(effects, k as VeilWind))} stacked />
                      {/* The opening's sentence, behind ⓘ — the row now holds the veil's own choices (helper words never take a row). */}
                      <About label="Opening">{OPENING_SAYS}</About>
                    </>
                  ) : (
                    <span className="min-w-0 flex-[1.4] px-1 text-[12.5px] leading-snug text-[var(--sp-ink2)]">{OPENING_SAYS}</span>
                  )}
                </>
              )}
            </div>
            {veil ? (
              /* 🧵 THE VEIL IS THE COUPLE'S TO TUNE (owner 2026-10-17: *"fold coverage, veil thread count, veil color"*):
                 Fold ▾ · Weave ▾ and the veil's colour circle — the one colour sheet. Each middle choice is today's veil,
                 stored as nothing (`lib/veil-style.ts`); all Pro ◆, tried here, named at Apply. */
              <div data-look-row="veil" className={`${SP_ROWS_ROW} h-[var(--sp-rh)] shrink-0`}>
                <Dd small="Fold ◆" label="Veil fold" data="veil-fold" value={veilFoldOf(effects)} options={FOLD_OPTIONS} onPick={(k) => setEffects(withVeilFold(effects, k as VeilFold))} stacked />
                <Dd small="Weave ◆" label="Veil weave" data="veil-weave" value={veilWeaveOf(effects)} options={WEAVE_OPTIONS} onPick={(k) => setEffects(withVeilWeave(effects, k as VeilWeave))} stacked />
                <Swatch
                  on
                  label={effects.veilColor ? `Veil colour ◆ ${effects.veilColor.toUpperCase()} — change it` : 'Veil colour ◆ — change it'}
                  face={<span className="absolute inset-0" style={{ background: effects.veilColor ?? veilShown }} />}
                  onPick={() => setPickingColour(true)}
                  data={{ 'data-veil-colour': effects.veilColor ?? 'house' }}
                />
                {pickingColour ? (
                  <ColourSheet
                    title="Veil colour"
                    what="the veil"
                    value={effects.veilColor}
                    shown={veilShown}
                    palette={mainColours}
                    slots={mainColours.length > 0}
                    onPick={(hex) => setEffects({ ...effects, veilColor: hex })}
                    onUnset={() => setEffects({ ...effects, veilColor: null })}
                    onClose={() => setPickingColour(false)}
                  />
                ) : null}
              </div>
            ) : null}
            {failed}
          </>
        }
        background={null}
      />
    </section>
  );
}
