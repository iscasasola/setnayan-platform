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
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { AI_SUB_SKU } from '@/lib/setnayan-ai-subscription';

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-ink">Setnayan AI</h1>
          <p className="text-sm text-ink/60">
            Your always-on planning assistant — across every event.
          </p>
        </div>
      </header>

      {isActive && activeUntil && (
        <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-4">
          <p className="text-sm font-medium text-ink">Your subscription is active.</p>
          <p className="mt-1 text-xs text-ink/60">Covered through {formatDate(activeUntil)}.</p>
        </div>
      )}

      {perUserOn ? (
        <section className="rounded-2xl border border-ink/10 bg-white p-5">
          <SetnayanAiSubscribe
            unitCentavos={unitCentavos}
            settings={paymentSettings}
            alreadyActive={isActive}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-ink/10 bg-cream p-5">
          <p className="text-sm font-medium text-ink">Coming soon.</p>
          <p className="mt-1 text-sm text-ink/60">
            Setnayan AI as a subscription is on the way. We&rsquo;ll let you know the moment it
            opens.
          </p>
        </section>
      )}
    </div>
  );
}
