import { ShieldAlert } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { NOT_YET_VERIFIED_INFO, NOT_YET_VERIFIED_LINE } from '@/lib/findable-shop';

/**
 * 💬 "This shop is not yet verified by Setnayan" at the head of a couple's chat with that shop — DECISION_LOG
 * 2026-11-07 ruling (4): *"When they chat the business. we will also message them that this shop is not yet
 * verified."* In-app only, never an email.
 *
 * Mounted in the shipped `ChatThreadHead`'s `below` slot (its own second row under the muted line), so the head
 * keeps its one look. ONE quiet line, not a banner, and not pressable apart from the ⓘ, which holds the details —
 * the same words as the shop page's notice (`NOT_YET_VERIFIED_INFO`), so the two can never disagree.
 */
export function NotYetVerifiedThreadLine() {
  return (
    <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] leading-tight text-warn-800" data-thread-not-yet-verified="">
      <ShieldAlert aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <InfoTip label={NOT_YET_VERIFIED_LINE} labelClassName="text-[12px] text-warn-800" align="start">
        {NOT_YET_VERIFIED_INFO}
      </InfoTip>
    </p>
  );
}
