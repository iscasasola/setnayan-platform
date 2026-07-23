import { GuestToHostCta } from '@/app/_components/guest-to-host-cta';

export function YourPhotosWidget({
  limited,
  eventId,
  eventPublicId,
  eventNoun,
}: {
  limited: boolean;
  eventId: string;
  eventPublicId: string;
  eventNoun: string;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your photos</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">All curated for you</h3>
      </header>

      <div className="rounded-lg border border-dashed border-ink/20 bg-cream p-5 text-center text-sm text-ink/60">
        All your photos will appear here after the event.
      </div>

      <div className="rounded-lg border border-ink/10 bg-cream p-5 text-sm">
        <p className="font-medium text-ink">Make sure a shutterbug snaps you on the {eventNoun} day</p>
        <p className="mt-1 text-ink/60">
          Your first tagged photo automatically becomes your profile picture in the gallery.
        </p>
      </div>

      {limited ? (
        <p className="text-xs text-ink/55">
          Your photos will be visible in your inviter&rsquo;s gallery.
        </p>
      ) : (
        <div className="rounded-lg border border-terracotta/30 bg-gradient-to-br from-terracotta/10 to-cream p-5 text-sm">
          <p className="font-medium text-ink">Add more via Shutter</p>
          <p className="mt-1 text-ink/65">
            You can also add your own photos and videos through Shutter, our in-app camera.
            Tag up to 5 guests per post — the couple is tagged for you automatically.
          </p>
          <p className="mt-3 text-xs italic text-ink/45">
            Shutter ships with the Setnayan native app (Phase 2).
          </p>
        </div>
      )}

      <GuestToHostCta
        surface="your_photos"
        eventId={eventId}
        eventPublicId={eventPublicId}
        headline="Want this for your own day?"
        sub="Capture every moment — start planning free."
      />
    </section>
  );
}
