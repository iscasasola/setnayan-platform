'use client';

import { useRouter } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/** The papers fold on Your details — where every "Get verified" lands. */
export const VERIFY_DOCS_ANCHOR = 'docs';
export const VERIFY_DOCS_HREF = `/vendor-dashboard/profile#${VERIFY_DOCS_ANCHOR}`;

/** The owner's own words for the reach case (2026-10-29, v13 note 4). */
export const UNVERIFIED_REACH_TITLE = 'Couples can’t find you by distance yet';
export const UNVERIFIED_LINE = 'You show up once you’re verified';

/**
 * 🛡 "GET VERIFIED" — THE ONE LINE FOR EVERYTHING BEING UNVERIFIED HOLDS BACK (owner 2026-10-29, Supplier dashboard v13
 * note 4: *"they are 0 because they are not yet verified. so we tell them… or just show a button (get verified)"* —
 * BOTH: the sentence AND the button).
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ Couples can't find you by distance yet          [Get verified] │
 *   │ You show up once you're verified                               │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * One component, so every place an unverified shop is held back says it the same way: Shop › Details' Where you work
 * (the reach is 0 km until verified) and Deep Search here; Find, live services and the rest reuse it (S3–S6). The
 * title names WHAT is held back; the line says why, in the same words everywhere.
 *
 * [Get verified] goes to Your details › Your documents (`#docs`) — the fold opens, its first step opens
 * (`VerifySection`), and the FIRST missing paper is highlighted and brought into view (`VerifyPairs`). On Your details
 * itself that is a move of the address, no request and no reload (the `OpenFoldButton` rule: pressed again on the same
 * address, it sends the `hashchange` itself); from any other page it goes there.
 *
 * Words wrap — a title is never cut (house rule). No frame: only the button is pressable.
 */
export function GetVerifiedLine({
  title,
  line = UNVERIFIED_LINE,
  data,
}: {
  /** What being unverified holds back, as the supplier feels it ("Couples can't find you by distance yet"). */
  title: string;
  line?: string;
  /** `data-get-verified="<data>"`. */
  data?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-2.5" data-get-verified={data ?? ''} role="group" aria-label={title}>
      <BadgeCheck aria-hidden className="h-5 w-5 shrink-0 text-sn-accent" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink/60">{line}</span>
      </span>
      <ActionButton
        tone="brand"
        main
        icon={BadgeCheck}
        label="Get verified"
        onClick={() => {
          if (!document.getElementById(VERIFY_DOCS_ANCHOR)) {
            router.push(VERIFY_DOCS_HREF);
            return;
          }
          const target = `#${VERIFY_DOCS_ANCHOR}`;
          if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
          else window.location.hash = target;
        }}
      />
    </div>
  );
}
