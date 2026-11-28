import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Every answer a quote's page gives that is not the quote — sign in, and "not yours" (404) — decided by `./layout.tsx`
 * BEFORE `./loading.tsx` streams, so a 307 / 404 is never sent as a 200, a skeleton and a client hop. A REFUSED read
 * is neither: it draws "We couldn't open this quote" (200), in the layout and the page alike.
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateProposal = cache(async (publicId: string) => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // RLS is the gate: vendor org OR couple/delegate (non-draft) — anyone else
  // sees nothing and gets a 404.
  // 🔑 AN RLS DENIAL AND A REFUSED READ ARE DISTINGUISHABLE HERE, and the
  // difference is the whole point. `maybeSingle()` returns `{ data: null,
  // error: null }` when RLS filtered the row away — that is the designed 404,
  // "not yours". A REJECTED query sets `error`, and answering that with the
  // same 404 tells the recipient of a quote somebody sent them that it does not
  // exist. It does exist; we could not read it.
  const { data, error: proposalError } = await supabase
    .from('vendor_proposals')
    .select(
      'proposal_id, public_id, vendor_profile_id, event_id, title, merge_snapshot, rendered_body, rendered_terms, line_items, total_centavos, payment_schedule, payment_method_ids, status, valid_until, sent_at, resolved_at, created_at, includes_setnayan_gift',
    )
    .eq('public_id', publicId)
    .maybeSingle();
  if (proposalError) {
    console.error('[proposals] proposal read refused', proposalError);
    return { refused: true as const };
  }
  if (!data) notFound();
  return { refused: false as const, supabase, user, data };
});

/** A refused read — never the 404: the recipient of a quote must not be told it does not exist. */
export function ProposalUnreadable() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">We couldn&rsquo;t open this quote</h1>
      <p className="mt-3 text-sm text-ink/70">
        Something went wrong reading it — this is <strong>not</strong> a sign the quote
        was withdrawn or that the link is wrong. Please reload in a moment; if it keeps
        happening, ask whoever sent it to re-send.
      </p>
    </main>
  );
}
