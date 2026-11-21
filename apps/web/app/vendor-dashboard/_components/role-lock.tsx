import { Lock } from 'lucide-react';
import {
  VENDOR_CAPABILITY_WORDS,
  VENDOR_DUTY_NAME,
  roleIsRenamed,
  roleNameOf,
  whoCanOpen,
  type VendorCapability,
  type VendorDuty,
  type VendorRoleNames,
} from '@/lib/vendor-duties';

/**
 * 🔒 A ROLE LOCK — what a teammate sees on a screen their role does not open (six supplier roles, owner 19 Nov 2026).
 * Never a blank page and never a bounce with nothing said: the Problem (your role does not open this) and the
 * Solution (who does, and how to get it), the house rule for every lock ("always show the Problem and Solution",
 * owner 10 Nov 2026). The SERVER gate is the page's own — this only says what that gate decided.
 */
export function roleLockWords(input: {
  duty: VendorDuty | null;
  names?: VendorRoleNames | null;
  capability: VendorCapability;
}): { problem: string; solution: string } {
  const what = VENDOR_CAPABILITY_WORDS[input.capability];
  const yours = input.duty
    ? roleIsRenamed(input.names, input.duty)
      ? `${roleNameOf(input.names, input.duty)} (${VENDOR_DUTY_NAME[input.duty]})`
      : VENDOR_DUTY_NAME[input.duty]
    : null;
  return {
    problem: yours ? `Your role, ${yours}, doesn’t open ${what}.` : `We couldn’t read your role here, so ${what} stays closed.`,
    solution: `Ask a ${whoCanOpen(input.capability)} — they can do it, or a Shop Manager can change your role on Team.`,
  };
}

export function RoleLock({
  duty,
  names,
  capability,
  className = '',
}: {
  duty: VendorDuty | null;
  names?: VendorRoleNames | null;
  capability: VendorCapability;
  className?: string;
}) {
  const { problem, solution } = roleLockWords({ duty, names, capability });
  return (
    <div className={`border-y border-ink/10 py-4 ${className}`} data-role-lock={capability} role="status">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Lock aria-label="Locked" className="h-4 w-4 flex-none text-ink/55" strokeWidth={2} />
        {VENDOR_CAPABILITY_WORDS[capability].replace(/^./, (c) => c.toUpperCase())}
      </p>
      <p className="hc-k2 pt-3">The problem</p>
      <p className="pt-1 text-[15px] leading-snug text-ink" data-role-lock-problem="">
        {problem}
      </p>
      <p className="hc-k2 pt-3">The solution</p>
      <p className="pt-1 text-[15px] leading-snug text-ink" data-role-lock-solution="">
        {solution}
      </p>
    </div>
  );
}
