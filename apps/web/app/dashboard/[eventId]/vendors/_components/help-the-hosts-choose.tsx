import { HOSTS_KEEP_THIS } from '../../_components/hosts-keep-this';
import { FindOpen } from './find-open';

/**
 * 🧭 THE COORDINATOR'S SUPPLIERS LINE (owner 2026-11-21; drawing `their_event_door_2026-11-21`, frame "4 · Suppliers":
 * *"Three things they can do: find, recommend, shortlist. No Book button, no Pay button."*). Drawn on the hosts' own
 * Suppliers page, above it, only for a viewer who is not a host. Words, one door (Find); the shortlist itself is the
 * page below. Booking and paying: "The hosts keep this".
 */
export const HELP_THE_HOSTS_CHOOSE = 'Help the hosts choose. They book and pay.';

// `eventId` stays in the props for the callers; the Find verb no longer builds an address from it.
export function HelpTheHostsChoose(_props: { eventId: string }) {
  const row = 'flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2 first:border-t-0';
  return (
    <div className="py-2" data-help-the-hosts-choose="">
      <p className="text-sm font-medium text-ink">{HELP_THE_HOSTS_CHOOSE}</p>
      <div className="mt-2">
        {/* Not a link to this same page: the shell reads `?tab=` once, so a soft navigation here moved nothing. */}
        <FindOpen className={row}>
          <span>
            <span className="block text-[15px] text-ink">Find</span>
            <span className="block text-[13px] text-ink/60">Look through shops</span>
          </span>
          <span className="text-[14px] font-medium text-sn-accent">Open</span>
        </FindOpen>
        <div className={row} data-coordinator-supplier-verb="recommend">
          <span>
            <span className="block text-[15px] text-ink">Recommend a partner</span>
            <span className="block text-[13px] text-ink/60">Send a shop you trust to the hosts</span>
          </span>
        </div>
        <div className={row} data-coordinator-supplier-verb="shortlist">
          <span>
            <span className="block text-[15px] text-ink">Add to the shortlist</span>
            <span className="block text-[13px] text-ink/60">The hosts see it in their shortlist</span>
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/55">Booking and paying</p>
      <div className={row} data-coordinator-supplier-verb="book-pay">
        <span>
          <span className="block text-[15px] text-ink">{HOSTS_KEEP_THIS}</span>
          <span className="block text-[13px] text-ink/60">Only a host can book or pay</span>
        </span>
      </div>
    </div>
  );
}
