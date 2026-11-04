/**
 * /dev/home-lab?view=offline&schedule=1 — 📅 "Your schedule", saved for no signal, on fixture data (no database, no
 * phone storage): a guest's Event Hub › Me card (the REAL `YourScheduleCard`, after Release) and a supplier's Schedule
 * tab, each wearing the saved mark in the state `&state=ok|nosignal|stale|failed|saving|none|amber` asks for. A server
 * component, so the card adds nothing to any client bundle; only the mark (`LabScheduleMark`) runs in the browser.
 * DEV-ONLY with the rest of home-lab.
 */
import { YourScheduleCard } from '@/app/[slug]/_components/your-schedule-card';
import { labYourSchedule } from '@/app/dev/me-lab/lab-your-schedule';
import { OFFLINE_COPY_UNREAD, copyVersionOf } from '@/lib/offline-copies';

import { LabScheduleMark } from './offline-lab';

export function OfflineScheduleLab({ state }: { state?: string }) {
  const read = labYourSchedule({ schedule: 'bridesmaid', released: '1' });
  const version = read?.kind === 'ok' ? copyVersionOf(read.schedule) : OFFLINE_COPY_UNREAD;
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl space-y-8 bg-cream px-4 pb-28 pt-4" data-lab-offline="" data-lab-schedule="">
      <section aria-label="Guest · Event Hub › Me">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Guest · Event Hub › Me · Your schedule</p>
        <YourScheduleCard read={read} eventName={'Ana & Ben'} saved={<LabScheduleMark state={state} version={version} />} />
      </section>
      <section aria-label="Supplier · Customer › Schedule" className="border-t border-ink/10 pt-6">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Supplier · Host / MC · Customer › Schedule</p>
        <LabScheduleMark state={state} version="lab" className="mb-3" />
        <p className="text-sm text-ink/60">The supplier&rsquo;s Schedule tab draws here, unchanged.</p>
      </section>
    </div>
  );
}
