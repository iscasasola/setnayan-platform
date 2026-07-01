import { redirect } from 'next/navigation';
import { Handshake, CheckCircle2, Inbox, Send, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  proposePartnership,
  acceptPartnership,
  declinePartnership,
  withdrawPartnership,
} from './actions';

export const metadata = { title: 'Partnerships · Vendor' };

type SearchParams = {
  proposed?: string;
  accepted?: string;
  declined?: string;
  withdrawn?: string;
  error?: string;
};

type PartnershipRow = {
  id: number;
  recommending_vendor_id: string;
  recommended_vendor_id: string;
  relationship_type: string;
  status: string;
  is_active: boolean;
  created_at: string;
};

type VendorOption = {
  vendor_profile_id: string;
  business_name: string;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  accredited: 'Accredited — you formally certify this vendor',
  sponsored_included: 'Included in package — recommended vendor is part of your offering at no extra cost',
  sponsored_discounted: 'Discounted — recommended vendor offers a discount when booked alongside you',
  general: 'General referral — informal "works well with" recommendation',
};

const RELATIONSHIP_LABELS_SHORT: Record<string, string> = {
  accredited: 'Accredited',
  sponsored_included: 'Included in package',
  sponsored_discounted: 'Discounted',
  general: 'General referral',
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function VendorPartnershipsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const myId = profile.vendor_profile_id;

  // Fetch every partnership this vendor is a party to (either direction), in
  // any status. RLS "parties read own vendor partnerships" scopes this to rows
  // where the current vendor is proposer or recipient.
  const { data: rows } = await supabase
    .from('vendor_partnerships')
    .select(
      'id, recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, created_at',
    )
    .or(`recommending_vendor_id.eq.${myId},recommended_vendor_id.eq.${myId}`)
    .order('created_at', { ascending: false });

  const partnerships = (rows ?? []) as PartnershipRow[];

  // Resolve the OTHER party's display name for every partnership.
  const otherIds = Array.from(
    new Set(
      partnerships.map((p) =>
        p.recommending_vendor_id === myId ? p.recommended_vendor_id : p.recommending_vendor_id,
      ),
    ),
  );
  const nameMap = new Map<string, string>();
  if (otherIds.length > 0) {
    const { data: others } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', otherIds);
    for (const v of (others ?? []) as { vendor_profile_id: string; business_name: string }[]) {
      nameMap.set(v.vendor_profile_id, v.business_name);
    }
  }
  const otherName = (p: PartnershipRow) => {
    const id = p.recommending_vendor_id === myId ? p.recommended_vendor_id : p.recommending_vendor_id;
    return nameMap.get(id) ?? id;
  };

  // Partition into the three inbox buckets + accepted partners.
  const incoming = partnerships.filter(
    (p) => p.recommended_vendor_id === myId && p.status === 'proposed' && p.is_active,
  );
  const outgoing = partnerships.filter(
    (p) => p.recommending_vendor_id === myId && p.status === 'proposed' && p.is_active,
  );
  const accepted = partnerships.filter((p) => p.status === 'accepted' && p.is_active);

  // "Worked together" hints — vendor_profile_ids this vendor has shared an
  // event with (marketplace co-occurrence). Surfaced as an eligibility hint in
  // the propose picker; NOT a hard block. SECURITY DEFINER RPC, scoped to my id.
  const { data: workedRows } = await supabase.rpc('vendor_worked_with_ids', {
    for_vendor: myId,
  });
  const workedWith = new Set(
    ((workedRows ?? []) as (string | { vendor_worked_with_ids: string })[]).map((r) =>
      typeof r === 'string' ? r : r.vendor_worked_with_ids,
    ),
  );

  // All other active vendors for the propose picker.
  const { data: allVendors } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('is_active', true)
    .neq('vendor_profile_id', myId)
    .order('business_name', { ascending: true })
    .limit(300);
  const vendorOptions = (allVendors ?? []) as VendorOption[];

  // Sort the picker so vendors you've worked with float to the top.
  const sortedOptions = [...vendorOptions].sort((a, b) => {
    const aw = workedWith.has(a.vendor_profile_id) ? 0 : 1;
    const bw = workedWith.has(b.vendor_profile_id) ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return a.business_name.localeCompare(b.business_name);
  });

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-1">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Vendor partnerships</p>
        <h1 className="m-display-tight text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          Partnerships
        </h1>
        <p className="text-sm text-ink/60">
          Team up with vendors you work well with. You propose; the other vendor accepts.
          Once <strong>both of you agree</strong>, the partnership badge appears on both
          profiles in couple search results. No admin review needed.
        </p>
      </header>

      {sp.error ? <FormFlash tone="error">{decodeURIComponent(sp.error)}</FormFlash> : null}
      {sp.proposed ? (
        <FormFlash tone="success">
          Proposal sent. The other vendor will see it in their partnerships inbox — the
          badge goes live once they accept.
        </FormFlash>
      ) : null}
      {sp.accepted ? (
        <FormFlash tone="success">Partnership accepted — the badge is now live on both profiles.</FormFlash>
      ) : null}
      {sp.declined ? <FormFlash tone="success">Proposal declined.</FormFlash> : null}
      {sp.withdrawn ? <FormFlash tone="success">Proposal withdrawn.</FormFlash> : null}

      {/* ── INCOMING PROPOSALS (accept / decline) ─────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          <Inbox className="h-3.5 w-3.5" /> Incoming proposals ({incoming.length})
        </h2>
        {incoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/45">
            No pending proposals. When another vendor proposes a partnership with you, it
            shows up here to accept or decline.
          </p>
        ) : (
          <ul className="space-y-3">
            {incoming.map((p) => (
              <li key={p.id} className="m-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{otherName(p)}</p>
                  <p className="text-xs text-ink/55">
                    Proposes: {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={acceptPartnership}>
                    <input type="hidden" name="partnership_id" value={p.id} />
                    <SubmitButton
                      pendingLabel="Accepting…"
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink/90"
                    >
                      Accept
                    </SubmitButton>
                  </form>
                  <form action={declinePartnership}>
                    <input type="hidden" name="partnership_id" value={p.id} />
                    <SubmitButton
                      pendingLabel="Declining…"
                      className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5"
                    >
                      Decline
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── ACCEPTED PARTNERS ─────────────────────────────────────────────── */}
      {accepted.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            <CheckCircle2 className="h-3.5 w-3.5" /> Partners ({accepted.length})
          </h2>
          <ul className="space-y-3">
            {accepted.map((p) => {
              const iProposed = p.recommending_vendor_id === myId;
              return (
                <li key={p.id} className="m-card flex items-center gap-3 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{otherName(p)}</p>
                    <p className="text-xs text-ink/55">
                      {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                      {' · '}
                      {iProposed ? 'You proposed' : 'They proposed'}
                    </p>
                  </div>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                    Live
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ── OUTGOING PROPOSALS (withdraw) ─────────────────────────────────── */}
      {outgoing.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            <Send className="h-3.5 w-3.5" /> Sent — awaiting response ({outgoing.length})
          </h2>
          <ul className="space-y-3">
            {outgoing.map((p) => (
              <li key={p.id} className="m-card flex items-center gap-3 p-4">
                <Send className="h-5 w-5 shrink-0 text-warn-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{otherName(p)}</p>
                  <p className="text-xs text-ink/55">
                    {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                    {' · '}Waiting for them to accept
                  </p>
                </div>
                <form action={withdrawPartnership}>
                  <input type="hidden" name="partnership_id" value={p.id} />
                  <SubmitButton
                    pendingLabel="Withdrawing…"
                    className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5"
                  >
                    Withdraw
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── PROPOSE A PARTNERSHIP ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <Handshake className="h-6 w-6 shrink-0 text-mulberry" />
          <div>
            <h2 className="text-base font-semibold text-ink">Propose a partnership</h2>
            <p className="text-xs text-ink/55">
              Pick a vendor and a partnership type. They&apos;ll get a proposal to accept —
              once they do, the badge goes live on both profiles.
            </p>
          </div>
        </div>

        <form action={proposePartnership} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Which vendor?</span>
            <select
              name="recommended_vendor_id"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Search for a vendor…</option>
              {workedWith.size > 0 ? (
                <optgroup label="Vendors you've worked with">
                  {sortedOptions
                    .filter((v) => workedWith.has(v.vendor_profile_id))
                    .map((v) => (
                      <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                        {v.business_name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              <optgroup label="All vendors">
                {sortedOptions
                  .filter((v) => !workedWith.has(v.vendor_profile_id))
                  .map((v) => (
                    <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                      {v.business_name}
                    </option>
                  ))}
              </optgroup>
            </select>
            {workedWith.size > 0 ? (
              <span className="flex items-center gap-1 text-[11px] text-ink/45">
                <Sparkles className="h-3 w-3" /> Vendors you&apos;ve shared an event with are
                listed first — they&apos;re the most likely to accept.
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">What kind of partnership?</span>
            <select
              name="relationship_type"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a type…</option>
              {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2">
            <SubmitButton
              pendingLabel="Sending…"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Send proposal
            </SubmitButton>
            <p className="mt-2 text-xs text-ink/45">
              The other vendor decides whether to accept. Nothing goes public until they do.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
