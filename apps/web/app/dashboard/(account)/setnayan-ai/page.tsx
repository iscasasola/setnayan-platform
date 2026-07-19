/**
 * /dashboard/setnayan-ai — the per-USER Setnayan AI subscription buy page.
 *
 * Setnayan AI is a per-user subscription (₱499 per 28-day cycle, owner 2026-06-29)
 * that covers ALL of a user's events — so this lives at the ACCOUNT level, not
 * under /dashboard/[eventId]. Shows the buyer's current window + a cycle picker
 * that checks out eventless via the shared drawer (subscription mode).
 *
 * DORMANT until the per-user flag (`platform_settings.setnayan_ai_per_user_enabled`)
 * is flipped at go-live (alongside flipping the SETNAYAN_AI_SUB SKU active +
 * reconciling public /pricing). While off, the page renders a "coming soon"
 * state and the buy UI is not shown — so this page is inert today.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { AI_SUB_SKU } from '@/lib/setnayan-ai-subscription';
import { computeUserAiDigest } from '@/lib/setnayan-ai-snapshot';
import { renderTemplate, WEDDING_TERMINOLOGY } from '@/lib/setnayan-ai-templates';

import { SetnayanAiSubscribe } from './_components/setnayan-ai-subscribe';

export const metadata = { title: 'Setnayan AI subscription' };

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function SetnayanAiSubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Per-user flag (the dormancy gate) + the buyer's current window.
  const admin = createAdminClient();
  const [{ data: settingsRow }, { data: subRow }, { data: skuRow }] = await Promise.all([
    admin.from('platform_settings').select('setnayan_ai_per_user_enabled').eq('id', 1).maybeSingle(),
    supabase.from('user_ai_subscription').select('active_until').eq('user_id', user.id).maybeSingle(),
    admin.from('platform_retail_catalog_v2').select('retail_price_php').eq('service_code', AI_SUB_SKU).maybeSingle(),
  ]);

  const perUserOn = settingsRow?.setnayan_ai_per_user_enabled === true;
  const activeUntil = subRow?.active_until ? new Date(subRow.active_until) : null;
  const isActive = activeUntil ? activeUntil.getTime() > Date.now() : false;
  const unitCentavos = skuRow ? Math.round(Number(skuRow.retail_price_php) * 100) : 0;

  const paymentSettings = await fetchPlatformSettings(supabase);

  // The weekly digest — only when the assistant is on AND the user is subscribed.
  // Computed from real budget data via the snapshot adapter (the money guard
  // floor today). Dormant otherwise → never rendered.
  const live = perUserOn && isActive;
  const digestResult = live ? await computeUserAiDigest(admin, user.id, new Date()) : null;

  // Plan state — the obsidian focal's headline (real data only): active window,
  // or the honest not-subscribed / coming-soon states.
  const planState = isActive ? 'Active' : perUserOn ? 'Not subscribed' : 'Coming soon';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <Link
        href="/dashboard"
        className="sn-chip sn-press -mb-2 w-fit"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to home
      </Link>
      <header className="space-y-2">
        <p className="sn-eye">
          <Sparkles aria-hidden strokeWidth={1.75} />
          Your assistant
        </p>
        <h1 className="sn-h1">
          Setnayan AI
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Your always-on planning assistant — across every event.
        </p>
      </header>

      {/* The account surface's ONE obsidian focal (§ 1.3): plan state + the
          guards Setnayan AI is holding on watch this week. Real data only —
          the guard machinery (money-guard digest) is live; when there's
          nothing to flag the watch section is simply hidden. */}
      <section className="sn-tile-dark sn-bloom flex flex-col gap-4">
        <div>
          <p className="sn-eye">
            <Sparkles aria-hidden strokeWidth={1.75} />
            Setnayan AI · your briefing
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#F3ECDF]">{planState}</p>
          {isActive && activeUntil ? (
            <p className="mt-1 text-sm text-[#CBA766]">
              Covered through <span className="font-mono">{formatDate(activeUntil)}</span>.
            </p>
          ) : perUserOn ? (
            <p className="mt-1 text-sm text-[#CBA766]/85">
              Subscribe below to put the assistant on watch across every event.
            </p>
          ) : (
            <p className="mt-1 text-sm text-[#CBA766]/85">
              The always-on subscription is on the way.
            </p>
          )}
        </div>

        {live && digestResult ? (
          <div className="border-t border-white/10 pt-4">
            <p className="sn-eye">On watch this week</p>
            {digestResult.interventions.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {digestResult.interventions.map((iv) => (
                  <li
                    key={iv.dedupeKey}
                    className="rounded-xl border border-white/12 bg-white/[0.06] p-3 text-sm text-[#F3ECDF]/90"
                  >
                    {renderTemplate(iv.templateId, iv.slots, WEDDING_TERMINOLOGY, iv.variant ?? 'default')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 whitespace-pre-line text-sm text-[#F3ECDF]/80">{digestResult.digest}</p>
            )}
          </div>
        ) : null}
      </section>

      {perUserOn ? (
        <section className="sn-tile">
          <SetnayanAiSubscribe
            unitCentavos={unitCentavos}
            settings={paymentSettings}
            alreadyActive={isActive}
          />
        </section>
      ) : (
        <section className="sn-tile">
          <p className="sn-sec">Coming soon</p>
          <p className="mt-1 text-sm text-ink/60">
            Setnayan AI as a subscription is on the way. We&rsquo;ll let you know the moment it
            opens.
          </p>
        </section>
      )}
    </div>
  );
}
