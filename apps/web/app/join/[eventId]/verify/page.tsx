import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { JoinShell, InvalidTokenScreen } from '../_components/join-shell';
import { verifyClaimOtpAction, resendClaimOtpAction, requestCoupleReviewAction } from '../claim-actions';

export const metadata = { title: 'Confirm it’s you' };

const NOTICE: Record<string, string> = {
  // Conditional copy shown identically for matched + unmatched resends, so the
  // banner never reveals list membership (anti-enumeration).
  resent: "If you're on the couple's list, a fresh code is on its way.",
};
const ERROR: Record<string, string> = {
  // Deliberately generic: the same message for a wrong code, an expired code,
  // and a claim that has no code at all — so this page never reveals whether
  // the name is on the couple's list (anti-enumeration, RA 10173).
  bad_code: "That code didn't match or has expired. Check your email, or ask the couple to confirm you below.",
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string; error?: string; notice?: string }>;
};

export default async function VerifyPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { token = '', error, notice } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/verify?token=${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('display_name, event_date, venue_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return <InvalidTokenScreen />;

  const { data: claim } = await admin
    .from('guest_claims')
    .select('status')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user!.id)
    .maybeSingle();

  // Already confirmed → straight to success. No claim at all → start over.
  if (claim?.status === 'confirmed') redirect(`/join/${eventId}/success?token=${token}`);
  if (!claim) redirect(`/join/${eventId}?token=${token}`);

  const errorMessage = error ? ERROR[error] ?? error : null;
  const noticeMessage = notice ? NOTICE[notice] ?? notice : null;

  // IMPORTANT: this screen renders IDENTICALLY whether the claim is otp_sent
  // (a code really was emailed) or pending_review (no/ambiguous match — the
  // couple will confirm). The copy covers both so the page leaks no signal.
  return (
    <JoinShell event={event}>
      <h2 className="text-xl font-semibold text-ink">Confirm it&rsquo;s you</h2>
      <p className="mt-2 text-sm text-ink/70">
        If the couple has you on their guest list, we&rsquo;ve emailed you a 6-digit code —
        enter it below. Not expecting one? The couple may confirm you directly (you can ask
        them to below), and we&rsquo;ll email you when you&rsquo;re in.
      </p>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}
      {noticeMessage ? (
        <p className="mt-4 rounded-md border border-ink/10 bg-ink/5 px-4 py-3 text-sm text-ink/70">
          {noticeMessage}
        </p>
      ) : null}

      <form action={verifyClaimOtpAction.bind(null, eventId, token)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-medium text-ink">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            placeholder="123456"
            className="input-field text-center text-2xl tracking-[0.5em]"
          />
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Verifying…">
          Verify &amp; join
        </SubmitButton>
      </form>

      {/* Recovery actions — the hardest things to hit at the exact moment the
          code didn't arrive. Give them real ≥44px, full-width hit areas with
          readable contrast (Guest Legibility Floor), not bare 17px text links. */}
      <div className="mt-6 flex flex-col gap-2 text-base">
        <form action={resendClaimOtpAction.bind(null, eventId, token)}>
          <SubmitButton
            pendingLabel="Resending…"
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-ink/15 px-4 py-2.5 font-medium text-terracotta transition hover:bg-terracotta/5"
          >
            Didn&rsquo;t get a code? Resend it
          </SubmitButton>
        </form>
        <form action={requestCoupleReviewAction.bind(null, eventId, token)}>
          <SubmitButton
            pendingLabel="Requesting…"
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-ink/15 px-4 py-2.5 font-medium text-ink/80 transition hover:bg-ink/5"
          >
            Can&rsquo;t access that email? Ask the couple to confirm you
          </SubmitButton>
        </form>
      </div>
    </JoinShell>
  );
}
