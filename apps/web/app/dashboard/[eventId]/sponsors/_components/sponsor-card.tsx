/**
 * sponsor-card.tsx — one sponsor's card on Sponsors (moved out of `sponsors/page.tsx` unchanged, 2026-11-03, so the
 * swipe-to-delete lab can draw the REAL card: a Next page file may export only its page). Remove is the card's swipe
 * (`SponsorSwipe`), with Undo.
 */
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { actionButtonClass } from '@/components/action-button';
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
            <p className="truncate text-xs text-ink/70">{sponsor.relationship_note}</p>
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
        <p className="mt-1 text-xs text-ink/70 tabular-nums">
          {[sponsor.email, sponsor.phone].filter(Boolean).join(' · ')}
        </p>
      ) : null}

      {/* Status chip + actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 5): the status is the shared soft chip — no border, never pressed. */}
        <Badge tone={statusChip.tone}>{statusChip.label}</Badge>

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
                className={actionButtonClass('ok')}
              >
                <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Marked yes
              </SubmitButton>
            </StayForm>
            <StayForm door="sponsors.markResponse" action={markResponse}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="sponsor_id" value={sponsor.id} />
              <input type="hidden" name="status" value="declined" />
              <SubmitButton
                pendingLabel="Saving…"
                className={actionButtonClass('neutral')}
              >
                <XCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Declined
              </SubmitButton>
            </StayForm>
          </>
        ) : null}

        {sponsor.invitation_status === 'accepted' && sponsor.linked_guest_id ? (
          <Link
            href={`/dashboard/${eventId}/guests/${sponsor.linked_guest_id}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-terracotta-700 underline-offset-2 hover:underline"
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
  tone: BadgeTone;
} {
  if (status === 'accepted') {
    return {
      label: 'Accepted',
      tone: 'ok',
    };
  }
  if (status === 'declined') {
    return {
      label: 'Declined',
      tone: 'quiet',
    };
  }
  if (status === 'invited') {
    return {
      label: 'Awaiting reply',
      tone: 'wait',
    };
  }
  return {
    label: 'Not yet invited',
    tone: 'quiet',
  };
}
