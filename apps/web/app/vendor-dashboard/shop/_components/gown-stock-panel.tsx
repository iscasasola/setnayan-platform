'use client';

/**
 * 👗 SHOP › YOUR WIDGETS › ATTIRE MAKER › FABRICS AND LACE · LOOKS — the shop's own stock (gown maker port step B5;
 * corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 5; the approved drawing is the prototype
 * `prototypes/gown_maker_2026-11-27/gown_maker_v196.html` pages "Fabrics and lace" and "Inspirations"; small swatches
 * and the four sliders are its v187 / v188 rules).
 *
 *   · A list of rows: the 64 px swatch (or the look's photo), the name, what it is, and its price per metre — or
 *     "Not priced", never zero. A hidden row says "Hidden from brides".
 *   · Add or tap a row → one Sheet: fabric or lace, name, code, kind of cloth (the admin's registry), price per metre,
 *     the photo (made into a 64 px swatch in this browser; a patterned cloth also keeps a 512 px repeat tile), its
 *     colour, the four sliders (Shine · See-through · Body · Texture, saved as offsets from the cloth's own values),
 *     and Show to brides. One Save through `gownAction({ op: 'fabric_save' })`, which checks it all again.
 *   · Looks: name, photo, and the main choices of the design (checked on the server the way a bride's design is).
 *
 * Locked (not bought, or not on a plan): the list still reads, and nothing can be added or changed.
 * Brides never see this screen, a price on it, or a hidden row.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Plus, RotateCw, Save } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { PillSelector } from '@/app/_components/pill-selector';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatAmountInput, parseAmountInput } from '@/lib/service-customization-draft';
import { formatCentavosPhp } from '@/lib/php';
import { GOWN_FABRIC_TUNE, gownShopMediaPrefix, type GownFabricTuneKey, type GownFabricTypeOption, type ShopGownStockFabric, type ShopGownStockLook } from '@/lib/gown-maker';
import {
  GOWN_NECKLINES,
  GOWN_SILHOUETTES,
  GOWN_SLEEVES,
  GOWN_STOCK_FABRICS,
  GOWN_TRAINS,
  GOWN_VEILS,
  startingGownConfig,
} from '@/lib/gown-config';
import { gownAction } from '@/app/_components/gown-maker/gown-call';

type Stock = { shop: string; fabrics: ShopGownStockFabric[]; looks: ShopGownStockLook[]; types: GownFabricTypeOption[]; locked: boolean };
type Load = { s: 'loading' } | { s: 'failed'; message: string } | { s: 'ok'; stock: Stock };

const UPLOAD_STALL_MS = 45_000;
const UPLOAD_RESPONSE_MS = 120_000;

/** One blob into the shop's own gown folder of the public media bucket. */
async function uploadToShop(shop: string, folder: 'fabrics' | 'looks', blob: Blob, name: string): Promise<string | null> {
  const { sendToStorage } = await import('@/lib/upload-send');
  const file = new File([blob], `${name}-${Date.now()}.webp`, { type: 'image/webp' });
  const out = await sendToStorage(
    { file, contentType: 'image/webp', bucket: 'media', pathPrefix: `${gownShopMediaPrefix(shop)}${folder}` },
    { stallMs: UPLOAD_STALL_MS, responseMs: UPLOAD_RESPONSE_MS },
  ).done;
  return out.ok ? out.r2Ref : null;
}

export function GownStockPanel({ view, seed }: { view: 'fabrics' | 'looks'; seed?: Stock }) {
  const [load, setLoad] = useState<Load>(seed ? { s: 'ok', stock: seed } : { s: 'loading' });
  const read = useCallback(() => {
    setLoad({ s: 'loading' });
    gownAction({ op: 'stock' })
      .then((r) => {
        if (r.ok && r.op === 'stock') setLoad({ s: 'ok', stock: { shop: r.shop, fabrics: r.fabrics, looks: r.looks, types: r.types, locked: r.locked } });
        else setLoad({ s: 'failed', message: r.ok ? 'Couldn’t load your fabrics and looks.' : r.message });
      })
      .catch(() => setLoad({ s: 'failed', message: 'Couldn’t load your fabrics and looks.' }));
  }, []);
  useEffect(() => {
    if (!seed) read();
  }, [read, seed]);

  if (load.s === 'loading') return <div className="sn-frame skeleton h-48" data-gown-stock="loading" aria-busy="true" />;
  if (load.s === 'failed') {
    return (
      <div className="sn-frame space-y-2 p-4" data-gown-stock="failed" role="alert">
        <p className="text-sn-md font-semibold text-ink">Couldn’t load your {view === 'fabrics' ? 'fabrics' : 'looks'}</p>
        <p className="text-sn-base text-ink/70">{load.message} Nothing was changed.</p>
        <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={read} />
      </div>
    );
  }
  return view === 'fabrics' ? <FabricList stock={load.stock} reload={seed ? undefined : read} /> : <LookList stock={load.stock} reload={seed ? undefined : read} />;
}

// ── Fabrics and lace ─────────────────────────────────────────────────────────────────────────────────────────────

type FabricDraft = Omit<ShopGownStockFabric, 'id' | 'thumbUrl' | 'tileUrl'> & { id: string | null; thumbUrl: string | null; patterned: boolean };

const blankFabric = (types: GownFabricTypeOption[]): FabricDraft => ({
  id: null,
  kind: 'fabric',
  name: '',
  code: null,
  typeId: types[0]?.id ?? 'satin',
  colours: [],
  pricePerMetreCentavos: null,
  tune: {},
  thumbKey: null,
  tileKey: null,
  thumbUrl: null,
  patterned: false,
  active: true,
});

function FabricList({ stock, reload }: { stock: Stock; reload?: () => void }) {
  const [editing, setEditing] = useState<FabricDraft | null>(null);
  const typeName = (id: string) => stock.types.find((t) => t.id === id)?.name ?? GOWN_STOCK_FABRICS.find((f) => f.id === id)?.label ?? id;
  return (
    <div className="space-y-3" data-gown-stock="fabrics">
      {stock.fabrics.length ? (
        <ul className="space-y-2">
          {stock.fabrics.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="sn-row flex min-h-11 w-full items-center gap-3 p-3 text-left"
                onClick={() => setEditing({ ...f, patterned: f.tileKey !== null })}
                disabled={stock.locked}
                data-gown-fabric={f.id}
              >
                <Swatch url={f.thumbUrl} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sn-md text-ink">{f.name}</b>
                  <small className="block text-sn-base text-ink/70">
                    {f.kind === 'lace' ? 'Lace' : typeName(f.typeId)}
                    {f.code ? ` · ${f.code}` : ''}
                    {f.active ? '' : ' · Hidden from brides'}
                  </small>
                </span>
                <span className="text-sn-base text-ink/70">{f.pricePerMetreCentavos == null ? 'Not priced' : `${formatCentavosPhp(f.pricePerMetreCentavos)} / m`}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sn-frame p-4 text-sn-base text-ink/70" data-gown-stock="empty">
          No fabrics yet. Add the cloths you stock: brides pick from them on the mannequin.
        </p>
      )}
      {stock.locked ? null : <ActionButton tone="brand" icon={Plus} label="Add fabric or lace" onClick={() => setEditing(blankFabric(stock.types))} className="w-full" />}
      {editing ? <FabricSheet stock={stock} start={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload?.(); }} /> : null}
    </div>
  );
}

function Swatch({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a 64 px swatch the shop uploaded; next/image adds JS for nothing here
    <img src={url} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 flex-none rounded-sn-sm object-cover" />
  ) : (
    <span aria-hidden className="h-10 w-10 flex-none rounded-sn-sm bg-ink/10" />
  );
}

function FabricSheet({ stock, start, onClose, onSaved }: { stock: Stock; start: FabricDraft; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<FabricDraft>(start);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const set = (patch: Partial<FabricDraft>) => setD((p) => ({ ...p, ...patch }));
  const type = stock.types.find((t) => t.id === d.typeId);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Preparing the photo…');
    setProblem(null);
    try {
      const { gownSwatchFromFile } = await import('@/lib/gown-swatch/swatch');
      const sw = await gownSwatchFromFile(file, d.patterned);
      setBusy('Uploading…');
      const [thumbKey, tileKey] = await Promise.all([
        uploadToShop(stock.shop, 'fabrics', sw.thumb, 'swatch'),
        sw.tile ? uploadToShop(stock.shop, 'fabrics', sw.tile, 'tile') : Promise.resolve(null),
      ]);
      if (!thumbKey || (sw.tile && !tileKey)) throw new Error('upload');
      set({ thumbKey, tileKey, thumbUrl: URL.createObjectURL(sw.thumb), colours: [{ name: d.colours[0]?.name ?? null, hex: sw.hex }] });
    } catch {
      setProblem('That photo didn’t upload. Try again, or pick another photo.');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('Saving…');
    setProblem(null);
    const r = await gownAction({
      op: 'fabric_save',
      fabric: {
        id: d.id,
        kind: d.kind,
        name: d.name,
        code: d.code,
        typeId: d.typeId,
        colours: d.colours,
        pricePerMetreCentavos: d.pricePerMetreCentavos,
        tune: d.tune,
        thumbKey: d.thumbKey,
        tileKey: d.patterned ? d.tileKey : null,
        active: d.active,
      },
    });
    setBusy(null);
    if (r.ok) {
      toast.success(d.id ? 'Fabric saved' : 'Fabric added');
      onSaved();
    } else {
      setProblem(r.message);
      toast.error(r.message);
    }
  };

  return (
    <Sheet open onClose={onClose} labelledById={titleId} title={d.id ? 'Edit fabric' : 'Add fabric or lace'}>
      <div className="space-y-4 p-4" data-gown-fabric-sheet="">
        <PillSelector
          label="Fabric or lace"
          value={d.kind}
          options={[
            { key: 'fabric', label: 'Fabric' },
            { key: 'lace', label: 'Lace' },
          ]}
          onPick={(k) => set({ kind: k === 'lace' ? 'lace' : 'fabric' })}
        />
        <FormRows>
          <TypedRow name="Name" value={d.name} empty="Add a name" onType={(v) => set({ name: v })} onKeep={(v) => set({ name: v })} data="gown-fabric-name" />
          <TypedRow name="Your code" value={d.code ?? ''} empty="Optional" onKeep={(v) => set({ code: v.trim() || null })} data="gown-fabric-code" />
          <ChosenRow
            name="Kind of cloth"
            value={d.typeId}
            options={stock.types.map((t) => ({ key: t.id, label: t.verified ? t.name : `${t.name} (values to check)` }))}
            onPick={(k) => set({ typeId: k, tune: {} })}
            data="gown-fabric-type"
          />
          <TypedRow
            name="Your price per metre"
            amount
            value={formatAmountInput(d.pricePerMetreCentavos ?? 0)}
            empty="Not priced"
            onType={(v) => set({ pricePerMetreCentavos: parseAmountInput(v) || null })}
            onKeep={(v) => set({ pricePerMetreCentavos: parseAmountInput(v) || null })}
            note="Brides never see it. Left empty, a quote line for it stays unpriced."
            data="gown-fabric-price"
          />
          <SwitchRow name="Patterned (keeps a repeat tile)" on={d.patterned} onChange={(on) => set({ patterned: on })} data="gown-fabric-patterned" />
          <SwitchRow name="Show to brides" on={d.active} onChange={(on) => set({ active: on })} data="gown-fabric-active" />
        </FormRows>

        <section className="space-y-2">
          <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Photo</h3>
          <div className="flex items-center gap-3">
            <Swatch url={d.thumbUrl} />
            <label className={actionButtonClass('neutral')}>
              <ImagePlus aria-hidden className="h-4 w-4" />
              {d.thumbKey ? 'Change photo' : 'Add photo'}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void pickPhoto(e.target.files?.[0] ?? undefined)} disabled={busy !== null} />
            </label>
          </div>
          <p className="text-sn-base text-ink/70">Lay the cloth flat in daylight. The centre square becomes the swatch.</p>
          {d.colours[0] ? (
            <FormRows>
              <TypedRow
                name="Colour name"
                value={d.colours[0].name ?? ''}
                empty="From the photo"
                onKeep={(v) => set({ colours: [{ ...d.colours[0]!, name: v.trim() || null }] })}
                data="gown-fabric-colour"
              />
            </FormRows>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">How it looks on the mannequin</h3>
          <p className="text-sn-base text-ink/70">Each starts at the cloth’s own value. Move it to match your photo.</p>
          {GOWN_FABRIC_TUNE.map((t) => (
            <TuneSlider key={t.key} k={t.key} label={t.label} base={baseOf(type, t.key)} offset={d.tune[t.key] ?? 0} onChange={(v) => set({ tune: { ...d.tune, [t.key]: v } })} />
          ))}
        </section>

        {problem ? (
          <p role="alert" className="text-sn-base font-semibold text-danger-700">
            {problem}
          </p>
        ) : null}
        <ActionButton tone="brand" icon={Save} label={busy ?? 'Save'} onClick={save} disabled={busy !== null} className="w-full" data-gown-fabric-save="" />
      </div>
    </Sheet>
  );
}

/** The cloth's own value for one slider (Texture has none of its own, so it starts at the middle). */
function baseOf(type: GownFabricTypeOption | undefined, k: GownFabricTuneKey): number {
  if (!type) return 0.5;
  return k === 'shine' ? type.sheen : k === 'sheer' ? type.sheer : k === 'body' ? type.stiff : 0.5;
}

function TuneSlider({ k, label, base, offset, onChange }: { k: GownFabricTuneKey; label: string; base: number; offset: number; onChange: (offset: number) => void }) {
  const value = Math.min(1, Math.max(0, base + offset));
  return (
    <label className="block text-sn-base text-ink" data-gown-tune={k}>
      {label} · {Math.round(value * 100)}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Math.round((Number(e.target.value) / 100 - base) * 100) / 100)}
        className="mt-1 block min-h-11 w-full accent-mulberry-600"
      />
    </label>
  );
}

// ── Looks ────────────────────────────────────────────────────────────────────────────────────────────────────────

type LookConfig = Record<string, unknown>;
type LookDraft = { id: string | null; name: string; photoKey: string | null; photoUrl: string | null; config: LookConfig; active: boolean };
const LOOK_CHOICES = [
  { key: 'sil', name: 'Shape', options: GOWN_SILHOUETTES },
  { key: 'neck', name: 'Neckline', options: GOWN_NECKLINES },
  { key: 'sleeve', name: 'Sleeves', options: GOWN_SLEEVES },
  { key: 'train', name: 'Train', options: GOWN_TRAINS },
  { key: 'veil', name: 'Veil', options: GOWN_VEILS },
] as const;

function LookList({ stock, reload }: { stock: Stock; reload?: () => void }) {
  const [editing, setEditing] = useState<LookDraft | null>(null);
  const fresh = (): LookDraft => ({ id: null, name: '', photoKey: null, photoUrl: null, config: { ...(startingGownConfig() as unknown as LookConfig) }, active: true });
  return (
    <div className="space-y-3" data-gown-stock="looks">
      {stock.looks.length ? (
        <ul className="space-y-2">
          {stock.looks.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="sn-row flex min-h-11 w-full items-center gap-3 p-3 text-left"
                onClick={() => setEditing({ id: l.id, name: l.name, photoKey: l.photoKey, photoUrl: l.photoUrl, config: { ...(startingGownConfig() as unknown as LookConfig), ...((l.config ?? {}) as LookConfig) }, active: l.active })}
                disabled={stock.locked}
                data-gown-look={l.id}
              >
                <Swatch url={l.photoUrl} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sn-md text-ink">{l.name}</b>
                  {l.active ? null : <small className="block text-sn-base text-ink/70">Hidden from brides</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sn-frame p-4 text-sn-base text-ink/70" data-gown-stock="empty">
          No looks yet. A look is a starting design a bride can open and change.
        </p>
      )}
      {stock.locked ? null : <ActionButton tone="brand" icon={Plus} label="Add a look" onClick={() => setEditing(fresh())} className="w-full" />}
      {editing ? <LookSheet stock={stock} start={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload?.(); }} /> : null}
    </div>
  );
}

function LookSheet({ stock, start, onClose, onSaved }: { stock: Stock; start: LookDraft; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<LookDraft>(start);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const titleId = useId();
  const set = (patch: Partial<LookDraft>) => setD((p) => ({ ...p, ...patch }));
  const fabricOptions = [...GOWN_STOCK_FABRICS.map((f) => ({ key: f.id as string, label: f.label as string })), ...stock.types.filter((t) => !GOWN_STOCK_FABRICS.some((f) => f.id === t.id)).map((t) => ({ key: t.id, label: t.name }))];

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Uploading…');
    setProblem(null);
    try {
      const { gownLookPhotoFromFile } = await import('@/lib/gown-swatch/swatch');
      const blob = await gownLookPhotoFromFile(file);
      const photoKey = await uploadToShop(stock.shop, 'looks', blob, 'look');
      if (!photoKey) throw new Error('upload');
      set({ photoKey, photoUrl: URL.createObjectURL(blob) });
    } catch {
      setProblem('That photo didn’t upload. Try again, or pick another photo.');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('Saving…');
    setProblem(null);
    const r = await gownAction({ op: 'look_save', look: { id: d.id, name: d.name, photoKey: d.photoKey, config: d.config, active: d.active } });
    setBusy(null);
    if (r.ok) {
      toast.success(d.id ? 'Look saved' : 'Look added');
      onSaved();
    } else {
      setProblem(r.message);
      toast.error(r.message);
    }
  };

  return (
    <Sheet open onClose={onClose} labelledById={titleId} title={d.id ? 'Edit look' : 'Add a look'}>
      <div className="space-y-4 p-4" data-gown-look-sheet="">
        <FormRows>
          <TypedRow name="Name" value={d.name} empty="Add a name" onType={(v) => set({ name: v })} onKeep={(v) => set({ name: v })} data="gown-look-name" />
          {LOOK_CHOICES.map((c) => (
            <ChosenRow
              key={c.key}
              name={c.name}
              value={String(d.config[c.key] ?? '')}
              options={c.options.map((o) => ({ key: o.id as string, label: o.label as string }))}
              onPick={(k) => set({ config: { ...d.config, [c.key]: k } })}
              data="gown-look-choice"
            />
          ))}
          <ChosenRow name="Fabric" value={String(d.config.fabric ?? '')} options={fabricOptions} onPick={(k) => set({ config: { ...d.config, fabric: k } })} data="gown-look-choice" />
          <SwitchRow name="Show to brides" on={d.active} onChange={(on) => set({ active: on })} data="gown-look-active" />
        </FormRows>
        <div className="flex items-center gap-3">
          <Swatch url={d.photoUrl} />
          <label className={actionButtonClass('neutral')}>
            <ImagePlus aria-hidden className="h-4 w-4" />
            {d.photoKey ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void pickPhoto(e.target.files?.[0] ?? undefined)} disabled={busy !== null} />
          </label>
        </div>
        {problem ? (
          <p role="alert" className="text-sn-base font-semibold text-danger-700">
            {problem}
          </p>
        ) : null}
        <ActionButton tone="brand" icon={Save} label={busy ?? 'Save'} onClick={save} disabled={busy !== null} className="w-full" data-gown-look-save="" />
      </div>
    </Sheet>
  );
}
