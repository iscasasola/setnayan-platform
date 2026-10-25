'use client';

import { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { TERMS_FIELD, TERMS_SAVE_FAILED_MESSAGE } from '@/lib/terms-agreement';
import { acceptTermsNow, type TermsAgreementResult } from './actions';

/**
 * 🔁 THE ONE-TIME TERMS RE-ASK (owner 2026-10-25, verbatim "Yes" to: *"after the no-refunds change, should everyone
 * re-agree to the Terms once on next login?"*). Who sees it is `needsTermsAgreement` (`lib/terms-agreement.ts`); the
 * couple, supplier and admin layouts mount it — and ONLY they do: a guest is not an account, so no guest page
 * (`app/[slug]/**`, `/invite/*`) ever mounts it (`lib/terms-reaccept.test.ts`).
 *
 *   · ONE sheet over the page (the house `Sheet` + `OverlayBackdrop`), never a redirect — a redirect can loop, and the
 *     page stays drawn underneath, so it is never a blank screen.
 *   · Title + one short line; the detail sits in the ⓘ. A link to /terms (outside every layout that mounts this, so
 *     the Terms can always be read). ONE "I agree".
 *   · 🔒 AFFIRMATIVE. The agreement is built INSIDE the press handler — nothing on the page pre-sets it, no hidden
 *     field, no pre-ticked box. The server action fails closed without it.
 *   · A failed save is SAID, with Retry, and the sheet stays. It closes only on a save that came back ok.
 *   · Closing it (×, Back, Esc, the dimmed space) puts it away for this visit only; it returns on the next one until
 *     they agree. It never traps anyone on a page they cannot leave.
 */
export function TermsReacceptSheet() {
  const titleId = useId();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function agree() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set(TERMS_FIELD, 'yes');
      let res: TermsAgreementResult;
      try {
        res = await acceptTermsNow(fd);
      } catch {
        res = { ok: false, message: TERMS_SAVE_FAILED_MESSAGE };
      }
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} rise>
      <div className="px-5 pb-4 pt-7" data-terms-reaccept="">
        <InfoTip
          label="Our Terms have changed"
          labelAs="h2"
          labelId={titleId}
          labelClassName="font-serif text-2xl leading-tight text-ink"
          align="start"
        >
          From 23 October 2026. If you paid for a service and can&rsquo;t use it, we turn what you paid into Papic
          credits for your event. Supplier bookings keep each supplier&rsquo;s own terms.
        </InfoTip>
        <p className="mt-2 text-base text-ink/70">What you buy from Setnayan is no longer refunded.</p>
        <Link
          href="/terms"
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-link underline underline-offset-2"
        >
          Read the Terms
        </Link>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[rgb(var(--color-danger))]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 [&>.ab]:w-full [&>.ab]:justify-center">
          <ActionButton
            tone="brand"
            main
            icon={Check}
            label={pending ? 'Saving…' : error ? 'Retry' : 'I agree'}
            name={error && !pending ? 'Retry — I agree to the Terms' : undefined}
            waiting={pending}
            onClick={agree}
            data-testid="terms-reaccept-agree"
          />
        </div>
      </div>
    </Sheet>
  );
}
