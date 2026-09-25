'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Play } from 'lucide-react';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { REVEAL_STAGE_CHOICES, type RevealStage } from '@/lib/reveal-stages';

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
  const toggleStage = (s: RevealStage) =>
    setStages(REVEAL_STAGE_CHOICES.filter((x) => (x === s ? !stages.includes(s) : stages.includes(x))));

  const replay = () => {
    /* The Reveal's page (the Maker's body) is the stage it plays on: playing it
       again is loading that page again, in place. */
    const frame = document.querySelector<HTMLIFrameElement>('[data-maker-page="reveal"] iframe');
    try {
      frame?.contentWindow?.location.reload();
    } catch {
      router.refresh();
    }
  };

  const Row = ({ id, label, note, pro }: { id: string; label: string; note: string; pro: boolean }) => {
    const on = effective === id;
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
          {pro && !ownsPro && !storeShell ? (
            <span className={`text-[11px] font-semibold ${on ? 'text-cream/80' : 'text-ink/55'}`}>Pro</span>
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
