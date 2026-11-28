import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { isStoreShellRequest } from '@/lib/request-platform';
import { storeShellRefusesPayable, STORE_SHELL_WEB_ONLY_PATH } from '@/lib/store-shell';

/**
 * Every answer /pay gives that is not the pay page — sign in, sign up (an anonymous draft session), "not yours / not
 * real" (404) and the store shell's /web-only — decided by `./layout.tsx` BEFORE `./loading.tsx` streams, so none of
 * them is sent as a 200, a skeleton and a client hop. `cache()`: one set of reads per request; the page asks again.
 *
 * The store-shell refusal reads only what the order IS (a booking fee, a gift on the bill), never its status, so it is
 * decided here on the first read — before the page's Maya re-check, which needs `?maya=` and so cannot run in a layout.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gatePayPage = cache(async (reference: string) => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));
  // An anonymous draft session is not an account. Couple checkout already
  // refuses one before it will mint an order (it sends them to sign up), and a
  // payment page must not be the one door that takes money from a session the
  // buyer can lose by closing the tab.
  if (user.is_anonymous) {
    redirect('/signup?next=' + encodeURIComponent(`/pay/${reference}`));
  }

  const payable = await fetchPayableByReference(
    supabase,
    decodeURIComponent(reference),
    // Who is looking decides the way out — a shop paying its own booking fee
    // must not be pointed at the couple's dashboard. See lib/pay-back-link.ts.
    user.id,
  );
  // Not yours and not real are the same answer on purpose — see the resolver.
  if (!payable) notFound();

  // 🔒 THE STORE SHELL PAYS ONLY FOR REAL-WORLD SERVICES. This page takes money
  // for every order — a supplier's booking fee AND every Setnayan digital SKU —
  // so middleware cannot refuse it by path. Here, with the order in hand, the
  // App Store / Play Store shell is sent to /web-only for anything that is not
  // a booking fee (guideline 3.1.1; lib/store-shell.ts). Desktop is unaffected.
  if (storeShellRefusesPayable(payable, await isStoreShellRequest())) {
    redirect(STORE_SHELL_WEB_ONLY_PATH);
  }
  return { supabase, user, payable };
});
