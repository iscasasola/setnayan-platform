import type { EventWords } from '../_lib/event-words';
import Link from 'next/link';
import { papicGamesEnabled } from '@/lib/papic-games-flag';

export function TierComparisonWidget({
  limited,
  eventNoun,
  words,
}: {
  limited: boolean;
  eventNoun: string;
  /** The event type's own words. Passed in rather than resolved here so this
   *  stays a presentational widget. */
  words: EventWords;
}) {
  if (limited) {
    return (
      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your access
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
        </header>
        <p className="rounded-md border-l-2 border-ink/30 bg-paper-deep px-4 py-3 text-sm text-ink/75">
          You&rsquo;re a +1 to your inviter. Your photos will appear in their gallery —
          ask them to show you. Want full access? You can register your own Setnayan account
          anytime — but for this {words.eventWord}, you&rsquo;re invited as their +1.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-dashed border-ink/15 bg-cream p-5 opacity-55">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
              Public
            </p>
            <p className="text-sm text-ink/60">View invitation · RSVP · 3-day photo window</p>
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-terracotta/30 bg-cream p-5 opacity-55">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
              Registered (locked for +1s)
            </p>
            <p className="text-sm text-ink/60">
              Shutter · Selfie Camera · Saved · Reel builder
            </p>
          </div>
        </div>
        <a
          href="https://setnayan.com"
          className="button-secondary inline-flex"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more about Setnayan
        </a>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your access</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-ink/15 bg-cream p-5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
            Public · As you are now
          </p>
          <p className="font-medium text-ink">Free · No sign-up needed</p>
          <ul className="space-y-1 text-sm text-ink/70">
            <li>· View this invitation</li>
            <li>· RSVP for the {eventNoun}</li>
            <li>· See your tagged photos through the {eventNoun}</li>
            <li>· Save your QR to your phone</li>
          </ul>
          {/* 🔴 THIS CARD PROMISED SOMETHING WE DO NOT DO. It read "See your
              tagged photos for 3 days" and "Photos delete from your view after
              3 days unless you sign up." There is NO 3-day mechanism anywhere
              in the product, and "delete" contradicts the owner's standing lock
              — photos are never deleted, only compressed, and the gallery is
              kept for life. So the card applied false pressure at the exact
              moment a guest decides whether to trust us, and put a promise in
              writing that we do not keep.
              What is TRUE is narrower and is already said correctly by the
              sibling card in site-body.tsx: the accountless GUEST VIEW winds
              down about a day after the event (`accountlessPhotosClosed`). The
              photographs are untouched. */}
          <p className="text-xs italic text-ink/60">
            Nothing is ever deleted — the guest view just winds down about a day
            after the {eventNoun}. A free account keeps it open on any device.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-terracotta/40 bg-gradient-to-br from-terracotta/10 to-cream p-5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
            With Setnayan account
          </p>
          <p className="font-medium text-ink">Free · One-tap sign-up</p>
          <ul className="space-y-1 text-sm text-ink/75">
            <li>· Everything in Public</li>
            {/* NAMES THE PRODUCT (2026-07-30). This card pitched guest capture as
                "Shutter" and never once said "Papic" — the guest-facing surface for
                the couple's flagship capture product, selling it anonymously. A
                guest who reads "Papic" here can recognise it on the couple's site,
                in the help centre and on /papic; "Shutter" is a button, not a
                product. No count and no price: what this event actually holds is
                resolved on the capture surface itself. */}
            <li>
              · <strong>Papic</strong> — shoot candids for {words.theOrganizer} from your own
              phone
            </li>
            <li>· <strong>Selfie Camera</strong> — branded {eventNoun} selfie cam</li>
            {papicGamesEnabled() ? (
              <li>· <strong>Papic Challenges</strong> — fun mini-quests</li>
            ) : null}
            <li>· <strong>Saved for life</strong> — every photo kept, free</li>
            <li>· Build your own souvenir reel</li>
          </ul>
          <Link href="/signup" className="button-primary inline-flex">
            Sign up free →
          </Link>
        </div>
      </div>
    </section>
  );
}
