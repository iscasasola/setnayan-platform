import type { ReactNode } from 'react';
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
  return (
    <div
      className="flex min-h-[60px] flex-wrap items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0"
      data-dates-row="helpers-member"
      data-team-member={memberId}
      data-team-duty={duty}
    >
      <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink/[0.05] text-[14px] font-bold text-ink/70">
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
      {/* The controls take their own line under the card, so a name is never squeezed to "Jo…" at 390 px. */}
      {end ? (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-1 pl-[52px]" data-team-member-controls="">
          {end}
        </div>
      ) : null}
    </div>
  );
}
