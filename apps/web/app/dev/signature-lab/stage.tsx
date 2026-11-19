'use client';

import { useState, type ReactNode } from 'react';
import { TieStage } from '@/app/_components/signature/the-tie';
import { FoilStage } from '@/app/_components/signature/foil-glint';
import { GoLiveStage } from '@/app/_components/signature/go-live';
import { ReplyStage } from '@/app/_components/signature/reply-arrives';
import { DayStage } from '@/app/_components/signature/day-turns';
import { CapizStage } from '@/app/_components/signature/capiz-light';
import { SIGNATURE_RULES, type SignatureMoment } from '@/lib/signature-moments';

/** One moment on its stage. `play` false = the still (what a later open, or reduced motion, shows). */
export function SignatureLabMoment({ moment, play }: { moment: SignatureMoment; play: boolean }) {
  switch (moment) {
    case 'tie':
      return <TieStage play={play} couple={{ name: 'Ana & Marco', sub: '14 Feb' }} supplier={{ name: 'Luna Florals', sub: 'Flowers' }} word="Booked" />;
    case 'foil':
      return (
        <div style={{ display: 'grid', placeItems: 'center', height: 130 }}>
          <FoilStage play={play}>
            <span data-lab-mono="" style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: '50%', border: '1.75px solid rgb(var(--color-terracotta))', background: 'rgb(var(--color-raised))', color: 'rgb(var(--color-ink))', fontSize: 20, fontWeight: 700 }}>
              A&amp;M
            </span>
          </FoilStage>
        </div>
      );
    case 'live':
      return <GoLiveStage kind="first" play={play} name="Ana & Marco" line="14 February · Tagaytay" />;
    case 'reply':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 64, padding: '0 12px', fontSize: 22, fontWeight: 700, color: 'rgb(var(--color-ink))' }}>
          <ReplyStage play={play} from={86} to={87} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>coming</span>
        </div>
      );
    case 'day':
      return (
        <div style={{ display: 'grid', placeItems: 'center', height: 110, fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'rgb(var(--color-ink))' }}>
          <DayStage play={play} from={12} to={11} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>days to go</span>
        </div>
      );
    case 'capiz':
      return <CapizStage play={play} word="Pro unlocked" />;
  }
}

const ORDER: SignatureMoment[] = ['tie', 'foil', 'live', 'reply', 'day', 'capiz'];

export function SignatureLabStage() {
  const [run, setRun] = useState<Record<string, number>>({});
  return (
    <main data-signature-lab="" style={{ maxWidth: 420, margin: '0 auto', padding: 16, display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Signature moments</h1>
      {ORDER.map((m) => (
        <LabCard key={m} moment={m} onPlay={() => setRun((r) => ({ ...r, [m]: (r[m] ?? 0) + 1 }))}>
          <SignatureLabMoment key={run[m] ?? 0} moment={m} play={(run[m] ?? 0) > 0} />
        </LabCard>
      ))}
    </main>
  );
}

function LabCard({ moment, onPlay, children }: { moment: SignatureMoment; onPlay: () => void; children: ReactNode }) {
  const rule = SIGNATURE_RULES[moment];
  return (
    <section data-lab-moment={moment} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>{rule.name}</h2>
        <button type="button" onClick={onPlay} data-lab-play={moment} style={{ minHeight: 44, padding: '0 14px', borderRadius: 'var(--m-r-full)', border: '1px solid rgb(var(--color-ink) / 0.2)', fontSize: 13, fontWeight: 600 }}>
          Play again
        </button>
      </div>
      {children}
      <p style={{ fontSize: 12, opacity: 0.75 }}>
        {rule.once} · reduced: {rule.reduced}
      </p>
    </section>
  );
}
