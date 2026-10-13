import type { ReactNode } from 'react';
import { Camera } from 'lucide-react';
import { PapicBandActions } from './papic-band-actions';
import { formatCount } from '@/lib/format-number';
import { PAPIC_UNTIL_WORDS, type PapicGlance } from '@/lib/papic-glance';

/**
 * 📍 THE PAPIC PAGE'S TOP BAND (owner "Yes", 2026-10-13 — DECISION_LOG 📍 and
 * 📸 "How about making it easy to purchase credits, track credits and view
 * gallery"): the three things in ONE band, first on the page —
 *
 *   credits left (track) · Buy more (buy) · See your N photos ↓ (gallery)
 *   On from [date] · until 12 h after your day
 *
 * so a couple never scrolls three phone screens to find their photos (the
 * tester measured the gallery 3.3 screens down).
 *
 * 🔑 NOTHING HERE IS READ. The words come from `papicGlance` over the page's
 * own `readPapicStandings` (one read, already made) and its `resolveStoredWindow`.
 * "Buy more" unfolds the SHIPPED `PapicPoolCard` in place (passed in as
 * `buyPanel`) — the same stepper and "Continue to payment" → /pay, no second
 * checkout. The card is already on the page; the tap only shows it — no request.
 */
export function PapicTopBand({
  glance,
  buyPanel,
  buyOpen = false,
}: {
  glance: PapicGlance;
  /** The shipped credit card (`<PapicPoolCard>`), unfolded by "Buy more". */
  buyPanel: ReactNode;
  /** Open on arrival — a purchase error to read, or a "Buy more" from Home. */
  buyOpen?: boolean;
}) {
  const { credits, photos, tone, phase, onFrom } = glance;
  const big = credits === null ? glance.status : formatCount(credits);
  const unit = credits === null ? null : credits === 1 ? 'credit left' : 'credits left';
  const flag =
    tone === 'stopped'
      ? { text: 'Stopped — your guests’ cameras need credits', color: 'rgb(var(--color-danger))' }
      : tone === 'low'
        ? { text: 'Running low', color: 'rgb(var(--color-warn))' }
        : null;
  const when =
    phase === 'closed'
      ? 'Cameras closed'
      : onFrom
        ? `${phase === 'waits' ? 'Papic turns on' : 'On from'} ${onFrom} · ${PAPIC_UNTIL_WORDS}`
        : null;
  const seePhotos = typeof photos === 'number' && photos > 0 ? photos : null;
  return (
    <section
      data-papic-top-band=""
      data-papic-tone={tone}
      aria-label="Your credits and photos"
      className={`rounded-2xl border p-4 sm:p-5 ${tone === 'stopped' ? 'border-red-500/40 bg-red-500/5' : tone === 'low' ? 'border-amber-500/40 bg-amber-500/5' : 'border-ink/10 bg-surface'}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
          <Camera className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-tight">
            <span data-papic-credits="" className="text-[26px] font-semibold tracking-tight text-ink tabular-nums">
              {big}
            </span>
            {unit ? <span className="ml-1.5 text-sm text-ink/65">{unit}</span> : null}
          </p>
          {flag ? (
            <p data-papic-flag="" className="mt-0.5 text-[13px] font-semibold" style={{ color: flag.color }}>
              {flag.text}
            </p>
          ) : null}
          {when ? <p data-papic-when="" className="mt-0.5 text-[12.5px] text-ink/60">{when}</p> : null}
        </div>
      </div>

      <PapicBandActions buy={glance.buy} photos={seePhotos} defaultOpen={buyOpen}>
        {buyPanel}
      </PapicBandActions>
    </section>
  );
}
