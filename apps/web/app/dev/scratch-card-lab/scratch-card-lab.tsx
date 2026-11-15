'use client';
import { useState } from 'react';
import { ScratchCard } from '@/app/_components/scratch-card';

/** The thing under the cover — a sample, so the lab needs no real gift. */
function Underneath({ words }: { words: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-2xl bg-surface p-6 text-center text-base font-semibold text-ink">
      {words}
    </div>
  );
}

export function ScratchCardLab() {
  const [done, setDone] = useState<string[]>([]);
  const [shown, setShown] = useState(false);
  const finished = (what: string) => setDone((d) => (d.includes(what) ? d : [...d, what]));

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-6" data-scratch-lab="">
      <h1 className="text-lg font-semibold">Scratch card lab</h1>

      <section className="space-y-2" aria-label="The gold cover">
        <ScratchCard onComplete={() => finished('gold')} className="h-44 w-full">
          <Underneath words="A gift from Petal & Pine" />
        </ScratchCard>
      </section>

      <section className="space-y-2" aria-label="Revealed from outside">
        <ScratchCard revealed={shown} onComplete={() => finished('controlled')} className="h-44 w-full">
          <Underneath words="Shown by the button" />
        </ScratchCard>
        <button type="button" className="fd-btn-quiet" onClick={() => setShown(true)} data-scratch-lab-reveal="">
          Reveal it
        </button>
      </section>

      <section className="space-y-2" aria-label="Disabled">
        <ScratchCard disabled className="h-44 w-full">
          <Underneath words="This one stays covered" />
        </ScratchCard>
      </section>

      <p className="text-sm text-ink/70" data-scratch-lab-done={done.join(',')}>
        {done.length ? `Revealed: ${done.join(', ')}` : 'Nothing revealed yet.'}
      </p>
    </main>
  );
}
