'use client';

import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * customers-pick.tsx — Customers' "Filter ▾" and "Show ▾", each ONE dropdown.
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED,
 * WITH THE THREE RECOMMENDED ANSWERS", frame 2): one Filter ▾ (the stage) and one
 * Show ▾ (the one column a phone row shows on its right) — the interaction rule
 * "3+ options → ONE dropdown, never a row of pills". This replaced the lane chip
 * row.
 *
 * It is the shipped `PickMenu`, not a new control — the same wrapper shape as the
 * People page's `PeopleViewPicker`: picking an option goes to that option's URL
 * (`?lane=` / `?show=`), so the list stays server-rendered, a filter is a link
 * you can share, and Back works. Every option carries its own href, built by the
 * server page, so this file decides nothing.
 */
export function CustomersPick({
  label,
  value,
  options,
  dataAttr,
  compact = false,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ key: string; label: string; href: string }>;
  dataAttr: string;
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <PickMenu
      label={label}
      value={value}
      compact={compact}
      options={options.map(({ key, label: l }) => ({ key, label: l }))}
      dataAttr={dataAttr}
      onPick={(key) => {
        const hit = options.find((o) => o.key === key);
        if (hit) router.push(hit.href, { scroll: false });
      }}
    />
  );
}
