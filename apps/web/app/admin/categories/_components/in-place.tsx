'use client';

/**
 * in-place.tsx — the category and service controls whose shipped actions
 * answer in JSON instead of redirecting: Group ▾ (moveTileToFolder), Order ▾
 * (reorderCategories), Delete category… (deleteTileWithDestination) and
 * Combine into another service… (mergeCanonicalService). Each runs the action,
 * says what happened right where the admin is, and refreshes the page.
 *
 * The actions arrive BOUND to the record they act on (`fn.bind(null, id)` in
 * the server panel), so this file never decides which record is edited.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useConfirm } from '@/app/_components/confirm-dialog';
import type { Choice } from './pickers';
import { reordered } from './model';
import { INPUT_IN_PLACE, SaidLine as Said, useInPlace } from './drawer-kit';

const DANGER_BUTTON =
  'sn-press inline-flex min-h-11 items-center justify-center rounded-full border border-danger-700/50 px-4 text-sm font-semibold text-danger-700 hover:bg-danger-700/5 disabled:opacity-40';

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * ⚡ Every write here revalidates /admin/categories: its own answer redraws the page — no refresh after it. Inside the
 * drawer the answer is the drawer's toast (with Undo where the old value is known); elsewhere it is said beside the
 * control.
 */
function useRun() {
  const ip = useInPlace();
  const run = (fn: () => Promise<Result>, what: string, undo?: () => Promise<Result>) =>
    ip.run(fn, { what, said: (m) => m, undo });
  return { pending: ip.pending, said: ip.local, run };
}

/** Group ▾ — move a category to another group. */
export function MoveGroupPick({
  groupId,
  groups,
  move,
}: {
  groupId: string;
  groups: readonly Choice[];
  move: (newGroupId: string) => Promise<Result>;
}) {
  const { pending, said, run } = useRun();
  return (
    <div className={pending ? 'opacity-60' : undefined}>
      <PickMenu
        label="Group"
        value={groupId}
        options={groups.map((g) => ({ key: g.key, label: g.label }))}
        compact
        className="border border-ink/15"
        onPick={(key) => {
          if (key !== groupId) run(() => move(key), 'Group', () => move(groupId));
        }}
      />
      <Said said={said} />
    </div>
  );
}

const ORDER_CHOICES = [
  { key: 'up', label: 'Move up' },
  { key: 'down', label: 'Move down' },
  { key: 'top', label: 'To the top' },
  { key: 'end', label: 'To the end' },
] as const;

/** Order ▾ — Move up · Move down · To the top · To the end, within the group. */
export function OrderPick({
  id,
  siblings,
  save,
}: {
  id: string;
  siblings: readonly string[];
  save: (orderedIds: string[]) => Promise<Result>;
}) {
  const { pending, said, run } = useRun();
  return (
    <div className={pending ? 'opacity-60' : undefined}>
      <PickMenu
        label="Order"
        value=""
        buttonText="Move"
        options={ORDER_CHOICES.map((c) => ({ key: c.key, label: c.label }))}
        compact
        className="border border-ink/15"
        onPick={(how) => {
          const next = reordered(siblings, id, how);
          if (next.join() !== siblings.join()) run(() => save(next), 'Order', () => save([...siblings]));
        }}
      />
      <Said said={said} />
    </div>
  );
}

/** Delete category… — pick where everything goes; nothing is stranded. */
export function DeleteCategory({
  label,
  holds,
  destinations,
  remove,
  goToAfter,
}: {
  label: string;
  /** Services + "what couples choose" cards it still holds. */
  holds: number;
  destinations: readonly Choice[];
  remove: (destinationId?: string) => Promise<Result>;
  goToAfter: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [dest, setDest] = useState('');
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const needsDest = holds > 0;
  const destLabel = destinations.find((d) => d.key === dest)?.label ?? '';
  return (
    <div className="space-y-2">
      {dialog}
      {needsDest ? (
        <PickMenu
          label="Move everything to"
          value={dest}
          buttonText={dest ? destLabel : '— choose a category —'}
          options={destinations.map((d) => ({ key: d.key, label: d.label, group: d.group }))}
          compact
          className="border border-ink/15"
          onPick={setDest}
        />
      ) : null}
      <button
        type="button"
        disabled={(needsDest && !dest) || pending}
        onClick={async () => {
          const ok = await confirm({
            title: `Delete ${label}?`,
            body: needsDest ? `Everything it holds moves to ${destLabel}. Keys and links stay the same.` : 'It is empty, so it goes outright.',
            destructive: true,
            confirmLabel: 'Delete',
          });
          if (!ok) return;
          start(async () => {
            const res = await remove(needsDest ? dest : undefined);
            if (res.ok) {
              router.push(goToAfter);
            } else {
              setSaid({ ok: false, text: res.error });
            }
          });
        }}
        className={DANGER_BUTTON}
      >
        {pending ? 'Deleting…' : `Delete ${label}`}
      </button>
      {said ? <Said said={said} /> : null}
    </div>
  );
}

/**
 * Combine into another service… — fold this service into a sibling. Confirmed
 * by TYPING THE NAME: every supplier listed under it moves, and there is no
 * un-combine. The targets are the service's own siblings (combining across
 * categories is a move first, then a combine).
 */
export function CombineService({
  name,
  targets,
  combine,
}: {
  name: string;
  targets: readonly Choice[];
  combine: (destinationKey: string) => Promise<Result>;
}) {
  const { pending, said, run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [dest, setDest] = useState('');
  const [typed, setTyped] = useState('');
  if (targets.length === 0) return <p className="text-xs text-ink/60">No other service in this category to combine with.</p>;
  const armed = dest !== '' && typed.trim() === name;
  return (
    <div className="space-y-2">
      {dialog}
      <PickMenu
        label="Combine into"
        value={dest}
        buttonText={dest ? targets.find((t) => t.key === dest)?.label : '— choose —'}
        options={targets.map((t) => ({ key: t.key, label: t.label }))}
        compact
        className="border border-ink/15"
        onPick={setDest}
      />
      <label className="block text-xs text-ink/70">
        Type the name to confirm
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={name}
          className={`mt-1 ${INPUT_IN_PLACE}`}
        />
      </label>
      <button
        type="button"
        disabled={!armed || pending}
        onClick={async () => {
          const into = targets.find((t) => t.key === dest)?.label ?? dest;
          const ok = await confirm({
            title: `Combine ${name} into ${into}?`,
            body: 'Every supplier moves. This cannot be undone.',
            destructive: true,
            confirmLabel: 'Combine',
          });
          if (ok) run(() => combine(dest), 'Combine');
        }}
        className={DANGER_BUTTON}
      >
        {pending ? 'Combining…' : 'Combine'}
      </button>
      <Said said={said} />
    </div>
  );
}
