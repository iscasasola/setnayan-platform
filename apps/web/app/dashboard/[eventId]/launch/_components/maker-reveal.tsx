'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Play } from 'lucide-react';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { useMaker } from './maker-context';

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
 */
export type MakerRevealOpening = { id: string; label: string; blurb: string };

export function MakerRevealPicker({
  eventId,
  current,
  drafted,
  themeName,
  defaultOpening,
  defaultIsTheme,
  dressing,
  openings,
  ownsPro,
  storeShell,
  stdWindowDays,
}: {
  /** `STD_THRESHOLD_DAYS` — the opening plays only in the Save-the-Date window
   *  (`cinematicRevealPlays`, owner ruling 2026-09-14). */
  stdWindowDays: number;
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

  const maker = useMaker();
  const replay = () => {
    /* The opening plays where guests meet it: as the Save the Date opens, and
       at the invitation door (`[slug]/invite`). The Event Hub body plays it only
       on the Save the Date stage (`cinematicRevealPlays`), so "Play" turns the
       canvas to that stage — the draft and the theme's dressing ride along —
       and, if it is already there, reloads it so the opening plays again. */
    if (maker && maker.stage !== 'save_the_date') {
      maker.setStage('save_the_date');
      return;
    }
    const frame = document.querySelector<HTMLIFrameElement>('[data-maker-shell] iframe');
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
      {effective !== 'none' ? (
        <p className="text-[12px] text-ink/60">
          Guests meet it while your Save the Date is out — at your Event Hub and at the door of every invitation
          link. It rests from {stdWindowDays} days before the day, when guests come to reply.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
