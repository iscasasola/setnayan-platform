'use client';

import { useState } from 'react';
import { StudioRevealPlayer } from '@/app/_components/studio-reveal-player';
import {
  ANIM_TEMPO_TIMINGS,
  type StudioAnimKind,
  type StudioAnimTempo,
} from '@/lib/monogram-studio-shared';
import { setRevealAction, saveRevealChoice } from './reveal-actions';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import type { InlineCheckoutDrawerProps } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

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
  checkout,
}: {
  eventId: string;
  /** The couple's mark, resolved and ink-applied by the page. */
  markSvg: string;
  monogramText: string;
  initialKind: StudioAnimKind;
  initialTempo: Exclude<StudioAnimTempo, 'custom'>;
  /** Does the event own the paid animation already? */
  owned: boolean;
  /** Shown BELOW the step once the animation is owned — the confirmation /
   *  under-review states, rendered server-side by the page. Not used for the
   *  purchase itself any more. */
  unlock?: React.ReactNode;
  /** Everything the checkout drawer needs, resolved server-side by the page
   *  (catalog price, payment settings). Absent when the animation is owned,
   *  when the store shell withholds purchases, or when the price could not be
   *  read — and the button below degrades accordingly rather than guessing. */
  checkout?: Pick<
    InlineCheckoutDrawerProps,
    'serviceKey' | 'displayName' | 'originalPriceCentavos' | 'settings' | 'vatRatePct'
  > | null;
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

      {/* ── ONE BUTTON (owner 2026-09-20): "keep this reveal and animate & apply
          should be 1. Unlock & Apply. One time payment that they can animate
          their monogram."

          There used to be two: "Keep this reveal" (free, saves the choice) and
          "Animate & apply · ₱500" (pays). Two buttons for one intention made the
          couple do the bookkeeping — and let them pay without saving, so the
          animation they bought could play a different reveal from the one they
          were looking at. Now the ONE button records the reveal on screen and
          THEN opens payment (InlineCheckoutDrawer.onBeforeOpen), so what they
          pay for is exactly what they chose. ── */}
      {owned ? (
        <form action={setRevealAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="tempo" value={tempo} />
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-mulberry px-6 text-sm font-semibold text-cream hover:bg-mulberry-700"
          >
            Apply this reveal
          </button>
          <span className="text-xs text-ink/55">Unlocked — it plays for your guests as soon as you apply it.</span>
        </form>
      ) : checkout ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1">
            <p className="text-base font-semibold tracking-tight text-ink">One-time payment, then it’s yours</p>
            <p className="max-w-prose text-sm leading-relaxed text-ink/65">
              Unlock animation for your monogram — it draws itself in on your website, your
              invitation, your save-the-date and the screens on the day. One payment for your
              wedding, whichever mark you use.
            </p>
            {/* The honest wait. `order_paid` is on the email allowlist, so the
                email is real; NO duration is promised because approval latency
                has never been measured. */}
            <p className="pt-1 text-xs text-ink/55">
              We check every payment by hand and email you the moment it goes live.
            </p>
          </div>
          <div className="shrink-0 sm:w-auto">
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={checkout.serviceKey}
              displayName={checkout.displayName}
              originalPriceCentavos={checkout.originalPriceCentavos}
              settings={checkout.settings}
              vatRatePct={checkout.vatRatePct}
              /* No price in the label — the drawer appends the catalog price
                 itself; passing one printed it twice on a money button. */
              triggerLabel="Unlock & Apply"
              triggerClassName="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg bg-mulberry px-6 text-sm font-semibold text-cream hover:bg-mulberry-700 disabled:opacity-70 sm:w-auto"
              onBeforeOpen={async () => {
                await saveRevealChoice({ eventId, kind, tempo });
              }}
            />
          </div>
        </div>
      ) : (
        /* No purchase path here — the store shell withholds paid items, or the
           catalog price could not be read. The couple can still record the
           reveal they like; nothing is priced from a guess. */
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
        </form>
      )}

      {unlock}
    </section>
  );
}
