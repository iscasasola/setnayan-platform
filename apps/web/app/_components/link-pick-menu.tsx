'use client';

import { useRouter } from 'next/navigation';
import {
  PickMenu,
  type PickOption,
} from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * THE SHARED `PickMenu`, FOR A CHOICE THAT IS A PAGE ADDRESS.
 *
 * Owner rule (2026-09-28, "again"): picking one of several options is ONE
 * dropdown showing the current choice, never a row of pills. Some of those rows
 * were rows of LINKS on a Server Component (a category filter, a lens) — each
 * option a URL, so the page stays server-rendered and survives a refresh. This
 * is the same dropdown with `onPick` = go to that option's address. It adds no
 * look of its own: the button and the list are `PickMenu`'s.
 */
export type LinkPickOption = PickOption & { href: string };

export function LinkPickMenu({
  label,
  value,
  options,
  dataAttr,
  className,
  buttonText,
}: {
  label: string;
  value: string | null;
  options: readonly LinkPickOption[];
  dataAttr?: string;
  className?: string;
  buttonText?: string;
}) {
  const router = useRouter();
  return (
    <PickMenu
      label={label}
      value={value}
      options={options}
      dataAttr={dataAttr}
      className={className}
      buttonText={buttonText}
      onPick={(key) => {
        const next = options.find((o) => o.key === key);
        if (next) router.push(next.href, { scroll: false });
      }}
    />
  );
}
