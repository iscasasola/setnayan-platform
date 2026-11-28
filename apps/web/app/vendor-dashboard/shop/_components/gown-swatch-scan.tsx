'use client';

/**
 * 👗 SHOP › ATTIRE MAKER › FABRICS AND LACE › SCAN A SWATCH BOOK (gown maker port step B13). The approved drawing is
 * the prototype `prototypes/gown_maker_2026-11-27/gown_maker_v198.html`, Settings › Fabrics and lace › "Scan a
 * swatch book" (`sbBox` · `sbPageEl` · `sbReview` · `sbStylesUI` · `sbSave`), ported onto the house pieces.
 *
 *   1. The designer adds photos of swatch-book pages (up to 12 at a time; each is shrunk as it comes in, so a phone
 *      never holds full-size photos). Every swatch on a page is found in this browser (`lib/gown-swatch/scan.ts`),
 *      and gets a numbered box she can tap, drag, resize, split, delete, or add when one was missed.
 *   2. Each swatch is shown straightened and white-balanced from the card paper, with its true size, a bridal colour
 *      name (or her own name for a near-identical colour she already stocks), and what to check (a pattern bigger
 *      than the swatch, a shadow).
 *   3. Swatches with the same printed name or code family are one STYLE; a style's swatches are its colours. Per
 *      style she picks the kind of cloth and, if she likes, her price per metre (brides never see it).
 *   4. Save → one fabric row per style through the shop's own `fabric_save` (the same check as Add fabric). A style
 *      already saved is never saved twice, and a photo already uploaded is never sent twice.
 *
 * ⛔ The prototype's AI label reader is not ported (owner, Q10): names and codes are typed. Nothing leaves the device
 * until Save. Brides never see this screen.
 */
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ImagePlus, Plus, RotateCw, Save, Scissors, ScanLine, Trash2, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatAmountInput, parseAmountInput } from '@/lib/service-customization-draft';
import { formatCount } from '@/lib/format-number';
import { gownAction } from '@/app/_components/gown-maker/gown-call';
import type { GownFabricTypeOption, ShopGownStockFabric } from '@/lib/gown-maker';
import {
  gownColourName,
  gownFindSwatches,
  gownGroupStyles,
  gownHexOf,
  gownPatternCut,
  gownReadingOrder,
  gownScanFabricRow,
  gownScanNotes,
  gownSwatchCm,
  gownSwatchTile,
  type GownRgba,
  type GownScanBox,
  type GownScanPage,
} from '@/lib/gown-swatch/scan';

const MAX_PAGES = 12;
const MAX_COLOURS = 24;
const CARD_CM = 21;

type Box = GownScanBox & { uid: string };
type Page = { id: string; url: string; img: GownRgba; pg: GownScanPage; boxes: Box[]; sel: number };
type Label = { colName: string | null; code: string; style: string; styleEdited: boolean; skip: boolean };
type Look = { key: string; thumb: string; rgb: [number, number, number]; side: number; cut: boolean; shade: number };
type StyleMeta = { typeId: string; priceCentavos: number | null; saved: boolean; thumbKey?: string | null; tileKey?: string | null; failed?: boolean };
type Upload = (blob: Blob, name: string) => Promise<string | null>;

let uidN = 0;
const uid = () => `b${++uidN}`;
const geomKey = (b: GownScanBox, ang: number) => [b.cx, b.cy, b.w, b.h, ang].map((v) => Math.round(v * 10)).join(',');

/** RGBA → a canvas (the browser's own encoder makes the WebP and the preview). */
function canvasOf(data: Uint8ClampedArray, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), size, size), 0, 0);
  return c;
}
const webp = (c: HTMLCanvasElement) => new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no blob'))), 'image/webp', 0.82));

/** A picked photo, shrunk as it comes in (a phone never holds the full-size picture). */
async function loadPage(file: File): Promise<{ img: GownRgba; url: string }> {
  const bmp = await createImageBitmap(file);
  try {
    const cap = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches ? 1600 : 2200;
    const m = Math.min(1, cap / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * m)), h = Math.max(1, Math.round(bmp.height * m));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h);
    const url = URL.createObjectURL(await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no blob'))), 'image/jpeg', 0.85)));
    return { img: { data: id.data, width: w, height: h }, url };
  } finally {
    bmp.close();
  }
}

const yieldToPaint = () => new Promise((r) => setTimeout(r, 0));
const pageOf = (id: string, url: string, img: GownRgba): Page => {
  const pg = gownFindSwatches(img);
  return { id, url, img, pg, boxes: pg.boxes.map((b) => ({ ...b, uid: uid() })), sel: -1 };
};

export function GownSwatchScan({
  types,
  ownColours,
  upload,
  onClose,
  onSaved,
  seedPages,
}: {
  types: GownFabricTypeOption[];
  /** The colours the shop already named (a near-identical swatch takes her name). */
  ownColours: ShopGownStockFabric['colours'];
  upload: Upload;
  onClose: () => void;
  onSaved: () => void;
  /** The lab only: pages already drawn (a dev page cannot pick files for a screenshot). */
  seedPages?: { url: string; img: GownRgba }[];
}) {
  const toast = useToast();
  const titleId = useId();
  const [book, setBook] = useState('');
  const [cardCm, setCardCm] = useState(CARD_CM);
  const [pages, setPages] = useState<Page[]>(() => (seedPages ?? []).map((p, i) => pageOf(`seed${i}`, p.url, p.img)));
  const [labels, setLabels] = useState<Record<string, Label>>({});
  const [styles, setStyles] = useState<Record<string, StyleMeta>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const looks = useRef(new Map<string, Look>());

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy('Reading pages…');
    let bad = 0, over = 0;
    const got: Page[] = [];
    for (let i = 0; i < files.length; i++) {
      if (pages.length + got.length >= MAX_PAGES) { over = files.length - i; break; }
      setBusy(`Reading page ${formatCount(i + 1)} of ${formatCount(files.length)}…`);
      await yieldToPaint();
      try {
        const { img, url } = await loadPage(files[i]!);
        await yieldToPaint();
        got.push(pageOf(`p${Date.now()}-${i}`, url, img));
      } catch {
        bad++;
      }
    }
    const all = [...pages, ...got], n = all.reduce((a, p) => a + p.boxes.length, 0);
    setPages(all);
    setBusy(null);
    setStatus(
      [
        all.length ? `${formatCount(n)} ${n === 1 ? 'swatch' : 'swatches'} found on ${formatCount(all.length)} ${all.length === 1 ? 'page' : 'pages'}. Tap a box to move or resize it; add one for any swatch that was missed.` : '',
        bad ? `${formatCount(bad)} ${bad === 1 ? "file wasn't a photo and was" : "files weren't photos and were"} skipped.` : '',
        over ? `Only ${formatCount(MAX_PAGES)} pages at a time: save these, then add the next ${formatCount(over)}.` : '',
      ].filter(Boolean).join(' '),
    );
  };

  const changePage = useCallback((id: string, next: (p: Page) => Page | null) => {
    setPages((ps) => ps.flatMap((p) => (p.id === id ? (next(p) ? [next(p)!] : []) : [p])));
  }, []);

  /** Each swatch's straightened picture, colour and checks — worked out once per box position. */
  const look = (p: Page, b: Box): Look => {
    const key = geomKey(b, p.pg.ang), have = looks.current.get(b.uid);
    if (have && have.key === key) return have;
    const t = gownSwatchTile(p.img, p.pg, b, 128);
    const out: Look = { key, thumb: canvasOf(t.data, t.size).toDataURL('image/webp', 0.8), rgb: t.rgb, side: t.side, cut: gownPatternCut(t.data, t.size), shade: t.shade };
    looks.current.set(b.uid, out);
    return out;
  };

  // The review: every kept swatch, in reading order, with its style.
  const review = useMemo(() => {
    const rows = pages.flatMap((p) => p.boxes.map((b, i) => ({ p, b, n: i + 1, lk: look(p, b), lb: labels[b.uid] ?? { colName: null, code: '', style: '', styleEdited: false, skip: false } })));
    const kept = rows.filter((r) => !r.lb.skip);
    const names = gownGroupStyles(kept.map((r) => ({ name: '', code: r.lb.code, style: r.lb.style, styleEdited: r.lb.styleEdited })), book);
    const styleOf = new Map(kept.map((r, i) => [r.b.uid, names[i]!]));
    return rows.map((r) => ({ ...r, style: styleOf.get(r.b.uid) ?? '', colour: r.lb.colName ?? gownColourName(r.lk.rgb, ownColours), cm: gownSwatchCm(r.lk.side, r.p.pg.cardW, cardCm) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `look` reads a ref cache keyed by each box's geometry
  }, [pages, labels, book, cardCm, ownColours]);

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: typeof review }>();
    for (const r of review) if (!r.lb.skip) { const k = r.style.toLowerCase(); if (!m.has(k)) m.set(k, { name: r.style, rows: [] }); m.get(k)!.rows.push(r); }
    return [...m.entries()].map(([key, g]) => ({ key, ...g, meta: styles[key] ?? { typeId: types[0]?.id ?? 'satin', priceCentavos: null, saved: false } }));
  }, [review, styles, types]);

  const setLabel = (u: string, patch: Partial<Label>) => setLabels((l) => ({ ...l, [u]: { ...(l[u] ?? { colName: null, code: '', style: '', styleEdited: false, skip: false }), ...patch } }));
  const setStyle = (key: string, patch: Partial<StyleMeta>) => setStyles((s) => ({ ...s, [key]: { ...(s[key] ?? { typeId: types[0]?.id ?? 'satin', priceCentavos: null, saved: false }), ...patch } }));
  const renameStyle = (key: string, to: string) => {
    const v = to.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!v) return;
    setLabels((l) => {
      const out = { ...l };
      for (const r of review) if (r.style.toLowerCase() === key) out[r.b.uid] = { ...(l[r.b.uid] ?? { colName: null, code: '', style: '', styleEdited: false, skip: false }), style: v, styleEdited: true };
      return out;
    });
    setStyles((s) => (s[key] ? { ...s, [v.toLowerCase()]: s[key]! } : s));
  };

  const left = groups.filter((g) => !g.meta.saved);
  const save = async () => {
    if (busy || !left.length) return;
    let ok = 0, bad = 0, run = 0;
    for (let i = 0; i < left.length; i++) {
      const g = left[i]!;
      setBusy(`Saving ${formatCount(i + 1)} of ${formatCount(left.length)}…`);
      try {
        if (g.rows.length > MAX_COLOURS) throw new Error(`A style holds up to ${MAX_COLOURS} colours. Move some of “${g.name}” to another style.`);
        const type = types.find((t) => t.id === g.meta.typeId);
        const lace = type?.family === 'laces';
        const first = g.rows[0]!;
        let { thumbKey, tileKey } = g.meta;
        if (!thumbKey) {
          const t = gownSwatchTile(first.p.img, first.p.pg, first.b, 64);
          thumbKey = await upload(await webp(canvasOf(t.data, t.size)), 'swatch');
          if (!thumbKey) throw new Error('upload');
          setStyle(g.key, { thumbKey });
        }
        const patterned = lace || g.rows.some((r) => r.lk.cut);
        if (patterned && !tileKey) {
          const t = gownSwatchTile(first.p.img, first.p.pg, first.b);
          tileKey = await upload(await webp(canvasOf(t.data, t.size)), 'tile');
          if (!tileKey) throw new Error('upload');
          setStyle(g.key, { tileKey });
        }
        const r = await gownAction({
          op: 'fabric_save',
          fabric: gownScanFabricRow({
            name: g.name,
            typeId: g.meta.typeId,
            lace,
            codes: g.rows.map((x) => x.lb.code),
            colours: g.rows.map((x) => ({ name: x.colour, hex: gownHexOf(x.lk.rgb) })),
            priceCentavos: g.meta.priceCentavos,
            thumbKey,
            tileKey: patterned ? (tileKey ?? null) : null,
          }),
        });
        if (!r.ok) throw new Error(r.message);
        setStyle(g.key, { saved: true, failed: false });
        ok++; run = 0;
      } catch (e) {
        setStyle(g.key, { failed: true });
        bad++; run++;
        if (e instanceof Error && e.message !== 'upload' && !/fetch|network/i.test(e.message)) setStatus(e.message);
        if (run >= 3) { bad += left.length - i - 1; break; }
      }
      await yieldToPaint();
    }
    setBusy(null);
    if (ok) { toast.success(`Saved ${formatCount(ok)} ${ok === 1 ? 'style' : 'styles'}`); onSaved(); }
    if (bad) {
      const why = `${formatCount(bad)} ${bad === 1 ? 'style' : 'styles'} couldn’t be saved. Tap Save again to finish the rest; nothing is saved twice.`;
      setStatus(why);
      toast.error(why);
    } else if (ok) setStatus(`Saved ${formatCount(ok)} ${ok === 1 ? 'style' : 'styles'}. Brides find them in the Fabric step.`);
  };

  const anySwatch = review.length > 0;
  return (
    <Sheet
      open
      onClose={onClose}
      labelledById={titleId}
      title="Scan a swatch book"
      page
      full
      foot={
        anySwatch ? (
          <div className="p-3">
            <ActionButton
              tone="brand"
              main
              icon={Save}
              label={busy ?? (left.length ? `Save ${formatCount(left.length)} ${left.length === 1 ? 'style' : 'styles'}` : 'All saved')}
              onClick={save}
              disabled={busy !== null || !left.length}
              className="w-full"
              data-gown-scan-save=""
            />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 p-4" data-gown-scan="">
        <p className="text-sn-base text-ink/70">
          Photograph each page flat, in daylight, the whole card in the frame. Every swatch is found on this phone; nothing is sent until you save.
        </p>
        <FormRows>
          <TypedRow name="Book name" value={book} empty="Optional" maxLength={40} onKeep={(v) => setBook(v.trim().slice(0, 40))} data="gown-scan-book" />
          <TypedRow
            name="Card width (cm)"
            value={String(cardCm)}
            maxLength={5}
            check={(t) => (Number(t) >= 5 && Number(t) <= 60 ? null : 'Between 5 and 60 cm.')}
            onKeep={(v) => setCardCm(Number(v))}
            note="Measure the page once. It sets each swatch’s true size."
            data="gown-scan-card"
          />
        </FormRows>
        <label className={actionButtonClass('neutral', { extra: 'w-full justify-center' })} data-gown-scan-add="">
          <ImagePlus aria-hidden className="h-4 w-4" />
          {pages.length ? 'Add more pages' : 'Add page photos'}
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={busy !== null} onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        {status || busy ? (
          <p className="text-sn-base text-ink" role="status" data-gown-scan-status="">
            {busy ?? status}
          </p>
        ) : null}

        {pages.map((p, pi) => (
          <ScanPage key={p.id} page={p} index={pi} onChange={(next) => changePage(p.id, next)} />
        ))}

        {anySwatch ? (
          <section className="space-y-3" data-gown-scan-review="">
            <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Swatches</h3>
            <datalist id={`${titleId}-styles`}>
              {groups.map((g) => (
                <option key={g.key} value={g.name} />
              ))}
            </datalist>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {review.map((r) => {
                const notes = gownScanNotes({ cut: r.lk.cut, lace: types.find((t) => t.id === (styles[r.style.toLowerCase()]?.typeId ?? types[0]?.id))?.family === 'laces', cm: r.cm, shade: r.lk.shade });
                const saved = styles[r.style.toLowerCase()]?.saved === true;
                return (
                  <li key={r.b.uid} className={`sn-tile space-y-2 p-3 ${r.lb.skip ? 'opacity-50' : ''}`} data-gown-scan-swatch={r.b.uid}>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a picture made in this browser, never uploaded until Save */}
                      <img src={r.lk.thumb} alt={`Swatch ${r.n}, page ${pages.indexOf(r.p) + 1}`} width={56} height={56} className="h-14 w-14 flex-none rounded-sn-sm object-cover" />
                      <small className="text-sn-base text-ink/70">
                        Page {pages.indexOf(r.p) + 1} · swatch {r.n} · {r.cm.toFixed(1)} cm{saved ? ' · Saved' : ''}
                      </small>
                    </div>
                    <input className="input-field" aria-label={`Colour name, swatch ${r.n}`} maxLength={30} value={r.colour} disabled={saved} onChange={(e) => setLabel(r.b.uid, { colName: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input-field"
                        aria-label={`Style, swatch ${r.n}`}
                        list={`${titleId}-styles`}
                        maxLength={40}
                        defaultValue={r.style}
                        key={`${r.b.uid}-${r.style}`}
                        disabled={r.lb.skip || saved}
                        onBlur={(e) => { const v = e.target.value.replace(/\s+/g, ' ').trim().slice(0, 40); if (v && v !== r.style) setLabel(r.b.uid, { style: v, styleEdited: true }); }}
                      />
                      <input className="input-field" aria-label={`Code, swatch ${r.n}`} placeholder="Code" maxLength={24} value={r.lb.code} disabled={saved} onChange={(e) => setLabel(r.b.uid, { code: e.target.value })} />
                    </div>
                    {notes.map((t) => (
                      <p key={t} className="text-sn-sm text-warn-700">
                        {t}
                      </p>
                    ))}
                    <ActionButton tone="neutral" quiet icon={r.lb.skip ? Plus : X} label={r.lb.skip ? 'Put back' : 'Leave out'} name={`${r.lb.skip ? 'Put back' : 'Leave out'} swatch ${r.n}`} onClick={() => setLabel(r.b.uid, { skip: !r.lb.skip })} disabled={saved} />
                  </li>
                );
              })}
            </ul>

            <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Styles</h3>
            <p className="text-sn-base text-ink/70">Each style becomes one fabric, its swatches its colours. Brides never see your price.</p>
            {groups.map((g) => (
              <div key={g.key} className="sn-frame p-1" data-gown-scan-style={g.key}>
                <FormRows>
                  <TypedRow name="Style" value={g.name} maxLength={40} readOnly={g.meta.saved} onKeep={(v) => renameStyle(g.key, v)} data="gown-scan-style-name" note={`${formatCount(g.rows.length)} ${g.rows.length === 1 ? 'colour' : 'colours'}${g.meta.saved ? ' · Saved' : g.meta.failed ? ' · Not saved yet' : ''}`} />
                  <ChosenRow
                    name="Kind of cloth"
                    value={g.meta.typeId}
                    options={types.map((t) => ({ key: t.id, label: t.verified ? t.name : `${t.name} (values to check)` }))}
                    onPick={(k) => setStyle(g.key, { typeId: k })}
                    data="gown-scan-style-type"
                  />
                  <TypedRow
                    name="Your price per metre"
                    amount
                    value={formatAmountInput(g.meta.priceCentavos ?? 0)}
                    empty="Not priced"
                    readOnly={g.meta.saved}
                    onKeep={(v) => setStyle(g.key, { priceCentavos: parseAmountInput(v) || null })}
                    data="gown-scan-style-price"
                  />
                </FormRows>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}

/** One page photo with a box on each swatch: tap a box, then drag it or its corner. */
function ScanPage({ page, index, onChange }: { page: Page; index: number; onChange: (next: (p: Page) => Page | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'size'; uid: string; x: number; y: number; b: GownScanBox; moved: boolean } | null>(null);
  const [live, setLive] = useState<Box | null>(null);
  const { pg, boxes, sel } = page;
  const W = pg.width, H = pg.height, cs = Math.cos(pg.ang), sn = Math.sin(pg.ang);
  const pt = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, W / r.width] as const; };
  const loc = (b: GownScanBox, x: number, y: number) => { const dx = x - b.cx, dy = y - b.cy; return [dx * cs + dy * sn, -dx * sn + dy * cs] as const; };
  const shown = (b: Box) => (live && live.uid === b.uid ? live : b);

  const down = (e: React.PointerEvent) => {
    const [x, y, s] = pt(e);
    let hit = -1, mode: 'move' | 'size' = 'move';
    const cur = boxes[sel];
    if (cur) { const [u, v] = loc(cur, x, y); if (Math.hypot(u - cur.w / 2, v - cur.h / 2) < 24 * s) { hit = sel; mode = 'size'; } }
    if (hit < 0) for (let i = boxes.length - 1; i >= 0; i--) { const [u, v] = loc(boxes[i]!, x, y); if (Math.abs(u) <= boxes[i]!.w / 2 && Math.abs(v) <= boxes[i]!.h / 2) { hit = i; break; } }
    onChange((p) => ({ ...p, sel: hit }));
    // a first tap picks the box; the page still scrolls until one is picked
    if (hit >= 0 && (hit === sel || e.pointerType === 'mouse')) {
      const b = boxes[hit]!;
      drag.current = { mode, uid: b.uid, x, y, b: { ...b }, moved: false };
      try { ref.current!.setPointerCapture(e.pointerId); } catch { /* an old browser: the drag still follows the finger */ }
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [x, y] = pt(e), o = d.b;
    let n: GownScanBox;
    if (d.mode === 'move') n = { ...o, cx: Math.max(0, Math.min(W, o.cx + x - d.x)), cy: Math.max(0, Math.min(H, o.cy + y - d.y)) };
    else {
      const ox = o.cx - (o.w / 2) * cs + (o.h / 2) * sn, oy = o.cy - (o.w / 2) * sn - (o.h / 2) * cs;
      const w = Math.max(16, (x - ox) * cs + (y - oy) * sn), h = Math.max(16, -(x - ox) * sn + (y - oy) * cs);
      n = { cx: ox + (w / 2) * cs - (h / 2) * sn, cy: oy + (w / 2) * sn + (h / 2) * cs, w, h };
    }
    d.moved = true;
    setLive({ ...n, uid: d.uid });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && live) { const L = live; onChange((p) => ({ ...p, boxes: p.boxes.map((b) => (b.uid === L.uid ? L : b)) })); }
    setLive(null);
  };

  const add = () => onChange((p) => {
    const ws = p.boxes.map((b) => Math.min(b.w, b.h)).sort((a, b) => a - b), s = ws.length ? ws[ws.length >> 1]! : W * 0.18;
    return { ...p, boxes: [...p.boxes, { cx: W / 2, cy: H / 2, w: s, h: s, uid: uid() }], sel: p.boxes.length };
  });
  const split = () => onChange((p) => {
    const b = p.boxes[p.sel];
    if (!b) return p;
    const wide = b.w >= b.h, q = (wide ? b.w : b.h) / 4, dx = wide ? q * cs : -q * sn, dy = wide ? q * sn : q * cs, nw = wide ? b.w / 2 : b.w, nh = wide ? b.h : b.h / 2;
    const next = [...p.boxes];
    next.splice(p.sel, 1, { cx: b.cx - dx, cy: b.cy - dy, w: nw, h: nh, uid: uid() }, { cx: b.cx + dx, cy: b.cy + dy, w: nw, h: nh, uid: uid() });
    return { ...p, boxes: next };
  });
  const del = () => onChange((p) => (p.sel < 0 ? p : { ...p, boxes: p.boxes.filter((_, i) => i !== p.sel), sel: -1 }));
  const again = () => onChange((p) => { const f = gownFindSwatches(p.img); return { ...p, pg: f, boxes: gownReadingOrder(f.boxes, f.ang).map((b) => ({ ...b, uid: uid() })), sel: -1 }; });
  const remove = () => { URL.revokeObjectURL(page.url); onChange(() => null); };

  const n = boxes.length;
  return (
    <section className="sn-frame space-y-2 p-3" data-gown-scan-page={index + 1}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sn-base font-semibold text-ink">
          Page {index + 1} · {n ? `${formatCount(n)} ${n === 1 ? 'swatch' : 'swatches'}` : 'no swatches found: add a box'}
        </span>
        <ActionButton tone="danger" quiet iconOnly icon={Trash2} label="Remove page" name={`Remove page ${index + 1}`} onClick={remove} />
      </div>
      <div
        ref={ref}
        className="relative w-full select-none overflow-hidden rounded-sn-sm"
        style={{ aspectRatio: `${W} / ${H}`, touchAction: sel >= 0 ? 'none' : 'pan-y' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="group"
        aria-label={`Page ${index + 1} photo with a box on each swatch. Tap a box, then drag it or its corner.`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the page photo as picked, held in this browser only */}
        <img src={page.url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        {boxes.map((b0, i) => {
          const b = shown(b0), on = i === sel;
          return (
            <div
              key={b.uid}
              aria-hidden
              className={`pointer-events-none absolute border-2 ${on ? 'border-mulberry-600' : 'border-ink'}`}
              style={{ left: `${(b.cx / W) * 100}%`, top: `${(b.cy / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%`, transform: `translate(-50%, -50%) rotate(${pg.ang}rad)` }}
            >
              <span className={`absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-sn-xs font-bold text-paper ${on ? 'bg-mulberry-600' : 'bg-ink'}`}>{i + 1}</span>
              {on ? <span className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-mulberry-600 bg-paper" /> : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton tone="neutral" icon={Plus} label="Box" name={`Add a box on page ${index + 1}`} onClick={add} />
        <ActionButton tone="neutral" icon={Scissors} label="Split in two" onClick={split} disabled={sel < 0} />
        <ActionButton tone="neutral" icon={X} label="Delete box" onClick={del} disabled={sel < 0} />
        <ActionButton tone="neutral" icon={RotateCw} label="Find again" onClick={again} />
      </div>
    </section>
  );
}

/** The door on Fabrics and lace. */
export function GownSwatchScanDoor({ onOpen }: { onOpen: () => void }) {
  return <ActionButton tone="neutral" icon={ScanLine} label="Scan a swatch book" onClick={onOpen} className="w-full" data-gown-scan-open="" />;
}
