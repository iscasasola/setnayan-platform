import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';

/**
 * SecureAccountBanner — the anon-draft safety net.
 *
 * Shown across the dashboard ONLY while the signed-in principal is a Supabase
 * native anonymous user (they finished onboarding without an account). Their
 * plan lives under an anonymous uid tied to this browser; if they clear cookies
 * or switch devices before adding an email, they lose access. This is the calm,
 * persistent nudge to convert — linking to the normal signup form, which
 * detects the anon session and attaches the email to the SAME uid (their plan
 * is preserved, no re-entry). It disappears the moment they convert because
 * `user.is_anonymous` flips to false.
 *
 * `next` routes them back to the dashboard after they secure + re-login.
 */
export function SecureAccountBanner({ next = '/dashboard' }: { next?: string }) {
  return (
    <div className="border-b border-champagne-gold/40 bg-champagne-gold/15">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-6">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={1.9} />
        <p className="min-w-0 flex-1 text-sm text-ink/80">
          <span className="font-medium text-ink">Your plan isn&rsquo;t saved to an account yet.</span>{' '}
          Add an email so you can sign in on any device and never lose it.
        </p>
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mulberry px-4 py-1.5 text-sm font-medium text-cream hover:bg-mulberry-600"
        >
          Secure my plan
          <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
