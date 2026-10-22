'use client';

import { useRouter } from 'next/navigation';
import { ListFilter } from 'lucide-react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { peopleViewHref, type PeopleView, type PeopleViewGates } from '@/lib/people-views';

/**
 * people-view-picker.tsx — the People page's ONE picker (owner 2026-09-28:
 * *"any set of choices is a dropdown"*, and *"People is same as Alaga and
 * Samahan"*). It is the shipped `PickMenu`, not a new control: a button showing
 * the open view, a tap lists the rest, and picking one goes to that view's URL
 * — the same `?view=` the rail's rows link to, so a view is shareable, the Back
 * button works, and the rail lights the row the page opened.
 *
 * ⚠ `PickMenu`'s `value` is an option KEY, never a label (the Access dropdown
 * shipped showing nothing because it was handed a label — see
 * `the-access-dropdown-shows-its-level.test.ts`). The labels carry the counts,
 * so they change; the keys do not.
 *
 * 2026-10-22 — IT MOVED FROM THE TOP INTO THE THUMB ROW, AS ≡ (owner, pointing at "Connected 2 ▾": *"remove
 * it"*). The counts line is the top now; this list holds what the counts do not: Your people · Following ·
 * Followers · Groups — the seat the Guest list keeps its groups in. Loved ones and Requests left it: they are
 * a folded section and the "asking you" count. The button draws only the ≡ (every option carries it).
 */
export function PeopleViewPicker({
  view,
  options,
  gates,
}: {
  view: PeopleView;
  options: readonly PickOption[];
  gates: PeopleViewGates;
}) {
  const router = useRouter();
  return (
    <PickMenu
      label="People view"
      value={view}
      options={options.map((o) => ({ ...o, icon: <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))}
      dataAttr="data-people-view-picker"
      onPick={(key) => router.push(peopleViewHref(key as PeopleView, gates))}
    />
  );
}
