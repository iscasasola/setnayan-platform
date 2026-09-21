'use client';

import { useState } from 'react';
import { StudioRevealPlayer } from '@/app/_components/studio-reveal-player';
import {
  ANIM_TEMPO_TIMINGS,
  type StudioAnimKind,
  type StudioAnimTempo,
} from '@/lib/monogram-studio-shared';
import { setRevealAction } from './reveal-actions';

/**
 * <RevealStep> — ONE reveal, for a mark made either way.
 *
 * Owner 2026-09-20, overruling the 2026-06-23 lock: *"it should be one reveal
 * for both only."* The picker used to live INSIDE the Vector Studio (letters
 * only) and again as chips in the upload panel — two pickers writing one field,
 * and neither visible from the other door. That was tenable while letters were
 * the only source; it is not now that an uploaded logo can be the mark.
 *
 * So: make your mark, free, either way — then this step, where you WATCH each
 * animation on your own mark before paying for any of them. The ₱500 unlock
 * renders directly beneath it (passed in as `unlock`), because the money buys
 * the animation, not the door you came through.
 *
 * Auto-plays on selection rather than waiting for a press: the whole complaint
 * was "i cannot see the different monogram animation effects", and a still
 * frame answers nothing. Safe — StudioRevealPlayer honours
 * prefers-reduced-motion itself and renders the mark static for anyone who
 * asked for less motion (WCAG 2.3.3).
 */

const REVEALS: { kind: StudioAnimKind; label: string }[] = [
  { kind: 'handwriting', label: 'Handwriting' },
  { kind: 'droplet', label: 'Bloom' },
  { kind: 'petalfall', label: 'Petal Fall' },
  { kind: 'molten', label: 'Molten Gold' },
  { kind: 'flip3d', label: 'Medallion Turn' },
];

const TEMPOS: { key: Exclude<StudioAnimTempo, 'custom'>; label: string }[] = [
  { key: 'quick', label: 'Quick' },
  { key: 'classic', label: 'Classic' },
  { key: 'ceremonial', label: 'Ceremonial' },
];

export function RevealStep({
  eventId,
  markSvg,
  monogramText,
  initialKind,
  initialTempo,
  owned,
  unlock,
}: {
  eventId: string;
  /** The couple's mark, resolved and ink-applied by the page. */
  markSvg: string;
  monogramText: string;
  initialKind: StudioAnimKind;
  initialTempo: Exclude<StudioAnimTempo, 'custom'>;
  /** Does the event own the paid animation already? */
  owned: boolean;
  /** The ₱500 unlock row, rendered by the page (a server component) and placed
   *  here so the price sits under the thing it buys. */
  unlock?: React.ReactNode;
}) {
  const [kind, setKind] = useState<StudioAnimKind>(initialKind);
  const [tempo, setTempo] = useState<Exclude<StudioAnimTempo, 'custom'>>(initialTempo);
  const [replay, setReplay] = useState(0);

  const timing = ANIM_TEMPO_TIMINGS[tempo];

  return (
    <section id="reveal" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-8">
      <header className="space-y-1.5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep">The reveal</p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Watch it come alive</h2>
        <p className="max-w-prose text-sm leading-relaxed text-ink/65">
          Your mark is free — designed here or uploaded, with frames and colours. This is how it
          arrives for your guests. Try every one on your own mark; they all preview free.
        </p>
      </header>

      <div className="mx-auto h-64 max-w-[360px]">
        <StudioRevealPlayer
          key={`${kind}-${tempo}-${replay}`}
          svg={markSvg}
          monogram={monogramText}
          anim={{ kind, dur: timing.dur, smooth: timing.smooth, delay: timing.delay }}
          allowWebgl={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {REVEALS.map((r) => (
          <button
            key={r.kind}
            type="button"
            aria-pressed={kind === r.kind}
            onClick={() => {
              setKind(r.kind);
              setReplay((n) => n + 1);
            }}
            className={`min-h-[44px] rounded-lg border px-3.5 text-xs font-semibold transition-colors ${
              kind === r.kind
                ? 'border-ink bg-ink text-cream'
                : 'border-ink/15 bg-cream text-ink/70 hover:bg-ink/5'
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setReplay((n) => n + 1)}
          className="min-h-[44px] rounded-lg border border-ink/15 bg-cream px-3.5 text-xs font-semibold text-ink/70 hover:bg-ink/5"
        >
          ↻ Play again
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">Tempo</span>
        {TEMPOS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tempo === t.key}
            onClick={() => {
              setTempo(t.key);
              setReplay((n) => n + 1);
            }}
            className={`min-h-[44px] rounded-lg border px-3.5 text-xs font-semibold transition-colors ${
              tempo === t.key
                ? 'border-gold bg-gold/12 text-gold-dark'
                : 'border-ink/15 bg-cream text-ink/70 hover:bg-ink/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form action={setRevealAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="tempo" value={tempo} />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-5 text-sm font-semibold text-ink hover:bg-ink/5"
        >
          Keep this reveal
        </button>
        <span className="text-xs text-ink/55">
          {owned
            ? 'Saved reveals play for your guests straight away.'
            : 'Saving is free — it plays for guests once the animation is unlocked.'}
        </span>
      </form>

      {unlock}
    </section>
  );
}
