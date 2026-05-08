import type {
  Event,
  Guest,
  GuestRsvpExtras,
  Household,
} from "@/lib/db/types";
import { SiteHeader } from "./widgets/site-header";
import { HeroMonogram } from "./widgets/hero-monogram";
import { Greeting } from "./widgets/greeting";
import { Countdown } from "./widgets/countdown";
import { QrCodeWidget } from "./widgets/qr-code";
import { RsvpForm } from "./widgets/rsvp-form";
import { EventDetails } from "./widgets/event-details";
import { Venue } from "./widgets/venue";
import { Schedule } from "./widgets/schedule";
import { DressCode } from "./widgets/dress-code";
import { PhotoMoments } from "./widgets/photo-moments";
import { YourPhotos } from "./widgets/your-photos";
import { TierComparison } from "./widgets/tier-comparison";
import { InvitationFooter } from "./widgets/footer";
import { GenericLanding } from "./generic-landing";

interface Props {
  event: Event;
  guest: Guest | null;
  partner: Guest | null;
  household: Household | null;
  rsvpExtras: GuestRsvpExtras | null;
  qrSvg: string | null;
  isRegistered: boolean;
}

export function InvitationShell({
  event,
  guest,
  partner,
  household,
  rsvpExtras,
  qrSvg,
  isRegistered,
}: Props) {
  if (!guest || !qrSvg) {
    return <GenericLanding event={event} />;
  }

  return (
    <div className="invite-page min-h-screen bg-page-bg">
      <SiteHeader event={event} />

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-16 pt-6 lg:gap-10 lg:px-6 lg:pt-12">
        <HeroMonogram event={event} />
        <Greeting event={event} guest={guest} partner={partner} household={household} />
        <Countdown eventDateIso={`${event.event_date}T15:00:00`} />
        <QrCodeWidget qrSvg={qrSvg} />
        <RsvpForm
          guest={guest}
          partner={partner}
          rsvpDeadline={event.rsvp_deadline}
          rsvpExtras={rsvpExtras}
          isRegistered={isRegistered}
        />
        <EventDetails event={event} guest={guest} partner={partner} household={household} />
        <Venue event={event} />
        <Schedule eventDate={event.event_date} />
        <DressCode />
        <PhotoMoments />
        <YourPhotos guest={guest} />
        <TierComparison isRegistered={isRegistered} />
        <InvitationFooter event={event} />
      </main>
    </div>
  );
}
