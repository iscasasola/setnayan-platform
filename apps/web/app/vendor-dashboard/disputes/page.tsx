import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { ToolPage, ToolPin } from '../_components/tool-page';
import { DisputesView, type DisputeRow } from './_components/disputes-view';
import { keepParamsFrom } from '../_components/list-pager';
import { paginate } from '@/lib/paginate';
import { readVendorDisputes } from '@/lib/vendor-disputes-read';

export const metadata = { title: 'Disputes · Supplier' };

/**
 * /vendor-dashboard/disputes — "Stand up for yourself" mediation.
 *
 * Every dispute a couple files against you is reviewed by a NEUTRAL Setnayan
 * team BEFORE it can touch your rating. An unreviewed dispute never counts
 * toward demotion (migration 20270413204817) — the team looks at the record
 * first. This surface lets you:
 *   • SEE every dispute filed against your shop + its current status.
 *   • CONTEST an open dispute — write your side of the story; the team reads it
 *     when they adjudicate.
 *   • TRACK the outcome once the team rules.
 *
 * Reads are RLS-scoped: vendor_disputes_self_read lets you read only disputes
 * against your own profile (or ones you opened). No admin client here.
 */

type Props = {
  searchParams: Promise<{ dpage?: string; [key: string]: string | string[] | undefined }>;
};

export default async function VendorDisputesPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard/disputes')); // A6-65

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return (
      <ToolPage name="disputes">
        <ToolPin route="/vendor-dashboard/disputes" title="Disputes" />
        <p className="mt-3 text-[15px] text-[color:var(--m-slate-2)]">
          Set up your supplier profile first. If a couple ever raises a concern
          about a booking, it&rsquo;ll show up here — and a neutral Setnayan team
          reviews it before it can affect your standing.
        </p>
      </ToolPage>
    );
  }

  // RLS-scoped: only disputes filed against this vendor's profile (or opened by
  // this user). No admin client — the vendor's own session is enough.
  // Read to the END (`readVendorDisputes`), then drawn 20 at a time through the
  // shared pager. It was `.limit(200)`: the 201st dispute could not be seen,
  // so it could not be contested.
  const disputeRead = await readVendorDisputes<DisputeRow>(
    supabase,
    profile.vendor_profile_id,
  );
  const incomplete = !disputeRead.complete;
  const rows = disputeRead.rows;
  const disputesPage = paginate(rows, search.dpage);

  return (
    <DisputesView
      rows={rows}
      incomplete={incomplete}
      paged={disputesPage}
      keepParams={keepParamsFrom(search, ['dpage'])}
    />
  );
}
