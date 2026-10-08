'use client';

import { makerSave } from '@/lib/maker-refresh';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Check, Play } from 'lucide-react';
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
import { useMaker } from './maker-context';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { IRow, ISection, ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { StageStyle } from './stage-panel/stage-style';
import { Dd, PanelSwitch } from './stage-panel/kit';
import { REVEAL_PICTURE_PX, RevealPicture } from './stage-panel/reveal-picture';
import { setStageRevealKind, useStageRevealLook } from './stage-panel/store';
import { SP_LAYOUT_CARD, spCardWidth } from '@/lib/maker-stage-room';

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
  part = 'all',
}: {
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

  const setStages = (next: RevealStage[]) => {
    setMine((m) => ({ ...m, stages: next }));
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { reveal_stages: next } }));
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
  /* 🎭 The Stages panel's Reveal part — the prototype's Style (DECISION_LOG 2026-10-07): Look = its five
     openings as REAL miniatures (`RevealPicture`, the picture the page draws) and Extras ▾; Arrange = On this
     stage ▾ (Hidden = no reveal here). No Background: the reveal plays over the cover. */
  if (onStage) {
    /* Shown / Hidden write THIS stage only, through the one helper. */
    const showHere = (on: boolean) => (on ? setStages(revealStagesWith(stages, onStage, true)) : setStages(revealStagesWith(stages, onStage, false)));
    return <RevealStagePart onStage={onStage} openings={openings} effective={effective} choose={choose} shownHere={stages.includes(onStage)} showHere={showHere} stages={stages} toggleStage={toggleStage} effects={effects} setEffects={setEffects} ownsPro={ownsPro} storeShell={storeShell} failed={failed} />;
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
        <button
          type="button"
          onClick={replay}
          className="sn-press inline-flex min-h-10 items-center gap-1.5 self-start rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink hover:bg-ink/10"
        >
          <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Play the opening
        </button>
      ) : null}
      {effective !== 'none' ? (
        <FineTune
          opening={effective}
          effects={effects}
          tuneHouse={tuneHouse}
          drafted={effectsDrafted}
          /* Never locked: each change is shown at once and saved behind it. */
          pending={false}
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
                className={`sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-sn-control ease-sn disabled:opacity-60 ${
                  on ? 'bg-ink text-cream' : 'bg-white/70 text-ink/75 hover:bg-white'
                }`}
              >
                {on ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
                {PUBLIC_STAGE_LABELS[s]}
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
  onChange,
}: {
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
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-terracotta-700' : 'bg-ink/20'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </span>
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
            onCommit={(hex) => onChange({ ...effects, veilColor: hex })}
          />
          <ColourRow
            label="Petal colour"
            value={effects.petalColor}
            disabled={pending}
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
        <input
          type="range"
          min={knob.min}
          max={knob.max}
          step={knob.step}
          value={local}
          disabled={disabled}
          aria-label={knob.label}
          onChange={(e) => setLocal(Number(e.target.value))}
          onPointerUp={(e) => onCommit(Number(e.currentTarget.value))}
          onKeyUp={(e) => onCommit(Number(e.currentTarget.value))}
          className="min-h-11 min-w-0 flex-1 accent-terracotta-700"
        />
        <span className="w-12 shrink-0 text-right">{knob.hi}</span>
      </span>
    </label>
  );
}

/** A colour, or "from your Mood Board" (null). Saved when the picker settles. */
function ColourRow({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  onCommit: (hex: string | null) => void;
}) {
  const [local, setLocal] = useState(value ?? '#f3ece1');
  const timer = useRef<number | null>(null);
  useEffect(() => setLocal(value ?? '#f3ece1'), [value]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-md bg-white/70 px-3 py-2">
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="color"
          value={local}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => {
            const hex = e.target.value;
            setLocal(hex);
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => onCommit(hex), 700);
          }}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-full border border-ink/15 bg-transparent p-0.5"
        />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
          <span className="block text-[12px] text-ink/60">{value ? value.toUpperCase() : 'From your Mood Board'}</span>
        </span>
      </label>
      {value ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCommit(null)}
          className="sn-press inline-flex min-h-10 items-center rounded-full bg-ink/5 px-3 text-[12px] font-semibold text-ink hover:bg-ink/10"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

function RevealStagePart({
  onStage,
  openings,
  effective,
  choose,
  shownHere,
  showHere,
  stages,
  toggleStage,
  effects,
  setEffects,
  ownsPro,
  storeShell,
  failed,
}: {
  /** Where the reveal plays — the ONE source (`events.reveal_stages`, drafted) Arrange's "On this stage" also writes. */
  stages: readonly RevealStage[];
  toggleStage: (s: RevealStage) => void;
  onStage: RevealStage;
  openings: MakerRevealOpening[];
  effective: string;
  choose: (value: string | null) => void;
  shownHere: boolean;
  showHere: (on: boolean) => void;
  effects: RevealEffects;
  setEffects: (next: RevealEffects) => void;
  ownsPro: boolean;
  storeShell: boolean;
  failed: ReactNode;
}) {
  const look = useStageRevealLook();
  /* The page's Reveal part draws the opening chosen here (`stage-tools.tsx`). */
  useEffect(() => {
    if (effective !== 'none') setStageRevealKind(effective);
  }, [effective]);
  const extras = effective !== 'none' ? revealExtrasFor(effective) : [];
  const mark = makerProMark({ owns: ownsPro, storeShell });
  return (
    <section className="contents" data-maker-reveal-part={onStage}>
      <StageStyle
        look={
          <>
            {openings.length > 0 ? (
              <div role="radiogroup" aria-label="Kind" data-style-carousel="" data-maker-reveal-kinds="" className="-mx-[2px] flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden px-[2px] pb-1 pt-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {openings.map((o) => {
                  const on = effective === o.id;
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} data-maker-reveal-kind={o.id} data-style-card={o.id} onClick={() => choose(o.id)} className={SP_LAYOUT_CARD} style={spCardWidth(REVEAL_PICTURE_PX.w / REVEAL_PICTURE_PX.h)}>
                      <span
                        data-style-card-preview=""
                        className={`relative flex h-[104px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--sp-page)] ${
                          on ? 'border-2 border-[var(--sp-cta)] shadow-[0_0_0_3px_var(--sp-cta-wash)]' : 'border border-[var(--sp-line)]'
                        }`}
                      >
                        <span data-style-preview="render" className="pointer-events-none">
                          <RevealPicture kind={o.id} colours={look.colours} />
                        </span>
                      </span>
                      <span className={`inline-flex h-[18px] items-center justify-center gap-1 truncate text-center text-[13px] font-semibold ${on ? 'text-[var(--sp-ink)]' : 'text-[var(--sp-ink2)]'}`}>
                        {o.label}
                        {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {/* 🎚 WHERE IT PLAYS — one switch per stage that can carry a reveal (owner 2026-10-07: "reveal will have a
                toggle for each stage it is at. to know where they want this to activate"). The same drafted list
                Arrange › On this stage writes — one source, two doors. */}
            <div className="grid shrink-0 grid-cols-3 gap-1.5" data-reveal-stage-switches="">
              {REVEAL_STAGE_CHOICES.map((st) => (
                <span key={st} className="flex min-w-0 flex-col items-center gap-0.5" data-reveal-stage-switch={st}>
                  <span className="max-w-full truncate text-[12px] font-semibold text-[var(--sp-ink2)]">{PUBLIC_STAGE_LABELS[st]}</span>
                  <PanelSwitch on={stages.includes(st)} label={`Reveal on ${PUBLIC_STAGE_LABELS[st]}`} onChange={() => toggleStage(st)} data={`reveal-${st}`} />
                </span>
              ))}
            </div>
            {extras.length > 1 ? (
              <div className="flex h-11 shrink-0">
                <Dd
                  small="Extras"
                  label="Extras"
                  data="reveal-extras"
                  value={revealExtraOf(effects, effective)}
                  options={extras.map((x) => ({ key: x, label: REVEAL_EXTRA_LABEL[x] }))}
                  onPick={(k) => setEffects(revealEffectsWithExtra(effects, effective, k as (typeof extras)[number]))}
                />
              </div>
            ) : null}
            {failed}
          </>
        }
        background={null}
        arrange={
          <div className="flex h-11 shrink-0">
            <Dd
              small="On this stage"
              label="Show or hide the reveal on this stage"
              data="reveal-show"
              value={shownHere ? 'shown' : 'hidden'}
              options={[
                { key: 'shown', label: 'Shown' },
                { key: 'hidden', label: 'Hidden — no reveal' },
              ]}
              onPick={(k) => showHere(k === 'shown')}
            />
          </div>
        }
      />
    </section>
  );
}
