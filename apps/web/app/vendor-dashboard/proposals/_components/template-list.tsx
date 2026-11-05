'use client';

/**
 * template-list.tsx — the Templates list on Proposals.
 *
 * 👈 A TEMPLATE'S DELETE IS ITS SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
 * VISIBLE ✕ ON ROWS"): left on a phone, the hover trash on a computer, named "Delete <template>". The row hides at once
 * and the delete is written after the Undo window (`deleteWithUndo`) by `deleteTemplate` — the same delete the
 * old trash's form posted, answered instead of redirected. A refusal brings it back and says so.
 * Held by proposals/a-template-deletes-by-swipe.test.ts.
 */

import { useState } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { deleteTemplate } from '../actions';

export type TemplateListRow = { template_id: string; template_name: string; body: string };

export function TemplateList({ templates }: { templates: TemplateListRow[] }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const shown = templates.filter((t) => !hidden.has(t.template_id));

  const remove = (t: TemplateListRow) =>
    deleteWithUndo({
      label: `${t.template_name} deleted`,
      hide: () => setHidden((h) => new Set(h).add(t.template_id)),
      restore: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(t.template_id);
          return next;
        }),
      commit: () => deleteTemplate(t.template_id),
      failed: `Couldn’t delete ${t.template_name}. It’s back — try again.`,
    });

  return (
    <>
      {shown.length > 0 ? (
        <ul className="mt-3 divide-y divide-ink/10">
          {shown.map((t) => (
            <SwipeToDelete
              key={t.template_id}
              as="li"
              label={`Delete ${t.template_name}`}
              onDelete={() => remove(t)}
              radiusClass=""
              surfaceClass="bg-[var(--m-paper)]"
            >
              <div className="min-w-0 py-2.5" data-proposal-template="">
                <p className="truncate text-sm font-medium">{t.template_name}</p>
                <p className="truncate text-xs text-ink/50">{t.body.slice(0, 90) || 'No body yet'}</p>
              </div>
            </SwipeToDelete>
          ))}
        </ul>
      ) : null}
      <UndoToastHost />
    </>
  );
}
