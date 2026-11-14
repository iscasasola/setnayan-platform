'use client';

/**
 * insights-param-pick.tsx — "Range ▾", "Churn window ▾", "Supplier ▾" on an Insights view.
 *
 * The approved drawing (`admin_pub/insights.html`) draws every such choice as ONE row with ONE dropdown
 * (`fr('Range', …, {raw: pick(…)})`) — never a native select with an Apply button, never a chip strip (the one-selector
 * rule, 2026-10-30). This is that row: the house `ChosenRow` (`PickMenu` inside the form row), and a pick moves the
 * address's one query parameter, keeping every other one (`tab`, `demo`, …). The view re-reads on the server, exactly
 * as the old GET form did — so no new read, no new action.
 */
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useContext, useTransition } from 'react';

import { ChosenRow, FormRows } from '@/app/_components/form-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function InsightsParamPick({
  name,
  param,
  value,
  options,
  about,
  drop = [],
}: {
  /** The row's name ("Range"). */
  name: string;
  /** The query parameter the pick writes (`range`, `quiet`, `vendor`). */
  param: string;
  value: string | null;
  options: readonly PickOption[];
  about?: string;
  /** Parameters a new pick clears (a stale `?ok=` notice, a page number). */
  drop?: readonly string[];
}) {
  // The context, not `useRouter()`: the same view is drawn by a lab and by a static render (a guard test), where no
  // router is mounted — there a pick falls back to an ordinary page load (the `bottom-nav.tsx` / `home-parts.tsx` way).
  const router = useContext(AppRouterContext);
  const [pending, start] = useTransition();
  return (
    <FormRows data={`insights-pick-${param}`} attrs={pending ? { 'data-pending': '' } : undefined}>
      <ChosenRow
        name={name}
        about={about ? { words: about } : null}
        value={value}
        options={options}
        onPick={(key) => {
          const next = new URLSearchParams(window.location.search);
          next.set(param, key);
          for (const d of drop) next.delete(d);
          const href = `${window.location.pathname}?${next.toString()}`;
          if (router) start(() => router.replace(href, { scroll: false }));
          else window.location.assign(href);
        }}
      />
    </FormRows>
  );
}
