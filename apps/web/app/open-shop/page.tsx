import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, CalendarDays, Store, Users } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { becomeVendor } from './actions';

/**
 * /open-shop — the ONE smart entry point behind every "Register your business"
 * CTA (owner gap-fix 2026-07-03). Routes by state:
 *
 *   • logged OUT            → /signup?as=vendor (account + shop in one go)
 *   • logged in, owns shop  → /vendor-dashboard/shop
 *   • logged in, no shop    → this page: a one-button confirm that provisions
 *                             the shop (becomeVendor) and lands on My Shop,
 *                             where the profile checklist + Get-verified
 *                             journey take over as the onboarding.
 *
 * Before this route, the nav popup's button pointed at the /for-vendors pitch
 * page and logged-in accounts had NO way to become a vendor at all (shops were
 * only created by the signup trigger).
 */

export const metadata = { title: 'Open your shop · Setnayan' };

export default async function OpenShopPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/signup?as=vendor');

  // Already owns a shop → straight in (own-row read passes RLS).
  const { data: owned } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (owned) redirect('/vendor-dashboard/shop');

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div
        className="w-full max-w-lg rounded-2xl border p-8"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        <span
          aria-hidden
          className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        >
          <Store className="h-6 w-6" strokeWidth={1.75} />
        </span>

        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--m-ink)' }}>
          Open your shop on Setnayan
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--m-slate)' }}>
          Your account stays the same — this adds the vendor doorway. Free during launch.
        </p>

        <ul className="mt-5 space-y-2.5 text-sm" style={{ color: 'var(--m-slate)' }}>
          <li className="flex items-start gap-2.5">
            <Users className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden style={{ color: 'var(--m-orange-2)' }} />
            A business profile couples can find and message
          </li>
          <li className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden style={{ color: 'var(--m-orange-2)' }} />
            Bookings, calendar, and your own team
          </li>
          <li className="flex items-start gap-2.5">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden style={{ color: 'var(--m-orange-2)' }} />
            A path to the Verified badge — couples message verified shops first
          </li>
        </ul>

        {error ? (
          <p
            className="mt-4 rounded-lg border p-3 text-xs"
            style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form action={becomeVendor} className="mt-6">
          <SubmitButton
            className="button-primary w-full justify-center py-2.5 text-sm"
            pendingLabel="Opening your shop…"
          >
            Open my shop — free
          </SubmitButton>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--m-slate-3)' }}>
          <Link href="/for-vendors" className="inline-flex items-center gap-1 font-medium text-terracotta hover:underline">
            See what vendors get
            <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </p>
      </div>
    </main>
  );
}
