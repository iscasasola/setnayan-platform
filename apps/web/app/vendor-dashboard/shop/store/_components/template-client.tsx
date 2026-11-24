'use client';

import { useMemo, useState, useTransition } from 'react';
import { MinusCircle, Plus, Save, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useToast } from '@/app/_components/toast/toast-provider';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { formatCount } from '@/lib/format-number';
import { MAX_PLAN_PARTS, partsTotal, removedToast, type PlanPart, type TemplateKind } from '@/lib/toolkit-templates';
import { storeAction } from '../store-actions';
import { PlanBar } from './template-bar';

/**
 * 🧩 THE TEMPLATE PRESSES THAT NEED THE BROWSER (Toolkit templates drawing, frame 2).
 *   TemplateRemove      Remove → the toast with Undo ("2 cards keep their payments as they are"); nothing is written
 *                       until the undo window closes (`deleteWithUndo`, the same window Payment Strategies' delete uses).
 *   TemplatePlanEditor  After Install: the plan opens filled in — name, then each payment (name · percent · when it is
 *                       due) — "Add a payment", and the running total ("100% of the total · adds up" / "90% of the total ·
 *                       must add up to 100%"). Save is op=template act=save; the server checks the total again.
 */

export function TemplateRemove({ of, templateKey, name, cardCount }: { of: TemplateKind; templateKey: string; name: string; cardCount: number }) {
  const [gone, setGone] = useState(false);
  const remove = () =>
    deleteWithUndo({
      label: removedToast(name, of === 'pay' ? cardCount : 0),
      hide: () => setGone(true),
      restore: () => setGone(false),
      commit: async () => {
        const fd = new FormData();
        fd.set('op', 'template');
        fd.set('of', of);
        fd.set('key', templateKey);
        fd.set('act', 'remove');
        const r = await storeAction({ status: 'idle' }, fd);
        return r.status === 'error' ? { ok: false, error: r.message } : { ok: true };
      },
      failed: `Couldn’t remove ${name}. It’s back — try again.`,
    });
  if (gone) return null;
  return <ActionButton tone="neutral" icon={MinusCircle} label="Remove" onClick={remove} data-template-remove="" />;
}

type Row = PlanPart & { id: number };

const DUE_OPTIONS: readonly { key: string; label: string }[] = [
  { key: 'on_lock', label: 'After booking' },
  { key: 'before_event', label: 'Before the event' },
];

export function TemplatePlanEditor({ templateKey, name: startName, parts }: { templateKey: string; name: string; parts: readonly PlanPart[] }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [name, setName] = useState(startName);
  const [rows, setRows] = useState<Row[]>(() => parts.map((x, i) => ({ ...x, id: i })));
  const total = useMemo(() => partsTotal(rows), [rows]);
  const set = (id: number, patch: Partial<PlanPart>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { id: Math.max(-1, ...rs.map((r) => r.id)) + 1, label: `Payment ${rs.length + 1}`, pct: Math.max(0, 100 - partsTotal(rs)) || 10, anchor: 'before_event', days: 7 }]);
  const drop = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const save = () => {
    const fd = new FormData();
    fd.set('op', 'template');
    fd.set('of', 'pay');
    fd.set('key', templateKey);
    fd.set('act', 'save');
    fd.set('name', name);
    for (const r of rows) {
      fd.append('part_label', r.label);
      fd.append('part_pct', String(r.pct));
      fd.append('part_anchor', r.anchor);
      fd.append('part_days', String(r.days));
    }
    start(async () => {
      const res = await storeAction({ status: 'idle' }, fd);
      if (res.status === 'error') toast.error(res.message);
      else if (res.status === 'ok') toast.success(res.message);
    });
  };
  const adds = total === 100;
  return (
    <div className="sn-frame mt-3 p-4" data-template-editor={templateKey}>
      <FormRows>
        <TypedRow name="Plan name" value={name} boxed required maxLength={60} autoCapitalize="sentences" onKeep={(t) => setName(t)} data="template-name" />
      </FormRows>
      <p className="mt-4 text-sn-base font-semibold text-ink">Payments</p>
      <div className="mt-2">
        <PlanBar parts={rows} />
      </div>
      <ol className="mt-2 divide-y divide-[color:var(--sn-hair)]" data-template-parts="">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2 py-3" data-template-part={i + 1}>
            <span className="mt-2.5 w-5 text-sn-base font-semibold tabular-nums text-[color:var(--m-slate-2)]">{formatCount(i + 1)}</span>
            <span className="grid min-w-0 grid-cols-2 gap-2">
              <span className="col-span-2 block">
                <FormRows>
                  <TypedRow name={`Payment ${i + 1}`} value={r.label} boxed required maxLength={60} autoCapitalize="sentences" onKeep={(t) => set(r.id, { label: t })} data={`template-part-name-${i + 1}`} />
                </FormRows>
              </span>
              <label className="flex items-center gap-1.5">
                <input
                  className="input-field w-20 tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={r.pct}
                  onChange={(e) => set(r.id, { pct: Math.round(Number(e.target.value) || 0) })}
                  aria-label={`Percent of payment ${i + 1}`}
                />
                <span className="text-sn-base text-ink">%</span>
              </label>
              <span className="flex items-center gap-1.5">
                <input
                  className="input-field w-20 tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={730}
                  value={r.days}
                  onChange={(e) => set(r.id, { days: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  aria-label={`Days for payment ${i + 1}`}
                />
                <span className="text-sn-base text-ink">days</span>
              </span>
              <span className="col-span-2 block">
                <PickMenu
                  label={`When payment ${i + 1} is due`}
                  value={r.anchor}
                  options={DUE_OPTIONS}
                  onPick={(k) => set(r.id, { anchor: k === 'on_lock' ? 'on_lock' : 'before_event' })}
                  dataAttr="data-template-due"
                />
              </span>
            </span>
            {rows.length > 1 ? <ActionButton tone="neutral" quiet icon={Trash2} label="Take out" iconOnly onClick={() => drop(r.id)} /> : <span />}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {rows.length < MAX_PLAN_PARTS ? <ActionButton tone="info" quiet icon={Plus} label="Add a payment" onClick={add} data-template-add="" /> : <span />}
        <span
          className="text-sn-base font-semibold tabular-nums"
          style={{ color: adds ? 'rgb(var(--color-ok))' : 'rgb(var(--color-danger))' }}
          role="status"
          data-template-total={total}
        >
          {formatCount(total)}% of the total · {adds ? 'adds up' : 'must add up to 100%'}
        </span>
      </div>
      <div className="mt-4 flex [&>*]:w-full">
        <ActionButton tone="brand" main icon={Save} label="Save" onClick={save} waiting={busy} disabled={busy || !adds} data-template-save="" />
      </div>
    </div>
  );
}
