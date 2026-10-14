import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import Link from 'next/link';
import { studioHubHref } from '@/lib/studio-hub';
import { redirect } from 'next/navigation';
import { ArrowLeft, Banknote, Flag, ListChecks, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveSetnayanAiDisplayPricePhp } from '@/lib/setnayan-ai-server';
import { eventOwnsSku } from '@/lib/entitlements';
import { isSetnayanAiActiveForEvent } from '@/lib/setnayan-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  resolveSetnayanAiPaywallEnabled,
} from '@/lib/integration-config';
import { loadAiActivity } from '@/lib/setnayan-ai-activity';
import { resolveProfile } from '@/lib/event-type-profile';
import { SetnayanAiValue } from './_components/setnayan-ai-value';
import type { AiValueTerms } from './_components/setnayan-ai-value-copy';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ServicePageBand, ServiceSection, ServiceListRow, ServiceQuietLink } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';
import { PlanMyselfSwitch } from '@/app/dashboard/[eventId]/launch/_components/plan-myself';
import { planMyselfOn } from '@/lib/plan-myself';
import { plannerGlance, serviceDayOf } from '@/lib/services-glance';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { isStoreShellRequest } from '@/lib/request-platform';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import type { ServiceMood } from '@/lib/service-glance';

export const metadata = { title: 'Setnayan AI' };

/**
 * /dashboard/[eventId]/studio/setnayan-ai — the BUY surface for the Setnayan AI
 * planner (the first paywall · catalog SETNAYAN_AI, a single ₱1,499 ONE-TIME
 * permanent unlock · owner FINAL 2026-07-12, per-event-pricing flag OFF since
 * 20270714262264; supersedes the ₱499 entry / ₱4,999 event-pass split, the
 * earlier ₱499/28-day subscription framing and the ₱3,999 one-time). This is
 * the purchase path the audit flagged: the
 * entitlement chain (checkout → admin approve → events.setnayan_ai_active →
 * lib/setnayan-ai.ts gate) was fully wired, but nothing let a couple actually
 * buy SETNAYAN_AI. This page closes that.
 *
 * One-time model: a single up-front charge (manual apply-then-pay) unlocks
 * Setnayan AI for the WHOLE wedding — activation stamps events.setnayan_ai_active
 * permanently, with no renewal, no 28-day cycle and no lapsing window.
 *
 * 🔒 PER EVENT, FULL STOP (owner 2026-08-01: "it is per event"). The dormant
 * SETNAYAN_AI_SUB — a ₱499/28d per-USER recurring door that would have unlocked
 * every event its buyer hosted — was DELETED, along with its table, flag and
 * activation writer. Buying here unlocks THIS event and no other. Recurring
 * auto-renew, if it ever returns, is a per-event renewal.
 *
 * Three states, all driven by lib/setnayan-ai.ts (the single governing gate) so
 * this stays in lockstep with every match/ranking surface:
 *   • ACTIVE  — isSetnayanAiActive(event) → AI is on for the wedding (covers the
 *               free-during-launch case when the paywall flag is OFF, AND the
 *               paid+active case when it's ON). No buy CTA.
 *   • OWNS-BUT-OFF — has access (purchased entitlement OR a pending SETNAYAN_AI
 *               order, OR the paywall is off) but Assisted mode is toggled to
 *               Manual → nudge to switch it back on, never a second charge.
 *   • BUY     — paywall ON + not owned → the band's "Add for ₱…" → the one Add
 *               sheet → the order is minted → /pay (owner 2026-10-14 🧩 5), at the
 *               catalog price. Dormant until SETNAYAN_AI_PAYWALL_ENABLED=true (owner's
 *               Vercel flip), so shipping this page changes nothing live today.
 *
 * Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
 * hardcoded price); the server re-resolves the authoritative charge from the
 * catalog at order time regardless (checkout/actions.ts).
 */

const SKU_CODE = 'SETNAYAN_AI';

type Props = { params: Promise<{ eventId: string }>; searchParams?: Promise<{ buy_error?: string }> };

/** A supplier's state on the shortlist, as a chip — the cockpit's own "booked" set. */
const BOOKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
function shortlistChip(v: { status: string | null; lock_request_state?: string | null }): { mood: ServiceMood | 'off'; words: string } {
  if (v.status && BOOKED.has(v.status)) return { mood: 'ok', words: 'Booked' };
  if (v.lock_request_state === 'pending') return { mood: 'wait', words: 'Asked to book' };
  if (v.status === 'quoted' || v.status === 'quote_received') return { mood: 'wait', words: 'Quote in' };
  return { mood: 'off', words: 'Saved' };
}
const shortDate = (d: Date) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', day: 'numeric', month: 'short' }).format(d);

export default async function SetnayanAiPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = (await searchParams) ?? {};

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, planning_mode, setnayan_ai_active, setnayan_ai_active_until, event_date, event_date_precision, event_type, ceremony_type, cleared_at, timezone, event_end_date',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const eventType = (event as { event_type?: string | null }).event_type ?? 'wedding';

  // Capability copy is per event type (2026-07-28). Previously this page derived
  // ONE word from a `=== 'wedding'` ternary while every capability body stayed
  // frozen wedding prose — so a birthday was promised PH marriage paperwork
  // tracking, and a corporate event was told "another COUPLE is eyeing your
  // date". Now the profile supplies the terminology, and statutoryPackKey
  // ('ph_marriage' on wedding, NULL on all 12 other seeded types) gates the
  // license/Pre-Cana/PSA clause — derived, never named by type.
  const profile = await resolveProfile(eventType);
  const aiValueTerms: AiValueTerms = {
    eventWord: profile.terminology.eventWord,
    organizerNoun: profile.terminology.organizerNoun,
    hasStatutoryPaperwork: profile.statutoryPackKey != null,
  };

  // DB-first paywall flag (Integration Activation Console — flips without a
  // redeploy); env-fallback when unset. Resolved once, threaded into the gate.
  const paywallOn = await resolveSetnayanAiPaywallEnabled();
  /* The ENTITLEMENT — "Plan it myself" only rests it, so the sections still show what it keeps. */
  const entitled = isSetnayanAiActiveForEvent({ ...event, planning_mode: 'guided' }, { paywallEnabled: paywallOn });

  // ACTIVE-only: the live per-event activity snapshot the "keeping for you"
  // surface renders (cockpit briefing + tracked-deadline + payment-due figures).
  // Skipped for the buy/paused states, which show the static value pitch. Every
  // query inside fail-softs, so this never blocks the page.
  const activity = entitled
    ? await loadAiActivity(supabase, eventId, {
        eventDate: (event as { event_date?: string | null }).event_date ?? null,
        eventDatePrecision:
          (event as { event_date_precision?: string | null }).event_date_precision ?? null,
        eventType,
        ceremonyType: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
      })
    : null;

  // "Owns" = the entitlement is stamped OR a SETNAYAN_AI order (à-la-carte OR a
  // GUIDED_PACK/MEDIA_PACK bundle that includes it) is in flight (submitted /
  // awaiting / paid · not cancelled/refunded/lapsed). The bundle-aware
  // eventOwnsSku() keeps a bundle buyer from being offered a SECOND purchase in
  // the reconciliation window BEFORE activateBundleChildren() stamps
  // setnayan_ai_active. Graceful-degrades on a legacy orders table (eventOwnsSku
  // → checkOrderOwnership swallows 42P01/42703).
  const owns =
    event.setnayan_ai_active === true ||
    (await eventOwnsSku(await eventEntitlementClient(eventId), eventId, SKU_CODE));

  // Per-EVENT-TYPE pricing (owner-locked 2026-07-22): the price is this event
  // type's tier on the load ladder — ₱1,499 Wedding · ₱899 Debut/Corporate ·
  // ₱499 standard · ₱99 light · ₱0 no-vendors — resolved from the catalog (never
  // hardcoded; last-resort fallback in lib/setnayan-ai-type-pricing.ts). The
  // order still charges SETNAYAN_AI (the entitlement). Tier E (no vendors) → 0 →
  // no buy shown; any unreadable read → 0 → the buy block degrades gracefully.
  //
  // ⚠ RESOLVED THROUGH THE SHARED SWITCH (2026-07-30). This used to call
  // `resolveSetnayanAiTypePricePhp` directly and UNGATED, while the charge path
  // takes the per-type branch only when `setnayan_ai_per_event_pricing_enabled` is
  // on. With the flag OFF that showed a `date` host ₱99 and charged ₱1,499 — a
  // mismatch in the customer's disfavour. `resolveSetnayanAiDisplayPricePhp` makes
  // one switch decide both, so the shown and charged prices cannot disagree in
  // either flag state. (The comment previously here claimed checkout re-resolves
  // this amount unconditionally. It did not.)
  const typePricePhp = await resolveSetnayanAiDisplayPricePhp(supabase, eventType).catch(
    () => 0,
  );
  const pricePhp = typePricePhp > 0 ? typePricePhp : null;
  /*
    ✅ THE PLANNER'S ONE BAND (owner "approve all", 2026-10-14 — services
    prototype): the same glance Home's row reads. "On" is the ENTITLEMENT — the
    paywall off, or the event bought it; "Plan it myself" only rests it (the
    band says so). Bought and waiting for approval: "Waiting for payment".
  */
  const phase = event.event_date
    ? getMenuLifecyclePhase(
        event.event_date as string,
        (event as { cleared_at?: string | null }).cleared_at ?? null,
        (event as { timezone?: string | null }).timezone ?? undefined,
        undefined,
        (event as { event_end_date?: string | null }).event_end_date ?? null,
      )
    : 'plan';
  const manual = planMyselfOn((event as { planning_mode?: string | null }).planning_mode ?? null);
  const glance = plannerGlance({
    ownership: entitled ? 'on' : owns ? 'waiting' : 'none',
    price: pricePhp,
    day: serviceDayOf(phase),
    suppliers: activity ? activity.vendorsTracked : null,
    paymentsDue30d: activity ? activity.paymentsDue30d : null,
    manual,
  });
  const on = glance.ownership === 'on';
  const storeShell = await isStoreShellRequest();
  const shortlist = activity?.shortlist ?? [];
  const payments = activity?.paymentsSoon ?? [];
  const deadlines = activity?.cockpit.upcoming ?? [];

  return (
    <section className="space-y-6">
      <Link
        href={studioHubHref(eventId)}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <PageMasthead title="Planner · Setnayan AI" />

      <div>
        <ServicePageBand eventId={eventId} glance={glance} label="Your Planner" storeShell={storeShell} buyError={search.buy_error ?? null} />

        {/* ✅ THE SECTIONS AS DRAWN (prototype `sections('ai')`): each row a door with its state
            as a chip; not added → dim, so the couple sees what it gives before paying. */}
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
      </div>

      {/* What it gives, for a couple who has not added it — the shipped preview grid. */}
      {!on ? <SetnayanAiValue mode="preview" terms={aiValueTerms} /> : null}
    </section>
  );
}
