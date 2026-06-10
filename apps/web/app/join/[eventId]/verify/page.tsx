import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { JoinShell, InvalidTokenScreen } from '../_components/join-shell';
import { maskEmail } from '@/lib/guest-claim';
import { verifyClaimOtpAction, resendClaimOtpAction, requestCoupleReviewAction } from '../claim-actions';

export const metadata = { title: 'Verify it’s you' };

const NOTICE: Record<string, string> = {
  resent: 'A fresh code is on its way.',
  cooldown: 'Hang on a few seconds before requesting another code.',
};
const ERROR: Record<string, string> = {
  bad_code: "That code didn't match. Check the email and try again.",
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
    .select('status, otp_sent_to')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user!.id)
    .maybeSingle();

  // Only the OTP step lands here; anything else routes to the right screen.
  if (!claim || claim.status === 'pending_review') redirect(`/join/${eventId}/pending?token=${token}`);
  if (claim?.status === 'confirmed') redirect(`/join/${eventId}/success?token=${token}`);
  if (claim?.status !== 'otp_sent' || !claim.otp_sent_to) {
    redirect(`/join/${eventId}/pending?token=${token}`);
  }

  const masked = maskEmail(claim!.otp_sent_to!);
  const errorMessage = error ? ERROR[error] ?? error : null;
  const noticeMessage = notice ? NOTICE[notice] ?? notice : null;

  return (
    <JoinShell event={event}>
      <h2 className="text-xl font-semibold text-ink">Confirm it&rsquo;s you</h2>
      <p className="mt-2 text-sm text-ink/70">
        We found you on the couple&rsquo;s guest list and emailed a 6-digit code to{' '}
        <span className="font-medium text-ink">{masked}</span>. Enter it below to finish.
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

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <form action={resendClaimOtpAction.bind(null, eventId, token)}>
          <button type="submit" className="text-terracotta underline-offset-2 hover:underline">
            Didn&rsquo;t get it? Resend the code
          </button>
        </form>
        <form action={requestCoupleReviewAction.bind(null, eventId, token)}>
          <button type="submit" className="text-ink/60 underline-offset-2 hover:underline">
            Can&rsquo;t access that email? Ask the couple to confirm you
          </button>
        </form>
      </div>
    </JoinShell>
  );
}
