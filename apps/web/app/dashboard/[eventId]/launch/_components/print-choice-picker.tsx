'use client';

import { useContext } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ChosenRow, FormRows } from '@/app/_components/form-row';

/**
 * ONE DROPDOWN FOR A CHOICE ON PRINTS & TICKETS — owner 2026-09-28, looking at
 * the Event pass format pills: *"if there are choices, again. us drop down
 * menu"* (DECISION_LOG "ANY SET OF CHOICES IS A DROPDOWN — NOT A ROW OF
 * PILLS"). The Maker's shared `PickMenu` (portal + flip placement, #6035) —
 * never a second dropdown. Picking navigates to the same address the old pill
 * linked to, so the chosen size or look is still just the page's address.
 *
 * The router is read from its context rather than `useRouter()`, which THROWS
 * outside the app router — the Prints panel is also rendered to static markup
 * by its tests (`paid-mark.test.ts`); there, and only there, a pick falls back
 * to an ordinary navigation.
 */
export function PrintChoicePicker({
  label,
  value,
  options,
  dataAttr,
  row,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<PickOption & { href: string }>;
  dataAttr?: string;
  /**
   * 🧭 Studio › Prints: the pick drawn as a FORM ROW (`ChosenRow` — the piece's name on the left, its sizes as the row's small line, the
   * house dropdown on the right). The pick is the same: it navigates to the same address.
   */
  row?: { name: string; line?: string };
}) {
  const router = useContext(AppRouterContext);
  const onPick = (key: string) => {
    const hit = options.find((o) => o.key === key);
    if (!hit || key === value) return;
    if (router) router.push(hit.href, { scroll: false });
    else window.location.assign(hit.href);
  };
  if (row) {
    return (
      <FormRows data="print-size" attrs={{ 'data-studio-print-rows': '' }}>
        <ChosenRow
          name={row.name}
          line={row.line}
          label={label}
          value={value}
          dataAttr={dataAttr}
          options={options.map(({ href: _href, ...o }) => o)}
          onPick={onPick}
        />
      </FormRows>
    );
  }
  return (
    <PickMenu
      label={label}
      value={value}
      options={options.map(({ href: _href, ...o }) => o)}
      dataAttr={dataAttr}
      onPick={onPick}
    />
  );
}
