import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * 🔒 "THE HOSTS KEEP THIS" — a part the booked coordinator may not open, said where the part is (owner 2026-11-21,
 * DECISION_LOG "BOOKED COORDINATOR = 'THEIR WHOLE DASHBOARD MINUS THE MEMORIES'"; drawing
 * `prototypes/their_event_door_2026-11-21/their_event_door_fable.html`, frame "5 · Memories tab": *"The tab stays in the
 * bar. It says why it is shut. No dead end, no missing tab."*).
 *
 * ⛔ NO CTA — nothing to press: the hosts keep it, and asking for it is not on the list.
 */
export const HOSTS_KEEP_THIS = 'The hosts keep this';

export const MEMORIES_KEPT_WHY = 'Photos and videos of the day belong to the hosts. Coordinators do not open them.';

export function HostsKeepThis({ title, kicker, why }: { title: string; kicker: string; why: string }) {
  return (
    <section className="sn-col space-y-6" data-hosts-keep-this="">
      <PageMasthead title={title} />
      <div className="py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{kicker}</p>
        <p className="mt-2 text-base font-semibold text-ink">{HOSTS_KEEP_THIS}</p>
        <p className="mt-1 text-sm text-ink/70">{why}</p>
      </div>
    </section>
  );
}
