import { PageMasthead } from '@/app/_components/page-masthead';
import { ApplePlanDoor, type ApplePlanDoorState } from '@/app/vendor-dashboard/subscription/_components/apple-plan-door';

/**
 * 🍎 THE APP'S PLAN DOOR LAB — the shipped `ApplePlanDoor` (Shop ⚙ › Plan and billing in the iPhone app) with fixture
 * states and no database. A browser has no StoreKit, so every price row reads the App Store's own "not answering" line
 * and every buy button stays off — exactly what the app shows when StoreKit is silent; real prices show only on a
 * device (TestFlight / sandbox).
 * `?state=new|own|down|retry|web|unread` · `&unverified=1` the 🔒 Get verified. Dark: add `dark` to <html>.
 */
const STATES: Record<string, { tier: string; state: ApplePlanDoorState; ends: string | null }> = {
  new: { tier: 'verified', ends: null, state: { status: 'ok', channel: null, apple: null } },
  own: {
    tier: 'pro',
    ends: null,
    state: { status: 'ok', channel: 'app_store', apple: { productId: 'com.setnayan.app.supplier_pro_monthly', status: 'active', endsOn: '22 Dec 2026', autoRenew: true, autoRenewProductId: 'com.setnayan.app.supplier_pro_monthly' } },
  },
  down: {
    tier: 'enterprise',
    ends: null,
    state: { status: 'ok', channel: 'app_store', apple: { productId: 'com.setnayan.app.supplier_ultra_monthly', status: 'active', endsOn: '22 Dec 2026', autoRenew: true, autoRenewProductId: 'com.setnayan.app.supplier_plus_monthly' } },
  },
  retry: {
    tier: 'pro',
    ends: null,
    state: { status: 'ok', channel: 'app_store', apple: { productId: 'com.setnayan.app.supplier_pro_monthly', status: 'billing_retry', endsOn: '22 Dec 2026', autoRenew: true, autoRenewProductId: null } },
  },
  web: { tier: 'pro', ends: '8 Dec 2026', state: { status: 'ok', channel: 'web', apple: null } },
  unread: { tier: 'verified', ends: null, state: { status: 'unread' } },
};

export default async function ApplePlanDoorLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const pick = STATES[sp.state ?? 'new'] ?? STATES.new!;
  return (
    <main className="sn-vt-page mx-auto max-w-[760px] px-4 py-6">
      <PageMasthead title="Plan and billing" />
      <div className="sn-frame mt-4 p-4">
        <p className="pb-2 text-[13.5px] text-ink/60">You&rsquo;re on {pick.tier === 'enterprise' ? 'Ultra' : pick.tier === 'pro' ? 'Pro' : pick.tier === 'solo' ? 'Plus' : 'Verified'}.</p>
        <ApplePlanDoor
          shopToken="11111111-1111-4111-8111-111111111111"
          currentTier={pick.tier}
          verified={sp.unverified !== '1'}
          papersProgress="3 of 5 papers in · then press Submit"
          planEndsOn={pick.ends}
          state={pick.state}
        />
      </div>
    </main>
  );
}
