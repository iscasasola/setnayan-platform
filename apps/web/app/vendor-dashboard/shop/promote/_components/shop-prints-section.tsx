'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Printer, Share } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { SwitchTrack, SWITCH_BUTTON } from '@/app/_components/switch-track';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { badgesForPrint, type ShopBadge, type ShopBadgeFacts } from '@/lib/shop-badges';
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
  PRINT_BLOCKS,
  PRINT_PURPOSE,
  PERSONAL_CARD_PURPOSE,
  groundCss,
  matrix3d,
  printDesign,
  printAllFilename,
  printAllHref,
  printFilename,
  printHref,
  type PrintBlock,
  type PrintDesign,
  type PrintPiece,
  type PrintPurpose,
  type PrintQrMode,
  type PrintScene,
  type PrintSide,
} from '@/lib/supplier-prints';
import type { PrintMember } from '@/lib/supplier-prints-svg';
import { formatCount } from '@/lib/format-number';
import { usePromoteBridge } from './promote-bridge';

/**
 * 🖨 PRINTS — Shop › Promote part 3 (owner APPROVED the 15 looks, 5 Nov 2026: "perfect"; prototype
 * Setnayan-specs `prototypes/supplier_prints_2026-11-05/`). A row on Promote opens ONE sheet:
 *
 *   ‹ Prints · <look> · 7 pieces ⓘ · Save all        (the head — 2026-11-06 "what is the use of our prototype?": the
 *                                                      build now IS the 5 Nov prototype: head, YOUR FACTS, HOW IT
 *                                                      FITS, and the pickers in the thumb dock, not at the top)
 *   YOUR FACTS      Shop name · Line · Verified seal · Rating · Badges · On your prints ▾
 *   Design ▾ (the 15 looks — one dropdown, never a pill row) · QR on your prints ▾ (the shop's own codes:
 *   Check a date · Shortlist · My page · Reviews) — both in the THUMB DOCK at the sheet's foot
 *   ALL 7 PIECES · <look>  [<code> QR]   each piece: name · size, its line, Save; tap the picture → it big
 *   Your badges            the badge print (`lib/shop-badge-print.ts` via `/api/vendor/badges`) — a piece INSIDE prints
 *                          (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL"); Analytics › Your badges no
 *                          longer has its own Save. Its facts are read when the sheet opens (`?view=facts`, the Today
 *                          line's read), so Promote's own reads do not grow; a refused read is said, never "none".
 *   SEE IT IN USE          the look + QR placed onto the real event photos (`PRINT_SCENES`, CSS matrix3d)
 *
 * Every picture is the ONE renderer's drawing (`/api/vendor/prints` → `renderPrint`), so the gallery, the photos and
 * the saved file are the same print. Words are the prototype's. Nothing is typed, moved or uploaded; nothing is stored
 * (each file is drawn on request), so there is no export to sweep.
 */

/** The route that draws every picture and file — `/api/vendor/prints`; a /dev lab hands in its fixture route. */
const ArtBase = createContext<string>(PRINTS_API);
/**
 * The blocks `On your prints ▾` switched off (PRINTS BY PURPOSE AND SIZE, owner 2026-11-06) — every picture, every
 * photo and every Save asks the ONE renderer with them (`printHref({ hide })`), so what is seen is what prints.
 */
const Hidden = createContext<readonly PrintBlock[]>([]);

/** `who: 'me'` = the signed-in member's own calling card (owner 2026-11-06, "Yes"). */
type Big = { kind: 'piece'; piece: PrintPiece; who?: 'me' } | { kind: 'scene'; scene: PrintScene } | null;

const ON_YOUR_PRINTS =
  'ONE place for every content block, on every piece. Switch a block off and it leaves every print that carried it. A small piece never carries more than its size allows, whatever is switched on. Your name and the QR are always on. A block with nothing behind it (no reviews yet, no photo, no logo) simply is not printed — never a zero, never an empty box. No prices, phones or emails are ever printed.';

const BADGE_FACTS_API = '/api/vendor/badges?view=facts';
const BADGE_PRINT_API = '/api/vendor/badges?badge=all';

const HOW =
  'Every piece has ONE fixed layout — fixed size, safe zones and fixed spots for your name, line, Verified seal, rating, badges and QR. A design changes only the look: ground, type, colours, ornament. Your facts come from your shop. Nothing is moved, resized or uploaded — which is exactly what lets your prints drop into the photos below by themselves.';

/** The YOUR FACTS ⓘ and HOW IT FITS ⓘ — the prototype's own words (supplier_prints_2026-11-05/index.html). */
const FACTS_TIP =
  'These come from your shop — change them there and every print follows. Nothing on a print is typed or moved here. The seal, rating and badges print only if you have them; the switches below take the rating and badges off every print. On the calling card the rating and badges sit on the back.';
const FITS_TIP =
  'Every piece has one fixed layout that all 15 designs share: fixed size, safe zones, and fixed spots for the name, line, seal, rating, badges and QR. The QR always prints dark on a white plate so it scans, and no ornament may enter its zone. You pick a design and a QR — that is all. No moving, resizing or uploading, which is exactly what lets the photos below place your prints by themselves.';

/** YOUR FACTS' first two rows: the shop's name and the line every print carries — read on the server, never typed. */
export type PrintFacts = { name: string; line: string };

export function ShopPrintsSection({
  canShare,
  setupHref,
  artBase = PRINTS_API,
  badgeFactsUrl = BADGE_FACTS_API,
  member = null,
  facts = null,
}: {
  canShare: boolean;
  setupHref: string;
  artBase?: string;
  /** Where the badge piece reads the shop's badges — the real route unless a /dev lab hands in a data: URI. */
  badgeFactsUrl?: string;
  /** The signed-in member's own card (their account name + Team label) — null = no name yet, so no card is offered. */
  member?: PrintMember | null;
  /** YOUR FACTS — the shop's name and line (`printLine`, the renderer's own builder). */
  facts?: PrintFacts | null;
}) {
  const [open, setOpen] = useState(false);
  // 🔗 The code on every piece — the QR codes list's "Put it on…" sets it (Option B), the dock's QR ▾ changes it.
  const [qr, setQr] = useState<PrintQrMode>(DEFAULT_PRINT_QR);
  const [big, setBig] = useState<Big>(null);
  const headingId = useId();
  const bridge = usePromoteBridge();
  const ask = bridge?.ask ?? null;
  useEffect(() => {
    if (!ask) return;
    setQr(ask.qr);
    setBig(ask.piece === 'door' ? { kind: 'piece', piece: PRINT_PIECES.find((p) => p.id === 'door')! } : null);
    setOpen(true);
    // one ask = one opening — `n` counts them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.n]);
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
          <PrintsSheet
            open={open}
            onClose={() => {
              setBig(null);
              setOpen(false);
            }}
            badgeFactsUrl={badgeFactsUrl}
            member={member}
            facts={facts}
            qr={qr}
            setQr={setQr}
            big={big}
            setBig={setBig}
          />
        </ArtBase.Provider>
      ) : null}
    </section>
  );
}

/**
 * THE PRINTS SHEET — the 5 Nov prototype, one-for-one (`supplier_prints_2026-11-05/index.html`, owner "perfect"):
 *
 *   ‹  Prints / <look> · 7 pieces ⓘ                                  [Save all]      ← the head, pinned
 *   YOUR FACTS ⓘ    Shop name · Line · Verified seal ◯ · Rating ◯ · Badges ◯ · On your prints ▾ (#7332, approved 6 Nov)
 *   HOW IT FITS ⓘ   "One fixed layout per piece. A design changes only the look — your shop changes the facts."
 *   ALL 7 PIECES · <look> [<code> QR] ⓘ   each: name · size / its purpose ⓘ / Save, the picture (tap → big)
 *   Your badges     the badge print — a piece INSIDE prints (6 Nov)
 *   SEE IT IN USE ⓘ the photos
 *   [Design ▾] [QR on your prints ▾]                                                  ← the thumb dock, pinned
 */
function PrintsSheet({
  open,
  onClose,
  badgeFactsUrl,
  member,
  facts,
  qr,
  setQr,
  big,
  setBig,
}: {
  open: boolean;
  onClose: () => void;
  badgeFactsUrl: string;
  member: PrintMember | null;
  facts: PrintFacts | null;
  qr: PrintQrMode;
  setQr: (q: PrintQrMode) => void;
  big: Big;
  setBig: (b: Big) => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const [designId, setDesignId] = useState<string>(DEFAULT_PRINT_DESIGN);
  const [hidden, setHidden] = useState<PrintBlock[]>([]);
  const d = printDesign(designId) ?? PRINT_DESIGNS[0]!;
  const onKeys = PRINT_BLOCKS.filter((b) => !hidden.includes(b.key)).map((b) => b.key);
  const toggleBlock = (k: string) => {
    const key = k as PrintBlock;
    setHidden((h) => (h.includes(key) ? h.filter((x) => x !== key) : [...h, key]));
  };
  const card = PRINT_PIECES.find((p) => p.id === 'card')!;
  const badgeRead = useBadgeFacts(open, badgeFactsUrl);

  const pickDesign = (k: string) => {
    if (k === designId) return;
    setDesignId(k);
    toast.info(`Design · ${printDesign(k)?.name ?? ''} · all 7 pieces and the photos updated`);
  };
  const pickQr = (k: string) => {
    const m = k as PrintQrMode;
    if (m === qr) return;
    setQr(m);
    toast.info(`QR · ${PRINT_QR[m].t} · every piece now says “${PRINT_QR[m].cap}”`);
  };
  const flip = (k: PrintBlock, word: string) => {
    const on = hidden.includes(k);
    toggleBlock(k);
    toast.info(`${word} · ${on ? 'shown' : 'hidden'} on every print`);
  };

  const bigTitle = big?.kind === 'piece' ? (big.who === 'me' ? 'Your own card' : big.piece.name) : big?.kind === 'scene' ? big.scene.cap : 'Prints';
  const bigSub =
    big?.kind === 'piece' ? `${big.piece.size} · ${d.name} · seen ${big.piece.view}` : big?.kind === 'scene' ? `${big.scene.sub} · ${d.name}` : null;

  const head = (
    <div className="flex items-center gap-2.5 border-b border-ink/10 bg-cream px-4 pb-2 pt-[calc(10px+env(safe-area-inset-top))]" data-prints-head="">
      <button
        type="button"
        onClick={big ? () => setBig(null) : onClose}
        aria-label={big ? 'Back to Prints' : 'Back to Promote'}
        className="sn-press grid h-9 w-9 flex-none place-items-center rounded-full bg-ink/[0.06] text-ink"
        data-prints-back=""
      >
        <ChevronLeft aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="truncate text-[18px] font-medium leading-tight text-ink">
          {bigTitle}
        </h2>
        {bigSub ? (
          <p className="truncate text-[12.5px] text-ink/60">{bigSub}</p>
        ) : (
          <span className="text-[12.5px] text-ink/60" data-prints-top="">
            <InfoTip label={`${d.name} · 7 pieces`} labelClassName="text-[12.5px] text-ink/60" ariaLabel="How prints work" align="start">
              {HOW}
            </InfoTip>
          </span>
        )}
      </div>
      {big ? null : <SaveAllButton d={d} qr={qr} />}
    </div>
  );

  const dock = big ? null : (
    <div className="flex gap-2 border-t border-ink/10 bg-cream/85 px-4 py-2.5 backdrop-blur-md" data-prints-dock="">
      <PickMenu
        label="Design"
        value={d.id}
        dataAttr="data-prints-design"
        className={DOCK_PICK}
        onPick={pickDesign}
        options={PRINT_DESIGNS.map((x) => ({
          key: x.id,
          label: x.name,
          hint: `suits ${x.suits}`,
          preview: <span aria-hidden className="block h-5 w-[30px] flex-none rounded ring-1 ring-black/10" style={{ background: groundCss(x) }} />,
        }))}
        trigger={<DockFace small="Design" value={d.name} />}
      />
      <PickMenu
        label="QR on your prints"
        value={qr}
        dataAttr="data-prints-qr-pick"
        className={DOCK_PICK}
        onPick={pickQr}
        options={PRINT_QR_ORDER.map((k) => ({ key: k, label: PRINT_QR[k].sub ? `${PRINT_QR[k].t} · ${PRINT_QR[k].sub}` : PRINT_QR[k].t, hint: `“${PRINT_QR[k].cap}”` }))}
        trigger={<DockFace small="QR on your prints" value={PRINT_QR[qr].t} />}
      />
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} labelledById={titleId} wide full head={head} foot={dock}>
      <Hidden.Provider value={hidden}>
      <div className="pb-8" data-prints-sheet={d.id} data-prints-qr={qr} data-prints-hide={hidden.join(',')}>
        {big?.kind === 'piece' ? (
          <BigPiece piece={big.piece} d={d} qr={qr} member={big.who === 'me' ? member : null} />
        ) : big?.kind === 'scene' ? (
          <BigScene scene={big.scene} d={d} qr={qr} />
        ) : (
          <>
            <SecHead label="Your facts" tip={FACTS_TIP} />
            <div data-prints-facts="">
              <FactRow k="Shop name" first>
                <span className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{facts?.name ?? '—'}</span>
              </FactRow>
              <FactRow k="Line">
                {facts?.line ? (
                  <span className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere]">{facts.line}</span>
                ) : (
                  <span className="text-ink/60">None yet</span>
                )}
              </FactRow>
              <FactRow k="Verified seal" small="If you have it">
                {/* No block switches the seal off (the 6 Nov block table has none): it prints when the shop is verified. */}
                <FactSwitch label="Verified seal" on={badgeRead.k === 'ok' && badgeRead.verified} disabled data="seal" />
              </FactRow>
              <FactRow k="Rating" small="If you have one">
                <FactSwitch label="Rating" on={!hidden.includes('stars')} onToggle={() => flip('stars', 'Rating')} data="stars" />
              </FactRow>
              <FactRow k="Badges" small="If you have them">
                <FactSwitch label="Badges" on={!hidden.includes('badges')} onToggle={() => flip('badges', 'Badges')} data="badges" />
              </FactRow>
              <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-2" data-prints-blocks="">
                <span className="text-ink/60">
                  <InfoTip label="On your prints" labelClassName="text-[14px] text-ink/60" ariaLabel="About On your prints" align="start">
                    {ON_YOUR_PRINTS}
                  </InfoTip>
                </span>
                <PickMenu
                  label="On your prints"
                  value={null}
                  picked={onKeys}
                  buttonText={`${formatCount(onKeys.length)} of ${formatCount(PRINT_BLOCKS.length)} blocks`}
                  dataAttr="data-prints-blocks-pick"
                  className="!min-h-9"
                  onPick={toggleBlock}
                  doneNote="Always on: your name · the QR."
                  options={PRINT_BLOCKS.map((b) => ({ key: b.key, label: b.label, hint: b.from === 'earned' ? 'earned, never set' : b.from }))}
                />
              </div>
            </div>

            <SecHead label="How it fits" tip={FITS_TIP} />
            <p className="px-4 pb-1.5 pt-1 text-[13px] text-ink/60">One fixed layout per piece. A design changes only the look — your shop changes the facts.</p>

            <SecHead
              label={`All 7 pieces · ${d.name}`}
              tip={`${d.name} — suits ${d.suits}. Tap any piece to see it big. Save gives a print-ready file with 3 mm bleed at this exact size.`}
              badge={`${PRINT_QR[qr].t} QR`}
            />
            <ul className="mt-1" data-prints-list="">
              {PRINT_PIECES.map((p) => (
                <li key={p.id} className="border-b border-ink/10 px-4 pb-4 pt-2" data-prints-piece={p.id}>
                  <PieceHead name={p.name} size={p.size} purpose={PRINT_PURPOSE[p.id]} action={<SaveButton piece={p} d={d} qr={qr} small />} />
                  <button type="button" onClick={() => setBig({ kind: 'piece', piece: p })} aria-label={`See ${p.name} big`} className="sn-press block w-full">
                    <PiecePicture piece={p} d={d} qr={qr} />
                  </button>
                </li>
              )).flatMap((li, i) =>
                // 🪪 YOUR OWN CARD — beside the shop's card, for the signed-in member only (owner 2026-11-06, "Yes")
                PRINT_PIECES[i]!.id === 'card' && member
                  ? [
                      li,
                      <li key="card-me" className="border-b border-ink/10 px-4 pb-4 pt-2" data-prints-piece="card-me">
                        <PieceHead name="Your own card" size={card.size} purpose={PERSONAL_CARD_PURPOSE} action={<SaveButton piece={card} d={d} qr={qr} small member={member} />} />
                        <button type="button" onClick={() => setBig({ kind: 'piece', piece: card, who: 'me' })} aria-label="See your own card big" className="sn-press block w-full">
                          <PiecePicture piece={card} d={d} qr={qr} member={member} />
                        </button>
                      </li>,
                    ]
                  : [li],
              )}
            </ul>
            <BadgesPiece open={open} factsUrl={badgeFactsUrl} />

            <SecHead
              label="See it in use"
              tip="Real event photos. Your chosen design and QR are placed onto the printed surfaces by the app — change the design or the QR and these update with it. The people and furniture in front stay in front."
            />
            <p className="px-4 pb-1.5 pt-1 text-[13px] text-ink/60">Your design and QR, placed on the prints in each photo. Swipe.</p>
            <div className="mt-1 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" data-prints-scenes="">
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
      </Hidden.Provider>
    </Sheet>
  );
}

/** The dock's pick: its name small over its value, the ▾ at the end (the prototype's `.thumb .pick`). */
const DOCK_PICK = 'sn-press flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-ink/15 bg-surface pl-4 pr-3 text-left';
function DockFace({ small, value }: { small: string; value: string }) {
  return (
    <>
      <span className="flex min-w-0 flex-col leading-[1.15]">
        <small className="truncate text-[11px] font-normal text-ink/60">{small}</small>
        <span className="truncate text-[14px] font-medium text-ink">{value}</span>
      </span>
      <ChevronDown aria-hidden className="h-3.5 w-3.5 flex-none text-ink/60" strokeWidth={2} />
    </>
  );
}

/** A section head: small capitals, an optional pill, the ⓘ at the row's end (the prototype's `.sec-l`). */
function SecHead({ label, tip, badge }: { label: string; tip: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-1 pt-4 text-[11px] uppercase tracking-[0.08em] text-ink/60" data-prints-sec={label.split(' ·')[0]!.toLowerCase()}>
      <span className="min-w-0 truncate">{label}</span>
      {badge ? <span className="flex-none rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-medium normal-case tracking-normal text-ink/60">{badge}</span> : null}
      <span className="ml-auto flex-none normal-case tracking-normal">
        <InfoTip label="" ariaLabel={`About ${label}`} align="end">
          {tip}
        </InfoTip>
      </span>
    </div>
  );
}

/** A YOUR FACTS row: its name (and a small line) left, the value or switch right (the prototype's `.kv`). */
function FactRow({ k, small, first = false, children }: { k: string; small?: string; first?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-[14px] ${first ? '' : 'border-t border-ink/10'}`} data-prints-fact={k}>
      <span className="min-w-0 text-ink/60">
        {k}
        {small ? <small className="block text-[11.5px]">{small}</small> : null}
      </span>
      {children}
    </div>
  );
}

function FactSwitch({ label, on, onToggle, disabled = false, data }: { label: string; on: boolean; onToggle?: () => void; disabled?: boolean; data: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onToggle} className={SWITCH_BUTTON} data-prints-switch={data}>
      <SwitchTrack on={on} />
    </button>
  );
}

/** SAVE ALL — every piece's print-ready file in one zip (the prototype's head button), drawn by the same route. */
function SaveAllButton({ d, qr }: { d: PrintDesign; qr: PrintQrMode }) {
  const base = useContext(ArtBase);
  const hide = useContext(Hidden);
  return (
    <SaveFileLink
      href={printAllHref({ design: d.id, qr, base, hide })}
      filename={printAllFilename(d)}
      className="sn-press inline-flex h-9 flex-none items-center justify-center rounded-full bg-sn-accent px-3.5 text-[14px] font-medium text-white"
      data-prints-save="all"
    >
      {(s) => (s === 'saving' ? 'Saving…' : 'Save all')}
    </SaveFileLink>
  );
}

/** A piece's head: name · size, its purpose as the one visible line, the rest (what it carries, type and QR sizes) in its ⓘ. */
function PieceHead({ name, size, purpose, action }: { name: string; size: string; purpose: PrintPurpose; action: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-tight text-ink">
          {name} <span className="font-normal text-ink/60">· {size}</span>
        </div>
        <InfoTip label={purpose.purpose} labelClassName="text-[12.5px] leading-snug text-ink/60" ariaLabel={`About ${name}`} align="start">
          <b className="font-medium">{purpose.what}</b>
          <span className="mt-1 block">Carries:</span>
          <ul className="mt-0.5 list-disc pl-4">
            {purpose.carries.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <span className="mt-1 block">{purpose.type}</span>
        </InfoTip>
      </div>
      {action}
    </div>
  );
}

function SaveButton({ piece, d, qr, small = false, member = null }: { piece: PrintPiece; d: PrintDesign; qr: PrintQrMode; small?: boolean; member?: PrintMember | null }) {
  const base = useContext(ArtBase);
  const hide = useContext(Hidden);
  return (
    <SaveFileLink
      href={printHref({ piece: piece.id, design: d.id, qr, save: true, base, hide, who: member ? 'me' : undefined })}
      filename={printFilename(piece, d, member?.name)}
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

function Art({ piece, side, d, qr, className = '', member = null }: { piece: PrintPiece; side: PrintSide; d: PrintDesign; qr: PrintQrMode; className?: string; member?: PrintMember | null }) {
  const base = useContext(ArtBase);
  const hide = useContext(Hidden);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an SVG drawn per request for the signed-in shop; nothing for next/image to optimise
    <img
      src={printHref({ piece: piece.id, side, design: d.id, qr, base, hide, who: member && side === 'f' ? 'me' : undefined })}
      alt={`${member ? `${member.name} · ` : ''}${piece.name}${piece.sides === 2 ? (side === 'f' ? ' · front' : ' · back') : ''} · ${d.name}`}
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
function PiecePicture({ piece, d, qr, member = null }: { piece: PrintPiece; d: PrintDesign; qr: PrintQrMode; member?: PrintMember | null }) {
  if (piece.sides === 2) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Art piece={piece} side="f" d={d} qr={qr} member={member} />
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

/** A piece big — its name and "size · look · seen …" are the sheet's head (the prototype's nested sheet title). */
function BigPiece({ piece, d, qr, member = null }: { piece: PrintPiece; d: PrintDesign; qr: PrintQrMode; member?: PrintMember | null }) {
  return (
    <div className="px-4 pt-3" data-prints-big={member ? 'card-me' : piece.id}>
      <div className="grid gap-3">
        {piece.sides === 2 ? (
          <>
            <p className="-mb-1.5 text-[12px] uppercase tracking-[0.06em] text-ink/60">Front</p>
            <Art piece={piece} side="f" d={d} qr={qr} member={member} />
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
        <SaveButton piece={piece} d={d} qr={qr} member={member} />
      </div>
      <p className="mt-2 text-[13px] text-ink/60">
        Print-ready, 3 mm bleed, exact size. Your QR: {PRINT_QR[qr].t} — “{PRINT_QR[qr].cap}”.
      </p>
    </div>
  );
}

function BigScene({ scene, d, qr }: { scene: PrintScene; d: PrintDesign; qr: PrintQrMode }) {
  const names = scene.surfaces.map((s) => PRINT_PIECES.find((p) => p.id === s.piece)?.name ?? '').join(' + ');
  return (
    <div className="px-4 pt-3" data-prints-big-scene={scene.slug}>
      <div>
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
function Scene({ scene, d, qr, height }: { scene: PrintScene; d: PrintDesign; qr: PrintQrMode; height?: number }) {
  const [W, H] = scene.size;
  const base = useContext(ArtBase);
  const hide = useContext(Hidden);
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
                  src={printHref({ piece: p.id, side: s.side, design: d.id, qr, base, hide })}
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

/**
 * 🏅 YOUR BADGES — the badge print, a piece in this list (owner 2026-11-06: "the door print and the badge print are
 * pieces INSIDE prints"). The file is the shipped one (`/api/vendor/badges` → `lib/shop-badge-print.ts`), drawn from
 * the facts READ when it is saved. Its facts are read once, when the sheet first opens. A refused read says so; a shop
 * with none yet is told they show by themselves — the words Analytics › Your badges already uses.
 */
type BadgeRead = { k: 'loading' } | { k: 'unread' } | { k: 'ok'; badges: ShopBadge[]; verified: boolean };

/**
 * The shop's badge facts, read ONCE per sheet visit and shared by the badges piece and YOUR FACTS' Verified seal — two
 * readers, one request (a failed read is forgotten, so the next opening asks again).
 */
const factReads = new Map<string, Promise<ShopBadgeFacts | null>>();
function readBadgeFacts(url: string): Promise<ShopBadgeFacts | null> {
  let p = factReads.get(url);
  if (!p) {
    p = fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<{ facts: ShopBadgeFacts }>) : null))
      .then((j) => j?.facts ?? null)
      .catch(() => null);
    factReads.set(url, p);
    void p.then((f) => {
      if (f === null) factReads.delete(url);
    });
  }
  return p;
}

function useBadgeFacts(open: boolean, factsUrl: string): BadgeRead {
  const [read, setRead] = useState<BadgeRead>({ k: 'loading' });
  const started = useRef(false);
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    void readBadgeFacts(factsUrl).then((f) => setRead(f ? { k: 'ok', badges: badgesForPrint(f), verified: f.verified } : { k: 'unread' }));
  }, [open, factsUrl]);
  return read;
}

function BadgesPiece({ open, factsUrl }: { open: boolean; factsUrl: string }) {
  const read = useBadgeFacts(open, factsUrl);

  const line =
    read.k === 'loading'
      ? 'Checking your badges…'
      : read.k === 'unread'
        ? 'Couldn’t load your badges just now.'
        : read.badges.length === 0
          ? 'None yet — they show here by themselves as you earn them.'
          : 'Every badge your shop wears today, ready to print.';
  return (
    <div className="border-b border-ink/10 px-4 pb-4 pt-2" data-prints-piece="badges" data-prints-badges={read.k === 'ok' ? read.badges.length : read.k}>
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium leading-tight text-ink">Your badges</div>
          <div className="text-[12.5px] leading-snug text-ink/60" role={read.k === 'unread' ? 'alert' : undefined}>
            {line}
          </div>
        </div>
        {read.k === 'ok' && read.badges.length > 0 ? (
          <SaveFileLink
            href={BADGE_PRINT_API}
            filename="setnayan-badges.svg"
            className="sn-press inline-flex h-[34px] flex-none items-center rounded-full border-[1.5px] border-ink/15 px-3 text-[13px] font-medium text-ink"
            data-prints-save="badges"
          >
            Save
          </SaveFileLink>
        ) : null}
      </div>
      {read.k === 'ok' && read.badges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {read.badges.map((b) => (
            <ShopBadgePill key={b.key} badge={b} size="sm" title={b.label} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
