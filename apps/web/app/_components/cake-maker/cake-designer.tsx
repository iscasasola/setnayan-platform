'use client';

/**
 * 🎂 DESIGN A CAKE — the couple's designer, opened FROM THE CHAT (DECISION_LOG 2026-11-21 "THE CAKE MAKER LIVES IN THE
 * CHAT, NOT ON SERVICE CARDS" · "CAKE MAKER v6 = THE BUILD REFERENCE"; prototypes/cake_maker_2026-11-21/
 * cake_maker_fable.html §02 "Design a cake, in the chat").
 *
 * The ways in (wired by the chat's ＋ tray — the Unichat builder):
 *   · the couple's ＋ › "Design a cake" tile, in a chat with a shop whose Cake Maker is on;
 *   · the supplier's invite card ("Design your cake for us" → Design your cake);
 *   · "Change my design" on the couple's own design card (starts from that design — Send posts a NEW version).
 *
 * Full screen on a phone (✕ goes back), the split view on a computer: the 3D cake on the left, the steps on the right.
 * Two starts: Design your own, or Use an inspiration (the shop's cake photos first, then the couple's own).
 *
 * 💰 The total is `cakeDesignOf` — the SAME function the server prices the stored design with: the cake card's one
 * price plus each extra the shop typed. No card with a price → no total; the shop quotes it. Booking goes through the
 * shop's quote (the old book-at-the-estimate button is gone, v6).
 *
 * Send → `cakeAction({ op: 'send' })` re-reads the shop's options, re-checks every pick and posts ONE card in this chat.
 * A design that did not go across says so and offers Send again — it is never shown as sent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock, ImageIcon, Lock, MessageCircle, Pencil, RotateCcw, RotateCw, Send, X } from 'lucide-react';
import { CAKE_DEMO_BAR_WORDS, cakeDemoOptions } from '@/lib/cake-demo';
import { SPECIAL_TOOLS_UPGRADE_HREF } from '@/lib/special-tools';
import { ActionButton } from '@/components/action-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { formatCentavosPhp } from '@/lib/vendor-packages';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  CAKE_ACCENTS,
  CAKE_ARRANGEMENTS,
  CAKE_FINISHES,
  CAKE_FLOWING,
  CAKE_INSTRUCTIONS_MAX,
  CAKE_MONOGRAM_SPOTS,
  CAKE_SHAPES,
  CAKE_TOPPERS,
  CUPCAKE_PLACEMENTS,
  cakeFigureSpec,
  resizeCakeTiers,
  startingCakeConfig,
  type CakeConfig,
  type CakeTierConfig,
} from '@/lib/cake-config';
import { cakeDesignOf, cakeOfferOf, cupcakeCountOf, extraWords, flavourLabelOf, packRef, servesWords, tierName, type CakePriced, type CakeShopOptions } from '@/lib/cake-maker';
import { CakeView } from '@/app/_components/plan3d/kit/cake-view';
import { cakeAction } from './cake-call';
import type { CakeOpenRead, CakePhoto } from './cake-actions';
import css from './cake-designer.module.css';

type Step = 'shape' | 'tiers' | 'colours' | 'accents' | 'monogram' | 'cupcakes' | 'message';
const STEP_NAME: Record<Step, string> = { shape: 'Shape', tiers: 'Tiers', colours: 'Colours', accents: 'Accents', monogram: 'Monogram', cupcakes: 'Cupcakes', message: 'Message' };

export type CakeDesignerStart = { config: CakeConfig; cardId: string | null };

/** The demo's read — sample options, no card (so no price), no photos, nothing from any event. */
function demoRead(): CakeOpenRead {
  return { ok: true, op: 'open', shopName: 'Your shop', options: cakeDemoOptions(), cards: [], mood: [], monogramText: 'A&M', guests: null, photos: [] };
}

type Send = { s: 'idle' } | { s: 'sending' } | { s: 'sent' } | { s: 'failed'; message: string };

export function CakeDesigner({
  threadId,
  onClose,
  onSent,
  start = null,
  seed,
  demo = false,
}: {
  threadId: string;
  onClose: () => void;
  /** After a design is posted — the chat refreshes its messages. */
  onSent?: () => void;
  /** "Change my design": start from that design (Send posts a new version). */
  start?: CakeDesignerStart | null;
  /** Labs only — the shop's read without a call. */
  seed?: CakeOpenRead | 'failed';
  /**
   * 🔒 A shop below Pro after the start date plays the couple's designer on SAMPLE options (`lib/cake-demo.ts`): no
   * read, no save, no send — the bar says which plans have it, with Upgrade (owner ruling "A LOCKED SPECIAL TOOL SHOWS
   * ITS FRONT-END EXPERIENCE, NOT ITS SETTINGS").
   */
  demo?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: ref });
  const [read, setRead] = useState<{ s: 'loading' } | { s: 'failed'; message: string } | { s: 'ok'; data: CakeOpenRead }>(
    demo ? { s: 'ok', data: demoRead() } : seed === 'failed' ? { s: 'failed', message: 'Couldn’t open the Cake Maker.' } : seed ? { s: 'ok', data: seed } : { s: 'loading' },
  );
  const load = useCallback(() => {
    setRead({ s: 'loading' });
    cakeAction({ op: 'open', threadId })
      .then((r) => setRead(r.ok && r.op === 'open' ? { s: 'ok', data: r } : { s: 'failed', message: r.ok ? 'Couldn’t open the Cake Maker.' : r.message }))
      .catch(() => setRead({ s: 'failed', message: 'Couldn’t open the Cake Maker.' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed && !demo) load();
  }, [load, seed, demo]);

  return (
    <div className={css.over} data-cake-designer="" data-cake-demo={demo ? '' : undefined}>
      <div ref={ref} className={css.root} role="dialog" aria-modal="true" aria-labelledby="cake-designer-h" tabIndex={-1}>
        {read.s === 'ok' ? (
          <Designer data={read.data} threadId={threadId} start={start} onClose={onClose} onSent={onSent} demo={demo} />
        ) : (
          <>
            <Head shop={read.s === 'failed' ? null : 'Opening…'} onClose={onClose} />
            {read.s === 'loading' ? (
              <div className={css.body} aria-busy="true">
                <div className={`skeleton ${css.ghost}`} />
              </div>
            ) : (
              <div className={css.body} role="alert" data-cake-designer-failed="">
                <p className={css.failT}>
                  <AlertCircle aria-hidden className="h-4 w-4" /> {read.message}
                </p>
                <p className={css.note}>Nothing was sent.</p>
                <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={load} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Head({ shop, sub, onClose, onReset }: { shop: string | null; sub?: string; onClose: () => void; onReset?: () => void }) {
  // v6 pinned row: ✕ on a phone (full screen) · a back arrow on a computer (the right column, the chat on the left) ·
  // the title · "Start over" (back to the shop's standard cake).
  return (
    <header className={css.head}>
      <button type="button" className={`${css.iconBtn} ${css.phoneOnly}`} aria-label="Close" onClick={onClose}>
        <X aria-hidden className="h-5 w-5" />
      </button>
      <button type="button" className={`${css.iconBtn} ${css.wideOnly}`} aria-label="Back to the chat" onClick={onClose}>
        <ArrowLeft aria-hidden className="h-5 w-5" />
      </button>
      <span className={css.headT}>
        <h2 id="cake-designer-h">Design a cake</h2>
        {sub ? <small>{sub}</small> : shop ? <small>{shop} · from your chat</small> : null}
      </span>
      {onReset ? (
        <button type="button" className={css.reset} onClick={onReset} data-cake-reset="">
          <RotateCcw aria-hidden className="h-4 w-4" />
          Start over
        </button>
      ) : null}
    </header>
  );
}

function Designer({ data, threadId, start, onClose, onSent, demo = false }: { data: CakeOpenRead; threadId: string; start: CakeDesignerStart | null; onClose: () => void; onSent?: () => void; demo?: boolean }) {
  const o = data.options;
  const offer = useMemo(() => cakeOfferOf(o), [o]);
  const fresh = useCallback(
    () => startingCakeConfig(offer, o.standardSize, { flavourRef: o.standardFlavour, accent: o.standardAccent, finish: o.standardFinish }),
    [offer, o],
  );
  const [phase, setPhase] = useState<'start' | 'design'>(start || demo ? 'design' : 'start');
  const [config, setConfig] = useState<CakeConfig>(() => start?.config ?? fresh());
  // The one price: the shop's priced cake card (the first one, if it has several) — no picker (v6 draws none).
  const cardId = start?.cardId ?? (data.cards.find((c) => c.oneCentavos != null) ?? data.cards[0])?.id ?? null;
  const [step, setStep] = useState<Step>('shape');
  const [tier, setTier] = useState<number>(() => (start?.config ?? fresh()).tiers.length - 1);
  const [capHit, setCapHit] = useState(false);
  const [send, setSend] = useState<Send>({ s: 'idle' });
  const patch = (over: Partial<CakeConfig>) => {
    setConfig((c) => ({ ...c, ...over }));
    if (send.s !== 'sending') setSend({ s: 'idle' });
  };
  const setTierAt = (i: number, over: Partial<CakeTierConfig>) => patch({ tiers: config.tiers.map((t, k) => (k === i ? { ...t, ...over } : t)) });

  const card = data.cards.find((c) => c.id === cardId) ?? null;
  const design = useMemo(() => cakeDesignOf(o, config, card && card.oneCentavos != null ? { name: card.name, oneCentavos: card.oneCentavos } : null), [o, config, card]);
  const spec = useMemo(() => cakeFigureSpec(config, (r) => flavourLabelOf(o, r), cupcakeCountOf(config)), [config, o]);
  const photo = data.photos.find((p) => p.assetId === config.inspirationRef) ?? null;
  const n = config.tiers.length;
  const steps: Step[] = ['shape', 'tiers', 'colours', 'accents', ...(o.monogram || o.toppers.length ? (['monogram'] as const) : []), ...(o.cupcakes ? (['cupcakes'] as const) : []), 'message'];

  if (phase === 'start') {
    return (
      <StartScreen
        shop={data.shopName}
        photos={data.photos}
        plainTiers={o.standardSize}
        onClose={onClose}
        onStart={(inspirationRef) => {
          setConfig({ ...fresh(), inspirationRef });
          setPhase('design');
        }}
      />
    );
  }

  const overCap = config.colours.length > o.colourPick;
  const doSend = async () => {
    if (demo || overCap || send.s === 'sending') return; // the demo never sends
    setSend({ s: 'sending' });
    try {
      const r = await cakeAction({ op: 'send', threadId, config, cardId });
      if (r.ok) {
        setSend({ s: 'sent' });
        onSent?.();
      } else setSend({ s: 'failed', message: r.message });
    } catch {
      setSend({ s: 'failed', message: 'Your design didn’t go across. It is kept here — send it again.' });
    }
  };

  return (
    <>
      <Head
        shop={data.shopName}
        sub={demo ? 'A demo · what couples see in your chat' : undefined}
        onClose={onClose}
        onReset={() => {
          const c = { ...fresh(), inspirationRef: config.inspirationRef };
          setConfig(c);
          setTier(c.tiers.length - 1);
          setStep('shape');
          setSend({ s: 'idle' });
        }}
      />
      <div className={css.split}>
        <div className={css.stageCol}>
          {photo ? (
            <div className={css.insp} data-cake-inspiration="">
              {/* eslint-disable-next-line @next/next/no-img-element -- a signed library thumbnail, not a page image */}
              <img src={photo.url} alt="" width={56} height={56} loading="lazy" />
              <span>
                <b>Your inspiration</b>
                <small>{photo.from === 'shop' ? `From ${data.shopName}` : 'From your Mood Board'} · it goes with your design</small>
              </span>
            </div>
          ) : null}
          <div className={css.stage}>
            <CakeView fill
              spec={spec}
              monogramText={data.monogramText}
              title={`Your cake — ${design.sizeWords}`}
              onTierTap={(i) => {
                setTier(i);
                if (step !== 'accents') setStep('tiers');
              }}
            />
          </div>
          <p className={css.cap}>Drag to turn · tap a tier</p>
        </div>

        <div className={css.panel}>
          <nav className={css.steps} aria-label="Steps">
            {steps.map((s) => (
              <button key={s} type="button" aria-pressed={s === step} className={css.stepBtn} onClick={() => setStep(s)}>
                {STEP_NAME[s]}
              </button>
            ))}
          </nav>

          <div className={css.body}>
            {step === 'shape' ? (
              <>
                <Sec title="How the tiers sit">
                  <Pills list={o.arrangements} catalog={CAKE_ARRANGEMENTS} value={config.arrangement} onPick={(arrangement) => patch({ arrangement })} />
                </Sec>
                <Sec title="Finish">
                  <Pills list={o.finishes} catalog={CAKE_FINISHES} value={config.finish} onPick={(finish) => patch({ finish })} />
                </Sec>
              </>
            ) : null}

            {step === 'tiers' ? (
              <>
                <Sec title="How many tiers">
                  <div className={css.pills} role="radiogroup" aria-label="How many tiers">
                    {o.sizes.map((s) => (
                      <button key={s.count} type="button" role="radio" aria-checked={s.count === n} className={css.pill} onClick={() => {
                        const next = resizeCakeTiers(config, s.count);
                        patch(next);
                        setTier(Math.min(tier, next.tiers.length - 1));
                      }}>
                        <b>{formatCount(s.count)}</b>
                        <small>{extraWords(s.extraCentavos)}</small>
                      </button>
                    ))}
                  </div>
                  {servesWords(o, n, data.guests) ? <p className={css.note}>{servesWords(o, n, data.guests)}</p> : null}
                </Sec>
                <Sec title="Each tier" hint="tap a tier for its flavour, shape and height">
                  <div className={css.pills} role="radiogroup" aria-label="Which tier">
                    {config.tiers.map((_, i) => (
                      <button key={i} type="button" role="radio" aria-checked={i === tier} className={css.chipBtn} onClick={() => setTier(i)}>
                        {tierName(i, n)}
                      </button>
                    ))}
                  </div>
                  <TierEditor o={o} config={config} i={Math.min(tier, n - 1)} setTierAt={setTierAt} shop={data.shopName} />
                </Sec>
                <Sec title="Cut">
                  <PickMenu
                    label="The tier you cut"
                    value={String(config.cuttingTier)}
                    options={config.tiers.map((_, i) => ({ key: String(i), label: tierName(i, n) }))}
                    onPick={(k) => {
                      const i = Number(k);
                      patch({ cuttingTier: i, tiers: config.tiers.map((t, j) => (j === i ? { ...t, kind: 'real' } : t)) });
                    }}
                  />
                  <p className={css.note}>The tier you cut is always real. A display tier is decorated to look the same and isn’t eaten.</p>
                </Sec>
              </>
            ) : null}

            {step === 'colours' ? (
              <Sec title="Colours" hint={`Choose up to ${o.colourPick}`}>
                <Colours
                  data={data}
                  picked={config.colours}
                  cap={o.colourPick}
                  onToggle={(c) => {
                    const on = config.colours.some((x) => x.hex.toLowerCase() === c.hex.toLowerCase());
                    if (on) {
                      setCapHit(false);
                      return patch({ colours: config.colours.filter((x) => x.hex.toLowerCase() !== c.hex.toLowerCase()) });
                    }
                    if (config.colours.length >= o.colourPick) return setCapHit(true);
                    patch({ colours: [...config.colours, c] });
                  }}
                />
                <p className={css.note}>
                  {formatCount(config.colours.length)} of {formatCount(o.colourPick)} picked · they show on the accents
                </p>
                {capHit || overCap ? (
                  <p className={css.warn} role="status">
                    <AlertCircle aria-hidden className="h-3.5 w-3.5" /> Pick up to {o.colourPick} — untick one to send your design.
                  </p>
                ) : null}
              </Sec>
            ) : null}

            {step === 'accents' ? (
              <>
                <Sec title="Accent on each tier" hint="pick a tier, or tap it on the cake">
                  <div className={css.pills} role="radiogroup" aria-label="Which tier">
                    {config.tiers.map((_, i) => (
                      <button key={i} type="button" role="radio" aria-checked={i === tier} className={css.chipBtn} onClick={() => setTier(i)}>
                        {tierName(i, n)}
                      </button>
                    ))}
                  </div>
                  <Pills list={o.accents} catalog={CAKE_ACCENTS} value={config.tiers[Math.min(tier, n - 1)]!.accent} onPick={(accent) => setTierAt(Math.min(tier, n - 1), { accent })} />
                </Sec>
                {o.flowing.length ? (
                  <Sec title="Across the tiers" hint="one accent that flows down">
                    <Pills
                      list={[{ id: 'none', extraCentavos: 0 }, ...o.flowing]}
                      catalog={CAKE_FLOWING}
                      value={config.flowing}
                      onPick={(flowing) => patch({ flowing })}
                    />
                    {config.flowing !== 'none' && n > 1 ? (
                      <div className={css.fromTo}>
                        <PickMenu
                          label="From"
                          value={String(config.flowingFrom)}
                          options={config.tiers.slice(0, n - 1).map((_, i) => ({ key: String(i), label: i === 0 ? 'Top' : tierName(i, n) }))}
                          onPick={(k) => patch({ flowingFrom: Number(k), flowingTo: Math.max(Number(k) + 1, config.flowingTo) })}
                        />
                        <PickMenu
                          label="To"
                          value={String(config.flowingTo)}
                          options={config.tiers.map((_, i) => ({ key: String(i), label: i === n - 1 ? 'Bottom' : tierName(i, n) })).slice(config.flowingFrom + 1)}
                          onPick={(k) => patch({ flowingTo: Number(k) })}
                        />
                      </div>
                    ) : null}
                  </Sec>
                ) : null}
              </>
            ) : null}

            {step === 'monogram' ? (
              <>
                {o.monogram ? (
                  <Sec title="Your monogram" hint="from your event — the same mark on your invitations and page">
                    {data.monogramText ? <p className={css.mono}>{data.monogramText}</p> : <p className={css.note}>Your event has no monogram yet — make one on your event’s page.</p>}
                    <div className={css.pills} role="radiogroup" aria-label="Where it goes">
                      <PillBtn on={config.monogram === null} label="Not on the cake" small="in the price" onClick={() => patch({ monogram: null })} />
                      {CAKE_MONOGRAM_SPOTS.map((m) => (
                        <PillBtn key={m.id} on={config.monogram === m.id} label={m.label} small={extraWords(o.monogram!.extraCentavos)} disabled={!data.monogramText} onClick={() => patch({ monogram: m.id })} />
                      ))}
                    </div>
                    {config.monogram === 'front' ? (
                      <PickMenu label="On" value={String(config.monogramTier)} options={config.tiers.map((_, i) => ({ key: String(i), label: tierName(i, n) }))} onPick={(k) => patch({ monogramTier: Number(k) })} />
                    ) : null}
                  </Sec>
                ) : null}
                {o.toppers.length ? (
                  <Sec title="Topper">
                    {config.monogram === 'topper' ? (
                      <p className={css.note}>Your monogram is the topper.</p>
                    ) : (
                      <Pills list={[{ id: 'none', extraCentavos: 0 }, ...o.toppers]} catalog={CAKE_TOPPERS} value={config.topper} onPick={(topper) => patch({ topper })} />
                    )}
                  </Sec>
                ) : null}
              </>
            ) : null}

            {step === 'cupcakes' && o.cupcakes ? (
              <Cupcakes o={o} config={config} patch={patch} shop={data.shopName} />
            ) : null}

            {step === 'message' ? (
              <>
                {o.messageMax > 0 ? (
                  <Sec title="Message on the cake" hint="Optional">
                    <label className={css.box}>
                      <input // field-ok: the cake's piped message — a short line beside its letter count, as drawn
                        value={config.message}
                        maxLength={o.messageMax}
                        placeholder="e.g. Ana & Migs · 12.19"
                        aria-label="Message on the cake"
                        onChange={(e) => patch({ message: e.target.value.slice(0, o.messageMax) })}
                      />
                      <small>{formatCount(o.messageMax - config.message.length)} letters</small>
                    </label>
                    <p className={css.note}>Piped on a board in front of the cake.</p>
                  </Sec>
                ) : null}
                <Sec title="Anything else the baker should know?" hint="Optional">
                  <label className={css.area}>
                    <textarea // field-ok: the design's own notes, sent with it — a long-text box, not a form field
                      value={config.instructions}
                      maxLength={CAKE_INSTRUCTIONS_MAX}
                      rows={4}
                      aria-label="Anything else the baker should know?"
                      onChange={(e) => patch({ instructions: e.target.value.slice(0, CAKE_INSTRUCTIONS_MAX) })}
                    />
                    <small>Sent with your design · {formatCount(CAKE_INSTRUCTIONS_MAX - config.instructions.length)} letters</small>
                  </label>
                </Sec>
              </>
            ) : null}

            {card?.usualPrepDays ? (
              <p className={css.prep}>
                <Clock aria-hidden className="h-4 w-4 flex-none" />
                {data.shopName} usually needs {card.usualPrepDays} {card.usualPrepDays === 1 ? 'day' : 'days'}. They confirm the time for your design when they quote.
              </p>
            ) : null}
          </div>

          <footer className={css.bar}>
            {demo ? (
              <div className={css.demoBar} role="note" data-cake-demo-bar="">
                <Lock aria-hidden className="h-4 w-4 flex-none" />
                <span>{CAKE_DEMO_BAR_WORDS}</span>
                <ActionButton tone="brand" icon={ArrowUpRight} label="Upgrade" href={SPECIAL_TOOLS_UPGRADE_HREF} data-web-only="" data-cake-demo-upgrade="" />
              </div>
            ) : send.s === 'sent' ? (
              <div className={css.sent} role="status" data-cake-sent="">
                <Check aria-hidden className="h-4 w-4 flex-none" />
                <span>Sent to {data.shopName} — your design is in the message.</span>
                <ActionButton tone="neutral" icon={MessageCircle} label="View the conversation" onClick={onClose} />
              </div>
            ) : (
              <>
                <div className={css.tot}>
                  <small>Total</small>
                  <b data-cake-total="">{design.estimateCentavos != null ? formatCentavosPhp(design.estimateCentavos) : `+${formatCentavosPhp(design.extrasCentavos)} in extras`}</b>
                  <small>{design.estimateCentavos != null ? `An estimate until ${data.shopName} quotes` : `${data.shopName} quotes the price`}</small>
                </div>
                <ActionButton tone="brand" main icon={Send} label={send.s === 'sending' ? 'Sending…' : send.s === 'failed' ? 'Send again' : `Send to ${data.shopName}`} onClick={doSend} disabled={overCap || send.s === 'sending'} data-cake-send="" />
              </>
            )}
            {send.s === 'failed' ? (
              <p className={css.warn} role="alert" data-cake-not-sent="">
                <AlertCircle aria-hidden className="h-3.5 w-3.5" /> Not delivered: {send.message}
              </p>
            ) : null}
          </footer>
        </div>
      </div>
    </>
  );
}

/* ── the two starts ────────────────────────────────────────────────────── */

function StartScreen({ shop, photos, plainTiers, onClose, onStart }: { shop: string; photos: CakePhoto[]; plainTiers: number; onClose: () => void; onStart: (inspirationRef: string | null) => void }) {
  const [way, setWay] = useState<'own' | 'photo' | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const shopPhotos = photos.filter((p) => p.from === 'shop');
  const yours = photos.filter((p) => p.from === 'yours');
  return (
    <>
      <Head shop={shop} onClose={onClose} />
      <div className={css.body} data-cake-start="">
        <h3 className={css.lab}>How do you want to start?</h3>
        <div className={css.ways} role="radiogroup" aria-label="How do you want to start?">
          <button type="button" role="radio" aria-checked={way === 'own'} className={css.way} onClick={() => setWay('own')}>
            <Pencil aria-hidden className="h-5 w-5" />
            <b>Design your own</b>
            <small>Start from a plain {formatCount(plainTiers)}-tier cake and choose every part.</small>
          </button>
          <button type="button" role="radio" aria-checked={way === 'photo'} className={css.way} onClick={() => setWay('photo')} disabled={photos.length === 0}>
            <ImageIcon aria-hidden className="h-5 w-5" />
            <b>Use an inspiration</b>
            <small>{photos.length ? 'Pick a cake photo you love. It stays at the top of your design while you choose the details.' : 'No cake photos yet — from the shop or your Mood Board.'}</small>
          </button>
        </div>
        {way === 'photo' ? (
          <>
            {shopPhotos.length ? <PhotoGrid title={`From ${shop}`} sub="their cake photos" photos={shopPhotos} pick={pick} onPick={setPick} /> : null}
            {yours.length ? <PhotoGrid title="From your Mood Board" sub="cake photos you saved" photos={yours} pick={pick} onPick={setPick} /> : null}
          </>
        ) : null}
      </div>
      <footer className={css.bar}>
        <ActionButton
          tone="brand"
          main
          icon={ArrowRight}
          label={way === 'photo' ? (pick ? 'Continue with this photo' : 'Pick a photo to continue') : way === 'own' ? 'Start designing' : 'Pick a way to start'}
          disabled={!way || (way === 'photo' && !pick)}
          onClick={() => onStart(way === 'photo' ? pick : null)}
          className="w-full"
          data-cake-begin=""
        />
      </footer>
    </>
  );
}

function PhotoGrid({ title, sub, photos, pick, onPick }: { title: string; sub: string; photos: CakePhoto[]; pick: string | null; onPick: (id: string) => void }) {
  return (
    <section className={css.sec}>
      <h3 className={css.lab}>
        {title} <span className={css.hint}>{sub}</span>
      </h3>
      <div className={css.photos} role="radiogroup" aria-label={title}>
        {photos.map((p) => (
          <button key={p.assetId} type="button" role="radio" aria-checked={pick === p.assetId} className={css.photo} onClick={() => onPick(p.assetId)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed library thumbnail */}
            <img src={p.url} alt={p.label ?? ''} loading="lazy" />
            {p.label ? <small>{p.label}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── one tier: real or display, flavour, shape, height ─────────────────── */

function TierEditor({ o, config, i, setTierAt, shop }: { o: CakeShopOptions; config: CakeConfig; i: number; setTierAt: (i: number, over: Partial<CakeTierConfig>) => void; shop: string }) {
  const t = config.tiers[i]!;
  const cut = i === config.cuttingTier;
  return (
    <div className={css.tier} data-cake-tier={i}>
      {o.display ? (
        <div className={css.pills} role="radiogroup" aria-label="Real or display">
          <PillBtn on={t.kind === 'real'} label="Real" small={cut ? 'cutting' : 'in the price'} onClick={() => setTierAt(i, { kind: 'real' })} />
          <PillBtn on={t.kind === 'display'} label="Display" small={extraWords(o.display.extraCentavos)} disabled={cut} onClick={() => setTierAt(i, { kind: 'display', flavourRef: null })} />
        </div>
      ) : null}
      {t.kind === 'real' && o.flavours.length ? (
        <PickMenu
          label="Flavour"
          value={t.flavourRef ?? ''}
          options={o.flavours.map((f) => ({ key: f.ref, label: f.extraCentavos > 0 ? `${f.label} · +${formatCentavosPhp(f.extraCentavos)} this tier` : f.label }))}
          onPick={(flavourRef) => setTierAt(i, { flavourRef })}
        />
      ) : t.kind === 'display' ? (
        <p className={css.note}>Decorated to match, not eaten · no flavour needed</p>
      ) : null}
      {o.shapes.length > 1 ? (
        <>
          <p className={css.sub}>Shape · the ones {shop} makes</p>
          <Pills list={o.shapes} catalog={CAKE_SHAPES} value={t.shape} onPick={(shape) => setTierAt(i, { shape })} />
        </>
      ) : null}
      {o.tall ? (
        <>
          <p className={css.sub}>Height</p>
          <div className={css.pills} role="radiogroup" aria-label="Height">
            <PillBtn on={!t.tall} label="Standard" small="in the price" onClick={() => setTierAt(i, { tall: false })} />
            <PillBtn on={t.tall} label="Tall" small={`double barrel · ${extraWords(o.tall.extraCentavos)}`} onClick={() => setTierAt(i, { tall: true })} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── colours: their Mood Board first, then the shop's ──────────────────── */

function Colours({ data, picked, cap, onToggle }: { data: CakeOpenRead; picked: { hex: string; name: string }[]; cap: number; onToggle: (c: { hex: string; name: string }) => void }) {
  const isOn = (hex: string) => picked.some((p) => p.hex.toLowerCase() === hex.toLowerCase());
  const shopOnly = data.options.colours.filter((c) => !data.mood.some((m) => m.hex.toLowerCase() === c.hex.toLowerCase()));
  return (
    <div className={css.swl} data-cake-colours={cap}>
      {data.mood.length ? <p className={css.sub}>From your Mood Board</p> : null}
      {data.mood.map((m) => (
        <button key={`${m.slot}-${m.hex}`} type="button" role="checkbox" aria-checked={isOn(m.hex)} className={css.sw} onClick={() => onToggle({ hex: m.hex, name: m.name })}>
          <i style={{ background: m.hex }} />
          <b>{m.name}</b>
          <small>{m.setByYou ? `${m.slot} · set by you` : m.slot}</small>
        </button>
      ))}
      {shopOnly.length ? <p className={css.sub}>More from {data.shopName}</p> : null}
      {shopOnly.map((c) => (
        <button key={c.hex} type="button" role="checkbox" aria-checked={isOn(c.hex)} className={css.sw} onClick={() => onToggle({ hex: c.hex, name: c.name })}>
          <i style={{ background: c.hex }} />
          <b>{c.name}</b>
        </button>
      ))}
      {!data.mood.length && !shopOnly.length ? <p className={css.note}>No colours to pick yet — tell {data.shopName} your colours in the notes.</p> : null}
    </div>
  );
}

/* ── cupcakes ──────────────────────────────────────────────────────────── */

function Cupcakes({ o, config, patch, shop }: { o: CakeShopOptions; config: CakeConfig; patch: (p: Partial<CakeConfig>) => void; shop: string }) {
  const cc = o.cupcakes!;
  const cur = config.cupcakes;
  const first = cc.packs[0]!;
  return (
    <>
      <Sec title="Would you like cupcakes with it?">
        <div className={css.pills} role="radiogroup" aria-label="Would you like cupcakes with it?">
          <PillBtn on={!!cur} label="Yes" small={`from ${extraWords(first.priceCentavos)}`} onClick={() => patch({ cupcakes: cur ?? { packRef: packRef(first.count), flavourRef: null, match: true, placement: 'base' } })} />
          <PillBtn on={!cur} label="No thanks" onClick={() => patch({ cupcakes: null })} />
        </div>
      </Sec>
      {cur ? (
        <>
          <Sec title="How many" hint={`${shop}’s packs`}>
            <div className={css.pills} role="radiogroup" aria-label="How many">
              {cc.packs.map((p) => (
                <PillBtn key={p.count} on={cur.packRef === packRef(p.count)} label={formatCount(p.count)} small={extraWords(p.priceCentavos)} onClick={() => patch({ cupcakes: { ...cur, packRef: packRef(p.count) } })} />
              ))}
            </div>
          </Sec>
          <Sec title="Flavour">
            <div className={css.pills} role="radiogroup" aria-label="Cupcake flavour">
              <PillBtn on={cur.match} label="Match my cake" small="the same colours and a small tier accent" onClick={() => patch({ cupcakes: { ...cur, match: true, flavourRef: null } })} />
              {o.flavours.map((f) => (
                <PillBtn key={f.ref} on={!cur.match && cur.flavourRef === f.ref} label={f.label} onClick={() => patch({ cupcakes: { ...cur, match: false, flavourRef: f.ref } })} />
              ))}
            </div>
          </Sec>
          <Sec title="Where">
            <div className={css.pills} role="radiogroup" aria-label="Where">
              {CUPCAKE_PLACEMENTS.filter((p) => p.id === 'base' || cc.tower).map((p) => (
                <PillBtn key={p.id} on={cur.placement === p.id} label={p.label} onClick={() => patch({ cupcakes: { ...cur, placement: p.id } })} />
              ))}
            </div>
          </Sec>
        </>
      ) : null}
    </>
  );
}

/* ── small parts ───────────────────────────────────────────────────────── */

function Sec({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={css.sec}>
      <h3 className={css.lab}>
        {title} {hint ? <span className={css.hint}>{hint}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Pills<T extends string>({ list, catalog, value, onPick }: { list: readonly CakePriced<T>[]; catalog: readonly { id: string; label: string }[]; value: T; onPick: (id: T) => void }) {
  return (
    <div className={css.pills} role="radiogroup">
      {list.map((x) => (
        <PillBtn key={x.id} on={x.id === value} label={catalog.find((c) => c.id === x.id)?.label ?? x.id} small={extraWords(x.extraCentavos)} onClick={() => onPick(x.id)} />
      ))}
    </div>
  );
}

function PillBtn({ on, label, small, disabled, onClick }: { on: boolean; label: string; small?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={css.pill} disabled={disabled} onClick={onClick}>
      <b>{label}</b>
      {small ? <small>{small}</small> : null}
    </button>
  );
}

