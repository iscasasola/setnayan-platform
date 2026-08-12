import Link from 'next/link';
import { Camera, LogIn, CircleAlert, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { claimPapicSeat } from '@/app/papic/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { papicSeatAnonEnabled } from '@/lib/papic-seats';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';

// Papic · seat claim (public)
//
// A couple shares one link per seat (`/papic/claim/[token]`). The friend opens
// it on their phone and claims the seat — binding it to a device so they can
// shoot through the capture surface (`/papic/seat/[token]`).
//
// LOGIN-FREE (flag NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED · 2026-06-21): when ON,
// the friend never sees a sign-in wall — they land on a single "Start shooting"
// button and one tap mints a native anonymous session + claims the seat + drops
// them in the camera. The tap can't be zero: claim happens on the POST, never on
// this GET, so a chat-app link-preview bot can't silently claim the seat. When
// OFF, the original sign-in gate is shown (graceful degrade).
//
// The claim itself goes through the SECURITY DEFINER papic_claim_seat() RPC
// (the seat isn't theirs yet, so RLS can't grant it — the token is the
// capability). This page only renders the claim CTA / sign-in gate + the
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

  // ---- Terminal states (checked first so they show whether or not a session
  //      was minted — the claim action redirects back here with ?state=…). ----

  // Already taken by someone else.
  if (state === 'taken') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This seat&rsquo;s already taken
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Someone else in the crew already claimed this one. Ask the host to
          send you a fresh seat link and you&rsquo;ll be good to go.
        </p>
      </Shell>
    );
  }

  // 🔴 BOT CHECK REFUSED — the link is FINE. Deliberately NOT folded into the
  // terminal branch below: that one says "ask the host for a new link", which
  // sends a crew member re-scanning a QR that was never the problem. This one
  // falls through to the claim CTA further down, so the form (and a FRESH
  // challenge) come back and one more tap works.
  const botCheckRefused = state === 'verify';

  // Invalid / expired / soft error.
  if (state === 'invalid' || state === 'error') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This link isn&rsquo;t active
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          The host may have reissued this seat. Ask them for your latest
          claim link and try again.
        </p>
      </Shell>
    );
  }

  // The claim CTA — one tap → claimPapicSeat. When login-free is on and the
  // friend has no account, the action mints a native anonymous session on that
  // POST; otherwise it claims under their existing session. Shared by the
  // signed-in and the login-free (no-account) paths.
  const showSignedInAs = Boolean(user && !isPlaceholderEmail(user.email));
  const claimCta = (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Sparkles aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        Claim your photo-crew seat
      </h1>
      <p className="mt-3 text-sm text-ink/65">
        Tap once and your phone turns into a candid camera for the day. Every
        photo you shoot lands straight in the host&rsquo;s gallery — no app to
        install{user ? '' : ', no sign-up'}.
      </p>
      {botCheckRefused ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-2 text-sm text-ink/80"
        >
          That didn&rsquo;t get past our quick &ldquo;are you a robot?&rdquo;
          check &mdash; usually just a tap that landed a second too early.
          Your link is fine. Give it one more go.
        </p>
      ) : null}
      <form action={claimPapicSeat} className="mt-5">
        <input type="hidden" name="token" value={token} />
        {/*
          🔴 THE STAMP THE ACTION ALREADY ASKED FOR. claimPapicSeat has read
          `captcha_token` off this form since captcha landed — and the form never
          carried one, so the comment there ("the claim form carries a
          <TurnstileField>") described a file that did not exist. Login-free
          claiming mints an ANONYMOUS session, which is the exact endpoint
          Supabase's captcha exists to protect, so with captcha on and no widget
          here every crew member scanning the poster is refused. Renders nothing
          until a site key is set.
        */}
        <TurnstileField action="papic_seat_claim" />
        <SubmitButton pendingLabel="Starting…" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600">
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          {user ? 'Claim my seat & start shooting' : 'Start shooting'}
        </SubmitButton>
      </form>
      {showSignedInAs ? (
        <p className="mt-3 text-xs text-ink/50">
          Signed in as {user?.email ?? 'your account'}.
        </p>
      ) : null}
    </Shell>
  );

  // Signed in (any account, incl. a returning anonymous claimer) → claim CTA.
  if (user) return claimCta;

  // Not signed in + login-free ON → the same CTA, no login wall (the POST mints
  // the anonymous session). This is the "scan → tap → camera" path.
  if (papicSeatAnonEnabled()) return claimCta;

  // Not signed in + login-free OFF → the original sign-in gate (graceful degrade).
  return (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Camera aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        You&rsquo;re invited to shoot
      </h1>
      {/* Type-neutral, like the signed-in branch above. Papic ships on all 16
          event types, and this seat may belong to a birthday, a reunion or a
          Simple Event — "one of the couple … their wedding photo crew" is wrong
          for 15 of them, and this page has no event loaded to derive a noun
          from (it resolves a SEAT TOKEN, not an event).
          🪤 This branch survived the 2026-07-31 copy sweep because it is the
          SIGNED-OUT one: every pass through this page was made while signed in,
          so the reviewed render was the other branch. A conditional's other
          arm is a surface you have not looked at. */}
      <p className="mt-3 text-sm text-ink/65">
        Someone asked you to be part of their photo crew. Sign in to claim your
        seat — then your phone becomes a candid camera and every shot lands in
        their gallery.
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
