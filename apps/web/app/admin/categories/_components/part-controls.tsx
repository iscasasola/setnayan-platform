'use client';

/**
 * part-controls.tsx — the part drawer's controls whose doors answer JSON (🌳 ③b, `four-level-actions.ts`):
 * Name, Move to ▾ (with Undo), Hidden from couples — all through `mapWrite`. Each runs
 * its action and says what happened in place; the action's revalidatePath redraws the page — the same shape as the shipped
 * `in-place.tsx` controls. The actions arrive BOUND by the server panel, so this file never decides which
 * record it edits.
 */
import { useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SwitchTrack, SWITCH_BUTTON } from '@/app/_components/switch-track';
import type { Choice } from './pickers';
import { mapWrite } from '../four-level-actions';

type Result = { ok: true; message: string; previous?: string } | { ok: false; error: string };

function Said({ said, onUndo }: { said: { ok: boolean; text: string } | null; onUndo?: () => void }) {
  if (!said) return null;
  return (
    <p role={said.ok ? 'status' : 'alert'} className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${said.ok ? 'text-success-700' : 'text-danger-700'}`}>
      {said.ok ? '✓ ' : '⚠ '}
      {said.text}
      {onUndo ? (
        <button type="button" onClick={onUndo} className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-3 font-semibold text-ink">
          Undo
        </button>
      ) : null}
    </p>
  );
}

export function RenamePart({ slotKey, label }: { slotKey: string; label: string }) {
  const save = (v: string) => mapWrite({ op: 'renamePart', slotKey, label: v }) as Promise<Result>;
  const [v, setV] = useState(label);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await save(v);
          setSaid(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
        });
      }}
    >
      <span className="w-40 shrink-0 text-xs font-medium text-ink/70">Name</span>
      <input value={v} onChange={(e) => setV(e.target.value)} minLength={1} maxLength={60} aria-label="Name" className="min-w-0 flex-1 rounded-md border border-ink/15 bg-raised px-2.5 py-1.5 text-sm text-ink" />
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-full bg-ink px-3 text-xs font-semibold text-cream disabled:opacity-40">
        {pending ? 'Saving…' : 'Save'}
      </button>
      <Said said={said} />
    </form>
  );
}

/** Move to ▾ — the part's home category; "Moved to … · Undo" (PLAN § 7.3). */
export function MovePartHomePick({ slotKey, home, choices }: { slotKey: string; home: string; choices: readonly Choice[] }) {
  const move = (categoryId: string) => mapWrite({ op: 'movePart', slotKey, categoryId }) as Promise<Result>;
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [undoTo, setUndoTo] = useState('');
  const [pending, start] = useTransition();
  const run = (to: string, isUndo: boolean) =>
    start(async () => {
      const r = await move(to);
      setSaid(r.ok ? { ok: true, text: isUndo ? 'Undone.' : r.message } : { ok: false, text: r.error });
      setUndoTo(r.ok && !isUndo && r.previous ? r.previous : '');
    });
  return (
    <div className={pending ? 'opacity-60' : undefined}>
      <PickMenu
        label="Move to"
        value={home}
        options={choices.map((c) => ({ key: c.key, label: c.label, group: c.group }))}
        compact
        stickyGroups
        className="border border-ink/15"
        onPick={(key) => {
          if (key !== home) run(key, false);
        }}
      />
      <Said said={said} onUndo={undoTo ? () => run(undoTo, true) : undefined} />
    </div>
  );
}

export function PartHiddenSwitch({ slotKey, hidden }: { slotKey: string; hidden: boolean }) {
  const save = (h: boolean) => mapWrite({ op: 'hidePart', slotKey, hidden: h }) as Promise<Result>;
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">Hidden from couples</span>
        <button
          type="button"
          aria-pressed={hidden}
          aria-label={`Hidden from couples: ${hidden ? 'on' : 'off'}`}
          disabled={pending}
          className={SWITCH_BUTTON}
          onClick={() =>
            start(async () => {
              const r = await save(!hidden);
              setSaid(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
            })
          }
        >
          <SwitchTrack on={hidden} />
        </button>
      </div>
      <Said said={said} />
    </div>
  );
}
