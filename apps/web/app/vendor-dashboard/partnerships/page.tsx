import { redirect } from 'next/navigation';
import { Handshake, CheckCircle2, Inbox, Send } from 'lucide-react';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { Fold } from '@/app/_components/fold';
import { eventTypeLabel } from '@/lib/demand-radar';
import {
  NO_PARTNERS_YET,
  proposableShops,
  readPartnersYouServedWith,
  servedTogetherLine,
} from '@/lib/partners-you-served-with.server';
import {
  proposePartnership,
  acceptPartnership,
  declinePartnership,
  withdrawPartnership,
  changePartnershipKind,
  toggleTrustedByHidden,
} from './actions';
import {
  PARTNERSHIP_KINDS,
  PARTNERSHIP_VENDOR_LABEL,
  PARTNERSHIP_VENDOR_LABEL_SHORT,
} from '@/lib/vendor-partnership-kinds';
import { StayForm } from '@/app/_components/stay-form';
import { LIVE_SHOP_GATE } from '@/lib/live-shops';
import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import {
  ADDED_WAITING_LINE,
  addedYouLine,
  joinedThroughLinkLine,
  originOf,
  partnerLine,
  supplierInvitePath,
  type PartnershipOrigin,
} from '@/lib/supplier-invite';
import { readJoinedThroughLink } from '@/lib/supplier-invite.server';
import { PreferredSupplierCard, type AddableShop } from './_components/preferred-supplier-card';
import { PartnerRemoveRow } from './_components/partner-remove-row';

export const metadata = { title: 'Partnerships · Supplier' };

type SearchParams = {
  proposed?: string;
  accepted?: string;
  declined?: string;
  withdrawn?: string;
  changed?: string;
  error?: string;
  added?: string;
  removed?: string;
  joined?: string;
  already?: string;
  hidden?: string;
  shown?: string;
  /** 🤝 the Add sheet's search (a GET): `add=1&q=…` opens it on arrival with the results. */
  add?: string;
  q?: string;
};

type PartnershipRow = {
  id: number;
  recommending_vendor_id: string;
  recommended_vendor_id: string;
  relationship_type: string;
  status: string;
  is_active: boolean;
  created_at: string;
  accepted_at: string | null;
  origin: PartnershipOrigin;
};

// Shared with the public page and Explore — one set of words, one rank order.
const RELATIONSHIP_LABELS: Record<string, string> = PARTNERSHIP_VENDOR_LABEL;
const RELATIONSHIP_LABELS_SHORT: Record<string, string> = PARTNERSHIP_VENDOR_LABEL_SHORT;

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
  const { data: rows, error: rowsError } = await supabase
    .from('vendor_partnerships')
    .select(
      'id, recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, created_at, accepted_at, origin',
    )
    .or(`recommending_vendor_id.eq.${myId},recommended_vendor_id.eq.${myId}`)
    .order('created_at', { ascending: false });

  // ⚠ EVERY PARTNERSHIP THEY ARE PART OF, IN ONE READ — so a refusal empties
  // ⚠ all three inboxes at once. The worst of the three is INCOMING: a proposal
  // ⚠ from another supplier, waiting on this person to answer, simply is not
  // ⚠ there. Nothing looks wrong, and the cost lands on somebody who cannot see
  // ⚠ this page and is waiting for a reply that will never come.
  if (rowsError) {
    logQueryError('VendorPartnershipsPage.rows', rowsError, { myId }, 'graceful_degrade');
  }
  const partnershipsMeasured = !rowsError && rows !== null;
  const partnerships = ((rows ?? []) as PartnershipRow[]).map((p) => ({ ...p, origin: originOf(p.origin) }));

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
    const { data: others, error: othersError } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', otherIds);
    // ⚠ the OTHER shop's name on each partnership. Refused, `nameMap.get(id) ??
    // ⚠ id` falls through to the raw profile id, so the partner reads as a
    // ⚠ machine code. A label failure, not a count failure — the partnerships
    // ⚠ are all still listed, they just stop naming anybody.
    if (othersError) {
      logQueryError('VendorPartnershipsPage.others', othersError, { myId }, 'graceful_degrade');
    }
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

  // 🤝 WHO THEY MAY PROPOSE TO — owner 2026-11-06: "cannot link until they have served the same event." Only shops
  // this supplier was BOOKED alongside on an event whose date has passed (and that are live on the marketplace). The
  // one shared reader asks the database, the same definition the vendor_partnerships insert trigger enforces — so a
  // shop offered here is never refused on Send, and one refused is never offered. Replaces the old "all suppliers"
  // picker and its "worked together" ordering hint (vendor_worked_with_ids, dropped in the same migration).
  // ⚠ A refused read is `measured: false` and says so — it must never draw the "nobody yet" sentence.
  const served = await readPartnersYouServedWith(supabase, myId);
  const proposable = proposableShops(served);
  // "Worked together · 2 events" — the served-together read already in hand, counted per shop.
  const eventsWith = new Map<string, number>();
  if (served.measured) {
    for (const r of served.partners) eventsWith.set(r.vendorProfileId, r.events.length);
  }

  // 🙈 Owner Q5 (16 Nov): the rows this shop hid from its own Trusted by — each row's fold offers Hide / Show. A refused
  // read draws no toggle at all (null) rather than offering "Hide" on a row that may already be hidden.
  const { data: hiddenRows, error: hiddenError } = await supabase
    .from('vendor_trusted_by_hidden')
    .select('hidden_vendor_profile_id')
    .eq('vendor_profile_id', myId);
  if (hiddenError) logQueryError('VendorPartnershipsPage.hidden', hiddenError, { myId }, 'graceful_degrade');
  const hiddenSet: Set<string> | null = hiddenError
    ? null
    : new Set(((hiddenRows ?? []) as { hidden_vendor_profile_id: string }[]).map((h) => h.hidden_vendor_profile_id));

  // ── 🤝 ADD A PREFERRED SUPPLIER (Invite a supplier v3, owner 16 Nov) ──────────────────────────────────────────
  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  const shopName = (profile as { business_name?: string | null }).business_name?.trim() || 'Your shop';
  const invitePath = slug ? supplierInvitePath(slug) : null;
  const inviteUrl = invitePath ? `${siteOrigin()}${invitePath}` : null;
  const [inviteSvg, joinedCount] = await Promise.all([
    inviteUrl ? renderUrlQrSvg(inviteUrl).catch(() => null) : Promise.resolve(null),
    readJoinedThroughLink(supabase, myId),
  ]);
  const query = (sp.q ?? '').trim().slice(0, 60);
  let addResults: AddableShop[] | 'unreadable' | null = null;
  if (sp.add === '1' && query.length >= 2) {
    // Setnayan shops that are live on the marketplace, by name — never this shop.
    const { data: found, error: findError } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, location_city')
      .ilike('business_name', `%${query.replace(/[%_,()]/g, ' ')}%`)
      // The ONE rule for a live, verified shop (lib/live-shops.ts) — never the columns spelled by hand.
      .match(LIVE_SHOP_GATE)
      .neq('vendor_profile_id', myId)
      .order('business_name', { ascending: true })
      .limit(20);
    if (findError) {
      logQueryError('VendorPartnershipsPage.addSearch', findError, { myId }, 'graceful_degrade');
      addResults = 'unreadable';
    } else {
      const tied = new Map<string, 'sent' | 'partner'>();
      for (const p of partnerships) {
        const other = p.recommending_vendor_id === myId ? p.recommended_vendor_id : p.recommending_vendor_id;
        if (p.status === 'accepted' && p.is_active) tied.set(other, 'partner');
        else if (p.status === 'proposed' && p.is_active && p.recommending_vendor_id === myId && !tied.has(other)) tied.set(other, 'sent');
      }
      addResults = ((found ?? []) as { vendor_profile_id: string; business_name: string | null; location_city: string | null }[])
        .filter((v) => v.business_name?.trim())
        .map((v) => ({
          vendorProfileId: v.vendor_profile_id,
          name: v.business_name!.trim(),
          line: v.location_city ?? '',
          state: tied.get(v.vendor_profile_id) ?? null,
        }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6">
      <PageMasthead
        title="Partnerships"
      />

      {sp.error ? <FormFlash tone="error">{decodeURIComponent(sp.error)}</FormFlash> : null}
      {sp.changed ? (
        <FormFlash tone="success">
          Sent. The old partnership is withdrawn and the new wording is waiting for
          them to accept — the badge returns once they do.
        </FormFlash>
      ) : null}
      {sp.proposed ? (
        <FormFlash tone="success">
          Request sent. The other supplier will see it in their partnerships inbox — the
          badge goes live once they accept.
        </FormFlash>
      ) : null}
      {sp.accepted ? (
        <FormFlash tone="success">Partnership accepted — the badge is now live on both profiles.</FormFlash>
      ) : null}
      {sp.declined ? <FormFlash tone="success">Request declined.</FormFlash> : null}
      {sp.added ? (
        <FormFlash tone="success">
          Added. They are on your Trusted by now; you show on theirs once they accept.
        </FormFlash>
      ) : null}
      {sp.removed ? <FormFlash tone="success">Removed from both shop pages.</FormFlash> : null}
      {sp.joined ? (
        <FormFlash tone="success">You joined — you are each other&rsquo;s preferred supplier now.</FormFlash>
      ) : null}
      {sp.already ? <FormFlash tone="success">You two are partners already.</FormFlash> : null}
      {sp.hidden ? <FormFlash tone="success">Hidden from your Trusted by. Your partnership is unchanged.</FormFlash> : null}
      {sp.shown ? <FormFlash tone="success">Shown on your Trusted by again.</FormFlash> : null}

      {/* ── 🤝 ADD A PREFERRED SUPPLIER — at the top (Invite a supplier v3, owner 16 Nov) ─────────────────────── */}
      <PreferredSupplierCard
        shopName={shopName}
        invite={inviteUrl ? { url: inviteUrl, svg: inviteSvg, label: inviteUrl.replace(/^https?:\/\//, '') } : null}
        joinedLine={joinedCount === null ? null : joinedThroughLinkLine(joinedCount)}
        query={query}
        results={addResults}
        openAdd={sp.add === '1'}
      />
      {sp.withdrawn ? <FormFlash tone="success">Request withdrawn.</FormFlash> : null}

      {/* ── INCOMING PROPOSALS (accept / decline) ─────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          <Inbox className="h-3.5 w-3.5" /> Incoming requests ({incoming.length})
        </h2>
        {!partnershipsMeasured ? (
          <p
            role="alert"
            className="rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 px-4 py-3 text-sm text-ink/70"
          >
            <strong className="text-ink">We couldn&rsquo;t load your partnerships.</strong>{' '}
            Requests, partners and sent invitations are all missing from this
            page because the read failed &mdash; not because there are none.
            Reload before assuming nobody has written to you.
          </p>
        ) : incoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/45">
            No pending requests. When another supplier proposes a partnership with you, it
            shows up here to accept or decline.
          </p>
        ) : (
          <ul className="space-y-3">
            {incoming.map((p) => (
              <li key={p.id} className="m-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{otherName(p)}</p>
                  <p className="text-xs text-ink/55">
                    {p.origin === 'added'
                      ? addedYouLine(p.created_at)
                      : `Proposes: ${RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <StayForm door="svPartnerships.acceptPartnership" action={acceptPartnership}>
                    <input type="hidden" name="partnership_id" value={p.id} />
                    <SubmitButton
                      pendingLabel="Accepting…"
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink/90"
                    >
                      Accept
                    </SubmitButton>
                  </StayForm>
                  <StayForm door="svPartnerships.declinePartnership" action={declinePartnership}>
                    <input type="hidden" name="partnership_id" value={p.id} />
                    <SubmitButton
                      pendingLabel="Declining…"
                      className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5"
                    >
                      Decline
                    </SubmitButton>
                  </StayForm>
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
              const kindLabel = RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type;
              return (
                // 🤝 THE HOUSE ROW (coordinator 2026-11-06, from the 390 px proof): name + Live on one line, one quiet
                // line under it, NO buttons on the closed row. It used to carry the kind dropdown and Re-propose
                // beside the name, which crushed the name to one word per line on a phone. Tapping opens the row in
                // place (the shared Fold) — same pattern as the propose list below.
                <PartnerRemoveRow key={p.id} id={p.id} name={otherName(p)}>
                  <div className="px-4">
                  <Fold
                    title={otherName(p)}
                    titleNode={
                      <>
                        {otherName(p)}{' '}
                        <span className="ml-1 inline-block rounded-full bg-success-50 px-2 py-0.5 align-middle text-[10px] font-semibold text-success-700">
                          Live
                        </span>
                      </>
                    }
                    line={
                      // 🤝 Invited and added ties say where they came from (v3); a worked-together tie keeps its kind.
                      p.origin === 'worked_together'
                        ? `${partnerLine({ origin: p.origin, iProposed, at: p.accepted_at, events: eventsWith.get(iProposed ? p.recommended_vendor_id : p.recommending_vendor_id) ?? null })} · ${kindLabel}`
                        : partnerLine({ origin: p.origin, iProposed, at: p.accepted_at ?? p.created_at })
                    }
                    wrap
                    lead={<CheckCircle2 className="h-5 w-5 text-success-600" />}
                    data="partner-accepted"
                  >
                    {/* RE-PROPOSE UNDER A DIFFERENT KIND. Only the vendor who
                        made the recommendation sees this, because the claim is
                        theirs to restate.

                        ⚠ It withdraws and re-proposes rather than editing in
                        place: the database FORBIDS changing an accepted
                        partnership's terms (trg_vendor_partnerships_lock_immutable),
                        and it is right to — the terms must not change under the
                        partner who agreed to them. The badge therefore comes down
                        at the withdrawal and returns only when they accept the new
                        wording, which is the consent behaviour we wanted, enforced
                        by the schema instead of by an action remembering to do
                        it. */}
                    {iProposed ? (
                      <StayForm door="svPartnerships.changePartnershipKind" action={changePartnershipKind} className="flex flex-col gap-3 pb-4">
                        <input type="hidden" name="partnership_id" value={p.id} />
                        <label className="flex flex-col gap-1 text-sm" htmlFor={`kind-${p.id}`}>
                          <span className="font-semibold text-ink">Change this partnership</span>
                          <select
                            id={`kind-${p.id}`}
                            name="relationship_type"
                            defaultValue={p.relationship_type}
                            className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                          >
                            {PARTNERSHIP_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {PARTNERSHIP_VENDOR_LABEL_SHORT[k]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <SubmitButton
                            pendingLabel="Sending…"
                            className="rounded-md border border-ink/20 px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
                          >
                            Re-propose
                          </SubmitButton>
                          <p className="mt-2 text-xs text-ink/45">
                            Withdraws this partnership and sends the new wording for them to accept — the
                            badge returns once they do.
                          </p>
                        </div>
                      </StayForm>
                    ) : (
                      <p className="pb-4 text-sm text-ink/55">
                        They proposed this partnership, so only they can change how it&rsquo;s described.
                      </p>
                    )}
                    <TrustedByToggle
                      otherId={iProposed ? p.recommended_vendor_id : p.recommending_vendor_id}
                      hidden={hiddenSet}
                    />
                  </Fold>
                  </div>
                </PartnerRemoveRow>
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
                    {p.origin === 'added' ? (
                      ADDED_WAITING_LINE
                    ) : (
                      <>
                        {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                        {' · '}Waiting for them to accept
                      </>
                    )}
                  </p>
                </div>
                <StayForm door="svPartnerships.withdrawPartnership" action={withdrawPartnership}>
                  <input type="hidden" name="partnership_id" value={p.id} />
                  <SubmitButton
                    pendingLabel="Withdrawing…"
                    className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5"
                  >
                    Withdraw
                  </SubmitButton>
                </StayForm>
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
              Suppliers you&apos;ve served an event with. Tap one and pick a partnership
              type — once they accept, the badge goes live on both profiles.
            </p>
          </div>
        </div>

        {!served.measured ? (
          <p
            role="alert"
            className="rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 px-4 py-3 text-sm text-ink/70"
            data-served-with="unreadable"
          >
            <strong className="text-ink">We couldn&rsquo;t load the suppliers you&rsquo;ve served with.</strong>{' '}
            The list is empty because the read failed, not because there is nobody
            to partner with. Reload in a moment.
          </p>
        ) : proposable.length === 0 ? (
          <p
            className="px-4 py-6 text-center text-sm text-ink/55"
            data-served-with="none"
          >
            {NO_PARTNERS_YET}
          </p>
        ) : (
          <ul className="space-y-3" data-served-with="list">
            {proposable.map((v) => (
              <li key={v.vendorProfileId} className="m-card px-4">
                <Fold
                  title={v.businessName}
                  line={servedTogetherLine(v, eventTypeLabel)}
                  wrap
                  lineWrap
                  data="partner-served-with"
                >
                  <StayForm door="svPartnerships.proposePartnership" action={proposePartnership} className="flex flex-col gap-3 pb-4">
                    <input type="hidden" name="recommended_vendor_id" value={v.vendorProfileId} />
                    <label className="flex flex-col gap-1 text-sm">
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
                    <div>
                      <SubmitButton
                        pendingLabel="Sending…"
                        className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
                      >
                        Send request
                      </SubmitButton>
                      <p className="mt-2 text-xs text-ink/45">
                        They decide whether to accept. Nothing goes public until they do.
                      </p>
                    </div>
                  </StayForm>
                  {/* Served together = automatic on your Trusted by (owner Q5) — hide it here if you'd rather not. */}
                  {v.isLive ? <TrustedByToggle otherId={v.vendorProfileId} hidden={hiddenSet} /> : null}
                </Fold>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * 🙈 Hide / Show one row on this shop's OWN Trusted by (owner Q5, 16 Nov). Inside the row's fold, never on the closed
 * row. `hidden` null = the hidden-rows read failed: no toggle rather than a guess.
 */
function TrustedByToggle({ otherId, hidden }: { otherId: string; hidden: Set<string> | null }) {
  if (!hidden) return null;
  const isHidden = hidden.has(otherId);
  return (
    <StayForm door="svPartnerships.toggleTrustedByHidden" action={toggleTrustedByHidden} className="flex flex-col gap-1 pb-4">
      <input type="hidden" name="other_vendor_id" value={otherId} />
      <input type="hidden" name="hide" value={isHidden ? '0' : '1'} />
      <div>
        <SubmitButton
          pendingLabel={isHidden ? 'Showing…' : 'Hiding…'}
          className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:bg-ink/5"
        >
          {isHidden ? 'Show on your Trusted by' : 'Hide from your Trusted by'}
        </SubmitButton>
      </div>
      <p className="text-xs text-ink/45">
        {isHidden ? 'Hidden from your shop page. ' : ''}Only your page changes — the tie and their page stay as they are.
      </p>
    </StayForm>
  );
}
