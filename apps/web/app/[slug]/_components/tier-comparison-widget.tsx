import Link from 'next/link';
import { papicGamesEnabled } from '@/lib/papic-games-flag';

export function TierComparisonWidget({ limited, eventNoun }: { limited: boolean; eventNoun: string }) {
  if (limited) {
    return (
      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your access
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
        </header>
        <p className="rounded-md border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          You&rsquo;re a +1 to your inviter. Your photos will appear in their gallery —
          ask them to show you. Want full access? You can register your own Setnayan account
          anytime — but for this wedding, you&rsquo;re invited as their +1.
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
              Shutter · Selfie Camera · Saved Forever · Reel builder
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
            <li>· See your tagged photos for <strong>3 days</strong></li>
            <li>· Save your QR to your phone</li>
          </ul>
          <p className="text-xs italic text-ink/50">
            Photos delete from your view after 3 days unless you sign up.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-terracotta/40 bg-gradient-to-br from-terracotta/10 to-cream p-5">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
            With Setnayan account
          </p>
          <p className="font-medium text-ink">Free · One-tap sign-up</p>
          <ul className="space-y-1 text-sm text-ink/75">
            <li>· Everything in Public</li>
            <li>· <strong>Shutter</strong> — capture &amp; tag photos as a guest</li>
            <li>· <strong>Selfie Camera</strong> — branded {eventNoun} selfie cam</li>
            {papicGamesEnabled() ? (
              <li>· <strong>Papic Challenges</strong> — fun mini-quests</li>
            ) : null}
            <li>· <strong>Saved Forever</strong> — photos kept permanently</li>
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
