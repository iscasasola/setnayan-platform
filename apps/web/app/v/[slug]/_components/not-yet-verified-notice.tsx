import { ShieldAlert } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { NOT_YET_VERIFIED_INFO, NOT_YET_VERIFIED_LINE } from '@/lib/findable-shop';

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
    // 🌿 A soft card at the top of the calm column since 13 Nov 2026 (prototype `public_pages_three_2026-11-13`,
    // `.notice`) — was a full-width strip under the site header. Same words, same ⓘ.
    <section aria-label={NOT_YET_VERIFIED_LINE} data-not-yet-verified className="mb-6 rounded-2xl bg-warn-50/70">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <ShieldAlert aria-hidden className="h-5 w-5 shrink-0 text-warn-800" strokeWidth={1.75} />
        <InfoTip label={NOT_YET_VERIFIED_LINE} labelClassName="text-sm font-medium text-ink" align="start">
          {NOT_YET_VERIFIED_INFO}
        </InfoTip>
      </div>
    </section>
  );
}
