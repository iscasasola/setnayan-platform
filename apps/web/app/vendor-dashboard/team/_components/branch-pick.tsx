'use client';

/**
 * 🏢 THE BRANCH, ONE DROPDOWN (final check B14, drawing § B14): "Branch: Quezon City · 2 ▾" — the house `PickMenu` (a
 * sheet of the branches with their Account Manager counts on a phone, a list under the button on a computer) instead of
 * a row of pill links. Picking one redraws the section in place (the address is replaced, nothing scrolls).
 */
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function BranchPick({ options, value, hrefOf }: { options: readonly { key: string; label: string }[]; value: string; hrefOf: Record<string, string> }) {
  const router = useRouter();
  const current = options.find((o) => o.key === value);
  return (
    <PickMenu
      label="Branch"
      value={value}
      options={options}
      buttonText={`Branch: ${current?.label ?? ''}`}
      onPick={(key) => {
        const to = hrefOf[key];
        if (to) router.replace(to, { scroll: false });
      }}
      dataAttr="data-team-inquiries-branch"
    />
  );
}
