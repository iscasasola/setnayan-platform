'use client';

/**
 * 🎂 SHOP › SPECIALIZED TOOLS › CAKE MAKER — the shop's cake options, SET ONCE PER SHOP (DECISION_LOG 2026-11-21
 * "THE CAKE MAKER LIVES IN THE CHAT, NOT ON SERVICE CARDS" · "CAKE MAKER v6 = THE BUILD REFERENCE";
 * prototypes/cake_maker_2026-11-21/cake_maker_fable.html § "Cake Maker · set once").
 *
 * What couples pick when they design a cake in this shop's chat. Every control reads ONE catalog (lib/cake-config.ts):
 * the shop ticks what it makes and types its own extra for each — nothing is guessed, every extra starts at ₱0. The
 * one price stays on the shop's cake card; this page only adds extras to it.
 *
 * Saved as ONE row per shop (`vendor_cake_makers`) through `cakeAction({ op: 'save' })`, which runs the same
 * `sanitizeCakeShopOptions` the couple's design is checked against — a refusal is the sentence shown here.
 *
 * 🔒 SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP (or open to every shop before the admin's start date). Locked,
 * the page shows "Included in Pro · Upgrade" and saves nothing — any saved options stay as they are.
 *
 * Lazy-loaded from the tile (shop-makers.tsx), so none of it is in the Shop's first load.
 */
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Info, Lock, Minus, Plus, RotateCw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { hexForColorName } from '@/lib/color-names';
import { formatCount } from '@/lib/format-number';
import { groupThousands, parseAmountInput } from '@/lib/service-customization-draft';
import {
  CAKE_ACCENTS,
  CAKE_ARRANGEMENTS,
  CAKE_FINISHES,
  CAKE_FLOWING,
  CAKE_MAX_COLOURS,
  CAKE_MAX_TIERS,
  CAKE_MESSAGE_MAX,
  CAKE_SHAPES,
  CAKE_TOPPERS,
  cakeFigureSpec,
  startingCakeConfig,
  type CakeArrangement,
} from '@/lib/cake-config';
import {
  CAKE_FLAVOURS_MAX,
  CAKE_LABEL_MAX,
  CAKE_SERVES_MAX,
  CAKE_SHOP_COLOURS_MAX,
  CUPCAKE_PACKS_MAX,
  CUPCAKE_PACK_MAX_COUNT,
  cakeOfferOf,
  flavourRefAt,
  tierLabel,
  type CakePriced,
  type CakeShopOptions, CAKE_PICKER_START } from '@/lib/cake-maker';
import { SPECIAL_TOOLS_LOCKED_WORDS, SPECIAL_TOOLS_UPGRADE_HREF } from '@/lib/special-tools';
import { CakeFigure } from '@/app/_components/plan3d/kit/cake-figure';
import { cakeAction } from '@/app/_components/cake-maker/cake-call';
import styles from './cake-maker-panel.module.css';

type Load = { s: 'loading' } | { s: 'failed'; message: string } | { s: 'ok'; options: CakeShopOptions; saved: boolean; locked: boolean };

type PartKey = 'arrangements' | 'tiers' | 'flavours' | 'shapes' | 'finish' | 'colours' | 'accents' | 'flowing' | 'monogram' | 'topper' | 'cupcakes' | 'message';

export function CakeMakerPanel({ seed }: { seed?: { options: CakeShopOptions; saved: boolean; locked: boolean } } = {}) {
  const [load, setLoad] = useState<Load>(seed ? { s: 'ok', ...seed } : { s: 'loading' });
  const read = useCallback(() => {
    setLoad({ s: 'loading' });
    cakeAction({ op: 'options' })
      .then((r) => {
        if (r.ok && r.op === 'options') setLoad({ s: 'ok', options: r.options, saved: r.saved, locked: r.locked });
        else setLoad({ s: 'failed', message: r.ok ? 'Couldn’t load your Cake Maker.' : r.message });
      })
      .catch(() => setLoad({ s: 'failed', message: 'Couldn’t load your Cake Maker.' }));
  }, []);
  useEffect(() => {
    if (!seed) read();
  }, [read, seed]);

  if (load.s === 'loading') {
    return (
      <div className={styles.root} data-cake-maker="loading" aria-busy="true">
        <div className={`${styles.frame} skeleton`} style={{ height: 240 }} />
      </div>
    );
  }
  if (load.s === 'failed') {
    return (
      <div className={styles.root} data-cake-maker="failed">
        <div className={styles.frame} role="alert">
          <p className={styles.failTitle}>Couldn’t load your Cake Maker</p>
          <p className={styles.failLine}>{load.message} Nothing was changed.</p>
          <div className={styles.failAct}>
            <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={read} />
          </div>
        </div>
      </div>
    );
  }
  if (load.locked) return <LockedCakeMaker saved={load.saved} options={load.options} />;
  return <CakeMakerEditor start={load.options} saved={load.saved} />;
}

/** Below Pro after the start date (v6 "Included in Pro"): the drawing's words, Upgrade, and what was saved — read-only,
 *  kept just as it is. Nothing here writes. */
function LockedCakeMaker({ saved, options }: { saved: boolean; options: CakeShopOptions }) {
  return (
    <div className={styles.root} data-cake-maker="locked">
      <div className={`${styles.frame} ${styles.lockRow}`}>
        <Lock aria-hidden className="h-4 w-4 flex-none" />
        <span className={styles.st}>
          <b>{SPECIAL_TOOLS_LOCKED_WORDS}</b>
          <small>Couples design their cake in your chat — tiers, shapes, accents, the 3D cake, cupcakes. Your cards don’t change.</small>
        </span>
        <Link href={SPECIAL_TOOLS_UPGRADE_HREF} className={styles.pill} data-web-only="">
          Upgrade
        </Link>
      </div>
      {saved ? (
        <>
          <h3 className={styles.lab}>Your saved options · kept as they are</h3>
          <CakeSummary o={options} />
        </>
      ) : null}
    </div>
  );
}

/** "1 to 10 · 3 in the price" — the sizes line (the Tiers part and the summary). */
const sizesLineOf = (o: CakeShopOptions) => `${formatCount(o.sizes[0]?.count ?? 1)} to ${formatCount(o.sizes[o.sizes.length - 1]?.count ?? 1)} · ${formatCount(o.standardSize)} in the price`;
/** "Round · Square · Tall" — the shapes and heights line. */
const shapesLineOf = (o: CakeShopOptions) => [...o.shapes.map((s) => label(CAKE_SHAPES, s.id)), ...(o.tall ? ['Tall'] : [])].join(' · ');

/** "What couples see" — the one summary of a shop's options (the editor's foot; read-only on the locked panel). */
function CakeSummary({ o }: { o: CakeShopOptions }) {
  const std = o.sizes.find((s) => s.count === o.standardSize);
  const sizesLine = sizesLineOf(o);
  const shapesLine = shapesLineOf(o);
  return (
    <dl className={`${styles.frame} ${styles.sum}`} data-cake-summary="">
      <SumRow k="Shape" v={o.arrangements.map((a) => label(CAKE_ARRANGEMENTS, a.id)).join(' · ')} />
      <SumRow k="Tiers" v={`${sizesLine}${std?.serves ? ` · serves about ${formatCount(std.serves)}` : ''}`} />
      <SumRow k="Each tier" v={`${o.flavours.length ? 'a flavour, ' : ''}${shapesLine.toLowerCase()}`} />
      <SumRow k="Finish" v={o.finishes.map((f) => label(CAKE_FINISHES, f.id)).join(' · ')} />
      {o.display ? <SumRow k="Display tiers" v="The cut tier stays real" /> : null}
      {o.monogram ? <SumRow k="Monogram" v="From their event" /> : null}
      {o.cupcakes ? <SumRow k="Cupcakes" v={o.cupcakes.packs.map((p) => formatCount(p.count)).join(' · ')} /> : null}
    </dl>
  );
}

function CakeMakerEditor({ start, saved: savedAtStart }: { start: CakeShopOptions; saved: boolean }) {
  const [o, setO] = useState<CakeShopOptions>(start);
  const [base, setBase] = useState<string>(() => JSON.stringify(start));
  const [saved, setSaved] = useState(savedAtStart);
  const [open, setOpen] = useState<PartKey | null>('tiers');
  const [state, setState] = useState<{ s: 'idle' } | { s: 'saving' } | { s: 'saved' } | { s: 'refused'; message: string }>({ s: 'idle' });
  const patch = useCallback((over: Partial<CakeShopOptions>) => {
    setO((c) => ({ ...c, ...over }));
    setState({ s: 'idle' });
  }, []);
  const toggle = (k: PartKey) => setOpen(open === k ? null : k);
  const dirty = JSON.stringify(o) !== base || !saved;

  const save = async () => {
    setState({ s: 'saving' });
    try {
      const r = await cakeAction({ op: 'save', options: o });
      if (r.ok) {
        setBase(JSON.stringify(o));
        setSaved(true);
        setState({ s: 'saved' });
      } else setState({ s: 'refused', message: r.message });
    } catch {
      setState({ s: 'refused', message: 'Couldn’t save just now — your changes are still here. Try again.' });
    }
  };


  return (
    <div className={styles.root} data-cake-maker="">
      <p className={styles.lline}>
        What couples pick when they design a cake in your chat. Extras add to your cake card’s one price.
      </p>
      <div className={styles.frame}>
        <Part id="arrangements" title="Arrangements" line={`${formatCount(o.arrangements.length)} ways the tiers sit · Stacked in the price`} chip="They pick" open={open === 'arrangements'} onToggle={() => toggle('arrangements')}>
          <ArrangementsBody o={o} onChange={(arrangements) => patch({ arrangements })} />
        </Part>
        <Part id="tiers" title="Tiers" line={sizesLineOf(o)} chip="They pick" open={open === 'tiers'} onToggle={() => toggle('tiers')}>
          <TiersBody o={o} patch={patch} />
        </Part>
        <Part id="flavours" title="Flavour" line={`${formatCount(o.flavours.length)} flavours · one for each tier`} chip="They pick" open={open === 'flavours'} onToggle={() => toggle('flavours')}>
          <p className={styles.ol}>Couples pick one for each tier</p>
          <FlavourList o={o} patch={patch} />
        </Part>
        <Part id="shapes" title="Shapes and heights" line={`${shapesLineOf(o)} · each tier`} chip="They pick" open={open === 'shapes'} onToggle={() => toggle('shapes')}>
          <p className={styles.ol}>Shapes you make · couples pick one for each tier</p>
          <TickList catalog={CAKE_SHAPES} list={o.shapes} plain="round" per="a tier" onChange={(shapes) => patch({ shapes })} />
          <p className={styles.ol}>Heights</p>
          <div className={`${styles.frame} ${styles.in}`}>
            <div className={styles.or}>
              <span className={styles.on}>Standard</span>
              <span className={styles.ov}>
                <StandardChip />
              </span>
            </div>
            <div className={styles.or}>
              <button type="button" aria-pressed={!!o.tall} className={styles.tick} onClick={() => patch({ tall: o.tall ? null : { extraCentavos: 0 } })}>
                Tall · double barrel
              </button>
              {o.tall ? (
                <span className={styles.ov}>
                  <Amount label="Extra for a tall tier" centavos={o.tall.extraCentavos} onChange={(extraCentavos) => patch({ tall: { extraCentavos } })} />
                  <small className={styles.per}>a tier</small>
                </span>
              ) : null}
            </div>
          </div>
          <Note>Untick what you don’t make and couples won’t see it. The 3D cake draws each tier in its shape and height.</Note>
        </Part>
        <Part id="finish" title="Finish" line={o.finishes.map((f) => label(CAKE_FINISHES, f.id)).join(' · ')} chip="They pick" open={open === 'finish'} onToggle={() => toggle('finish')}>
          <TickList
            catalog={CAKE_FINISHES}
            list={o.finishes}
            standard={o.standardFinish}
            onStandard={(standardFinish) => patch({ standardFinish, finishes: o.finishes.map((f) => (f.id === standardFinish ? { ...f, extraCentavos: 0 } : f)) })}
            onChange={(finishes) => patch({ finishes, standardFinish: finishes.some((f) => f.id === o.standardFinish) ? o.standardFinish : (finishes[0]?.id ?? o.standardFinish) })}
          />
        </Part>
        <Part id="colours" title="Colours" line={`${formatCount(o.colours.length)} colours · their Mood Board first`} chip={`Choose 1–${formatCount(o.colourPick)}`} open={open === 'colours'} onToggle={() => toggle('colours')}>
          <ColoursBody o={o} patch={patch} />
        </Part>
        <Part id="accents" title="Accents for each tier" line={`${formatCount(o.accents.length)} accents · ${label(CAKE_ACCENTS, o.standardAccent)} in the price`} chip="They pick" open={open === 'accents'} onToggle={() => toggle('accents')}>
          <TickList
            catalog={CAKE_ACCENTS}
            list={o.accents}
            plain="none"
            per="a tier"
            standard={o.standardAccent}
            onStandard={(standardAccent) => patch({ standardAccent, accents: o.accents.map((a) => (a.id === standardAccent ? { ...a, extraCentavos: 0 } : a)) })}
            onChange={(accents) => patch({ accents, standardAccent: accents.some((a) => a.id === o.standardAccent) ? o.standardAccent : 'none' })}
          />
          <Note>Each extra is charged per tier it’s on.</Note>
        </Part>
        <Part id="flowing" title="Flowing accents" line={o.flowing.length ? `Across the tiers · ${formatCount(o.flowing.length)} kinds` : 'None yet'} chip="Optional" open={open === 'flowing'} onToggle={() => toggle('flowing')}>
          <TickList catalog={CAKE_FLOWING.filter((f) => f.id !== 'none')} list={o.flowing} onChange={(flowing) => patch({ flowing: flowing as CakeShopOptions['flowing'] })} />
          <Note>Couples choose where it starts and ends.</Note>
        </Part>
        <Part id="monogram" title="Monogram" line={o.monogram ? 'On · from their event' : 'Off'} chip="Optional" open={open === 'monogram'} onToggle={() => toggle('monogram')}>
          <Switch label="Couples can add their monogram" hint="On a tier · as the topper · on a plaque" on={!!o.monogram} onChange={(on) => patch({ monogram: on ? { extraCentavos: 0 } : null })} />
          {o.monogram ? (
            <div className={`${styles.frame} ${styles.in}`}>
              <div className={styles.or}>
                <span className={styles.on}>Their monogram</span>
                <span className={styles.ov}>
                  <Amount label="Extra for the monogram" centavos={o.monogram.extraCentavos} onChange={(extraCentavos) => patch({ monogram: { extraCentavos } })} />
                </span>
              </div>
            </div>
          ) : null}
          <Note>It is the event’s own monogram — the couple never uploads one.</Note>
        </Part>
        <Part id="topper" title="Topper" line={o.toppers.length ? `${formatCount(o.toppers.length)} toppers · none in the price` : 'None yet'} chip="Optional" open={open === 'topper'} onToggle={() => toggle('topper')}>
          <TickList catalog={CAKE_TOPPERS.filter((t) => t.id !== 'none')} list={o.toppers} onChange={(toppers) => patch({ toppers: toppers as CakeShopOptions['toppers'] })} />
        </Part>
        <Part
          id="cupcakes"
          title="Cupcakes"
          line={o.cupcakes ? `Packs of ${o.cupcakes.packs.map((p) => formatCount(p.count)).join(' · ')}${o.cupcakes.tower ? ' · a tower' : ''}` : 'Off'}
          chip="Optional"
          open={open === 'cupcakes'}
          onToggle={() => toggle('cupcakes')}
        >
          <CupcakesBody o={o} patch={patch} />
        </Part>
        <Part id="message" title="Message on the cake" line={o.messageMax > 0 ? `Up to ${formatCount(o.messageMax)} letters · plus their notes` : 'No message · their notes only'} chip="They write" open={open === 'message'} onToggle={() => toggle('message')}>
          <Stepper label="Longest message" value={o.messageMax} min={0} max={CAKE_MESSAGE_MAX} unit="letters" step={5} onChange={(messageMax) => patch({ messageMax })} />
          <Note>Couples also write “Anything else the baker should know?” and can pin one inspiration photo — both arrive with their design.</Note>
        </Part>
      </div>

      <h3 className={styles.lab}>What couples see</h3>
      <CakeSummary o={o} />

      <div className={styles.saveRow}>
        {state.s === 'refused' ? (
          <p role="alert" className={styles.problem} data-cake-problem="">
            {state.message}
          </p>
        ) : state.s === 'saved' ? (
          <p role="status" className={styles.okLine} data-cake-saved="">
            Saved · couples see these the next time they open Design a cake.
          </p>
        ) : null}
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={state.s === 'saving' ? 'Saving…' : saved ? 'Save changes' : 'Turn on Cake Maker'}
          onClick={save}
          disabled={state.s === 'saving' || !dirty}
          className="w-full !h-11"
          data-cake-save=""
        />
      </div>
    </div>
  );
}

/* ── one part: its row, and its body opened in place ───────────────────── */

function Part({ id, title, line, chip, open, onToggle, children }: { id: PartKey; title: string; line: string; chip: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const head = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: head.current, end: body.current }));
  return (
    <div className={styles.sl} data-cake-part={id} data-open={open ? '' : undefined}>
      <button
        ref={head}
        type="button"
        className={styles.sh}
        aria-expanded={open}
        onClick={() => {
          intend();
          onToggle();
        }}
      >
        <span className={styles.st}>
          <b>{title}</b>
          <small>{line}</small>
        </span>
        <span className={styles.chip}>
          <i aria-hidden />
          {chip}
        </span>
        <ChevronRight aria-hidden className={`${styles.chev} ${open ? styles.chevOpen : ''}`} />
      </button>
      {open ? (
        <div ref={body} className={styles.so}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ── Arrangements: a small cake for each way the tiers sit ─────────────── */

function ArrangementsBody({ o, onChange }: { o: CakeShopOptions; onChange: (a: CakePriced<CakeArrangement>[]) => void }) {
  const offer = useMemo(() => cakeOfferOf(o), [o]);
  const has = new Map(o.arrangements.map((a) => [a.id, a] as const));
  const tick = (id: CakeArrangement) => {
    if (id === 'stacked') return; // the plain way — always offered, in the price
    const order = CAKE_ARRANGEMENTS.map((x) => x.id) as string[];
    onChange(has.has(id) ? o.arrangements.filter((a) => a.id !== id) : [...o.arrangements, { id, extraCentavos: 0 }].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
  };
  return (
    <div className={styles.arrs} data-cake-arrangements="">
      {CAKE_ARRANGEMENTS.map((a) => {
        const on = has.get(a.id);
        const spec = cakeFigureSpec({ ...startingCakeConfig({ ...offer, sizes: [3] }, 3), arrangement: a.id });
        return (
          <div key={a.id} className={styles.arr} data-on={on ? '' : undefined}>
            <button type="button" aria-pressed={!!on} className={styles.arrPick} onClick={() => tick(a.id)} disabled={a.id === 'stacked'}>
              <CakeFigure spec={spec} className={styles.arrFig} />
              <b>{a.label}</b>
            </button>
            {a.id === 'stacked' ? (
              <StandardChip />
            ) : on ? (
              <Amount label={`Extra for ${a.label}`} centavos={on.extraCentavos} onChange={(extraCentavos) => onChange(o.arrangements.map((x) => (x.id === a.id ? { ...x, extraCentavos } : x)))} />
            ) : (
              <small className={styles.per}>Not offered</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tiers: the sizes 1–10, each with its extra and how many it serves ─── */

function TiersBody({ o, patch }: { o: CakeShopOptions; patch: (p: Partial<CakeShopOptions>) => void }) {
  const has = new Map(o.sizes.map((s) => [s.count, s] as const));
  const tick = (count: number) => {
    if (count === o.standardSize) return; // the size in the one price stays
    const sizes = has.has(count) ? o.sizes.filter((s) => s.count !== count) : [...o.sizes, { count, extraCentavos: 0, serves: null }].sort((a, b) => a.count - b.count);
    patch({ sizes });
  };
  const set = (count: number, over: Partial<{ extraCentavos: number; serves: number | null }>) => patch({ sizes: o.sizes.map((s) => (s.count === count ? { ...s, ...over } : s)) });
  return (
    <>
      <p className={styles.ol}>Sizes you make · 1 to {formatCount(CAKE_MAX_TIERS)}</p>
      <div className={styles.ccs} role="group" aria-label="Sizes you make">
        {Array.from({ length: CAKE_MAX_TIERS }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-pressed={has.has(n)} aria-label={tierLabel(n)} className={styles.cc} onClick={() => tick(n)} disabled={n === o.standardSize}>
            {formatCount(n)}
          </button>
        ))}
      </div>
      <p className={styles.ol}>In the price · extras · how many it serves</p>
      <div className={`${styles.frame} ${styles.in}`} data-cake-list="sizes">
        {o.sizes.map((s) => (
          <div key={s.count} className={styles.or}>
            <span className={styles.on}>
              {tierLabel(s.count)}
              <ServesInput count={s.count} serves={s.serves} onChange={(serves) => set(s.count, { serves })} />
            </span>
            <span className={styles.ov}>
              {s.count === o.standardSize ? (
                <StandardChip />
              ) : (
                <>
                  <Amount label={`Extra for ${tierLabel(s.count)}`} centavos={s.extraCentavos} onChange={(extraCentavos) => set(s.count, { extraCentavos })} />
                  <button type="button" className={styles.mk} onClick={() => patch({ standardSize: s.count, sizes: o.sizes.map((x) => (x.count === s.count ? { ...x, extraCentavos: 0 } : x)) })}>
                    Make standard
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      <Note>An extra can’t go below ₱0, so a smaller cake costs the one price. Couples see how many each size serves next to their own guest count.</Note>
      <Switch label="Display tiers" hint="Couples can make a tier display — decorated to match, not eaten. The tier they cut is always real." on={!!o.display} onChange={(on) => patch({ display: on ? { extraCentavos: 0 } : null })} />
      {o.display ? (
        <div className={`${styles.frame} ${styles.in}`}>
          <div className={styles.or}>
            <span className={styles.on}>Extra for each display tier</span>
            <span className={styles.ov}>
              <Amount label="Extra for each display tier" centavos={o.display.extraCentavos} onChange={(extraCentavos) => patch({ display: { extraCentavos } })} />
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ServesInput({ count, serves, onChange }: { count: number; serves: number | null; onChange: (n: number | null) => void }) {
  return (
    <label className={styles.serves}>
      <span>serves about</span>
      <input // field-ok: the inline "serves about" count inside a size row, beside its extra — not a form field
        inputMode="numeric"
        aria-label={`How many ${tierLabel(count)} serves`}
        value={serves === null ? '' : String(serves)}
        placeholder="—"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
          onChange(digits ? Math.min(CAKE_SERVES_MAX, Math.max(1, Number(digits))) : null);
        }}
      />
    </label>
  );
}

/* ── Flavour: the shop's own words ─────────────────────────────────────── */

function FlavourList({ o, patch }: { o: CakeShopOptions; patch: (p: Partial<CakeShopOptions>) => void }) {
  const list = o.flavours;
  const set = (ref: string, over: Partial<{ label: string; extraCentavos: number }>) => patch({ flavours: list.map((c) => (c.ref === ref ? { ...c, ...over } : c)) });
  const remove = (ref: string) => {
    const before = { flavours: list, standardFlavour: o.standardFlavour };
    const next = list.filter((c) => c.ref !== ref);
    const standardFlavour = o.standardFlavour === ref ? (next[0]?.ref ?? null) : o.standardFlavour;
    patch({ flavours: next.map((c) => (c.ref === standardFlavour ? { ...c, extraCentavos: 0 } : c)), standardFlavour });
    pushUndo({ label: `${list.find((c) => c.ref === ref)?.label || 'Flavour'} removed`, undo: async () => patch(before) });
  };
  const add = () => {
    let i = list.length;
    while (list.some((c) => c.ref === flavourRefAt(i))) i += 1;
    const ref = flavourRefAt(i);
    patch({ flavours: [...list, { ref, label: '', extraCentavos: 0 }], standardFlavour: o.standardFlavour ?? ref });
  };
  return (
    <div className={`${styles.frame} ${styles.in}`} data-cake-list="flavours">
      {list.map((c) => (
        <SwipeToDelete key={c.ref} label={`Remove ${c.label || 'this flavour'}`} word="Remove" onDelete={(close) => (close(), remove(c.ref))} radiusClass="rounded-none" surfaceClass="bg-[color:var(--cake-s-ghost)]">
          <div className={styles.or}>
            <input // field-ok: a list row's own name inside a swipe row, beside its extra — the inline line editor, not a form field
              className={styles.name}
              value={c.label}
              maxLength={CAKE_LABEL_MAX}
              placeholder="Name this flavour"
              aria-label="Name of this flavour"
              onChange={(e) => set(c.ref, { label: e.target.value })}
            />
            <span className={styles.ov}>
              {c.ref === o.standardFlavour ? (
                <StandardChip />
              ) : (
                <>
                  <Amount label={`Extra for ${c.label || 'this flavour'}`} centavos={c.extraCentavos} onChange={(v) => set(c.ref, { extraCentavos: v })} />
                  {c.extraCentavos > 0 ? <small className={styles.per}>a tier</small> : null}
                  <button type="button" className={styles.mk} onClick={() => patch({ standardFlavour: c.ref, flavours: list.map((x) => (x.ref === c.ref ? { ...x, extraCentavos: 0 } : x)) })}>
                    Make standard
                  </button>
                </>
              )}
            </span>
          </div>
        </SwipeToDelete>
      ))}
      {list.length < CAKE_FLAVOURS_MAX ? (
        <button type="button" className={styles.addRow} onClick={add}>
          <Plus aria-hidden className="h-4 w-4" />
          <span>Add a flavour</span>
        </button>
      ) : null}
    </div>
  );
}

/* ── A catalog part: tick what you make, type each one's extra ─────────── */

function TickList<T extends string>({
  catalog,
  list,
  plain,
  per,
  standard,
  onStandard,
  onChange,
}: {
  catalog: readonly { id: T; label: string }[];
  list: CakePriced<T>[];
  /** The plain choice — always offered, in the price. */
  plain?: T;
  per?: string;
  standard?: T;
  onStandard?: (id: T) => void;
  onChange: (next: CakePriced<T>[]) => void;
}) {
  const has = new Map(list.map((c) => [c.id, c] as const));
  const order = catalog.map((x) => x.id) as string[];
  const tick = (id: T) => {
    if (id === plain || (id === standard && has.has(id))) return; // the plain and the Standard choice stay
    onChange(has.has(id) ? list.filter((c) => c.id !== id) : [...list, { id, extraCentavos: 0 }].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
  };
  return (
    <div className={`${styles.frame} ${styles.in}`}>
      {catalog.map((x) => {
        const c = has.get(x.id);
        const isStd = x.id === standard || (standard === undefined && x.id === plain);
        return (
          <div key={x.id} className={styles.or}>
            <button type="button" aria-pressed={!!c} className={styles.tick} onClick={() => tick(x.id)} disabled={x.id === plain || (isStd && !!c)}>
              {x.label}
            </button>
            {c ? (
              <span className={styles.ov}>
                {isStd ? (
                  <StandardChip />
                ) : (
                  <>
                    <Amount label={`Extra for ${x.label}`} centavos={c.extraCentavos} onChange={(v) => onChange(list.map((k) => (k.id === x.id ? { ...k, extraCentavos: v } : k)))} />
                    {per && c.extraCentavos > 0 ? <small className={styles.per}>{per}</small> : null}
                    {onStandard ? (
                      <button type="button" className={styles.mk} onClick={() => onStandard(x.id)}>
                        Make standard
                      </button>
                    ) : null}
                  </>
                )}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── Colours: the shop's own, after the couple's Mood Board ────────────── */

function ColoursBody({ o, patch }: { o: CakeShopOptions; patch: (p: Partial<CakeShopOptions>) => void }) {
  const [typed, setTyped] = useState('');
  const [hex, setHex] = useState(CAKE_PICKER_START);
  const add = () => {
    const name = typed.trim().slice(0, CAKE_LABEL_MAX);
    if (!name || o.colours.some((c) => c.name.toLowerCase() === name.toLowerCase()) || o.colours.length >= CAKE_SHOP_COLOURS_MAX) return;
    patch({ colours: [...o.colours, { name, hex: (hexForColorName(name) ?? hex).toUpperCase() }] });
    setTyped('');
  };
  return (
    <>
      <Stepper label="Couples pick" prefix="1 to" value={o.colourPick} min={1} max={CAKE_MAX_COLOURS} onChange={(colourPick) => patch({ colourPick })} />
      <p className={styles.ol}>Your colours</p>
      <div className={styles.sws}>
        {o.colours.map((c) => (
          <span key={c.name} className={styles.sw}>
            <i aria-hidden style={{ background: c.hex }} />
            {c.name}
            <button
              type="button"
              aria-label={`Remove ${c.name}`}
              onClick={() => {
                const before = o.colours;
                patch({ colours: o.colours.filter((x) => x.name !== c.name) });
                pushUndo({ label: `${c.name} removed`, undo: async () => patch({ colours: before }) });
              }}
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {o.colours.length < CAKE_SHOP_COLOURS_MAX ? (
          <span className={styles.swAdd}>
            <input // field-ok: the colour chip's own swatch picker inside the "Add" chip — not a form field
              type="color"
              className={styles.swPick}
              value={hexForColorName(typed) ?? hex}
              aria-label="This colour’s shade"
              onChange={(e) => setHex(e.target.value)}
            />
            <input // field-ok: the chip list's own "Add" chip — typing a new chip, not a form field
              value={typed}
              maxLength={CAKE_LABEL_MAX}
              placeholder="Add"
              aria-label="Add a colour"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" aria-label="Add this colour" onClick={add}>
              <Plus aria-hidden className="h-4 w-4" />
            </button>
          </span>
        ) : null}
      </div>
      <Note>Couples see their own Mood Board colours first, then yours.</Note>
    </>
  );
}

/* ── Cupcakes: packs at your own price, the cake's flavours, a tower ───── */

function CupcakesBody({ o, patch }: { o: CakeShopOptions; patch: (p: Partial<CakeShopOptions>) => void }) {
  const cc = o.cupcakes;
  return (
    <>
      <Switch label="Offer cupcakes with this cake" hint="Couples are asked “Would you like cupcakes with it?”" on={!!cc} onChange={(on) => patch({ cupcakes: on ? { packs: [{ count: 24, priceCentavos: 0 }], tower: false } : null })} />
      {cc ? (
        <>
          <p className={styles.ol}>Your packs · price per pack</p>
          <div className={`${styles.frame} ${styles.in}`} data-cake-list="cupcakes">
            {cc.packs.map((p, i) => (
              <SwipeToDelete
                key={i}
                label={`Remove the ${formatCount(p.count)} pack`}
                word="Remove"
                onDelete={(close) => {
                  close();
                  if (cc.packs.length <= 1) return;
                  const before = cc;
                  patch({ cupcakes: { ...cc, packs: cc.packs.filter((_, k) => k !== i) } });
                  pushUndo({ label: `${formatCount(p.count)} cupcakes removed`, undo: async () => patch({ cupcakes: before }) });
                }}
                radiusClass="rounded-none"
                surfaceClass="bg-[color:var(--cake-s-ghost)]"
              >
                <div className={styles.or}>
                  <Stepper label="Cupcakes" value={p.count} min={1} max={CUPCAKE_PACK_MAX_COUNT} step={6} onChange={(count) => patch({ cupcakes: { ...cc, packs: cc.packs.map((x, k) => (k === i ? { ...x, count } : x)) } })} />
                  <span className={styles.ov}>
                    <Amount
                      label={`Price of the ${formatCount(p.count)} pack`}
                      centavos={p.priceCentavos}
                      onChange={(priceCentavos) => patch({ cupcakes: { ...cc, packs: cc.packs.map((x, k) => (k === i ? { ...x, priceCentavos } : x)) } })}
                    />
                  </span>
                </div>
              </SwipeToDelete>
            ))}
            {cc.packs.length < CUPCAKE_PACKS_MAX ? (
              <button
                type="button"
                className={styles.addRow}
                onClick={() => patch({ cupcakes: { ...cc, packs: [...cc.packs, { count: Math.min(CUPCAKE_PACK_MAX_COUNT, (cc.packs[cc.packs.length - 1]?.count ?? 12) + 12), priceCentavos: 0 }] } })}
              >
                <Plus aria-hidden className="h-4 w-4" />
                <span>Add a pack size</span>
              </button>
            ) : null}
          </div>
          <p className={styles.ol}>Flavours · the same list as your cake ({formatCount(o.flavours.length)} flavours)</p>
          <Switch label="You make a cupcake tower" hint="Otherwise couples only see “Around the base”." on={cc.tower} onChange={(tower) => patch({ cupcakes: { ...cc, tower } })} />
          <Note>“Match my cake” uses their colours and a small version of the tier accent.</Note>
        </>
      ) : null}
    </>
  );
}

/* ── small parts ───────────────────────────────────────────────────────── */

const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.sumRow}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.onote}>
      <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
      {children}
    </p>
  );
}

function StandardChip() {
  return (
    <span className={`${styles.chip} ${styles.info}`}>
      <i aria-hidden />
      Standard
    </span>
  );
}

function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.st}>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={SWITCH_BUTTON} onClick={() => onChange(!on)}>
        <SwitchTrack on={on} />
      </button>
    </div>
  );
}

function Amount({ label, centavos, onChange }: { label: string; centavos: number; onChange: (c: number) => void }) {
  return (
    <label className={styles.amt}>
      <span aria-hidden>+ ₱</span>
      <input // field-ok: the inline "+ ₱" extra beside a pick — a number box inside its chip row, not a form field
        inputMode="numeric"
        aria-label={label}
        value={centavos > 0 ? groupThousands(String(Math.round(centavos / 100))) : ''}
        placeholder="0"
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
      />
    </label>
  );
}

function Stepper({ label, prefix, value, min, max, unit, step = 1, onChange }: { label: string; prefix?: string; value: number; min: number; max: number; unit?: string; step?: number; onChange: (n: number) => void }) {
  return (
    <div className={styles.step} data-cake-stepper="">
      <span className={styles.stepName}>{label}</span>
      <button type="button" aria-label={`Fewer — ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <b>
        {prefix ? `${prefix} ` : ''}
        {formatCount(value)}
        {unit ? ` ${unit}` : ''}
      </b>
      <button type="button" aria-label={`More — ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
