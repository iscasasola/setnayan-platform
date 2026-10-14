import { Banknote, Flag, ListChecks, Settings2 } from 'lucide-react';
import { ServiceSection, ServiceListRow, ServiceChip, ServiceQuietLink } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';
import { PlanMyselfSwitch } from '@/app/dashboard/[eventId]/launch/_components/plan-myself';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import type { ServiceMood } from '@/lib/service-glance';
import type { VendorCategory } from '@/lib/vendors';

/** A supplier's state on the shortlist, as a chip — the cockpit's own "booked" set. */
const BOOKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
function shortlistChip(v: { status: string | null; lock_request_state?: string | null }): { mood: ServiceMood | 'off'; words: string } {
  if (v.status && BOOKED.has(v.status)) return { mood: 'ok', words: 'Booked' };
  if (v.lock_request_state === 'pending') return { mood: 'wait', words: 'Asked to book' };
  if (v.status === 'quoted' || v.status === 'quote_received') return { mood: 'wait', words: 'Quote in' };
  return { mood: 'off', words: 'Saved' };
}
const shortDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(',', '');

/**
 * ✅ THE PLANNER PAGE'S SECTIONS (owner "approve all", 2026-10-14 — services
 * prototype `sections('ai')`): Your shortlist · Payments · Deadlines · Plan it
 * myself (ONE row). Each row is a door with its state as a chip; not added →
 * dim, so the couple sees what it gives before paying. Pure of reads: the page
 * hands in what `loadAiActivity` already read (the dev lab hands in samples).
 */
export function PlannerSections({
  eventId,
  on,
  manual,
  shortlist,
  payments,
  deadlines,
}: {
  eventId: string;
  on: boolean;
  manual: boolean;
  shortlist: ReadonlyArray<{ vendor_id: string; vendor_name: string; category: VendorCategory; status: string | null; lock_request_state?: string | null }>;
  payments: ReadonlyArray<{ id: string; title: string; subtitle: string; date: Date; href?: string }>;
  deadlines: ReadonlyArray<{ id: string; label: string; daysOut: number | null; when: string; href?: string }>;
}) {
  return (
    <div className="mt-2">
      <ServiceSection
        icon={<ListChecks strokeWidth={1.9} />}
        title="Your shortlist"
        sub={on ? (shortlist.length === 0 ? 'Nothing yet · add a supplier' : `${shortlist.length} ${shortlist.length === 1 ? 'supplier' : 'suppliers'} ranked`) : 'Ranks every supplier you shortlist'}
        end={on ? <ServiceQuietLink href={`/dashboard/${eventId}/vendors`} label="Open" /> : null}
        dim={!on}
      >
        {on && shortlist.length > 0 ? (
          shortlist.slice(0, 5).map((v) => {
            const chip = shortlistChip(v);
            return (
              <ServiceListRow
                key={v.vendor_id}
                who={`${VENDOR_CATEGORY_LABEL[v.category] ?? 'Supplier'} · ${v.vendor_name}`}
                mood={chip.mood}
                words={chip.words}
                href={`/dashboard/${eventId}/vendors`}
              />
            );
          })
        ) : !on ? (
          <p className="m-0 text-[13px] text-ink/60">Price, distance and reviews, side by side.</p>
        ) : null}
      </ServiceSection>

      <ServiceSection
        icon={<Banknote strokeWidth={1.9} />}
        title="Payments"
        sub={on ? (payments.length === 0 ? 'Nothing due in 30 days' : `${payments.length} due in 30 days`) : 'Watches every due date'}
        dim={!on}
      >
        {on && payments.length > 0
          ? payments.slice(0, 4).map((p) => (
              <ServiceListRow
                key={p.id}
                who={p.subtitle ? `${p.title} · ${p.subtitle}` : p.title}
                mood="wait"
                words={`Due ${shortDate(p.date)}`}
                href={p.href ?? `/dashboard/${eventId}/vendors?part=budget`}
              />
            ))
          : null}
      </ServiceSection>

      <ServiceSection
        icon={<Flag strokeWidth={1.9} />}
        title="Deadlines"
        sub={on ? (deadlines.length === 0 ? 'Nothing coming up' : `${deadlines.length} watched`) : 'Reminds you before each'}
        dim={!on}
      >
        {on && deadlines.length > 0
          ? deadlines.slice(0, 4).map((d) => (
              <ServiceListRow
                key={d.id}
                who={d.label}
                mood={d.daysOut !== null && d.daysOut < 0 ? 'low' : 'wait'}
                words={d.when}
                href={d.href ?? `/dashboard/${eventId}/checklist`}
              />
            ))
          : null}
      </ServiceSection>

      {/* A setting is ONE row — the ONE "Plan it myself" switch (Event Details carries the same
          component; one form, one action: plan-myself.tsx). Free for every host (owner d4). */}
      <ServiceSection
        icon={<Settings2 strokeWidth={1.9} />}
        title="Plan it myself"
        sub="You run the checklist · the Planner rests"
        end={<PlanMyselfSwitch eventId={eventId} on={manual} compact />}
      />
    </div>
  );
}
