import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, Wand2, ListChecks, CalendarHeart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { eventOwnsSku } from '@/lib/entitlements';
import { isSetnayanAiActive, isSetnayanAiPaywallEnabled } from '@/lib/setnayan-ai';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

export const metadata = { title: 'Setnayan AI · Setnayan' };

/**
 * /dashboard/[eventId]/studio/setnayan-ai — the BUY surface for the Setnayan AI
 * planner (the first paywall · catalog SETNAYAN_AI ₱3,999). This is the missing
 * purchase path the audit flagged: the entitlement chain (checkout → admin
 * approve → events.setnayan_ai_active → lib/setnayan-ai.ts gate) was fully wired,
 * but nothing let a couple actually buy SETNAYAN_AI. This page closes that.
 *
 * Three states, all driven by lib/setnayan-ai.ts (the single governing gate) so
 * this stays in lockstep with every match/ranking surface:
 *   • ACTIVE  — isSetnayanAiActive(event) → AI is on for the wedding (covers the
 *               free-during-launch case when the paywall flag is OFF, AND the
 *               paid+active case when it's ON). No buy CTA.
 *   • OWNS-BUT-OFF — has access (purchased entitlement OR a pending SETNAYAN_AI
 *               order, OR the paywall is off) but Assisted mode is toggled to
 *               Manual → nudge to switch it back on, never a second charge.
 *   • BUY     — paywall ON + not owned → the InlineCheckoutDrawer at the catalog
 *               price. Dormant until SETNAYAN_AI_PAYWALL_ENABLED=true (owner's
 *               Vercel flip), so shipping this page changes nothing live today.
 *
 * Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
 * hardcoded price); the server re-resolves the authoritative charge from the
 * catalog at order time regardless (checkout/actions.ts).
 */

const SKU_CODE = 'SETNAYAN_AI';

const WHAT_YOU_GET = [
  {
    icon: ListChecks,
    title: 'Your ranked shortlist',
    body: 'Vendors sorted by how well they fit your date, budget, location, guest count, faith and reviews — with a "% match" on each, not a generic directory.',
  },
  {
    icon: CalendarHeart,
    title: 'A plan that thinks ahead',
    body: 'Recommended and statutory deadlines, reception-proximity sorting, and a nudge when someone is eyeing your date.',
  },
  {
    icon: Wand2,
    title: 'One purchase, the whole wedding',
    body: 'Pay once for this event and Setnayan AI stays on through your wedding day. No subscription.',
  },
];

type Props = { params: Promise<{ eventId: string }> };

export default async function SetnayanAiPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, planning_mode, setnayan_ai_active')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const active = isSetnayanAiActive(event);
  const paywallOn = isSetnayanAiPaywallEnabled();

  // "Owns" = the entitlement is stamped OR a SETNAYAN_AI order (à-la-carte OR a
  // GUIDED_PACK/MEDIA_PACK bundle that includes it) is in flight (submitted /
  // awaiting / paid · not cancelled/refunded/lapsed). The bundle-aware
  // eventOwnsSku() keeps a bundle buyer from being offered a SECOND purchase in
  // the reconciliation window BEFORE activateBundleChildren() stamps
  // setnayan_ai_active. Graceful-degrades on a legacy orders table (eventOwnsSku
  // → checkOrderOwnership swallows 42P01/42703).
  const owns =
    event.setnayan_ai_active === true ||
    (await eventOwnsSku(supabase, eventId, SKU_CODE));

  // Pricing from the live V2 catalog (single source of truth). null when the
  // row is unreadable (e.g. no service-role key in CI / pre-seed) → the buy
  // block degrades gracefully instead of inventing a number.
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;

  // Only the BUY branch needs the BDO/GCash settings · fetch lazily there.
  const showBuy = !active && !owns && paywallOn;
  const settings = showBuy ? await fetchPlatformSettings(supabase) : null;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Setnayan AI
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Stop guessing who to hire
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Setnayan AI reads your date, budget, location, guest count and faith,
          then ranks every available vendor by how well they actually fit —
          turning a directory into a shortlist made for your wedding.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-xl border border-ink/10 bg-cream p-4"
          >
            <Icon aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
            <p className="mt-2 text-sm font-medium text-ink">{title}</p>
            <p className="mt-1 text-sm text-ink/65">{body}</p>
          </li>
        ))}
      </ul>

      {active ? (
        <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-mulberry">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
            Setnayan AI is on for {event.display_name ?? 'your wedding'}
          </p>
          <p className="mt-1 text-sm text-ink/65">
            Your matches are already ranked. Head to your{' '}
            <Link
              href={`/dashboard/${eventId}/vendors`}
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              vendors
            </Link>{' '}
            to see the shortlist.
          </p>
        </div>
      ) : owns || !paywallOn ? (
        <div className="rounded-xl border border-ink/10 bg-cream p-5">
          <p className="text-sm font-medium text-ink">
            Setnayan AI is available for your wedding
          </p>
          <p className="mt-1 text-sm text-ink/65">
            It&rsquo;s currently switched to manual planning. Turn Assisted
            planning back on from your{' '}
            <Link
              href={`/dashboard/${eventId}`}
              className="font-medium text-terracotta underline-offset-4 hover:underline"
            >
              planning home
            </Link>{' '}
            to get your ranked matches.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-ink/10 bg-white p-5">
          {pricePhp != null && settings ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink/65">
                One purchase, on through your wedding day ·{' '}
                <span className="font-mono text-base text-ink">
                  {formatPhp(pricePhp)}
                </span>
              </p>
              <div className="sm:w-auto">
                <InlineCheckoutDrawer
                  eventId={eventId}
                  serviceKey={SKU_CODE}
                  displayName={`Setnayan AI${event.display_name ? ` · ${event.display_name}` : ''}`}
                  originalPriceCentavos={String(Math.round(pricePhp * 100))}
                  settings={settings}
                  triggerLabel="Unlock Setnayan AI"
                  triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
                />
              </div>
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-ink/65">
              <Sparkles aria-hidden className="h-4 w-4 text-ink/40" />
              Pricing loads from your catalog &mdash; please refresh in a moment.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
