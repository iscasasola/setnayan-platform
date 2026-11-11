import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlsForPrivateStoredAssets } from '@/lib/uploads';
import { disputeEvidencePolicy } from '@/lib/r2-client-ref';
import { sweepEscalateStaleFlags } from '@/lib/force-majeure';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FlagCard, NewFlagForm, type EventVendorRow, type FlagRow } from './_components/dispute-parts';

export const metadata = { title: 'Disputes' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ filed?: string; error?: string }>;
};

export default async function CoupleDisputesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Per the no-cron lock (PR #47, 2026-05-14): every couple pageview
  // sweeps stale `open` / `under_review` flags past their 7-day window.
  // Uses the admin client because RLS restricts UPDATE to admins.
  await sweepEscalateStaleFlags(createAdminClient());

  const [flagsRes, vendorsRes] = await Promise.all([
    supabase
      .from('force_majeure_flags')
      .select(
        'flag_id, public_id, event_vendor_id, flag_type, description, evidence_urls, status, resolution_notes, auto_resolve_at, resolved_at, created_at',
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, status')
      .eq('event_id', eventId)
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'shortlisted'])
      .order('vendor_name', { ascending: true }),
  ]);

  const flags = (flagsRes.data ?? []) as FlagRow[];
  const vendors = (vendorsRes.data ?? []) as EventVendorRow[];

  // Build a lookup so flag rows can show the affected vendor's name.
  const vendorById = new Map<string, EventVendorRow>(
    vendors.map((v) => [v.vendor_id, v]),
  );

  // Pre-resolve every flag's evidence URLs. Legacy http(s) URLs pass through
  // unchanged; new r2:// refs get a 24h presigned GET. The map is keyed by
  // flag_id so `<FlagCard>` can look up the resolved hrefs without
  // smuggling secrets back through React state.
  const evidenceUrlMap: Record<string, string[]> = {};
  await Promise.all(
    flags.map(async (f) => {
      if (!f.evidence_urls?.length) return;
      // 🔒 Evidence lives in the PRIVATE thread-files bucket; signed only from
      // THIS event's `events/<id>/disputes/` folder (the uploader's own).
      evidenceUrlMap[f.flag_id] = await displayUrlsForPrivateStoredAssets(
        f.evidence_urls,
        disputeEvidencePolicy(eventId),
      );
    }),
  );

  return (
    <section className="sn-col space-y-6">
      <PageMasthead
        titleNode={
          <span>
            <span>
              <AlertTriangle aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Disputes
          </span>
        }
      />

      {search.filed ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50/80 px-4 py-3 text-sm text-success-900"
        >
          Flag filed. We&rsquo;ll be in touch — track its status below.
        </p>
      ) : null}
      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {search.error}
        </p>
      ) : null}

      <NewFlagForm eventId={eventId} vendors={vendors} />

      <section aria-labelledby="existing-flags" className="space-y-3">
        <h2
          id="existing-flags"
          className="sn-eye"
        >
          Existing flags ({flags.length})
        </h2>
        {flags.length === 0 ? (
          <div className="sn-row border-dashed p-8 text-center text-sm text-ink/55">
            No disputes on record. Open one above when something goes
            sideways.
          </div>
        ) : (
          <ul className="space-y-3">
            {flags.map((f) => (
              <FlagCard
                key={f.flag_id}
                flag={f}
                vendor={vendorById.get(f.event_vendor_id ?? '') ?? null}
                resolvedEvidenceUrls={evidenceUrlMap[f.flag_id] ?? null}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

