'use client';

import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Printer, Share } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import type { PromoteQrMode } from '@/lib/supplier-qr-codes';
import {
  DEFAULT_PRINT_DESIGN,
  DEFAULT_PRINT_QR,
  PRINT_DESIGNS,
  PRINT_PIECES,
  PRINT_QR,
  PRINT_QR_ORDER,
  PRINT_SCENES,
  PRINT_SCENE_DIR,
  PRINTS_API,
  groundCss,
  matrix3d,
  printDesign,
  printFilename,
  printHref,
  type PrintDesign,
  type PrintPiece,
  type PrintScene,
  type PrintSide,
} from '@/lib/supplier-prints';

/**
 * 🖨 PRINTS — Shop › Promote part 3 (owner APPROVED the 15 looks, 5 Nov 2026: "perfect"; prototype
 * Setnayan-specs `prototypes/supplier_prints_2026-11-05/`). A row on Promote opens ONE sheet:
 *
 *   Prints · <look> · 7 pieces ⓘ
 *   Design ▾ (the 15 looks — one dropdown, never a pill row) · QR on your prints ▾ (the shop's own codes:
 *   Check a date · Shortlist · My page)
 *   ALL 7 PIECES · <look>  [<code> QR]   each piece: name · size, its line, Save; tap the picture → it big
 *   SEE IT IN USE          the look + QR placed onto the real event photos (`PRINT_SCENES`, CSS matrix3d)
 *
 * Every picture is the ONE renderer's drawing (`/api/vendor/prints` → `renderPrint`), so the gallery, the photos and
 * the saved file are the same print. Words are the prototype's. Nothing is typed, moved or uploaded; nothing is stored
 * (each file is drawn on request), so there is no export to sweep.
 */

/** The route that draws every picture and file — `/api/vendor/prints`; a /dev lab hands in its fixture route. */
const ArtBase = createContext<string>(PRINTS_API);

type Big = { kind: 'piece'; piece: PrintPiece } | { kind: 'scene'; scene: PrintScene } | null;

const HOW =
  'Every piece has ONE fixed layout — fixed size, safe zones and fixed spots for your name, line, Verified seal, rating, badges and QR. A design changes only the look: ground, type, colours, ornament. Your facts come from your shop. Nothing is moved, resized or uploaded — which is exactly what lets your prints drop into the photos below by themselves.';

export function ShopPrintsSection({ canShare, setupHref, artBase = PRINTS_API }: { canShare: boolean; setupHref: string; artBase?: string }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <section id="prints" className="mt-8 scroll-mt-24" data-shop-prints="" aria-labelledby={headingId}>
      <InfoTip label="Prints" labelAs="h2" labelClassName="sn-sec" labelId={headingId} align="start">
        {HOW}
      </InfoTip>
      <div className="mt-2">
        {canShare ? (
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="sn-press flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left" data-dates-row="shop-prints">
            <Printer aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium leading-tight text-ink">Calling card + tarps</span>
              <span className="mt-0.5 block truncate text-[13px] text-ink/60">15 designs · 7 pieces</span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
          </button>
        ) : (
          <DatesRow data="shop-prints-no-address" title="Name your shop first" line="Your codes are built from your shop’s web address" href={setupHref} />
        )}
      </div>
      {canShare ? (
        <ArtBase.Provider value={artBase}>
          <PrintsSheet open={open} onClose={() => setOpen(false)} />
        </ArtBase.Provider>
      ) : null}
    </section>
  );
}

function PrintsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const toast = useToast();
  const [designId, setDesignId] = useState<string>(DEFAULT_PRINT_DESIGN);
  const [qr, setQr] = useState<PromoteQrMode>(DEFAULT_PRINT_QR);
  const [big, setBig] = useState<Big>(null);
  const d = printDesign(designId) ?? PRINT_DESIGNS[0]!;

  const pickDesign = (k: string) => {
    if (k === designId) return;
    setDesignId(k);
    toast.info(`Design · ${printDesign(k)?.name ?? ''} · all 7 pieces and the photos updated`);
  };
  const pickQr = (k: string) => {
    const m = k as PromoteQrMode;
    if (m === qr) return;
    setQr(m);
    toast.info(`QR · ${PRINT_QR[m].t} · every piece now says “${PRINT_QR[m].cap}”`);
  };

  const close = () => {
    setBig(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      labelledById={titleId}
      wide
      full
      title={big ? undefined : 'Prints'}
      back={big ? { label: 'Prints', onBack: () => setBig(null) } : undefined}
    >
      <div className="pb-8" data-prints-sheet={d.id} data-prints-qr={qr}>
        {big?.kind === 'piece' ? (
          <BigPiece piece={big.piece} d={d} qr={qr} titleId={titleId} />
        ) : big?.kind === 'scene' ? (
          <BigScene scene={big.scene} d={d} qr={qr} titleId={titleId} />
        ) : (
          <>
            <div className="flex items-center gap-1 px-4 text-[13px] text-ink/60">
              <h2 id={titleId} className="sr-only">
                Prints
              </h2>
              <span data-prints-top="">
                <InfoTip label={`${d.name} · 7 pieces`} ariaLabel="How prints work" align="start">
                  {HOW}
                </InfoTip>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 px-4">
              <label className="block min-w-0">
                <span className="block text-[11px] text-ink/60">Design</span>
                <PickMenu
                  label="Design"
                  value={d.id}
                  dataAttr="data-prints-design"
                  className="!min-h-11 w-full"
                  onPick={pickDesign}
                  options={PRINT_DESIGNS.map((x) => ({
                    key: x.id,
                    label: x.name,
                    hint: `suits ${x.suits}`,
                    preview: <span aria-hidden className="block h-5 w-[30px] flex-none rounded ring-1 ring-black/10" style={{ background: groundCss(x) }} />,
                  }))}
                />
              </label>
              <label className="block min-w-0">
                <span className="block text-[11px] text-ink/60">QR on your prints</span>
                <PickMenu
                  label="QR on your prints"
                  value={qr}
                  dataAttr="data-prints-qr-pick"
                  className="!min-h-11 w-full"
                  onPick={pickQr}
                  options={PRINT_QR_ORDER.map((k) => ({ key: k, label: PRINT_QR[k].sub ? `${PRINT_QR[k].t} · ${PRINT_QR[k].sub}` : PRINT_QR[k].t, hint: `“${PRINT_QR[k].cap}”` }))}
                />
              </label>
            </div>

            <div className="mt-5 flex items-center gap-2 px-4">
              <InfoTip label={`All 7 pieces · ${d.name}`} labelClassName="sn-sec" ariaLabel="About this design" align="start">
                {`${d.name} — suits ${d.suits}. Tap any piece to see it big. Save gives a print-ready file with 3 mm bleed at this exact size.`}
              </InfoTip>
              <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-medium text-ink/60">{PRINT_QR[qr].t} QR</span>
            </div>
            <ul className="mt-1" data-prints-list="">
              {PRINT_PIECES.map((p) => (
                <li key={p.id} className="border-b border-ink/10 px-4 pb-4 pt-2" data-prints-piece={p.id}>
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium leading-tight text-ink">
                        {p.name} <span className="font-normal text-ink/60">· {p.size}</span>
                      </div>
                      <div className="text-[12.5px] leading-snug text-ink/60">{p.line}</div>
                    </div>
                    <SaveButton piece={p} d={d} qr={qr} small />
                  </div>
                  <button type="button" onClick={() => setBig({ kind: 'piece', piece: p })} aria-label={`See ${p.name} big`} className="sn-press block w-full">
                    <PiecePicture piece={p} d={d} qr={qr} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-5 px-4">
              <InfoTip label="See it in use" labelAs="h3" labelClassName="sn-sec" align="start">
                Real event photos. Your chosen design and QR are placed onto the printed surfaces by the app — change the design or the QR and these update with it. The people and furniture in front stay in front.
              </InfoTip>
              <p className="mt-1 text-[13px] text-ink/60">Your design and QR, placed on the prints in each photo. Swipe.</p>
            </div>
            <div className="mt-2 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" data-prints-scenes="">
              {PRINT_SCENES.map((s) => (
                <figure key={s.slug} className="m-0 flex-none snap-start" data-prints-scene={s.slug}>
                  <button type="button" onClick={() => setBig({ kind: 'scene', scene: s })} aria-label={`${s.cap} big`} className="sn-press block">
                    <Scene scene={s} d={d} qr={qr} height={220} />
                  </button>
                  <figcaption className="pt-1.5 text-[12.5px] text-ink/60">
                    <b className="font-medium text-ink">{s.cap}</b> · {s.sub}
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function SaveButton({ piece, d, qr, small = false }: { piece: PrintPiece; d: PrintDesign; qr: PromoteQrMode; small?: boolean }) {
  const base = useContext(ArtBase);
  return (
    <SaveFileLink
      href={printHref({ piece: piece.id, design: d.id, qr, save: true, base })}
      filename={printFilename(piece, d)}
      className={
        small
          ? 'sn-press inline-flex h-[34px] flex-none items-center rounded-full border-[1.5px] border-ink/15 px-3 text-[13px] font-medium text-ink'
          : 'sn-press inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-sn-accent px-4 text-[14px] font-medium text-white'
      }
      data-prints-save={piece.id}
    >
      {small ? (
        'Save'
      ) : (
        <>
          <Share aria-hidden className="h-4 w-4" strokeWidth={1.8} />
          Save
        </>
      )}
    </SaveFileLink>
  );
}

function Art({ piece, side, d, qr, className = '' }: { piece: PrintPiece; side: PrintSide; d: PrintDesign; qr: PromoteQrMode; className?: string }) {
  const base = useContext(ArtBase);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an SVG drawn per request for the signed-in shop; nothing for next/image to optimise
    <img
      src={printHref({ piece: piece.id, side, design: d.id, qr, base })}
      alt={`${piece.name}${piece.sides === 2 ? (side === 'f' ? ' · front' : ' · back') : ''} · ${d.name}`}
      width={1000}
      height={Math.round(1000 / piece.ratio)}
      loading="lazy"
      decoding="async"
      className={`block h-auto w-full rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.12)] ${className}`}
      style={{ aspectRatio: String(piece.ratio), background: groundCss(d) }}
    />
  );
}

/** The gallery picture: the card's two sides side by side; a tall piece narrower, as the prototype sizes them. */
function PiecePicture({ piece, d, qr }: { piece: PrintPiece; d: PrintDesign; qr: PromoteQrMode }) {
  if (piece.sides === 2) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Art piece={piece} side="f" d={d} qr={qr} />
        <Art piece={piece} side="b" d={d} qr={qr} />
      </div>
    );
  }
  const width = piece.ratio < 0.6 ? 'max-w-[52%]' : piece.ratio < 1 ? 'max-w-[72%]' : '';
  return (
    <div className={`mx-auto ${width}`}>
      <Art piece={piece} side="f" d={d} qr={qr} />
    </div>
  );
}

function BigPiece({ piece, d, qr, titleId }: { piece: PrintPiece; d: PrintDesign; qr: PromoteQrMode; titleId: string }) {
  return (
    <div className="px-4" data-prints-big={piece.id}>
      <h2 id={titleId} className="text-[18px] font-medium text-ink">
        {piece.name}
        <small className="block text-[12.5px] font-normal text-ink/60">
          {piece.size} · {d.name} · seen {piece.view}
        </small>
      </h2>
      <div className="mt-3 grid gap-3">
        {piece.sides === 2 ? (
          <>
            <p className="-mb-1.5 text-[12px] uppercase tracking-[0.06em] text-ink/60">Front</p>
            <Art piece={piece} side="f" d={d} qr={qr} />
            <p className="-mb-1.5 text-[12px] uppercase tracking-[0.06em] text-ink/60">Back</p>
            <Art piece={piece} side="b" d={d} qr={qr} />
          </>
        ) : (
          <div className={piece.ratio < 0.6 ? 'mx-auto w-3/5' : ''}>
            <Art piece={piece} side="f" d={d} qr={qr} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <SaveButton piece={piece} d={d} qr={qr} />
      </div>
      <p className="mt-2 text-[13px] text-ink/60">
        Print-ready, 3 mm bleed, exact size. Your QR: {PRINT_QR[qr].t} — “{PRINT_QR[qr].cap}”.
      </p>
    </div>
  );
}

function BigScene({ scene, d, qr, titleId }: { scene: PrintScene; d: PrintDesign; qr: PromoteQrMode; titleId: string }) {
  const names = scene.surfaces.map((s) => PRINT_PIECES.find((p) => p.id === s.piece)?.name ?? '').join(' + ');
  return (
    <div className="px-4" data-prints-big-scene={scene.slug}>
      <h2 id={titleId} className="text-[18px] font-medium text-ink">
        {scene.cap}
        <small className="block text-[12.5px] font-normal text-ink/60">
          {scene.sub} · {d.name}
        </small>
      </h2>
      <div className="mt-3">
        <Scene scene={scene} d={d} qr={qr} />
      </div>
      <p className="mt-2 text-[13px] text-ink/60">{names} placed by the app. The design and QR you picked; nothing drawn by hand.</p>
    </div>
  );
}

/**
 * One photo with the supplier's prints placed on it — `placement.json`'s recipe: each surface's print warped into its
 * quad (CSS matrix3d), blurred to the photo's focus, the blank surface's own light multiplied over it (`shade`), a thin
 * veil of that light on top, then the foreground (hands, flowers, people) drawn back in front (`mask`).
 */
function Scene({ scene, d, qr, height }: { scene: PrintScene; d: PrintDesign; qr: PromoteQrMode; height?: number }) {
  const [W, H] = scene.size;
  const base = useContext(ArtBase);
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);
  const sized = height ? { height, width: Math.round((height * W) / H) } : { width: '100%' };
  return (
    <div ref={box} className="relative overflow-hidden rounded-xl bg-ink/[0.05]" style={{ ...sized, aspectRatio: `${W} / ${H}` }} data-scene-k={k ? k.toFixed(4) : ''}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${k})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size plate the surfaces are placed on in its own pixels */}
        <img src={`${PRINT_SCENE_DIR}/${scene.slug}.webp`} alt={scene.cap} width={W} height={H} loading="lazy" decoding="async" className="absolute left-0 top-0 block" style={{ width: W, height: H }} />
        {scene.surfaces.map((s, i) => {
          const p = PRINT_PIECES.find((x) => x.id === s.piece)!;
          const q = s.quad;
          const qw = (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1])) / 2;
          const qh = (Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2;
          const w = 720;
          const h = s.fit === 'contain' ? (w * qh) / qw : w / p.ratio;
          return (
            <div key={i} className="contents" data-scene-surface={s.piece}>
              <div
                className="absolute left-0 top-0 flex origin-top-left items-center justify-center overflow-hidden"
                style={{ width: w, height: h, background: groundCss(d), transform: matrix3d(w, h, q) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the same drawing the gallery shows */}
                <img
                  src={printHref({ piece: p.id, side: s.side, design: d.id, qr, base })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="block flex-none"
                  // the photo's focus, INSIDE the clipped surface: a blur on the surface itself spills a halo past its edge,
                  // and that halo showed as a seam across the expo booth's counter
                  style={{
                    ...(s.fit === 'contain' ? (p.ratio >= w / h ? { width: w, height: w / p.ratio } : { height: h, width: h * p.ratio }) : { width: w, height: h }),
                    filter: s.blur ? `blur(${((s.blur * w) / qw) * 0.5}px)` : undefined,
                  }}
                />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- the blank surface's own light */}
              <img src={`${PRINT_SCENE_DIR}/${s.shade.file}`} alt="" aria-hidden className="absolute block mix-blend-multiply" style={{ left: s.shade.x, top: s.shade.y, width: s.shade.w, height: s.shade.h }} />
              {s.veil ? (
                // eslint-disable-next-line @next/next/no-img-element -- matte ink never reads pure black under light
                <img src={`${PRINT_SCENE_DIR}/${s.shade.file}`} alt="" aria-hidden className="absolute block" style={{ left: s.shade.x, top: s.shade.y, width: s.shade.w, height: s.shade.h, opacity: s.veil }} />
              ) : null}
              {s.mask ? (
                // eslint-disable-next-line @next/next/no-img-element -- the foreground, back in front
                <img src={`${PRINT_SCENE_DIR}/${s.mask.file}`} alt="" aria-hidden className="absolute block" style={{ left: s.mask.x, top: s.mask.y, width: s.mask.w, height: s.mask.h }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
