'use client';

/**
 * MonogramAnimatePicker — the editor's "Animate" side (owner 2026-06-22 "this is
 * monogram animation … from the monogram editor, the animate side").
 *
 * Lets the couple choose HOW their monogram animates from the 8-key motion
 * library (draw·foil·bloom·editorial·halo·stardust + Gold Turn + Molten Gold).
 * The pick persists to events.monogram_motion_key via the narrow
 * saveMonogramMotion server action and then plays wherever the mark shows
 * (HeroMonogram). A live preview pane animates the currently-selected motion —
 * Gold Turn (CSS) and Molten Gold (WebGL) both render in flowing gold, so the
 * couple previews the real look before buying.
 *
 * Gating: WHICH motion is a free choice (persists for everyone); WHETHER it plays
 * on the live surfaces is gated by ANIMATED_MONOGRAM ownership — so non-owners
 * still pick + preview here, behind an unlock CTA.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { MONOGRAM_MOTIONS, type MonogramMotionKey } from '@/lib/monogram-motion';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { MonogramConfig } from '@/lib/monogram';
import { saveMonogramMotion } from './actions';

type PreviewInputs = {
  design: {
    monogram_style: string | null;
    monogram_font_key: string | null;
    monogram_frame_key: string | null;
  };
  monogram: MonogramConfig;
  bespokeSvg: string | null;
};

export function MonogramAnimatePicker({
  eventId,
  currentMotion,
  owns,
  buyHref,
  preview,
}: {
  eventId: string;
  currentMotion: MonogramMotionKey;
  owns: boolean;
  buyHref: string;
  preview: PreviewInputs;
}) {
  const [selected, setSelected] = useState<MonogramMotionKey>(currentMotion);

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-white/60 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">Animate</p>
          <h2 className="text-xl font-semibold tracking-tight">How your monogram moves</h2>
          <p className="max-w-prose text-sm text-ink/60">
            Pick the animation that plays when your mark appears — on your website hero, your
            Save-the-Date, and across your pages.
          </p>
        </div>
      </header>

      {!owns ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink/75">
            <Sparkles aria-hidden className="h-4 w-4 text-gold" strokeWidth={2} />
            Preview any motion here. They play live once you unlock Animated Monogram.
          </p>
          <Link
            href={buyHref}
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink/90"
          >
            Unlock
          </Link>
        </div>
      ) : null}

      {/* Live preview of the selected motion (allowWebgl so molten renders live —
          one WebGL context). Keyed so the once-through CSS motions replay on change. */}
      <div className="flex justify-center rounded-xl bg-ink/[0.03] py-6">
        <div
          key={selected}
          className="relative flex items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          <HeroMonogram
            event={preview.design}
            monogram={preview.monogram}
            animatedMonogram={selected}
            bespokeSvg={preview.bespokeSvg}
            allowWebgl
          />
        </div>
      </div>

      <form action={saveMonogramMotion}>
        <input type="hidden" name="event_id" value={eventId} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MONOGRAM_MOTIONS.map((m) => {
            const isSel = selected === m.key;
            const premium = m.key === 'gold' || m.key === 'molten';
            return (
              <button
                key={m.key}
                type="submit"
                name="motion"
                value={m.key}
                onClick={() => setSelected(m.key)}
                aria-pressed={isSel}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  isSel
                    ? 'border-ink bg-ink/[0.04] ring-1 ring-ink'
                    : 'border-ink/12 hover:border-ink/30 hover:bg-ink/[0.02]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {m.label}
                  {premium ? (
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                      Premium
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-ink/55">{m.hint}</span>
              </button>
            );
          })}
        </div>
      </form>
    </section>
  );
}
