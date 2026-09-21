'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ANIM_TEMPO_TIMINGS,
  type StudioAnimKind,
  type StudioAnimTempo,
} from '@/lib/monogram-studio-shared';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import type { InlineCheckoutDrawerProps } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { commitMonogram } from './commit-actions';
import { currentMark, playOnMark } from './mark-bench';

/**
 * <AnimateRows> — rows 3 and 4 of the Monogram Maker, as the owner drew them
 * (2026-09-20):
 *
 *   "next row is the different animation effects /
 *    next row is Use Static Image (FREE) and Unlock Animation (500)"
 *
 * and, on the result: *"do you see how much less words we have for the page I
 * made? simple and direct."* So there is no heading, no explainer and no tempo
 * control here — five effects, two buttons, one line about the wait.
 *
 * • An effect plays ON the mark in the row above (mark-bench.ts), in place.
 * • The two buttons are the page's only save. Making or uploading a mark is
 *   free; every animation is one ₱500 per event (price from the catalog, via
 *   the checkout drawer — never typed here).
 * • "Use Static Image" also switches a PAID animation off (anim.off), and the
 *   paid button turns it back on without paying twice — owner: "Their guests
 *   see it still."
 *
 * The tempo is not a control any more but is not lost: the saved preset rides
 * through every save unchanged.
 */

const EFFECTS: { kind: StudioAnimKind; label: string }[] = [
  { kind: 'handwriting', label: 'Handwriting' },
  { kind: 'droplet', label: 'Bloom' },
  { kind: 'petalfall', label: 'Petal Fall' },
  { kind: 'molten', label: 'Molten Gold' },
  { kind: 'flip3d', label: 'Medallion Turn' },
];

type Tempo = Exclude<StudioAnimTempo, 'custom'>;

export function AnimateRows({
  eventId,
  initialKind,
  tempo,
  owned,
  checkout,
  unlock,
}: {
  eventId: string;
  initialKind: StudioAnimKind;
  /** The saved tempo preset — carried through, not shown. */
  tempo: Tempo;
  /** Does the event own the paid animation already? */
  owned: boolean;
  /** Everything the checkout drawer needs, read server-side. Null when owned,
   *  in the store shell (App Review 3.1.1), or when the catalog price could not
   *  be read — and then no purchase is offered rather than a guessed one. */
  checkout: Pick<
    InlineCheckoutDrawerProps,
    'serviceKey' | 'displayName' | 'originalPriceCentavos' | 'settings' | 'vatRatePct'
  > | null;
  /** The owned / under-review confirmation, rendered by the page. */
  unlock?: React.ReactNode;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<StudioAnimKind>(initialKind);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function save(animate: boolean): Promise<boolean> {
    const m = currentMark();
    if (!m.ok) {
      setResult({ tone: 'error', text: m.error });
      return false;
    }
    const res = await commitMonogram({ ...m.mark, eventId, kind, tempo, animate });
    if (!res.ok) {
      setResult({ tone: 'error', text: res.error });
      return false;
    }
    return true;
  }

  async function saveAndSay(animate: boolean) {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const ok = await save(animate);
    setBusy(false);
    if (ok) {
      setResult({ tone: 'ok', text: animate ? 'Saved — it plays for your guests.' : 'Saved — guests see it still.' });
      router.refresh();
    }
  }

  const BTN =
    'inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60 sm:text-base';

  return (
    <>
      {/* ROW 3 — the effects. One sideways-scrolling row on a phone, five even
          cells on a wide screen. */}
      <div
        role="group"
        aria-label="Animation effects"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0"
      >
        {EFFECTS.map((e) => (
          <button
            key={e.kind}
            type="button"
            aria-pressed={kind === e.kind}
            onClick={() => {
              setKind(e.kind);
              setResult(null);
              playOnMark({ kind: e.kind, ...ANIM_TEMPO_TIMINGS[tempo] });
            }}
            className={`min-h-[48px] shrink-0 rounded-xl border-[1.5px] px-4 text-sm font-semibold transition-colors sm:min-h-[60px] ${
              kind === e.kind ? 'border-ink bg-ink text-cream' : 'border-ink/15 bg-cream text-ink hover:bg-ink/5'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* ROW 4 — pinned in the thumb on a phone, in the flow on a wide screen. */}
      <div className="sticky bottom-20 z-20 -mx-4 space-y-2 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className={`grid gap-2 sm:gap-3 ${owned || checkout ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveAndSay(false)}
            className={`${BTN} border-[1.5px] border-ink bg-cream text-ink hover:bg-ink/5`}
          >
            Use Static Image
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-800">FREE</span>
          </button>

          {owned ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAndSay(true)}
              className={`${BTN} bg-mulberry text-cream hover:bg-mulberry-700`}
            >
              Apply Animation
            </button>
          ) : checkout ? (
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={checkout.serviceKey}
              displayName={checkout.displayName}
              originalPriceCentavos={checkout.originalPriceCentavos}
              settings={checkout.settings}
              vatRatePct={checkout.vatRatePct}
              /* No price in the label — the drawer appends the catalog price. */
              triggerLabel="Unlock Animation & Apply"
              triggerClassName={`${BTN} bg-mulberry text-cream hover:bg-mulberry-700`}
              /* Save the mark and the effect on screen, THEN open payment, so
                 what they pay for is what they were looking at. A failed save
                 never blocks paying; commitMonogram logs it. */
              onBeforeOpen={async () => {
                await save(true);
              }}
            />
          ) : null}
        </div>

        {result ? (
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${
              result.tone === 'ok' ? 'bg-success-50 text-success-800' : 'bg-terracotta/10 text-terracotta-700'
            }`}
          >
            {result.text}
          </p>
        ) : null}

        {/* The honest wait: `order_paid` is on the email allowlist, so the email
            is real; no duration, because approval time was never measured. */}
        {checkout ? (
          <p className="text-center text-xs text-ink/55">We check every payment by hand and email you when it goes live.</p>
        ) : null}
      </div>

      {unlock}
    </>
  );
}
