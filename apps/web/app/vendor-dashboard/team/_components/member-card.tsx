'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  VENDOR_DUTY_NAME,
  VENDOR_DUTY_LINE,
  memberWhereLine,
  roleIsRenamed,
  roleNameOf,
  type VendorDuty,
  type VendorRoleNames,
} from '@/lib/vendor-duties';

/**
 * 🪪 A TEAM MEMBER'S CARD (six supplier roles, owner 19 Nov 2026 — drawing (b)). The person's name; under it the shop's
 * OWN name for their role, gold, with the fixed role behind ⓘ; then where they work and what they do. The one card
 * for a person wherever the Team screen draws them — a role is never a free-text guess on one screen and a rank on
 * another. Not truncated: the ⓘ's popover must not be clipped.
 */
export function initialsOf(name: string): string {
  const parts = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  const two = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? ''));
  return two.toUpperCase() || '·';
}

export function TeamMemberCard({
  name,
  duty,
  names,
  branchLabel,
  cardCount,
  teamLabel,
  isSelf,
  end,
  aside,
  memberId,
}: {
  name: string;
  duty: VendorDuty;
  names: VendorRoleNames;
  branchLabel: string | null;
  cardCount?: number | null;
  teamLabel?: string | null;
  isSelf?: boolean;
  end?: ReactNode;
  /** A short mark beside the name (Owner). */
  aside?: ReactNode;
  memberId: string;
}) {
  const roleName = roleNameOf(names, duty);
  const where = memberWhereLine({ duty, branchLabel, cardCount, teamLabel, isSelf });
  const face = (
    <>
      <span
        aria-hidden
        className="grid h-10 w-10 flex-none place-items-center rounded-full bg-terracotta/10 text-[14px] font-bold text-terracotta"
        data-team-avatar=""
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink">{name}</span>
        <span className="mt-0.5 block text-[14px] font-semibold text-terracotta" data-team-role-name="">
          <InfoTip label={roleName} align="start">
            {roleIsRenamed(names, duty)
              ? `Role: ${VENDOR_DUTY_NAME[duty]} — ${VENDOR_DUTY_LINE[duty].toLowerCase()}. “${roleName}” is your shop’s name for it.`
              : `${VENDOR_DUTY_NAME[duty]} — ${VENDOR_DUTY_LINE[duty].toLowerCase()}.`}
          </InfoTip>
        </span>
        <span className="block truncate text-[13px] text-[color:var(--m-slate-2)]" data-team-where="">
          {where}
        </span>
      </span>
      {aside ?? null}
    </>
  );
  // Drawing (b): "Tapping a card opens the same Role ▾ · Branch ▾ as the invite (c), and × Remove." The card stays one
  // clean row; a tap opens its controls in place under it (rows: tap opens). A card with nothing to change is a plain row.
  if (!end) {
    return (
      <div
        className="flex min-h-[60px] items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0"
        data-dates-row="helpers-member"
        data-team-member={memberId}
        data-team-duty={duty}
      >
        {face}
      </div>
    );
  }
  return (
    <details
      className="group border-t border-ink/10 first:border-t-0"
      data-dates-row="helpers-member"
      data-team-member={memberId}
      data-team-duty={duty}
    >
      <summary
        // The ⓘ inside the card opens its own note; it must not also open the card's controls.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) e.preventDefault();
        }}
        className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
        {face}
        <ChevronDown
          aria-hidden
          className="h-4 w-4 flex-none text-ink/40 transition-transform duration-[var(--sn-dur-control)] group-open:rotate-180"
        />
      </summary>
      {/* The controls take their own line under the card, so a name is never squeezed to "Jo…" at 390 px. */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-1 pb-3 pl-[52px]" data-team-member-controls="">
        {end}
      </div>
    </details>
  );
}
