import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import { acceptTermsNow } from './terms-reaccept-actions';

/**
 * 🔁 THE ONE-TIME RE-ASK — shown in place of the dashboard (never a redirect,
 * so it cannot loop) to an account with no agreement on record
 * (`needsTermsAgreement`). The same clickwrap every sign-up door uses:
 * unticked, required, above the press.
 */
export function TermsReaccept() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">One quick thing</h1>
      <p className="mt-3 text-base text-ink/70">Please agree to our Terms to keep planning.</p>
      <form action={acceptTermsNow} className="mt-8 space-y-6">
        <label htmlFor="reaccept-terms" className="flex min-h-[44px] items-start gap-3 text-sm text-ink/75">
          <input
            id="reaccept-terms"
            name={TERMS_FIELD}
            type="checkbox"
            required
            className="mt-0.5 h-5 w-5 shrink-0 accent-terracotta"
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="font-medium text-link underline-offset-2 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-link underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <SubmitButton className="button-primary min-h-[44px] w-full" pendingLabel="Saving…" overlay={false}>
          Continue
        </SubmitButton>
      </form>
    </main>
  );
}
