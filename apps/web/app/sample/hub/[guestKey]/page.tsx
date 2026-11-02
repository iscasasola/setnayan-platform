import { loadSampleGuestOrNotFound } from '@/lib/sample-event/switch.server';
import {
  SAMPLE_WORDS,
  sampleArriveBy,
  sampleChapters,
  sampleDay,
  sampleGuestName,
  sampleGuests,
  sampleGuestsArrive,
  sampleLookVars,
  sampleMarch,
  sampleMarchPlace,
  sampleScheduleBlocks,
  sampleSeat,
  SAMPLE_DAY_ONLY,
} from '@/lib/sample-event/hub';
import { samplePassSrc } from '@/lib/sample-event/pass';
import { guestGreetingOf } from '@/lib/guest-greeting';
import { guestRoleLabel } from '@/lib/guests';
import { GuestLookScope } from '@/app/[slug]/_components/guest-look-scope';
import { InvitationShell } from '@/app/[slug]/_components/invitation-shell';
import { MeGreeting } from '@/app/[slug]/_components/guest-greeting';
import { GuestTicket } from '@/app/[slug]/_components/guest-ticket';
import { GuestMeParts } from '@/app/[slug]/_components/guest-me-parts';
import { YourSeatBlock } from '@/app/[slug]/_components/your-seat-block';
import { ScheduleWidget } from '@/app/[slug]/_components/schedule-widget';
import { EntourageSection } from '@/app/[slug]/_components/entourage-section';
import { DressCodeWidget } from '@/app/[slug]/_components/dress-code-widget';
import { PaidMark } from '@/app/_components/paid-mark';

/**
 * `/sample/hub/[guestKey]` — the Event Hub as one sample guest (owner 2026-11-02:
 * "see the event hub of any guest"; first visible slice = the two persona guests,
 * `sample-guest-bride-cousin` and `sample-guest-maid-of-honor`).
 *
 * S2 (this slice) fills it with the sample's CONTENT, drawn by the SHIPPED Hub
 * parts — never a drawing of them: the guest tree's look (`GuestLookScope` +
 * `InvitationShell`), Me's greeting, the ticket (`GuestTicket`, its picture the
 * shipped renderer's PNG from `/sample/pass/<key>`), Your role · What to wear ·
 * Arrive by · Coming with you (`GuestMeParts`), the seat (`YourSeatBlock`, the
 * seat plan's own renderer), the day (`ScheduleWidget` by chapter), the Wedding
 * March (`EntourageSection`, march look) and the dress code (`DressCodeWidget`).
 * Every value comes from `lib/sample-event/hub.ts` over the fixtures — no table.
 *
 * S3 puts these into the Hub's own tabbed body (Welcome · Details · Me) with the
 * persona switcher and the sessionStorage edits. Nothing here posts anywhere.
 */
export default async function SampleGuestHubPage({ params }: { params: Promise<{ guestKey: string }> }) {
  const { guestKey } = await params;
  const { sample, guest } = await loadSampleGuestOrNotFound(guestKey);
  const now = new Date();
  const day = sampleDay(now);
  const [ceremony, reception] = sample.chapters;
  const seat = sampleSeat(guest);
  const march = sampleMarch();
  const comingWith = sampleGuests()
    .filter((g) => g.plus_one_of_guest_id === guest.guest_id)
    .map(sampleGuestName);
  /* The couple's words for roles (`events.role_names`): the sample keeps the usual ones, so it hands none. */
  const roleWord = guest.role === 'guest' ? null : guestRoleLabel(guest.role, null);
  const greeting = guestGreetingOf({
    name: sampleGuestName(guest),
    roleCode: guest.role,
    roleWord,
    sideLabel: guest.side === 'bride' ? 'Bride’s side' : guest.side === 'groom' ? 'Groom’s side' : null,
    date: day.label,
    venues: [
      { role: 'ceremony', name: ceremony?.location ?? null },
      { role: 'reception', name: reception?.location ?? null },
    ],
    venueName: null,
  });
  const look = {
    config: sample.dressCode,
    ceremonyType: 'catholic',
    genderSeparation: null,
    guestRole: guest.role,
    guestAttire: guest.attire,
    march: sampleMarchPlace(guest),
    rolePalette: sample.rolePalette,
    guestsArriveBy: sampleGuestsArrive(),
  };
  /* Me's parts, in the shipped order (`GUEST_ME_PARTS`), each only when its fact is set — `guestMePartsShown`'s rule. */
  const meParts = (['role', 'wear', 'arrive', 'guests'] as const).filter((p) =>
    p === 'role' ? roleWord !== null : p === 'arrive' ? sampleArriveBy(guest) !== null : p === 'guests' ? comingWith.length > 0 : true,
  );
  const vars = sampleLookVars();

  return (
    <GuestLookScope theme={null} art={null} fontClassName="" style={vars}>
      <InvitationShell monogramText="M & J" exitHref="/sample" stageLabel="Invitation">
        <div data-sample-hub={guest.guestKey} className="space-y-14">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70">
            Sample event · {day.daysToGo} days to go
          </p>

          <MeGreeting greeting={greeting} />

          <GuestTicket state="pass" name={sampleGuestName(guest)} invitationUrl={`/sample/hub/${guest.guestKey}`} src={samplePassSrc(guest.guestKey)} />

          <GuestMeParts parts={meParts} words={SAMPLE_WORDS} look={look} comingWith={comingWith} />

          {seat ? (
            <section data-sample-part="seat" className="space-y-3">
              <YourSeatBlock tableLabel={seat.tableLabel} venueName={reception?.location ?? null} plan={seat.plan} arrived={false} />
              <p className="text-center text-sm text-ink/70">
                Seat {seat.seatNumber} · with {seat.tablemates.slice(0, 3).join(', ')} and {seat.tablemates.length - 3} more
              </p>
            </section>
          ) : null}

          <section data-sample-part="schedule">
            <ScheduleWidget blocks={sampleScheduleBlocks(now)} eventTz={day.tz} estimated eventType="wedding" chapters={sampleChapters(now)} />
          </section>

          <section data-sample-part="march">
            <EntourageSection groups={march} sceneStyle="march" myGuestId={guest.guest_id} />
          </section>

          <section data-sample-part="dress-code">
            <DressCodeWidget
              words={SAMPLE_WORDS}
              config={sample.dressCode}
              ceremonyType="catholic"
              genderSeparation={null}
              guestRole={guest.role}
              guestAttire={guest.attire}
              march={sampleMarchPlace(guest)}
              rolePalette={sample.rolePalette}
              readerOnly
              hideWhenEmpty
            />
          </section>

          <section data-sample-part="day-only" className="space-y-4">
            <p className="pahina-eyebrow">
              <span>The Day</span>
            </p>
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {SAMPLE_DAY_ONLY.map((d) => (
                <li key={d.key} data-day-only={d.key} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-base font-medium text-ink">
                      {d.label}
                      {d.pro ? <PaidMark state="unlocked" label={`${d.pro} — part of Event Hub Pro`} size="sm" /> : null}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/70">{d.line}</p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-right text-xs text-ink/70">Opens on your wedding day</span>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </InvitationShell>
    </GuestLookScope>
  );
}
