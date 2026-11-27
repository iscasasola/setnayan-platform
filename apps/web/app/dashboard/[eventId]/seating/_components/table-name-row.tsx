'use client';

import { useId, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import {
  autoNameFor,
  hostNameClash,
  tableDisplayNames,
  tableNameInfos,
  tableNameWhyWords,
  type NameGroups,
  type NameSeat,
  type NameTable,
} from '@/lib/table-auto-name';

/**
 * 🪑 THE NAME ROW (seat plan § 4.3, owner ruling R6 — the approved clickable prototype
 * `prototypes/seat_table_flow_2026-11-27/index.html`, This table ▾ › Name):
 *   · the box holds the host's name, or shows the auto name as its placeholder;
 *   · the line under it says why: "Auto · 9 of 10 seated here are Reyes family" · "Auto · no group has more than half
 *     the seats yet" · "Named by you · moving guests never changes it";
 *   · "Use the auto name · <name>" when the name is the host's; an empty Save does the same;
 *   · a name another table already shows is refused in place, before any save ("<name> already has that name.").
 * Every name here is read through the ONE reader, `tableDisplayNames` (lib/table-auto-name.ts). Save is the sheet's
 * one main button and goes through the editor's own rename (`onSave` → `updateTableLabel`, which re-checks the clash).
 */
export function TableNameSheet({
  open,
  onClose,
  tableId,
  tables,
  seated,
  groups,
  canEdit,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  tableId: string;
  tables: ReadonlyArray<NameTable>;
  seated: ReadonlyArray<NameSeat>;
  groups: NameGroups;
  canEdit: boolean;
  /** The typed name, or '' to return the table to its auto name. */
  onSave: (label: string) => void;
}) {
  const headingId = useId();
  const table = tables.find((t) => t.table_id === tableId) ?? null;
  const hostName = table && table.label_is_auto !== true ? (table.table_label ?? '') : '';
  const [typed, setTyped] = useState(hostName);
  const { info, names, autoName } = useMemo(
    () => ({
      info: tableNameInfos(tables, seated, groups).get(tableId) ?? null,
      names: tableDisplayNames(tables, seated, groups),
      autoName: autoNameFor(tableId, tables, seated, groups),
    }),
    [tables, seated, groups, tableId],
  );
  if (!table || !info) return null;
  const trimmed = typed.trim();
  const clash = hostNameClash(tableId, trimmed, names);
  const unchanged = trimmed === hostName.trim();

  const save = (label: string) => {
    if (!canEdit || hostNameClash(tableId, label, names)) return;
    onSave(label);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} labelledById={headingId} rise>
      <div className="px-5 pb-5 pt-4" data-table-name-row="">
        <h2 id={headingId} className="pr-10 text-sn-xl font-semibold text-ink">
          {info.name}
        </h2>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(trimmed);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sn-sm font-semibold text-ink/70">Name</span>
            <input
              className="input-field"
              value={typed}
              maxLength={64}
              autoComplete="off"
              placeholder={autoName}
              disabled={!canEdit}
              aria-invalid={clash ? true : undefined}
              aria-describedby={`${headingId}-why`}
              onChange={(e) => setTyped(e.currentTarget.value)}
            />
          </label>
          <p id={`${headingId}-why`} className={`text-sn-md ${clash ? 'text-mulberry' : 'text-ink/70'}`} data-table-name-why="">
            {clash ?? tableNameWhyWords(info.why)}
          </p>
          {info.why.kind === 'host' && canEdit ? (
            <button
              type="button"
              className="min-h-11 self-start text-left text-sn-md font-semibold text-terracotta underline underline-offset-2"
              onClick={() => save('')}
              data-table-name-auto=""
            >
              Use the auto name · {autoName}
            </button>
          ) : null}
          <ActionButton
            type="submit"
            tone="brand"
            main
            icon={Check}
            label="Save"
            disabled={!canEdit || Boolean(clash) || (unchanged && info.why.kind === 'host') || (trimmed === '' && info.why.kind !== 'host')}
            className="mt-2"
          />
        </form>
      </div>
    </Sheet>
  );
}
