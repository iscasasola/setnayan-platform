import Link from 'next/link';
import { Camera, LogIn, CircleAlert, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { claimPapicSeat } from '@/app/papic/actions';

// Papic · seat claim (public)
//
// A couple shares one link per seat (`/papic/claim/[token]`). The friend opens
// it on their phone, signs in, and claims the seat — binding it to their
// account so they can shoot through the capture surface (`/papic/seat/[token]`).
//
// The claim itself goes through the SECURITY DEFINER papic_claim_seat() RPC
// (the seat isn't theirs yet, so RLS can't grant it — the token is the
// capability). This page only renders the sign-in gate + the claim CTA + the
// taken/invalid states; the action does the binding + the redirect to capture.
//
// Public route — no dashboard chrome. Token-gated; nothing here reads a seat
// row directly (RLS would block a non-claimer anyway).

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 shadow-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Papic · photo crew
        </p>
        {children}
      </div>
    </main>
  );
}

export default async function PapicClaimPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { state } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → invite them to sign in, then bounce back here to claim.
  if (!user) {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Camera aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          You&rsquo;re invited to shoot
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          One of the couple asked you to be part of their wedding photo crew.
          Sign in to claim your seat — then your phone becomes a candid camera
          and every shot lands in their gallery.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/papic/claim/${token}`)}`}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
        >
          <LogIn aria-hidden className="h-4 w-4" strokeWidth={2} />
          Sign in to claim my seat
        </Link>
      </Shell>
    );
  }

  // Already taken by someone else.
  if (state === 'taken') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This seat&rsquo;s already taken
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Someone else in the crew already claimed this one. Ask the couple to
          send you a fresh seat link and you&rsquo;ll be good to go.
        </p>
      </Shell>
    );
  }

  // Invalid / expired / soft error.
  if (state === 'invalid' || state === 'error') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This link isn&rsquo;t active
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          The couple may have reissued this seat. Ask them for your latest
          claim link and try again.
        </p>
      </Shell>
    );
  }

  // Signed in + fresh link → claim CTA.
  return (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Sparkles aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        Claim your photo-crew seat
      </h1>
      <p className="mt-3 text-sm text-ink/65">
        Claim this seat and your phone turns into a candid camera for the
        wedding. Every photo you shoot lands straight in the couple&rsquo;s
        gallery — no app to install.
      </p>
      <form action={claimPapicSeat} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
        >
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          Claim my seat &amp; start shooting
        </button>
      </form>
      <p className="mt-3 text-xs text-ink/50">
        Signed in as {user.email ?? 'your account'}.
      </p>
    </Shell>
  );
}
