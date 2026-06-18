import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PRINCIPAL_PAIR_DEFAULT,
  PRINCIPAL_PAIR_MAX,
  PRINCIPAL_PAIR_MIN,
  SECONDARY_SLOTS_PER_TIER,
  SECONDARY_TIERS,
  SPONSOR_SIDE_LABEL,
  SPONSOR_TIER_HINT,
  SPONSOR_TIER_LABEL,
  buildInvitationMessage,
  sponsorRoleHonorific,
  type SponsorInvitationStatus,
  type SponsorSide,
  type SponsorTier,
} from '@/lib/event-sponsors';
import { AddSponsorModal } from './_components/add-sponsor-modal';
import { InvitationTemplateModal } from './_components/invitation-template-modal';
import { SubmitButton } from '@/app/_components/submit-button';
import { PairTargetPicker } from './_components/pair-target-picker';
import {
  addSponsor,
  markResponse,
  removeSponsor,
  sendInvitation,
} from './actions';

export const metadata = {
  title: 'Sponsors · Setnayan',
  description: 'Coordinate your ninong, ninang, and secondary wedding sponsors.',
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    pairs?: string;
    added?: string;
    updated?: string;
    removed?: string;
    invited?: string;
    accepted?: string;
    declined?: string;
    error?: string;
  }>;
};

type SponsorRow = {
  id: string;
  event_id: string;
  pair_index: number | null;
  sponsor_tier: SponsorTier;
  side: SponsorSide;
  full_name: string;
  relationship_note: string | null;
  email: string | null;
  phone: string | null;
  invitation_status: SponsorInvitationStatus;
  invitation_sent_at: string | null;
  responded_at: string | null;
  decline_note: string | null;
  linked_guest_id: string | null;
};

type EventMini = {
  display_name: string | null;
  event_date: string | null;
  ceremony_type: string | null;
  venue_name: string | null;
};

export default async function SponsorsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Gate access — must be a current host on this event (via either
  // event_moderators or the legacy event_members couple row).
  const { data: modCheck } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  let isHost = !!modCheck;
  if (!isHost) {
    const { data: legacy } = await supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    isHost = (legacy as { member_type: string } | null)?.member_type === 'couple';
  }
  if (!isHost) redirect('/dashboard');

  const admin = createAdminClient();

  // Event meta + sponsor rows both key off eventId and are independent — one
  // parallel batch instead of two serial reads (owner perf pass 2026-06-03).
  const [{ data: eventRow }, { data: sponsorRows }] = await Promise.all([
    // Event meta — used for the invitation template + page header.
    admin
      .from('events')
      .select('display_name, event_date, ceremony_type, venue_name')
      .eq('event_id', eventId)
      .maybeSingle(),
    // Sponsors — all rows on this event.
    admin
      .from('event_sponsors')
      .select(
        'id, event_id, pair_index, sponsor_tier, side, full_name, relationship_note, email, phone, invitation_status, invitation_sent_at, responded_at, decline_note, linked_guest_id',
      )
      .eq('event_id', eventId)
      .order('pair_index', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  ]);
  const event = (eventRow as EventMini | null) ?? {
    display_name: null,
    event_date: null,
    ceremony_type: null,
    venue_name: null,
  };
  const eventName = event.display_name ?? 'Your event';
  const coupleNames = event.display_name ?? 'we';
  const sponsors = (sponsorRows ?? []) as SponsorRow[];

  // Highest pair_index already in use — guards the picker.
  const highestUsedPair = sponsors.reduce(
    (max, s) => (s.pair_index && s.pair_index > max ? s.pair_index : max),
    0,
  );

  // Resolve target — query param ?pairs= wins, else default 4 (or higher if
  // the host has already added pairs above the default).
  const rawPairs = Number.parseInt(search.pairs ?? '', 10);
  const targetPairs = Number.isFinite(rawPairs)
    ? Math.max(
        Math.max(PRINCIPAL_PAIR_MIN, highestUsedPair),
        Math.min(PRINCIPAL_PAIR_MAX, rawPairs),
      )
    : Math.max(PRINCIPAL_PAIR_DEFAULT, highestUsedPair);

  // Bucket sponsors by tier for rendering.
  const principalSponsors = sponsors.filter((s) => s.sponsor_tier === 'principal');
  const principalByPair: Map<number, { groom: SponsorRow | null; bride: SponsorRow | null; neutral: SponsorRow[] }> =
    new Map();
  for (let i = 1; i <= targetPairs; i += 1) {
    principalByPair.set(i, { groom: null, bride: null, neutral: [] });
  }
  for (const s of principalSponsors) {
    if (s.pair_index === null) continue;
    if (!principalByPair.has(s.pair_index)) {
      principalByPair.set(s.pair_index, { groom: null, bride: null, neutral: [] });
    }
    const slot = principalByPair.get(s.pair_index)!;
    if (s.side === 'groom' && !slot.groom) slot.groom = s;
    else if (s.side === 'bride' && !slot.bride) slot.bride = s;
    else slot.neutral.push(s);
  }

  const secondaryByTier: Map<SponsorTier, SponsorRow[]> = new Map();
  for (const tier of SECONDARY_TIERS) {
    secondaryByTier.set(tier, sponsors.filter((s) => s.sponsor_tier === tier));
  }

  // Aggregate progress counters.
  const totalSlotsTarget = targetPairs * 2 + SECONDARY_TIERS.length * SECONDARY_SLOTS_PER_TIER;
  const filledCount = sponsors.length;
  const acceptedCount = sponsors.filter((s) => s.invitation_status === 'accepted').length;
  const declinedCount = sponsors.filter((s) => s.invitation_status === 'declined').length;
  const pendingCount = sponsors.filter((s) => s.invitation_status === 'pending').length;
  const invitedCount = sponsors.filter((s) => s.invitation_status === 'invited').length;

  // Notification copy for the inline status bar.
  const justAdded = search.added === '1';
  const justUpdated = search.updated === '1';
  const justRemoved = search.removed === '1';
  const justInvited = search.invited === '1';
  const justAccepted = search.accepted === '1';
  const justDeclined = search.declined === '1';
  const errorMessage = search.error ?? null;

  return (
    <section className="space-y-6 pb-12">
      <Link
        href={`/dashboard/${eventId}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to {eventName}
      </Link>

      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Filipino wedding tradition · ninong + ninang
        </p>
        <h1 className="font-display text-3xl italic tracking-tight sm:text-4xl">
          Your principal sponsors
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Pick the people you want standing beside you on the day — your ninong
          and ninang, plus the cord, veil, coin, and candle sponsors who carry
          the rites of the ceremony. Filipino weddings traditionally invite{' '}
          {PRINCIPAL_PAIR_DEFAULT} pairs of principal sponsors; some couples go
          up to {PRINCIPAL_PAIR_MAX}.
        </p>
      </header>

      {/* Inline status banner */}
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : justAdded ? (
        <Banner kind="success">Sponsor added.</Banner>
      ) : justUpdated ? (
        <Banner kind="success">Sponsor updated.</Banner>
      ) : justRemoved ? (
        <Banner kind="success">Sponsor removed.</Banner>
      ) : justInvited ? (
        <Banner kind="success">Marked invitation sent.</Banner>
      ) : justAccepted ? (
        <Banner kind="success">Saved their yes. Added to your guest list.</Banner>
      ) : justDeclined ? (
        <Banner kind="info">Saved their reply.</Banner>
      ) : null}

      {/* Progress strip + pair-target picker */}
      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Sponsor list progress
            </p>
            <p className="text-sm text-ink/65">
              {filledCount} of {totalSlotsTarget} slots filled · {acceptedCount} accepted
              {invitedCount > 0 ? ` · ${invitedCount} awaiting response` : ''}
              {pendingCount > 0 ? ` · ${pendingCount} not yet invited` : ''}
              {declinedCount > 0 ? ` · ${declinedCount} declined` : ''}
            </p>
          </div>
          <PairTargetPicker eventId={eventId} currentTarget={targetPairs} highestUsedPair={highestUsedPair} />
        </div>

        {/* Slot meter — visual progress */}
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: totalSlotsTarget }).map((_, idx) => {
            const filled = idx < filledCount;
            return (
              <span
                key={idx}
                aria-hidden
                className={`block h-2 w-6 rounded-full ${
                  filled ? 'bg-terracotta/80' : 'bg-ink/10'
                }`}
              />
            );
          })}
        </div>
      </section>

      {/* PRINCIPAL SPONSORS */}
      <section
        id="tier-principal"
        className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5"
      >
        <header className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            {SPONSOR_TIER_LABEL.principal}s · {targetPairs} pair
            {targetPairs === 1 ? '' : 's'}
          </p>
          <h2 className="font-display text-2xl italic">Ninong & ninang</h2>
          <p className="max-w-prose text-sm text-ink/65">
            {SPONSOR_TIER_HINT.principal}
          </p>
        </header>

        <div className="space-y-4">
          {Array.from({ length: targetPairs }).map((_, idx) => {
            const pairIdx = idx + 1;
            const slot = principalByPair.get(pairIdx) ?? {
              groom: null,
              bride: null,
              neutral: [],
            };
            return (
              <PrincipalPairRow
                key={pairIdx}
                eventId={eventId}
                pairIndex={pairIdx}
                groomSponsor={slot.groom}
                brideSponsor={slot.bride}
                event={event}
                coupleNames={coupleNames}
              />
            );
          })}
        </div>
      </section>

      {/* SECONDARY SPONSORS */}
      {SECONDARY_TIERS.map((tier) => {
        const rows = secondaryByTier.get(tier) ?? [];
        const slotsRequired = SECONDARY_SLOTS_PER_TIER;
        const filledSlots = rows.length;
        return (
          <section
            key={tier}
            id={`tier-${tier}`}
            className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5"
          >
            <header className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                {SPONSOR_TIER_LABEL[tier]}s · 2 individuals
              </p>
              <h2 className="font-display text-2xl italic">
                {tier === 'cord'
                  ? 'Cord sponsors'
                  : tier === 'veil'
                    ? 'Veil sponsors'
                    : tier === 'coin'
                      ? 'Coin sponsors (arrhae)'
                      : 'Candle sponsors'}
              </h2>
              <p className="max-w-prose text-sm text-ink/65">{SPONSOR_TIER_HINT[tier]}</p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Two slots side-by-side */}
              {[0, 1].map((slotIdx) => {
                const filled = rows[slotIdx] ?? null;
                if (filled) {
                  return (
                    <SponsorCard
                      key={filled.id}
                      sponsor={filled}
                      eventId={eventId}
                      event={event}
                      coupleNames={coupleNames}
                    />
                  );
                }
                return (
                  <AddSponsorModal
                    key={`empty-${tier}-${slotIdx}`}
                    eventId={eventId}
                    sponsorTier={tier}
                    side="neutral"
                    pairIndex={null}
                    triggerLabel={`Add ${tier} sponsor`}
                    formAction={addSponsor}
                  />
                );
              })}
              {/* Extra slot if host has already exceeded SECONDARY_SLOTS_PER_TIER */}
              {filledSlots > SECONDARY_SLOTS_PER_TIER
                ? rows.slice(SECONDARY_SLOTS_PER_TIER).map((extra) => (
                    <SponsorCard
                      key={extra.id}
                      sponsor={extra}
                      eventId={eventId}
                      event={event}
                      coupleNames={coupleNames}
                    />
                  ))
                : null}
            </div>
          </section>
        );
      })}

      <p className="text-center text-xs text-ink/55">
        Sponsors who accept are auto-added to your guest list with their
        sponsor role + RSVP marked Attending. Edit them anytime from
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="ml-1 text-terracotta hover:text-terracotta-700"
        >
          your guest list
        </Link>
        .
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Banner({
  kind,
  children,
}: {
  kind: 'success' | 'info';
  children: React.ReactNode;
}) {
  const color =
    kind === 'success'
      ? 'border-emerald-300/60 bg-emerald-50/70 text-emerald-950'
      : 'border-ink/15 bg-cream text-ink/75';
  return (
    <p
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${color}`}
    >
      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      {children}
    </p>
  );
}

function PrincipalPairRow({
  eventId,
  pairIndex,
  groomSponsor,
  brideSponsor,
  event,
  coupleNames,
}: {
  eventId: string;
  pairIndex: number;
  groomSponsor: SponsorRow | null;
  brideSponsor: SponsorRow | null;
  event: EventMini;
  coupleNames: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3 sm:p-4">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        Pair {pairIndex}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Groom's side */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {SPONSOR_SIDE_LABEL.groom} · ninong
          </p>
          {groomSponsor ? (
            <SponsorCard
              sponsor={groomSponsor}
              eventId={eventId}
              event={event}
              coupleNames={coupleNames}
            />
          ) : (
            <AddSponsorModal
              eventId={eventId}
              sponsorTier="principal"
              side="groom"
              pairIndex={pairIndex}
              triggerLabel="Add ninong"
              formAction={addSponsor}
            />
          )}
        </div>

        {/* Bride's side */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {SPONSOR_SIDE_LABEL.bride} · ninang
          </p>
          {brideSponsor ? (
            <SponsorCard
              sponsor={brideSponsor}
              eventId={eventId}
              event={event}
              coupleNames={coupleNames}
            />
          ) : (
            <AddSponsorModal
              eventId={eventId}
              sponsorTier="principal"
              side="bride"
              pairIndex={pairIndex}
              triggerLabel="Add ninang"
              formAction={addSponsor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SponsorCard({
  sponsor,
  eventId,
  event,
  coupleNames,
}: {
  sponsor: SponsorRow;
  eventId: string;
  event: EventMini;
  coupleNames: string;
}) {
  const statusChip = statusChipFor(sponsor.invitation_status);
  const invitationMessage = buildInvitationMessage({
    sponsorFullName: sponsor.full_name,
    sponsorTier: sponsor.sponsor_tier,
    sponsorSide: sponsor.side,
    coupleNames,
    weddingDate: event.event_date,
    ceremonyVenue: event.venue_name,
  });
  const honorific = sponsorRoleHonorific(sponsor.sponsor_tier, sponsor.side);

  return (
    <article className="rounded-lg border border-ink/10 bg-cream p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-semibold text-ink">
            {sponsor.full_name}
          </p>
          {sponsor.relationship_note ? (
            <p className="truncate text-xs text-ink/65">{sponsor.relationship_note}</p>
          ) : null}
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {honorific}
          </p>
        </div>
        <form action={removeSponsor}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="sponsor_id" value={sponsor.id} />
          <SubmitButton
            pendingLabel="Removing…"
            aria-label={`Remove ${sponsor.full_name}`}
            className="rounded-md p-1 text-ink/45 hover:bg-terracotta/10 hover:text-terracotta-700"
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </SubmitButton>
        </form>
      </div>

      {/* Contact summary */}
      {sponsor.email || sponsor.phone ? (
        <p className="mt-1 font-mono text-[10px] text-ink/55">
          {[sponsor.email, sponsor.phone].filter(Boolean).join(' · ')}
        </p>
      ) : null}

      {/* Status chip + actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] ${statusChip.cls}`}
        >
          {statusChip.icon}
          {statusChip.label}
        </span>

        {sponsor.invitation_status === 'pending' || sponsor.invitation_status === 'invited' ? (
          <InvitationTemplateModal
            sponsorId={sponsor.id}
            triggerLabel={sponsor.full_name}
            initialMessage={invitationMessage}
            formAction={sendInvitation}
            eventId={eventId}
          />
        ) : null}

        {sponsor.invitation_status === 'invited' ? (
          <>
            <form action={markResponse}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_id" value={sponsor.id} />
              <input type="hidden" name="status" value="accepted" />
              <SubmitButton
                pendingLabel="Saving…"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300/60 bg-emerald-50/60 px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100"
              >
                <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                Marked yes
              </SubmitButton>
            </form>
            <form action={markResponse}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_id" value={sponsor.id} />
              <input type="hidden" name="status" value="declined" />
              <SubmitButton
                pendingLabel="Saving…"
                className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-2 py-1 text-[11px] font-medium text-ink/70 hover:border-ink/30"
              >
                <XCircle aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                Declined
              </SubmitButton>
            </form>
          </>
        ) : null}

        {sponsor.invitation_status === 'accepted' && sponsor.linked_guest_id ? (
          <Link
            href={`/dashboard/${eventId}/guests/${sponsor.linked_guest_id}`}
            className="font-mono text-[10px] text-terracotta underline-offset-2 hover:underline"
          >
            View on guest list
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function statusChipFor(status: SponsorInvitationStatus): {
  label: string;
  icon: React.ReactNode;
  cls: string;
} {
  if (status === 'accepted') {
    return {
      label: 'Accepted',
      icon: <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />,
      cls: 'bg-emerald-100/80 text-emerald-900',
    };
  }
  if (status === 'declined') {
    return {
      label: 'Declined',
      icon: <XCircle aria-hidden className="h-3 w-3" strokeWidth={2} />,
      cls: 'bg-ink/8 text-ink/65',
    };
  }
  if (status === 'invited') {
    return {
      label: 'Awaiting reply',
      icon: <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />,
      cls: 'bg-amber-100/80 text-amber-900',
    };
  }
  return {
    label: 'Not yet invited',
    icon: <Users aria-hidden className="h-3 w-3" strokeWidth={2} />,
    cls: 'bg-ink/8 text-ink/60',
  };
}
