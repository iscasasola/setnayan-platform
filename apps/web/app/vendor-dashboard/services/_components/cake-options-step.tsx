'use client';

/**
 * 🎂 YOUR CAKE OPTIONS — the cake card's own choices (Cake Maker §01 + the controller's v2 rulings: up to 10 layers,
 * real vs display tiers, accents per layer, arrangement, a flowing accent, the monogram, cupcakes).
 *
 * The card's LAST part, under How clients book. Every control is driven off ONE catalog (lib/cake-config.ts): the
 * supplier ticks which looks they make and types their own extra for each — nothing is guessed, every extra starts at
 * ₱0. Every choice is a SHIPPED package line on the card's own ★ Customization package (lib/cake-maker.ts). This
 * component only edits the model and posts it as ONE hidden field (`cake_options`), which `commitVendorService`
 * validates and saves, on a new card AND on a saved one (ruling 9).
 *
 * 🔒 SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP. Locked (a plan below Pro, after the admin's start date), the
 * part shows "Included in Pro · Upgrade" and posts NOTHING — so the rest of the card still saves and the saved options
 * stay exactly as they are.
 *
 * Lazy-loaded by the Card Maker, so none of it is in the Maker's first load.
 */
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { ChevronRight, Info, Lock, Minus, Plus, X } from 'lucide-react';
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
  CAKE_TOPPERS,
  cakeFigureSpec,
  startingCakeConfig,
  fullCakeOffer,
  type CakeConfig,
} from '@/lib/cake-config';
import {
  CAKE_COLOURS_MAX,
  CAKE_LABEL_MAX,
  CAKE_MAX_TIERS,
  CAKE_MESSAGE_LETTERS_MAX,
  CAKE_OPTIONS_FIELD,
  CUPCAKE_PACKS_MAX,
  CUPCAKE_PACK_MAX_COUNT,
  cakeOptionsProblem,
  cakeTemplate,
  lookLabel,
  serializeCakeOptions,
  tierLabel,
  type CakeChoice,
  type CakeLookChoice,
  type CakeOptions,
} from '@/lib/cake-maker';
import { SPECIAL_TOOLS_LOCKED_WORDS, SPECIAL_TOOLS_UPGRADE_HREF } from '@/lib/special-tools';
import { CakeFigure } from '@/app/_components/plan3d/kit/cake-figure';
import styles from './cake-options.module.css';

/** What the editor starts from. `unread` = a saved card whose options could not be read: nothing is posted. */
export type CakeSeed = { status: 'ok'; cake: CakeOptions | null; saved: boolean; locked?: boolean } | { status: 'unread' };

type PartKey = 'tiers' | 'flavours' | 'finish' | 'accents' | 'arrangements' | 'flowing' | 'topper' | 'monogram' | 'colours' | 'message' | 'cupcakes';
type LookKey = 'finish' | 'accents' | 'arrangements' | 'flowing' | 'topper';

const PART_NAME: Record<PartKey, string> = {
  tiers: 'Tiers',
  flavours: 'Flavour',
  finish: 'Finish',
  accents: 'Accents',
  arrangements: 'Arrangement',
  flowing: 'Flowing accent',
  topper: 'Topper',
  monogram: 'Monogram',
  colours: 'Colours',
  message: 'Message on the cake',
  cupcakes: 'Cupcakes',
};

const LOOK_CATALOG: Record<LookKey, { list: readonly { id: string; label: string }[]; plain: string | null; line: string }> = {
  finish: { list: CAKE_FINISHES, plain: null, line: 'the whole cake' },
  accents: { list: CAKE_ACCENTS, plain: 'none', line: 'one for each layer' },
  arrangements: { list: CAKE_ARRANGEMENTS, plain: 'stacked', line: 'how the layers stand' },
  flowing: { list: CAKE_FLOWING, plain: 'none', line: 'one that runs across the layers' },
  topper: { list: CAKE_TOPPERS, plain: 'none', line: 'on the top tier' },
};

let refSeq = 0;
const newRef = (p: string) => `${p}-n${Date.now().toString(36)}${(refSeq += 1)}`;

export function CakeOptionsStep({ seed, priceWords }: { seed: CakeSeed; serviceId?: string | null; priceWords: string | null }) {
  if (seed.status === 'unread') {
    return (
      <div className={styles.frame} data-cake-options="unread" role="alert">
        <p className={styles.failTitle}>Couldn’t load your cake options</p>
        <p className={styles.failLine}>They are saved; only this read failed. Saving the card now keeps them as they are.</p>
      </div>
    );
  }
  if (seed.locked) return <LockedCakeOptions saved={seed.saved} />;
  return <CakeOptionsEditor start={seed.cake ?? cakeTemplate()} priceWords={priceWords} />;
}

/** Below Pro after the start date: one quiet row, and nothing posted — the saved options are kept. */
function LockedCakeOptions({ saved }: { saved: boolean }) {
  return (
    <section className={styles.root} data-cake-options="locked">
      <h3 className={styles.lab}>Your cake options</h3>
      <div className={`${styles.frame} ${styles.lockRow}`}>
        <Lock aria-hidden className="h-4 w-4 flex-none" />
        <span className={styles.st}>
          <b>{SPECIAL_TOOLS_LOCKED_WORDS}</b>
          <small>{saved ? 'Your saved cake options are kept, just as they are.' : 'Couples design their cake on your card.'}</small>
        </span>
        <Link href={SPECIAL_TOOLS_UPGRADE_HREF} className={styles.pill} data-web-only="">
          Upgrade
        </Link>
      </div>
    </section>
  );
}

function CakeOptionsEditor({ start, priceWords }: { start: CakeOptions; priceWords: string | null }) {
  const [cake, setCake] = useState<CakeOptions>(start);
  const [open, setOpen] = useState<PartKey | null>('tiers');
  const problem = cakeOptionsProblem(cake);
  const patch = useCallback((over: Partial<CakeOptions>) => setCake((c) => ({ ...c, ...over })), []);
  const template = useMemo(() => cakeTemplate(), []);
  const optional: Exclude<PartKey, 'tiers'>[] = ['flavours', 'finish', 'accents', 'arrangements', 'flowing', 'topper', 'monogram', 'colours', 'message', 'cupcakes'];
  const onCount = 1 + optional.filter((k) => cake[k] !== null).length;

  const removePart = (key: Exclude<PartKey, 'tiers'>) => {
    const before = cake;
    patch({ [key]: null } as Partial<CakeOptions>);
    if (open === key) setOpen(null);
    pushUndo({ label: `${PART_NAME[key]} removed`, undo: async () => setCake(before) });
  };
  const addBack = (key: Exclude<PartKey, 'tiers'>) => {
    const fresh: Partial<CakeOptions> =
      key === 'monogram' ? { monogram: { extraCentavos: 0 } } : key === 'cupcakes' ? { cupcakes: { packs: [{ count: 24, priceCentavos: 0 }], tower: null } } : { [key]: template[key] };
    patch(fresh);
    setOpen(key);
  };
  const toggle = (key: PartKey) => setOpen(open === key ? null : key);

  // The picture of the cake the one price pays for — drawn from the shared model, the same as the couple's.
  const spec = useMemo(() => {
    const base: CakeConfig = startingCakeConfig(fullCakeOffer());
    const n = Math.max(1, Math.min(CAKE_MAX_TIERS, cake.tiers.standard));
    const accent = cake.accents?.find((a) => a.look !== 'none')?.look ?? 'none';
    return cakeFigureSpec({
      ...base,
      tiers: Array.from({ length: n }, (_, i) => ({ kind: 'real' as const, flavourRef: null, accent: i === 0 ? accent : 'none' })),
      finish: cake.finish?.find((f) => f.standard)?.look ?? 'buttercream',
      arrangement: cake.arrangements?.find((a) => a.standard)?.look ?? 'stacked',
      topper: cake.topper?.find((t) => t.standard)?.look ?? 'none',
    });
  }, [cake.tiers.standard, cake.accents, cake.finish, cake.arrangements, cake.topper]);

  const t = cake.tiers;
  const tiersLine = `Up to ${formatCount(t.maxReal)} · ${formatCount(t.standard)} in the price${t.display ? ` · up to ${formatCount(t.display.max)} display` : ''}`;
  const removed = optional.filter((k) => cake[k] === null);

  return (
    <section className={styles.root} data-cake-options="">
      {/* THE ONE FIELD THIS PART POSTS. A problem posts nothing (the save then keeps what was saved). */}
      <input type="hidden" name={CAKE_OPTIONS_FIELD} value={problem ? '' : serializeCakeOptions(cake)} />
      <h3 className={styles.lab}>
        Your cake options <span className={styles.n}>{formatCount(onCount)}</span>
      </h3>
      <p className={styles.lline}>
        What couples choose in “Design your cake”. Extras add to your one price
        {priceWords ? ` (${priceWords})` : ''}.
      </p>
      <div className={styles.preview} aria-hidden>
        <CakeFigure spec={spec} />
      </div>
      <div className={styles.frame}>
        <Part id="tiers" title="Tiers" line={tiersLine} chip="They pick" open={open === 'tiers'} onToggle={() => toggle('tiers')}>
          <TiersBody tiers={t} onChange={(tiers) => patch({ tiers })} />
        </Part>
        {cake.flavours ? (
          <Part id="flavours" title="Flavour" line={`${formatCount(cake.flavours.length)} flavours · one for each real tier`} chip="They pick" open={open === 'flavours'} onToggle={() => toggle('flavours')} onRemove={() => removePart('flavours')}>
            <p className={styles.ol}>Couples pick one for each real tier</p>
            <FlavourList list={cake.flavours} onChange={(flavours) => patch({ flavours })} />
          </Part>
        ) : null}
        {(['finish', 'accents', 'arrangements', 'flowing', 'topper'] as const).map((k) => {
          const list = cake[k] as CakeLookChoice[] | null;
          if (!list) return null;
          return (
            <Part
              key={k}
              id={k}
              title={PART_NAME[k]}
              line={`${list.map((c) => lookLabel(c.look, LOOK_CATALOG[k].list)).join(' · ')} · ${LOOK_CATALOG[k].line}`}
              chip="They pick"
              open={open === k}
              onToggle={() => toggle(k)}
              onRemove={() => removePart(k)}
            >
              <LookList kind={k} list={list} onChange={(next) => patch({ [k]: next } as Partial<CakeOptions>)} />
            </Part>
          );
        })}
        {cake.monogram ? (
          <Part id="monogram" title="Monogram" line="The couple’s own monogram, on a layer, the topper or the board" chip="Optional" open={open === 'monogram'} onToggle={() => toggle('monogram')} onRemove={() => removePart('monogram')}>
            <div className={`${styles.frame} ${styles.in}`}>
              <div className={styles.or}>
                <span className={styles.on}>Their monogram</span>
                <span className={styles.ov}>
                  <Amount label="Extra for the monogram" centavos={cake.monogram.extraCentavos} onChange={(extraCentavos) => patch({ monogram: { extraCentavos } })} />
                </span>
              </div>
            </div>
            <p className={styles.onote}>
              <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
              It is the monogram they already made for their event — nothing for them to draw.
            </p>
          </Part>
        ) : null}
        {cake.colours ? (
          <Part id="colours" title="Colours" line={`${formatCount(cake.colours.names.length)} colours · their Mood Board first`} chip={`Choose 1–${formatCount(cake.colours.max)}`} open={open === 'colours'} onToggle={() => toggle('colours')} onRemove={() => removePart('colours')}>
            <ColoursBody colours={cake.colours} onChange={(colours) => patch({ colours })} />
          </Part>
        ) : null}
        {cake.message ? (
          <Part id="message" title="Message on the cake" line={`Up to ${formatCount(cake.message.maxLetters)} letters`} chip="They write" open={open === 'message'} onToggle={() => toggle('message')} onRemove={() => removePart('message')}>
            <Stepper label="Longest message" value={cake.message.maxLetters} min={1} max={CAKE_MESSAGE_LETTERS_MAX} unit="letters" step={5} onChange={(maxLetters) => patch({ message: { maxLetters } })} />
          </Part>
        ) : null}
        {cake.cupcakes ? (
          <Part id="cupcakes" title="Cupcakes" line={`${cake.cupcakes.packs.map((p) => formatCount(p.count)).join(' · ')} a pack${cake.cupcakes.tower ? ' · tower' : ''}`} chip="Add-on" open={open === 'cupcakes'} onToggle={() => toggle('cupcakes')} onRemove={() => removePart('cupcakes')}>
            <CupcakesBody cupcakes={cake.cupcakes} onChange={(cupcakes) => patch({ cupcakes })} />
          </Part>
        ) : null}
        {removed.length > 0 ? (
          <div className={styles.addRow} data-cake-add-back="">
            <Plus aria-hidden className="h-4 w-4" />
            <span>Add an option</span>
            <span className={styles.addChips}>
              {removed.map((k) => (
                <button key={k} type="button" className={styles.pill} onClick={() => addBack(k)}>
                  {PART_NAME[k]}
                </button>
              ))}
            </span>
          </div>
        ) : null}
      </div>
      <p className={styles.onote}>
        <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
        Couples also write special instructions and can pin one inspiration photo — both arrive with their design.
      </p>
      {problem ? (
        <p role="alert" className={styles.problem} data-cake-problem="">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

/* ── one part: its row, and its body opened in place ───────────────────── */

function Part({
  id,
  title,
  line,
  chip,
  open,
  onToggle,
  onRemove,
  children,
}: {
  id: string;
  title: string;
  line: string;
  chip: string;
  open: boolean;
  onToggle: () => void;
  /** Absent = a part that cannot be removed (Tiers). */
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const head = (
    <button type="button" className={styles.sh} aria-expanded={open} onClick={onToggle}>
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
  );
  return (
    <div className={styles.sl} data-cake-part={id} data-open={open ? '' : undefined}>
      {onRemove ? (
        <SwipeToDelete label={`Remove ${title}`} word="Remove" onDelete={(close) => (close(), onRemove())} radiusClass="rounded-none" surfaceClass="bg-[color:var(--cake-s-bg)]">
          {head}
        </SwipeToDelete>
      ) : (
        head
      )}
      {open ? <div className={styles.so}>{children}</div> : null}
    </div>
  );
}

/* ── Tiers: real (1–10) and the Display tiers switch ───────────────────── */

function TiersBody({ tiers: t, onChange }: { tiers: CakeOptions['tiers']; onChange: (t: CakeOptions['tiers']) => void }) {
  return (
    <>
      <Stepper label="Most real tiers you make" value={t.maxReal} min={1} max={CAKE_MAX_TIERS} onChange={(maxReal) => onChange({ ...t, maxReal, standard: Math.min(t.standard, maxReal) })} />
      <Stepper label="Real tiers in your price" value={t.standard} min={1} max={t.maxReal} onChange={(standard) => onChange({ ...t, standard })} />
      {t.maxReal > t.standard ? (
        <div className={`${styles.frame} ${styles.in}`}>
          <div className={styles.or}>
            <span className={styles.on}>Each real tier above {tierLabel(t.standard)}</span>
            <span className={styles.ov}>
              <Amount label="Extra for each real tier" centavos={t.realExtraCentavos} onChange={(realExtraCentavos) => onChange({ ...t, realExtraCentavos })} />
            </span>
          </div>
        </div>
      ) : null}
      <Switch
        label="Display tiers"
        hint="Styled foam layers that look like cake — the cutting tier is always real cake."
        on={t.display !== null}
        onChange={(on) => onChange({ ...t, display: on ? { max: 2, extraCentavos: 0 } : null })}
      />
      {t.display ? (
        <>
          <Stepper label="Most display tiers" value={t.display.max} min={1} max={CAKE_MAX_TIERS - 1} onChange={(max) => onChange({ ...t, display: { ...t.display!, max } })} />
          <div className={`${styles.frame} ${styles.in}`}>
            <div className={styles.or}>
              <span className={styles.on}>Each display tier</span>
              <span className={styles.ov}>
                <Amount label="Extra for each display tier" centavos={t.display.extraCentavos} onChange={(extraCentavos) => onChange({ ...t, display: { ...t.display!, extraCentavos } })} />
              </span>
            </div>
          </div>
        </>
      ) : null}
      <p className={styles.onote}>
        <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
        An extra can’t go below ₱0, so fewer tiers than your price still costs the one price. A cake holds up to {formatCount(CAKE_MAX_TIERS)} tiers in all.
      </p>
    </>
  );
}

/* ── Flavour: the supplier's own words, written once ───────────────────── */

function FlavourList({ list, onChange }: { list: CakeChoice[]; onChange: (next: CakeChoice[]) => void }) {
  const set = (ref: string, over: Partial<CakeChoice>) => onChange(list.map((c) => (c.ref === ref ? { ...c, ...over } : c)));
  const makeStandard = (ref: string) => onChange(list.map((c) => ({ ...c, standard: c.ref === ref, extraCentavos: c.ref === ref ? 0 : c.extraCentavos })));
  const remove = (ref: string) => {
    const before = list;
    const gone = list.find((c) => c.ref === ref);
    let next = list.filter((c) => c.ref !== ref);
    if (gone?.standard && next[0]) next = next.map((c, i) => (i === 0 ? { ...c, standard: true, extraCentavos: 0 } : c));
    onChange(next);
    pushUndo({ label: `${gone?.label || 'Flavour'} removed`, undo: async () => onChange(before) });
  };
  return (
    <div className={`${styles.frame} ${styles.in}`} data-cake-list="flavours">
      {list.map((c) => (
        <SwipeToDelete key={c.ref} label={`Remove ${c.label || 'this flavour'}`} word="Remove" onDelete={(close) => (close(), remove(c.ref))} radiusClass="rounded-none" surfaceClass="bg-[color:var(--cake-s-bg)]">
          <div className={styles.or}>
            <input // field-ok: a list row's own name inside a swipe row, beside its extra — the Card Maker's inline line editor, not a form field
              className={styles.name} value={c.label} maxLength={CAKE_LABEL_MAX} placeholder="Name this flavour" aria-label="Name of this flavour" onChange={(e) => set(c.ref, { label: e.target.value })} />
            <span className={styles.ov}>
              {c.standard ? (
                <StandardChip />
              ) : (
                <>
                  <Amount label={`Extra for ${c.label || 'this flavour'}`} centavos={c.extraCentavos} onChange={(v) => set(c.ref, { extraCentavos: v })} />
                  {c.extraCentavos > 0 ? <small className={styles.per}>a tier</small> : null}
                  <button type="button" className={styles.mk} onClick={() => makeStandard(c.ref)}>
                    Make standard
                  </button>
                </>
              )}
            </span>
          </div>
        </SwipeToDelete>
      ))}
      <button type="button" className={styles.addRow} onClick={() => onChange([...list, { ref: newRef('fl'), label: '', extraCentavos: 0, standard: list.length === 0 }])}>
        <Plus aria-hidden className="h-4 w-4" />
        <span>Add a flavour</span>
      </button>
    </div>
  );
}

/* ── A catalog part: tick the looks you make, type each one's extra ────── */

function LookList({ kind, list, onChange }: { kind: LookKey; list: CakeLookChoice[]; onChange: (next: CakeLookChoice[]) => void }) {
  const cat = LOOK_CATALOG[kind];
  const has = new Set(list.map((c) => c.look));
  const tick = (look: string) => {
    if (look === cat.plain) return; // the plain look is what "nothing picked" is — always offered
    if (has.has(look)) {
      const gone = list.find((c) => c.look === look);
      let next = list.filter((c) => c.look !== look);
      if (gone?.standard && next[0]) next = next.map((c, i) => (i === 0 ? { ...c, standard: true, extraCentavos: 0 } : c));
      onChange(next);
    } else {
      const order = cat.list.map((x) => x.id);
      onChange([...list, { look, extraCentavos: 0, standard: list.length === 0 }].sort((a, b) => order.indexOf(a.look) - order.indexOf(b.look)));
    }
  };
  const set = (look: string, extraCentavos: number) => onChange(list.map((c) => (c.look === look ? { ...c, extraCentavos } : c)));
  const makeStandard = (look: string) => onChange(list.map((c) => ({ ...c, standard: c.look === look, extraCentavos: c.look === look ? 0 : c.extraCentavos })));
  return (
    <>
      <p className={styles.ol}>What you make</p>
      <div className={styles.ccs} role="group" aria-label={`${PART_NAME[kind]} you make`} data-cake-looks={kind}>
        {cat.list.map((x) => (
          <button key={x.id} type="button" aria-pressed={has.has(x.id)} className={`${styles.cc} ${styles.ccWide}`} onClick={() => tick(x.id)} disabled={x.id === cat.plain}>
            <b>{x.label}</b>
          </button>
        ))}
      </div>
      <p className={styles.ol}>In the price · extras</p>
      <div className={`${styles.frame} ${styles.in}`}>
        {list.map((c) => (
          <div key={c.look} className={styles.or}>
            <span className={styles.on}>{lookLabel(c.look, cat.list)}</span>
            <span className={styles.ov}>
              {c.standard ? (
                <StandardChip />
              ) : (
                <>
                  <Amount label={`Extra for ${lookLabel(c.look, cat.list)}`} centavos={c.extraCentavos} onChange={(v) => set(c.look, v)} />
                  {kind === 'accents' && c.extraCentavos > 0 ? <small className={styles.per}>a layer</small> : null}
                  {cat.plain === null ? (
                    <button type="button" className={styles.mk} onClick={() => makeStandard(c.look)}>
                      Make standard
                    </button>
                  ) : null}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Colours ───────────────────────────────────────────────────────────── */

function ColoursBody({ colours, onChange }: { colours: NonNullable<CakeOptions['colours']>; onChange: (c: NonNullable<CakeOptions['colours']>) => void }) {
  const [typed, setTyped] = useState('');
  const add = () => {
    const name = typed.trim().slice(0, CAKE_LABEL_MAX);
    if (!name || colours.names.some((n) => n.toLowerCase() === name.toLowerCase())) return;
    onChange({ ...colours, names: [...colours.names, name] });
    setTyped('');
  };
  return (
    <>
      <Stepper label="Couples pick" prefix="1 to" value={colours.max} min={1} max={CAKE_COLOURS_MAX} onChange={(max) => onChange({ ...colours, max })} />
      <p className={styles.ol}>Your colours</p>
      <div className={styles.sws}>
        {colours.names.map((n) => (
          <span key={n} className={styles.sw}>
            <i aria-hidden style={{ background: hexForColorName(n) ?? 'transparent' }} />
            {n}
            <button
              type="button"
              aria-label={`Remove ${n}`}
              onClick={() => {
                const before = colours;
                onChange({ ...colours, names: colours.names.filter((x) => x !== n) });
                pushUndo({ label: `${n} removed`, undo: async () => onChange(before) });
              }}
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <span className={styles.swAdd}>
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
      </div>
      <p className={styles.onote}>
        <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
        Couples see their own Mood Board colours first, then yours.
      </p>
    </>
  );
}

/* ── Cupcakes: packs at your own price, the cake's flavours, a tower ───── */

function CupcakesBody({ cupcakes, onChange }: { cupcakes: NonNullable<CakeOptions['cupcakes']>; onChange: (c: NonNullable<CakeOptions['cupcakes']>) => void }) {
  const packs = cupcakes.packs;
  const setPack = (i: number, over: Partial<{ count: number; priceCentavos: number }>) => onChange({ ...cupcakes, packs: packs.map((p, k) => (k === i ? { ...p, ...over } : p)) });
  return (
    <>
      <p className={styles.ol}>Packs · your price for each</p>
      <div className={`${styles.frame} ${styles.in}`} data-cake-list="cupcakes">
        {packs.map((p, i) => (
          <SwipeToDelete
            key={i}
            label={`Remove the ${formatCount(p.count)} pack`}
            word="Remove"
            onDelete={(close) => {
              close();
              const before = cupcakes;
              onChange({ ...cupcakes, packs: packs.filter((_, k) => k !== i) });
              pushUndo({ label: `${formatCount(p.count)} cupcakes removed`, undo: async () => onChange(before) });
            }}
            radiusClass="rounded-none"
            surfaceClass="bg-[color:var(--cake-s-bg)]"
          >
            <div className={styles.or}>
              <Stepper label="Cupcakes" value={p.count} min={1} max={CUPCAKE_PACK_MAX_COUNT} step={6} onChange={(count) => setPack(i, { count })} />
              <span className={styles.ov}>
                <Amount label={`Price of the ${formatCount(p.count)} pack`} centavos={p.priceCentavos} onChange={(priceCentavos) => setPack(i, { priceCentavos })} />
              </span>
            </div>
          </SwipeToDelete>
        ))}
        {packs.length < CUPCAKE_PACKS_MAX ? (
          <button
            type="button"
            className={styles.addRow}
            onClick={() => onChange({ ...cupcakes, packs: [...packs, { count: Math.min(CUPCAKE_PACK_MAX_COUNT, (packs[packs.length - 1]?.count ?? 12) + 12), priceCentavos: 0 }] })}
          >
            <Plus aria-hidden className="h-4 w-4" />
            <span>Add a pack</span>
          </button>
        ) : null}
      </div>
      <Switch label="Cupcake tower" hint="Couples pick around the base or a tower." on={cupcakes.tower !== null} onChange={(on) => onChange({ ...cupcakes, tower: on ? { extraCentavos: 0 } : null })} />
      {cupcakes.tower ? (
        <div className={`${styles.frame} ${styles.in}`}>
          <div className={styles.or}>
            <span className={styles.on}>Tower</span>
            <span className={styles.ov}>
              <Amount label="Extra for the tower" centavos={cupcakes.tower.extraCentavos} onChange={(extraCentavos) => onChange({ ...cupcakes, tower: { extraCentavos } })} />
            </span>
          </div>
        </div>
      ) : null}
      <p className={styles.onote}>
        <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
        Cupcakes use your cake flavours — couples match the cake or pick one.
      </p>
    </>
  );
}

/* ── small parts ───────────────────────────────────────────────────────── */

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

function Stepper({
  label,
  prefix,
  value,
  min,
  max,
  unit,
  step = 1,
  onChange,
}: {
  label: string;
  prefix?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  onChange: (n: number) => void;
}) {
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
