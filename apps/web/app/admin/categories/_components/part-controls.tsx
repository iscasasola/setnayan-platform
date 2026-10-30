'use client';

/**
 * part-controls.tsx — the part drawer's controls whose doors answer JSON (🌳 ③b, `four-level-actions.ts`):
 * Name (saves on blur/Enter), Home ▾ (with Undo), Hidden from couples — all in place, said in the drawer's toast
 * (`drawer-kit.tsx`, owner 2026-10-29 panels approved). The server panel names the record; this file never decides
 * which record it edits.
 */
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { Choice } from './pickers';
import { mapWrite } from '../four-level-actions';
import { InPlaceFields, InPlaceSwitch, SaidLine, useInPlace, type WriteResult } from './drawer-kit';

export function RenamePart({ slotKey, label }: { slotKey: string; label: string }) {
  return <InPlaceFields kind="rename-part" hidden={{ slot_key: slotKey }} fields={[{ name: 'label', label: 'Name', value: label, what: 'Name', maxLength: 60 }]} />;
}

/** Home ▾ — the part's home category; "Moved to … · Undo" (PLAN § 7.3). */
export function MovePartHomePick({ slotKey, home, choices }: { slotKey: string; home: string; choices: readonly Choice[] }) {
  const move = (categoryId: string) => mapWrite({ op: 'movePart', slotKey, categoryId }) as Promise<WriteResult>;
  const { pending, run, local } = useInPlace();
  return (
    <div className={pending ? 'opacity-60' : undefined}>
      <PickMenu
        label="Home"
        value={home}
        options={choices.map((c) => ({ key: c.key, label: c.label, group: c.group }))}
        compact
        stickyGroups
        className="border border-ink/15"
        onPick={(key) => {
          if (key !== home) run(() => move(key), { what: 'Home', said: (m) => m, undo: () => move(home) });
        }}
      />
      <SaidLine said={local} />
    </div>
  );
}

export function PartHiddenSwitch({ slotKey, hidden }: { slotKey: string; hidden: boolean }) {
  return <InPlaceSwitch label="Hidden from couples" on={hidden} door={{ op: 'hidePart', slotKey }} help="Hiding keeps every saved photo." />;
}
