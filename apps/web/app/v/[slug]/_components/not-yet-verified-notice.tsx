import { ShieldAlert } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { NOT_YET_VERIFIED_LINE } from '@/lib/findable-shop';

/**
 * "This shop is not yet verified by Setnayan" — DECISION_LOG 2026-11-07 ruling (4), the page half.
 *
 * Drawn on a shop's public page when the shop is open to everyone but Setnayan has not verified it yet
 * (`ownLinkOpensUnverified`, lib/findable-shop.ts): found in a list until its first inquiry, then reached only by
 * its own link and QR. In-app only — never an email. Not pressable, so it wears no frame: a band like the team
 * preview above it, one line, the details inside the ⓘ.
 */
export function NotYetVerifiedNotice() {
  return (
    <section aria-label={NOT_YET_VERIFIED_LINE} data-not-yet-verified className="border-b border-ink/10 bg-warn-50/70">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <ShieldAlert aria-hidden className="h-5 w-5 shrink-0 text-warn-800" strokeWidth={1.75} />
        <InfoTip label={NOT_YET_VERIFIED_LINE} labelClassName="text-sm font-medium text-ink" align="start">
          Setnayan has not checked this shop’s documents yet, so it has no Verified badge. Verified shops show the
          badge beside their name.
        </InfoTip>
      </div>
    </section>
  );
}
