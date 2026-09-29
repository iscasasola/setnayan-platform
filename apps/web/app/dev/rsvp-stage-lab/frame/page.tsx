/**
 * /dev/rsvp-stage-lab/frame?scene=form|thanks|decline — the RSVP stage lab's
 * canvas (see `../page.tsx`). DEV-ONLY. It composes the guest pages' OWN parts
 * on a fixture sample, the way `invite/reply` and `invite/enter` compose them
 * on the Maker's canvas: `DoorShell`, the REAL `RsvpWidget` (every question
 * drawn, `previewEveryQuestion`), `thankYouWords` for the screens after a reply,
 * and the REAL `RsvpCanvasBridge` that takes the Maker's messages.
 */
import { notFound } from 'next/navigation';
import { DoorShell } from '@/app/_components/door/door-shell';
import { RsvpWidget } from '@/app/[slug]/_components/rsvp-widget';
import { RsvpCanvasBridge } from '@/app/[slug]/_components/rsvp-canvas-bridge';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { replySummary, thankYouHeadline, thankYouWords } from '@/app/[slug]/_lib/thank-you-words';
import { WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';
import { resolveRsvpAsk, rsvpAnswerWord } from '@/lib/rsvp-ask';
import { rsvpWordBridgeKey } from '@/lib/rsvp-stage-shared';
import { rsvpReplyByLine } from '@/lib/rsvp-stage';
import { rsvpCanvasGuestFor } from '@/lib/simulated-guest-preview';
import { labRsvpNoop } from '../actions';

export default async function RsvpStageLabFrame({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const words = eventWordsFromProfile(sp.solemn === '1' ? WAKE_PROFILE : WEDDING_PROFILE);
  const guest = rsvpCanvasGuestFor(null);
  const meta = '18 December 2026 · San Agustin Church';
  if (sp.scene === 'thanks' || sp.scene === 'decline') {
    const status = sp.scene === 'thanks' ? 'attending' : 'declined';
    const ownHeadline = thankYouHeadline({ status, firstName: guest.first_name, eventDate: '2026-12-18', solemn: words.solemn });
    const couple = thankYouWords({ status, words: {}, ownHeadline, name: guest.first_name });
    return (
      <DoorShell
        eyebrow="Thank you"
        title={couple.heading}
        sub={replySummary({ status, seats: 1, meal: null, solemn: words.solemn, answerWord: rsvpAnswerWord({}, status, words.solemn) })}
        meta={meta}
      >
        <RsvpCanvasBridge inertButtons />
        <i hidden data-rsvp-word-proxy={rsvpWordBridgeKey(couple.keys!.heading)} data-rsvp-target="[data-door-header] h1" data-rsvp-default={ownHeadline} data-rsvp-name={guest.first_name} />
        <p className="text-base leading-relaxed text-ink/80" data-thank-you-message="" data-rsvp-word={rsvpWordBridgeKey(couple.keys!.message)} data-rsvp-word-optional="" data-rsvp-name={guest.first_name} hidden />
        <p className="text-sm text-ink/70">
          {status === 'attending' ? 'Your Digital tickets and “Copy my link” show here for a real guest.' : 'A guest who can’t come sees no ticket.'}
        </p>
      </DoorShell>
    );
  }
  return (
    <DoorShell eyebrow="You’re invited" title="Ana & Ben" meta={meta} width="lg" lead={<div data-rsvp-progress-slot="" />}>
      <RsvpCanvasBridge />
      <p className="font-serif text-lg text-ink" data-reply-for="">
        {guest.display_name ?? `${guest.first_name} ${guest.last_name}`}
      </p>
      <p className="text-sm text-ink/70" data-rsvp-word={rsvpWordBridgeKey('reply-by')}>
        {rsvpReplyByLine('2026-11-18')}
      </p>
      <RsvpWidget
        words={words}
        guest={{ ...guest, plus_one_seats: [] }}
        eventId="00000000-0000-4000-8000-000000000000"
        eventPublicId="S89E-LAB0000000"
        faceMode="mode_b"
        doorAction={labRsvpNoop}
        offerSelfie={false}
        ask={resolveRsvpAsk({})}
        termsOnSend
        previewEveryQuestion
      />
    </DoorShell>
  );
}
