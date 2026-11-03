'use client';

import { useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { UndoToastHost } from '../guests/_components/undo-toast';

/**
 * 👈 A ROW THAT ASKS BEFORE IT DELETES, ON THE SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST
 * ROW — NO VISIBLE ✕ ON ROWS"). For server-drawn rows whose trash was a `ConfirmForm` (`app/_components/confirm-form.tsx`):
 * the row is wrapped in THE ONE SWIPE, the swipe asks the SAME question (title · message · confirm word) in the shared
 * confirm dialog, then the delete waits out the Undo window (`deleteWithUndo`) and is written through the SAME server
 * action with the SAME hidden fields. Cancel springs the row shut.
 */
export function ConfirmSwipe({
  action,
  fields,
  title,
  message,
  confirmLabel = 'Delete',
  label,
  undoLabel,
  word = 'Delete',
  className,
  children,
}: {
  /** The server action the old `<ConfirmForm action>` posted to. */
  action: (fd: FormData) => Promise<unknown>;
  /** The old form's hidden inputs, name → value. */
  fields: Record<string, string>;
  title: string;
  message: string;
  confirmLabel?: string;
  /** The swipe button's name — "Delete Venue deposit". */
  label: string;
  /** What the Undo toast says — "Venue deposit deleted". */
  undoLabel: string;
  word?: string;
  /** The row's own ground, corners and layout (drawn inside the swipe's front). */
  className: string;
  children: ReactNode;
}) {
  const { confirm, dialog } = useConfirm();
  const [gone, setGone] = useState(false);
  if (gone) return <li hidden data-swipe-gone="" />;
  return (
    <>
      <UndoToastHost />
      {dialog}
      <SwipeToDelete
        as="li"
        label={label}
        word={word}
        radiusClass="rounded-md"
        onDelete={(close) =>
          void (async () => {
            const ok = await confirm({ title, body: message, confirmLabel, cancelLabel: 'Keep it', destructive: true });
            if (!ok) return close();
            deleteWithUndo({
            label: undoLabel,
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: async () => {
              const fd = new FormData();
              for (const [k, v] of Object.entries(fields)) fd.set(k, v);
              await action(fd);
            },
          });
          })()
        }
      >
        <div className={className}>{children}</div>
      </SwipeToDelete>
    </>
  );
}
