import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import { ShopCard, ShopNotice, shopInputClass } from '@/app/vendor-dashboard/_components/kit';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import { othersPlace, SERVICE_REQUEST_NEW_HREF, SERVICE_REQUESTS_HREF } from '@/lib/service-requests';
import { loadMyCards, loadMyRequest, loadRequestTree, markRequestSeen } from '@/lib/service-requests.server';
import { putCardUnderRequest } from '../actions';
import { decidedOf, placeOfMine, RequestStatusPill } from '../_components/request-bits';

export const metadata = { title: 'Request · Supplier' };

type Search = { requested?: string; already?: string; placed?: string; error?: string };

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

/**
 * /vendor-dashboard/services/requests/[requestId] — one request (owner rulings 2026-11-13, ruling 4).
 *
 * Where it was filed, the shop's note, where its cards are NOW, and the "Note from Setnayan"
 * (`resolution_note`, shown to the supplier since 2026-08-11). Opening a decided request clears the
 * notice on Services. A waiting request lets the shop put a card under it; a "Not added" one keeps
 * the cards online under Others and offers "Pick the service that fits" (ruling 7).
 */
export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ requestId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = profile.vendor_profile_id as string;

  const [one, tree, cards] = await Promise.all([
    loadMyRequest(supabase, vendorProfileId, requestId),
    loadRequestTree(),
    loadMyCards(supabase, vendorProfileId),
  ]);

  const shell = (children: ReactNode) => (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-request-detail="">
      <Link href={SERVICE_REQUESTS_HREF} className="mb-3 inline-flex text-xs font-medium text-ink/70 underline underline-offset-2">
        ‹ Your requests
      </Link>
      {children}
    </div>
  );

  if (!one.ok) {
    return shell(
      <ShopNotice tone="danger" role="alert">
        <strong>Couldn&rsquo;t load this request.</strong> It is still with us.{' '}
        <Link href={`${SERVICE_REQUESTS_HREF}/${requestId}`} className="font-semibold underline underline-offset-2">
          Try again
        </Link>
      </ShopNotice>,
    );
  }
  const r = one.value;
  if (!r) {
    return shell(
      <ShopNotice tone="warn" role="status">
        That request is gone.
      </ShopNotice>,
    );
  }

  if (r.status !== 'pending') await markRequestSeen(supabase, vendorProfileId, r.request_id);

  const category = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? null : null;
  const group = r.tile_id ? tree?.groupOf.get(r.tile_id) ?? null : null;
  const place = placeOfMine(r, tree);
  const mineHere = cards.ok ? cards.value.filter((c) => c.category_request_id === r.request_id) : [];
  const free = cards.ok ? cards.value.filter((c) => !c.category_request_id) : [];
  const sameNameOthers = sp.requested ? await otherShopsAskingSameName(r.proposed_label, vendorProfileId) : null;

  return shell(
    <>
      {sp.requested ? (
        <ShopNotice tone="success" role="status" className="mb-4">
          <strong>You&rsquo;re in.</strong> “{r.proposed_label}” is with us. Until we decide, your shop is listed under{' '}
          <b>
            {group ? `${group} › ` : ''}
            {othersPlace(category)}
          </b>
          .
          {sameNameOthers !== null
            ? sameNameOthers > 0
              ? ` ${sameNameOthers} other shop${sameNameOthers === 1 ? '' : 's'} asked for this too — the more who ask, the sooner it is its own service.`
              : ' You are the first to ask for this name.'
            : ''}
        </ShopNotice>
      ) : null}
      {sp.already ? (
        <ShopNotice tone="gold" role="status" className="mb-4">
          You already asked for “{r.proposed_label}” — it is the same request, still waiting.
        </ShopNotice>
      ) : null}
      {sp.placed ? (
        <ShopNotice tone="success" role="status" className="mb-4">
          Your card now shows under <b>{place}</b>.
        </ShopNotice>
      ) : null}
      {sp.error ? (
        <ShopNotice tone="danger" role="alert" className="mb-4">
          {sp.error}
        </ShopNotice>
      ) : null}

      <p className="sn-eye">{dateFmt.format(new Date(r.created_at))}</p>
      <PageMasthead title={r.proposed_label} />
      <div className="-mt-2 mb-4">
        <RequestStatusPill status={r.status} movedTo={decidedOf(r, tree)?.serviceLabel ?? null} />
      </div>

      <ShopCard>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink/60">Filed under</dt>
          <dd className="text-ink">{category ? `${group ? `${group} › ` : ''}${category}` : 'No category picked'}</dd>
          {r.proposed_note ? (
            <>
              <dt className="text-ink/60">Your note</dt>
              <dd className="text-ink">{r.proposed_note}</dd>
            </>
          ) : null}
          <dt className="text-ink/60">Your cards</dt>
          <dd className="text-ink" data-request-cards="">
            {r.cards === null ? (
              'Couldn’t count them right now'
            ) : (
              <>
                {r.cards} card{r.cards === 1 ? '' : 's'} · now under <b>{place}</b>
              </>
            )}
          </dd>
        </dl>
        {r.resolution_note ? (
          <div className="mt-3 rounded-xl bg-cream/70 p-3 text-sm text-ink" data-setnayan-note="">
            <b>Note from Setnayan</b>
            <br />
            {r.resolution_note}
          </div>
        ) : null}
        {r.status === 'pending' ? (
          <p className="mt-3 rounded-xl bg-ink/[0.03] p-3 text-sm text-ink/70">
            We review requests within two working days. Nothing to do on your side.
          </p>
        ) : null}
      </ShopCard>

      {mineHere.length > 0 ? (
        <ul className="mt-4 divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm">
          {mineHere.map((c) => (
            <li key={c.vendor_service_id} className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{c.title ?? 'Untitled card'}</span>
                <span className="block truncate text-[12.5px] text-ink/60">{place}</span>
              </span>
              <span className="text-[12px] text-ink/60">{c.is_active ? 'Online' : 'Draft'}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {r.status === 'pending' && cards.ok && free.length > 0 ? (
        <form action={putCardUnderRequest} className="mt-4 flex flex-wrap items-end gap-2" data-put-card="">
          <input type="hidden" name="request_id" value={r.request_id} />
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[13px] font-medium text-ink/75">Put a card under {othersPlace(category)}</span>
            <select name="vendor_service_id" required className={`${shopInputClass} w-full min-h-11`} defaultValue="">
              <option value="" disabled>
                Choose one of your cards
              </option>
              {free.map((c) => (
                <option key={c.vendor_service_id} value={c.vendor_service_id}>
                  {c.title ?? 'Untitled card'}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton className="button-primary min-h-11" pendingLabel="Placing…">
            Put it here
          </SubmitButton>
        </form>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {r.status === 'pending' ? (
          <Link href={SERVICE_MAKER_HREF} className="button-primary inline-flex min-h-11 items-center">
            Make a card now
          </Link>
        ) : null}
        {r.status === 'rejected' ? (
          <Link href={SERVICE_MAKER_HREF} className="button-primary inline-flex min-h-11 items-center" data-pick-the-service="">
            Pick the service that fits
          </Link>
        ) : null}
        <Link href="/vendor-dashboard/shop" className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink">
          See your cards
        </Link>
        {r.status === 'rejected' ? (
          <Link href={SERVICE_REQUEST_NEW_HREF} className="inline-flex min-h-11 items-center rounded-full border border-terracotta px-5 text-sm font-semibold text-terracotta-700">
            Request a different name
          </Link>
        ) : null}
      </div>
    </>,
  );
}

/**
 * How many OTHER shops are waiting on the same name — a count only, never a name (the supplier's
 * session cannot read another shop's request, and must not). Null when unreadable: then the line is
 * simply not said.
 */
async function otherShopsAskingSameName(label: string, vendorProfileId: string): Promise<number | null> {
  try {
    const exact = label.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await createAdminClient()
      .from('taxonomy_category_requests')
      .select('proposed_by_vendor_id')
      .eq('status', 'pending')
      .ilike('proposed_label', exact)
      .neq('proposed_by_vendor_id', vendorProfileId);
    if (error) return null;
    return new Set(((data ?? []) as Array<{ proposed_by_vendor_id: string }>).map((d) => d.proposed_by_vendor_id)).size;
  } catch {
    return null;
  }
}
