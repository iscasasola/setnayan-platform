/**
 * sponsor-card.tsx — one sponsor's card on Sponsors (moved out of `sponsors/page.tsx` unchanged, 2026-11-03, so the
 * swipe-to-delete lab can draw the REAL card: a Next page file may export only its page). Remove is the card's swipe
 * (`SponsorSwipe`), with Undo.
 */
import Link from 'next/link';
import { CheckCircle2, Sparkles, Users, XCircle } from 'lucide-react';
import {
  buildInvitationMessage,
  sponsorRoleHonorific,
  type SponsorInvitationStatus,
  type SponsorSide,
  type SponsorTier,
} from '@/lib/event-sponsors';
import { EditSponsorModal } from './edit-sponsor-modal';
import { InvitationTemplateModal } from './invitation-template-modal';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import { SponsorSwipe } from './sponsor-swipe';
import { markResponse, sendInvitation, updateSponsor } from '../actions';

export type SponsorRow = {
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

export type EventMini = {
  display_name: string | null;
  event_date: string | null;
  ceremony_type: string | null;
  venue_name: string | null;
};

export function SponsorCard({
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

  const card = (
    <article className="sn-row p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-semibold text-ink">
            {sponsor.full_name}
          </p>
          {sponsor.relationship_note ? (
            <p className="truncate text-xs text-ink/65">{sponsor.relationship_note}</p>
          ) : null}
          <p className="sn-eye">
            {honorific}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Edit sits BEFORE remove, and not only for reading order: removing was
              the only way to fix a name until now, and it silently threw away the
              invitation and the answer. The gentler control goes first. */}
          <EditSponsorModal
            eventId={eventId}
            sponsorId={sponsor.id}
            fullName={sponsor.full_name}
            relationshipNote={sponsor.relationship_note}
            email={sponsor.email}
            phone={sponsor.phone}
            formAction={updateSponsor}
          />
          {/* 👈 Remove is the card's swipe (owner 2026-11-03) — `SponsorSwipe`, around the card, with Undo. */}
        </div>
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
            <StayForm door="sponsors.markResponse" action={markResponse}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_id" value={sponsor.id} />
              <input type="hidden" name="status" value="accepted" />
              <SubmitButton
                pendingLabel="Saving…"
                className="inline-flex items-center gap-1 rounded-md border border-success-300/60 bg-success-50/60 px-2 py-1 text-[11px] font-medium text-success-900 hover:bg-success-100"
              >
                <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                Marked yes
              </SubmitButton>
            </StayForm>
            <StayForm door="sponsors.markResponse" action={markResponse}>
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
            </StayForm>
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
  return (
    <SponsorSwipe eventId={eventId} sponsorId={sponsor.id} name={sponsor.full_name}>
      {card}
    </SponsorSwipe>
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
      cls: 'bg-success-100/80 text-success-900',
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
      cls: 'bg-warn-100/80 text-warn-900',
    };
  }
  return {
    label: 'Not yet invited',
    icon: <Users aria-hidden className="h-3 w-3" strokeWidth={2} />,
    cls: 'bg-ink/8 text-ink/60',
  };
}
