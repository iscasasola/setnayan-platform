'use client';

/**
 * 👗 ADMIN › STUDIO › FABRIC TYPES — the Attire Maker's fabric-type registry (gown maker port step B5b; owner Q4,
 * 27 Nov 2026: Setnayan admin only). Every shop's fabric points at one of these: how a cloth hangs and shines.
 *
 *   · One row per type: its name, family, weight, and whether its numbers are checked ("Values to check" until then).
 *     A hidden type says so.
 *   · Tap a row (or Add a fabric type) → one Sheet with every column the table holds, bounded by its own CHECKs.
 *     Hide, never delete: a shop's fabric may point at the type.
 *   · Saved through `gownAction({ op: 'type_save' })`, which proves the admin and checks it all again.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { Plus, RotateCw, Save } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { GOWN_FABRIC_FAMILIES, GOWN_FABRIC_STRETCH, GOWN_FABRIC_USES, type GownFabricTypeRow } from '@/lib/gown-maker';
import { gownAction } from '@/app/_components/gown-maker/gown-call';

type Load = { s: 'loading' } | { s: 'failed'; message: string } | { s: 'ok'; types: GownFabricTypeRow[] };

const blank = (): GownFabricTypeRow => ({
  id: '',
  name: '',
  aliases: [],
  family: 'satins',
  gsm: 100,
  stiff: 0.5,
  sheen: 0.5,
  sheer: 0,
  stretch: 'none',
  usedFor: ['gown_body'],
  renderAs: null,
  active: true,
  sort: 0,
  verified: false,
});

export function GownFabricTypesSurface({ seed }: { seed?: GownFabricTypeRow[] } = {}) {
  const [load, setLoad] = useState<Load>(seed ? { s: 'ok', types: seed } : { s: 'loading' });
  const [editing, setEditing] = useState<{ row: GownFabricTypeRow; isNew: boolean } | null>(null);
  const read = useCallback(() => {
    setLoad({ s: 'loading' });
    gownAction({ op: 'types' })
      .then((r) => setLoad(r.ok && r.op === 'types' ? { s: 'ok', types: r.types } : { s: 'failed', message: r.ok ? 'Couldn’t load the fabric types.' : r.message }))
      .catch(() => setLoad({ s: 'failed', message: 'Couldn’t load the fabric types.' }));
  }, []);
  useEffect(() => {
    if (!seed) read();
  }, [read, seed]);

  if (load.s === 'loading') return <div className="sn-frame skeleton h-64" aria-busy="true" data-gown-types="loading" />;
  if (load.s === 'failed') {
    return (
      <div className="sn-frame space-y-2 p-4" role="alert" data-gown-types="failed">
        <p className="text-sn-md font-semibold text-ink">Couldn’t load the fabric types</p>
        <p className="text-sn-base text-ink/70">{load.message} Nothing was changed.</p>
        <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={read} />
      </div>
    );
  }
  const family = (id: string) => GOWN_FABRIC_FAMILIES.find((f) => f.id === id)?.label ?? id;
  return (
    <div className="space-y-3" data-gown-types="ok">
      <p className="text-sn-base text-ink/70">Every shop’s fabric points at one of these. Hide a type instead of deleting it.</p>
      <ul className="space-y-2">
        {load.types.map((t) => (
          <li key={t.id}>
            <button type="button" className="sn-row flex min-h-11 w-full items-center gap-3 p-3 text-left" onClick={() => setEditing({ row: t, isNew: false })} data-gown-type={t.id}>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sn-md text-ink">{t.name}</b>
                <small className="block text-sn-base text-ink/70">
                  {family(t.family)} · {t.gsm} g/m²{t.verified ? '' : ' · Values to check'}
                  {t.active ? '' : ' · Hidden'}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ActionButton tone="brand" icon={Plus} label="Add a fabric type" onClick={() => setEditing({ row: blank(), isNew: true })} className="w-full" />
      {editing ? (
        <TypeSheet
          start={editing.row}
          isNew={editing.isNew}
          others={load.types.filter((t) => t.id !== editing.row.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            if (!seed) read();
          }}
        />
      ) : null}
    </div>
  );
}

function TypeSheet({ start, isNew, others, onClose, onSaved }: { start: GownFabricTypeRow; isNew: boolean; others: GownFabricTypeRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const titleId = useId();
  const [d, setD] = useState<GownFabricTypeRow>(start);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<GownFabricTypeRow>) => setD((p) => ({ ...p, ...patch }));
  const num = (v: string) => Number(v.replace(',', '.'));

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const r = await gownAction({ op: 'type_save', type: d });
    setBusy(false);
    if (r.ok) {
      toast.success('Fabric type saved');
      onSaved();
    } else {
      setProblem(r.message);
      toast.error(r.message);
    }
  };

  return (
    <Sheet open onClose={onClose} labelledById={titleId} title={isNew ? 'Add a fabric type' : `Edit ${start.name}`}>
      <div className="space-y-4 p-4" data-gown-type-sheet="">
        <FormRows>
          {isNew ? <TypedRow name="Id" value={d.id} empty="Add an id" onKeep={(v) => set({ id: v.trim().toLowerCase() })} note="Small letters, digits and _. It never changes." data="gown-type-id" /> : null}
          <TypedRow name="Name" value={d.name} empty="Add a name" onType={(v) => set({ name: v })} onKeep={(v) => set({ name: v })} data="gown-type-name" />
          <TypedRow
            name="Other names"
            value={d.aliases.join(', ')}
            empty="None"
            onKeep={(v) => set({ aliases: v.split(',').map((x) => x.trim()).filter(Boolean) })}
            note="Separated by commas."
            data="gown-type-aliases"
          />
          <ChosenRow name="Family" value={d.family} options={GOWN_FABRIC_FAMILIES.map((f) => ({ key: f.id, label: f.label }))} onPick={(k) => set({ family: k as GownFabricTypeRow['family'] })} data="gown-type-family" />
          <TypedRow name="Weight (g/m²)" value={String(d.gsm)} inputMode="numeric" onKeep={(v) => set({ gsm: Math.round(num(v)) })} note="5 to 600" data="gown-type-gsm" />
          <TypedRow name="Stiffness" value={String(d.stiff)} inputMode="text" onKeep={(v) => set({ stiff: num(v) })} note="0 to 1" data="gown-type-stiff" />
          <TypedRow name="Shine" value={String(d.sheen)} inputMode="text" onKeep={(v) => set({ sheen: num(v) })} note="0 to 1" data="gown-type-sheen" />
          <TypedRow name="See-through" value={String(d.sheer)} inputMode="text" onKeep={(v) => set({ sheer: num(v) })} note="0 to 1" data="gown-type-sheer" />
          <ChosenRow name="Stretch" value={d.stretch} options={GOWN_FABRIC_STRETCH.map((s) => ({ key: s.id, label: s.label }))} onPick={(k) => set({ stretch: k as GownFabricTypeRow['stretch'] })} data="gown-type-stretch" />
          {GOWN_FABRIC_USES.map((u) => (
            <SwitchRow
              key={u.id}
              name={`Used for: ${u.label}`}
              on={d.usedFor.includes(u.id)}
              onChange={(on) => set({ usedFor: on ? [...d.usedFor, u.id] : d.usedFor.filter((x) => x !== u.id) })}
              data="gown-type-use"
            />
          ))}
          <ChosenRow
            name="Looks like"
            value={d.renderAs ?? ''}
            options={[{ key: '', label: 'Its family’s look' }, ...others.map((t) => ({ key: t.id, label: t.name }))]}
            onPick={(k) => set({ renderAs: k || null })}
            data="gown-type-render"
          />
          <TypedRow name="Order" value={String(d.sort)} inputMode="numeric" onKeep={(v) => set({ sort: Math.round(num(v)) || 0 })} data="gown-type-sort" />
          <SwitchRow name="Values checked against a source" on={d.verified} onChange={(on) => set({ verified: on })} data="gown-type-verified" />
          <SwitchRow name="Shops can pick it" on={d.active} onChange={(on) => set({ active: on })} data="gown-type-active" />
        </FormRows>
        {problem ? (
          <p role="alert" className="text-sn-base font-semibold text-danger-700">
            {problem}
          </p>
        ) : null}
        <ActionButton tone="brand" icon={Save} label={busy ? 'Saving…' : 'Save'} onClick={save} disabled={busy} className="w-full" data-gown-type-save="" />
      </div>
    </Sheet>
  );
}
