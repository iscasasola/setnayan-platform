'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, Play } from 'lucide-react';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { REVEAL_STAGE_CHOICES, type RevealStage } from '@/lib/reveal-stages';
import type { RevealEffects } from '@/lib/std-reveal-effects';
import { useMaker } from './maker-context';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel, paidMarkState } from '@/lib/paid-mark';

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
 */
export type MakerRevealOpening = { id: string; label: string; blurb: string };

export function MakerRevealPicker({
  eventId,
  current,
  drafted,
  stages,
  stagesDrafted,
  effects,
  effectsDrafted,
  themeName,
  defaultOpening,
  defaultIsTheme,
  dressing,
  openings,
  ownsPro,
  storeShell,
  stdWindowDays,
}: {
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
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* What guests meet when nothing is chosen: the theme's opening for a Pro
     couple, and no reveal at all without Pro (`revealAllowedFor`). */
  const effective = current ?? (ownsPro ? defaultOpening : 'none');

  const choose = (value: string | null) =>
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { std_reveal_template: value } }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) setError(r.error);
        else router.refresh();
      } catch {
        setError('Your reveal could not be saved. Please try again.');
      }
    });

  const setStages = (next: RevealStage[]) =>
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { reveal_stages: next } }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) setError(r.error);
        else router.refresh();
      } catch {
        setError('Where your reveal plays could not be saved. Please try again.');
      }
    });
  /* 🎛 FINE-TUNING (owner 2026-09-25: "pick a reveal and see the effects, fine
     tune it to your liking") — the couple's own effects, the same keys the
     Save-the-Date studio sets, saved to the DRAFT; the canvas replays with them. */
  const setEffects = (next: RevealEffects) =>
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { std_reveal_effects: next } }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) setError(r.error);
        else router.refresh();
      } catch {
        setError('Your reveal’s effects could not be saved. Please try again.');
      }
    });

  const toggleStage = (s: RevealStage) =>
    setStages(REVEAL_STAGE_CHOICES.filter((x) => (x === s ? !stages.includes(s) : stages.includes(x))));

  const replay = () => {
    /* The Reveal's page (the Maker's body) is the stage it plays on: playing it
       again is loading that page again, in place. That page loads the stage
       PREVIEW (`?preview=draft`, `makerPageCanvasSrc`), never the editing
       canvas — the canvas skips the opening by design (owner 2026-09-26:
       *"that role is for the preview stage"*). */
    const frame = document.querySelector<HTMLIFrameElement>('[data-maker-page="reveal"] iframe');
    try {
      frame?.contentWindow?.location.reload();
    } catch {
      router.refresh();
    }
  };

  const Row = ({ id, label, note, pro }: { id: string; label: string; note: string; pro: boolean }) => {
    const on = effective === id;
    const mark = pro ? paidMarkState({ owns: ownsPro, storeShell }) : null;
    return (
      <li>
        <button
          type="button"
          aria-pressed={on}
          disabled={pending}
          data-maker-reveal={id}
          onClick={() => choose(id)}
          className={`sn-press flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-sn-control ease-sn disabled:opacity-60 ${
            on ? 'bg-ink text-cream' : 'bg-white/70 text-ink hover:bg-white'
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold">{label}</span>
            <span className={`block text-[12px] ${on ? 'text-cream/80' : 'text-ink/60'}`}>{note}</span>
          </span>
          {mark ? (
            <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} tone={on ? 'current' : 'auto'} />
          ) : null}
          {on ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
        </button>
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-3 px-1" data-made-once="reveal">
      <p className="text-[13.5px] text-ink/75">
        How your Event Hub opens for a guest — once, before the page. Your {themeName} theme dresses it
        {dressing ? `: ${dressing.charAt(0).toLowerCase()}${dressing.slice(1)}.` : '.'}
      </p>
      <ul className="flex flex-col gap-1.5" aria-label="Choose how your Event Hub opens">
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
      {drafted ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
      {!ownsPro && !storeShell && openings.length > 0 ? (
        <p className="text-[12px] text-ink/60">
          Every opening is part of Event Hub Pro. Try one here — it plays in your own preview; guests see it only
          after you Apply with Pro.
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
          drafted={effectsDrafted}
          pending={pending}
          onChange={setEffects}
        />
      ) : null}
      <fieldset className="flex flex-col gap-1.5" data-maker-reveal-stages="">
        <legend className="mb-1 text-[13px] font-semibold text-ink">Where it plays</legend>
        <div className="flex flex-wrap gap-1.5">
          {REVEAL_STAGE_CHOICES.map((s) => {
            const on = stages.includes(s);
            return (
              <button
                key={s}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={pending}
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
        <p className="text-[12px] text-ink/60">
          On the {PUBLIC_STAGE_LABELS.save_the_date} (more than {stdWindowDays} days before the day) it opens your
          film. On the {PUBLIC_STAGE_LABELS.rsvp} and {PUBLIC_STAGE_LABELS.event} it plays on the first page only —
          once opened, it is gone.
        </p>
      </fieldset>
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
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
  drafted,
  pending,
  onChange,
}: {
  opening: string;
  effects: RevealEffects;
  drafted: boolean;
  pending: boolean;
  onChange: (next: RevealEffects) => void;
}) {
  const envelope = ENVELOPES.has(opening);
  const veil = opening === 'veil-sheer';
  const Switch = ({ on, label, hint, flip }: { on: boolean; label: string; hint: string; flip: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={flip}
      className="sn-press flex min-h-12 w-full items-center gap-3 rounded-md bg-white/70 px-3 py-2 text-left hover:bg-white disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="block text-[12px] text-ink/60">{hint}</span>
      </span>
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
      <legend className="mb-1 text-[13px] font-semibold text-ink">Fine-tune</legend>
      {envelope ? (
        <Switch
          on={effects.butterflies}
          label="Butterflies"
          hint="They fly out as the envelope opens."
          flip={() => onChange({ ...effects, butterflies: !effects.butterflies })}
        />
      ) : (
        <Switch
          on={effects.petals}
          label="Falling petals"
          hint="Rose petals drift down through the opening."
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
      {drafted ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
    </fieldset>
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
