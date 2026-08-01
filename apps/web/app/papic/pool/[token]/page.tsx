import { Camera, CircleAlert, Sparkles } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { resolvePapicPoolToken } from '@/lib/papic-pool-join';
import { joinPapicPool } from './actions';

/**
 * Papic POSTER QR — the page a scanner lands on.
 *
 * One QR per event, printed and put on a table. Anyone scans it, taps once, and
 * their phone is a camera shooting into the couple's shared pool. Owner-locked
 * 2026-08-01: no limit, first come first served.
 *
 * ── THIS PAGE MINTS NOTHING ──────────────────────────────────────────────────
 * It renders a button and nothing else. The camera, the anonymous session and
 * the seat are all created by the server ACTION, on POST. That split is the
 * whole defence against link previewers: paste this URL into a group chat and
 * the preview bot fetches it immediately — if the GET minted a camera, sharing
 * the poster would burn seats and auth rows before a single guest arrived.
 *
 * ── WHY IT SHOWS THE EVENT NAME ──────────────────────────────────────────────
 * A stranger who finds a printed QR should be able to tell whose party they are
 * about to shoot into BEFORE they tap. It is the one thing that turns "some
 * random QR" into an informed choice, and it costs one already-fetched field.
 */
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

/** Never say WHY a poster is dead — a dead token and a paused event look alike
 *  from outside, and distinguishing them tells a stranger about the event. */
function DeadPoster({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
      <h1 className="mt-3 text-center text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-center text-sm text-ink/65">{body}</p>
    </Shell>
  );
}

export default async function PapicPoolJoinPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { state } = await searchParams;

  if (state === 'invalid' || state === 'off') {
    return (
      <DeadPoster
        title="This camera link isn’t active"
        body="Ask whoever put up the code for a fresh one — this one isn’t open right now."
      />
    );
  }
  if (state === 'error') {
    return (
      <DeadPoster
        title="That didn’t go through"
        body="Nothing was saved. Tap back and give it one more go."
      />
    );
  }

  // Resolve for the NAME only — the action re-resolves and re-checks everything
  // before it mints anything, so nothing here is load-bearing.
  const target = await resolvePapicPoolToken(createAdminClient(), token);
  if (!target) {
    return (
      <DeadPoster
        title="This camera link isn’t active"
        body="Ask whoever put up the code for a fresh one — this one isn’t open right now."
      />
    );
  }

  return (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Sparkles aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        Shoot for {target.eventName ?? 'this event'}
      </h1>
      <p className="mt-3 text-sm text-ink/65">
        Tap once and your phone becomes a camera. Every photo you take lands
        straight in the host’s gallery — no app, no sign-up.
      </p>
      <form action={joinPapicPool} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <TurnstileField action="papic_pool_join" />
        <SubmitButton
          pendingLabel="Opening your camera…"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
        >
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          Start shooting
        </SubmitButton>
      </form>
      <p className="mt-3 text-center text-xs text-ink/50">
        Shots come from the host’s shared pool — when it runs out, it runs out.
      </p>
    </Shell>
  );
}
