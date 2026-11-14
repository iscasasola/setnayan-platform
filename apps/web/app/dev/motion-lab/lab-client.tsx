'use client';

/** The motion lab's client half — the real shared pieces on sample words. See `page.lab.tsx`. */
import { useState } from 'react';
import { Check, Plus, Settings } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { Sheet } from '@/app/_components/sheet';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { SwitchTrack } from '@/app/_components/switch-track';

const ROWS = ['Lila Florals · Flowers', 'Tala Catering · Food', 'Sinag Photo & Film · Photo and video', 'Himig Strings · Music'];

export function MotionLabClient() {
  const [sheet, setSheet] = useState(false);
  const [rise, setRise] = useState(false);
  const [on, setOn] = useState(false);
  const [chip, setChip] = useState('All');
  return (
    <div className="space-y-6" data-motion-lab="">
      <h1 className="text-[22px] font-bold text-ink">Motion lab</h1>
      <div className="flex flex-wrap gap-2">
        <span data-lab="open-sheet" className="inline-flex">
          <ActionButton tone="brand" main icon={Plus} label="Open the sheet" onClick={() => setSheet(true)} />
        </span>
        <ActionButton tone="neutral" icon={Check} label="Second" onClick={() => undefined} />
      </div>
      <button type="button" data-lab="open-rise" onClick={() => setRise(true)} className="sn-row flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-ink/10 bg-raised px-3 text-left">
        <Settings aria-hidden className="h-5 w-5 text-ink/60" />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] text-ink">Event settings</b>
          <small className="block text-[13px] text-ink/60">Names, date, venues, parents, access</small>
        </span>
      </button>
      <div className="space-y-2">
        <Fold title="Celebrants" summary="Maria, Jose" data="lab-1">
          <p className="py-1 text-[14px] text-ink/60">The default event name reads these.</p>
          <input className="input-field" defaultValue="Maria Santos" aria-label="First" />
          <input className="input-field mt-2" defaultValue="Jose Reyes" aria-label="Second" />
        </Fold>
        <Fold title="Date" summary="Sat, 12 Dec 2026" data="lab-2">
          <p className="py-1 text-[14px] text-ink/60">Guests see this on the cover.</p>
          <input className="input-field" defaultValue="Sat, 12 Dec 2026" aria-label="Date" />
        </Fold>
        <Fold title="Venues" summary="2 venues" data="lab-3">
          <p className="py-1 text-[14px] text-ink/60">Ceremony, then reception.</p>
          <input className="input-field" defaultValue="San Agustin Church" aria-label="Ceremony" />
          <input className="input-field mt-2" defaultValue="Casa Maria Gardens" aria-label="Reception" />
        </Fold>
      </div>
      <button type="button" role="switch" aria-checked={on} onClick={() => setOn((v) => !v)} className="flex min-h-[44px] items-center gap-3" data-lab="switch">
        <SwitchTrack on={on} />
        <span className="text-[15px] text-ink">Guests can see the seat plan</span>
      </button>
      <div className="flex flex-wrap gap-2">
        {['All', 'Booked', 'Asked'].map((c) => (
          <button key={c} type="button" className={`sn-chip${chip === c ? ' selected' : ''}`} onClick={() => setChip(c)}>
            {c}
          </button>
        ))}
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} labelledById="lab-sheet-title" title="Your suppliers">
        <div className="px-5 py-3">
          <p id="lab-sheet-title" className="text-[17px] font-bold text-ink">4 booked</p>
        </div>
        {ROWS.map((r) => (
          <div key={r} className="border-b border-ink/10 px-5 py-4 text-[15px] text-ink">
            {r}
          </div>
        ))}
      </Sheet>
      {rise ? (
        <RiseScreen
          title="Event settings"
          line="Names, date, venues, parents, access"
          info="Everything about your event in one place."
          data="motion-lab"
          onClose={() => setRise(false)}
          thumb={<ActionButton tone="brand" main icon={Check} label="Apply 1 change" onClick={() => undefined} />}
        >
          <div className="px-4 pt-4 text-[13px] font-semibold uppercase tracking-wide text-ink/55">Your event</div>
          {['Event name · Maria & Jose', 'Celebrants · Maria, Jose', 'Date · Sat, 12 Dec 2026', 'Venues · 2 venues', 'Parents · 4 parents'].map((r) => (
            <div key={r} className="border-b border-ink/10 px-4 py-4 text-[15px] text-ink">
              {r}
            </div>
          ))}
        </RiseScreen>
      ) : null}
    </div>
  );
}
