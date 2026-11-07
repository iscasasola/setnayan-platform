'use client';

import { formatCount } from '@/lib/format-number';
import { EASE_OUT, HeldCount, HeldFill, useTween } from './growth-motion';
import { GhostTrack } from './ghost-track';

/**
 * Your booking funnel — views → inquiries → quotes → booked, each bar scaled to the top stage (profile views) so the
 * drop-off is visible at a glance, with the step-to-step % beside each count. Data comes from the shared
 * `fetchVendorFunnelTotalsResult()` so this card, the pinned row and the sentence never disagree on what "booked" means.
 *
 * 📈 EXTENDED, NOT REDRAWN — Shop › Analytics, owner-approved 6 Nov 2026 ("Analytics, growing" §3 picture): the bars
 * now fill stage by stage (`Fill` + `Count`, 160 ms apart; the % pops 350 ms after its stage), and an EMPTY stage is a
 * dashed `GhostTrack` that names what fills it ("Your first booking lands here") — never a zero bar. What each stage
 * counts moved into the section's ⓘ (it was a tap-to-expand line per row). Unread → "Couldn’t load".
 */
const GHOST_LINE: Record<string, string> = {
  'Profile views': 'Your first profile view lands here',
  Inquiries: 'Your first inquiry lands here',
  'Quotes sent': 'Your first quote lands here',
  Booked: 'Your first booking lands here',
};

function Pct({ id, rate, delay }: { id: string; rate: number; delay: number }) {
  const v = useTween(id, 1, { dur: 450, ease: EASE_OUT, delay });
  return (
    <span className="ag-pct" style={{ opacity: v, transform: `scale(${0.6 + 0.4 * v})` }}>
      {rate}%
    </span>
  );
}

export function FunnelPreviewCard({ steps }: { steps: { label: string; count: number }[] | null }) {
  if (steps === null) return <p className="ag-one">Couldn’t load your funnel just now.</p>;
  const top = steps[0]?.count || 1;
  return (
    <div className="ag-funnel" data-funnel="">
      <ul>
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1]!.count : null;
          const rate = prev ? Math.round((s.count / prev) * 100) : null;
          const w = Math.max((s.count / top) * 100, s.count > 0 ? 4 : 0);
          const d = i * 160;
          if (s.count === 0) {
            return (
              <li key={s.label} className="ag-ghostrow">
                <div className="ag-fr">
                  <span>{s.label}</span>
                  <span className="ag-n">0</span>
                </div>
                <GhostTrack line={GHOST_LINE[s.label]} />
              </li>
            );
          }
          return (
            <li key={s.label}>
              <div className="ag-fr">
                <span>{s.label}</span>
                <span>
                  {rate !== null ? <Pct id={`ag:fun:${s.label}:pct`} rate={rate} delay={d + 350} /> : null}
                  <HeldCount value={s.count} id={`ag:fun:${s.label}`} delay={d} className="ag-n" format={(n) => formatCount(n)} />
                </span>
              </div>
              <div className="ag-track">
                <HeldFill value={w} id={`ag:funw:${s.label}`} delay={d} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
