'use client';

/**
 * 🎂 YOUR CAKE OPTIONS — the cake card's own choices (Cake Maker §01, drawing
 * prototypes/cake_maker_2026-11-21/cake_maker_fable.html; DECISION_LOG 2026-11-21).
 *
 * The card's LAST part, under How clients book. It opens with the cake template's lines already filled (Tiers · Flavour ·
 * Finish · Colours · Design · Topper · Message); the supplier edits any of them, or swipes one away (Undo, or "Add an
 * option" brings it back). Every line is a SHIPPED package line on the card's own ★ Customization package — see
 * lib/cake-maker.ts. This component only edits the model and posts it as ONE hidden field (`cake_options`), which
 * `commitVendorService` validates and saves, on a new card AND on a saved one (ruling 9).
 *
 * Lazy-loaded by the Card Maker, so none of it is in the Maker's first load.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ChevronRight, ImagePlus, Info, Minus, Plus, X } from 'lucide-react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { Sheet } from '@/app/_components/sheet';
import { pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { cakeAction } from '@/app/vendor-dashboard/cake-actions';
import { hexForColorName } from '@/lib/color-names';
import { formatCount } from '@/lib/format-number';
import { groupThousands, parseAmountInput } from '@/lib/service-customization-draft';
import {
  CAKE_COLOURS_MAX,
  CAKE_LABEL_MAX,
  CAKE_MAX_TIERS,
  CAKE_MESSAGE_LETTERS_MAX,
  CAKE_OPTIONS_FIELD,
  cakeOptionsProblem,
  cakeTemplate,
  serializeCakeOptions,
  tierLabel,
  type CakeChoice,
  type CakeOptions,
} from '@/lib/cake-maker';
import styles from './cake-options.module.css';

/** What the editor starts from. `unread` = a saved card whose options could not be read: nothing is posted. */
export type CakeSeed = { status: 'ok'; cake: CakeOptions | null; saved: boolean } | { status: 'unread' };

type Open = 'tiers' | 'flavours' | 'finish' | 'colours' | 'design' | 'topper' | 'message' | null;
type ListKey = 'flavours' | 'finish' | 'design' | 'topper';

const LIST_NAME: Record<ListKey, { title: string; one: string; add: string }> = {
  flavours: { title: 'Flavour', one: 'flavour', add: 'Add a flavour' },
  finish: { title: 'Finish', one: 'finish', add: 'Add a finish' },
  design: { title: 'Design', one: 'design', add: 'Add a design' },
  topper: { title: 'Topper', one: 'topper', add: 'Add a topper' },
};

let refSeq = 0;
const newRef = (p: string) => `${p}-n${Date.now().toString(36)}${(refSeq += 1)}`;

export function CakeOptionsStep({ seed, serviceId, priceWords }: { seed: CakeSeed; serviceId: string | null; priceWords: string | null }) {
  if (seed.status === 'unread') {
    return (
      <div className={styles.frame} data-cake-options="unread" role="alert">
        <p className={styles.failTitle}>Couldn’t load your cake options</p>
        <p className={styles.failLine}>They are saved; only this read failed. Saving the card now keeps them as they are.</p>
      </div>
    );
  }
  return <CakeOptionsEditor start={seed.cake ?? cakeTemplate()} serviceId={serviceId} priceWords={priceWords} />;
}

function CakeOptionsEditor({ start, serviceId, priceWords }: { start: CakeOptions; serviceId: string | null; priceWords: string | null }) {
  const [cake, setCake] = useState<CakeOptions>(start);
  const [open, setOpen] = useState<Open>('tiers');
  const [tiersOn, setTiersOn] = useState(true);
  const problem = tiersOn ? cakeOptionsProblem(cake) : null;
  const count =
    (tiersOn ? 1 : 0) + [cake.flavours, cake.finish, cake.colours, cake.design, cake.topper, cake.message].filter((x) => x !== null).length;

  const patch = useCallback((over: Partial<CakeOptions>) => setCake((c) => ({ ...c, ...over })), []);

  /** Swipe a part away — Undo puts it back as it was. */
  const removePart = (key: Exclude<Open, null>) => {
    const before = cake;
    const wasTiers = tiersOn;
    if (key === 'tiers') setTiersOn(false);
    else patch({ [key]: null } as Partial<CakeOptions>);
    if (open === key) setOpen(null);
    pushUndo({
      label: `${key === 'tiers' ? 'Tiers' : key === 'message' ? 'Message on the cake' : key === 'colours' ? 'Colours' : LIST_NAME[key].title} removed`,
      undo: async () => {
        setCake(before);
        setTiersOn(wasTiers);
      },
    });
  };
  const template = useMemo(() => cakeTemplate(), []);
  const removed: { key: Exclude<Open, null>; label: string }[] = [
    ...(!tiersOn ? [{ key: 'tiers' as const, label: 'Tiers' }] : []),
    ...(cake.flavours === null ? [{ key: 'flavours' as const, label: 'Flavour' }] : []),
    ...(cake.finish === null ? [{ key: 'finish' as const, label: 'Finish' }] : []),
    ...(cake.colours === null ? [{ key: 'colours' as const, label: 'Colours' }] : []),
    ...(cake.design === null ? [{ key: 'design' as const, label: 'Design' }] : []),
    ...(cake.topper === null ? [{ key: 'topper' as const, label: 'Topper' }] : []),
    ...(cake.message === null ? [{ key: 'message' as const, label: 'Message on the cake' }] : []),
  ];
  const addBack = (key: Exclude<Open, null>) => {
    if (key === 'tiers') setTiersOn(true);
    else patch({ [key]: template[key] } as Partial<CakeOptions>);
    setOpen(key);
  };

  const sizes = [...cake.tiers.made].sort((a, b) => a - b);
  const tiersLine = `${formatCount(sizes[0] ?? 1)} to ${formatCount(sizes[sizes.length - 1] ?? 1)} · ${formatCount(cake.tiers.standard)} in the price`;

  return (
    <section className={styles.root} data-cake-options="">
      {/* THE ONE FIELD THIS PART POSTS. No tiers = no cake options (the field is empty and nothing is saved). */}
      <input type="hidden" name={CAKE_OPTIONS_FIELD} value={tiersOn && !problem ? serializeCakeOptions(cake) : ''} />
      <h3 className={styles.lab}>
        Your cake options <span className={styles.n}>{formatCount(count)}</span>
      </h3>
      <p className={styles.lline}>
        What couples choose in “Design your cake”. Extras add to your one price
        {priceWords ? ` (${priceWords})` : ''}.
      </p>
      <div className={styles.frame}>
        {tiersOn ? (
          <Part
            id="tiers"
            title="Tiers"
            line={tiersLine}
            chip="They pick"
            open={open === 'tiers'}
            onToggle={() => setOpen(open === 'tiers' ? null : 'tiers')}
            onRemove={() => removePart('tiers')}
          >
            <TiersBody cake={cake} onChange={(tiers) => patch({ tiers })} />
          </Part>
        ) : null}
        {cake.flavours ? (
          <Part
            id="flavours"
            title="Flavour"
            line={`${formatCount(cake.flavours.length)} flavours · one for each tier`}
            chip="They pick"
            open={open === 'flavours'}
            onToggle={() => setOpen(open === 'flavours' ? null : 'flavours')}
            onRemove={() => removePart('flavours')}
          >
            <p className={styles.ol}>Couples pick one for each tier</p>
            <ChoiceList list={cake.flavours} kind="flavours" perTier onChange={(flavours) => patch({ flavours })} />
          </Part>
        ) : null}
        {cake.finish ? (
          <Part
            id="finish"
            title="Finish"
            line={cake.finish.map((c) => c.label || 'Unnamed').join(' · ')}
            chip="They pick"
            open={open === 'finish'}
            onToggle={() => setOpen(open === 'finish' ? null : 'finish')}
            onRemove={() => removePart('finish')}
          >
            <ChoiceList list={cake.finish} kind="finish" onChange={(finish) => patch({ finish })} />
          </Part>
        ) : null}
        {cake.colours ? (
          <Part
            id="colours"
            title="Colours"
            line={`${formatCount(cake.colours.names.length)} colours · their Mood Board first`}
            chip={`Choose 1–${formatCount(cake.colours.max)}`}
            open={open === 'colours'}
            onToggle={() => setOpen(open === 'colours' ? null : 'colours')}
            onRemove={() => removePart('colours')}
          >
            <ColoursBody colours={cake.colours} onChange={(colours) => patch({ colours })} />
          </Part>
        ) : null}
        {cake.design ? (
          <Part
            id="design"
            title="Design"
            line={`${formatCount(cake.design.filter((d) => d.photoRef).length)} photos from your work`}
            chip="They pick"
            open={open === 'design'}
            onToggle={() => setOpen(open === 'design' ? null : 'design')}
            onRemove={() => removePart('design')}
          >
            <ChoiceList list={cake.design} kind="design" serviceId={serviceId} onChange={(design) => patch({ design })} />
          </Part>
        ) : null}
        {cake.topper ? (
          <Part
            id="topper"
            title="Topper"
            line={`${formatCount(cake.topper.filter((t) => !t.standard).length)} toppers · ${cake.topper.find((t) => t.standard)?.label === 'None' ? 'none in the price' : `${cake.topper.find((t) => t.standard)?.label ?? ''} in the price`}`}
            chip="Optional"
            open={open === 'topper'}
            onToggle={() => setOpen(open === 'topper' ? null : 'topper')}
            onRemove={() => removePart('topper')}
          >
            <ChoiceList list={cake.topper} kind="topper" onChange={(topper) => patch({ topper })} />
          </Part>
        ) : null}
        {cake.message ? (
          <Part
            id="message"
            title="Message on the cake"
            line={`Up to ${formatCount(cake.message.maxLetters)} letters`}
            chip="They write"
            open={open === 'message'}
            onToggle={() => setOpen(open === 'message' ? null : 'message')}
            onRemove={() => removePart('message')}
          >
            <Stepper
              name="Longest message"
              value={cake.message.maxLetters}
              min={1}
              max={CAKE_MESSAGE_LETTERS_MAX}
              unit="letters"
              step={5}
              onChange={(maxLetters) => patch({ message: { maxLetters } })}
            />
          </Part>
        ) : null}
        {removed.length > 0 ? (
          <div className={styles.addRow} data-cake-add-back="">
            <Plus aria-hidden className="h-4 w-4" />
            <span>Add an option</span>
            <span className={styles.addChips}>
              {removed.map((r) => (
                <button key={r.key} type="button" className={styles.pill} onClick={() => addBack(r.key)}>
                  {r.label}
                </button>
              ))}
            </span>
          </div>
        ) : null}
      </div>
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
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sl} data-cake-part={id} data-open={open ? '' : undefined}>
      <SwipeToDelete label={`Remove ${title}`} word="Remove" onDelete={(close) => (close(), onRemove())} radiusClass="rounded-none" surfaceClass="bg-[color:var(--cake-s-bg)]">
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
      </SwipeToDelete>
      {open ? <div className={styles.so}>{children}</div> : null}
    </div>
  );
}

/* ── Tiers ─────────────────────────────────────────────────────────────── */

function TiersBody({ cake, onChange }: { cake: CakeOptions; onChange: (t: CakeOptions['tiers']) => void }) {
  const t = cake.tiers;
  const made = new Set(t.made);
  const toggle = (n: number) => {
    const next = made.has(n) ? t.made.filter((x) => x !== n) : [...t.made, n].sort((a, b) => a - b);
    if (next.length === 0) return;
    onChange({ ...t, made: next, standard: next.includes(t.standard) ? t.standard : next[0]! });
  };
  return (
    <>
      <p className={styles.ol}>Sizes you make</p>
      <div className={styles.ccs} role="group" aria-label="Sizes you make">
        {Array.from({ length: CAKE_MAX_TIERS }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-pressed={made.has(n)} className={styles.cc} onClick={() => toggle(n)}>
            <b>{n}</b>
          </button>
        ))}
      </div>
      <p className={styles.ol}>In the price · extras</p>
      <div className={`${styles.frame} ${styles.in}`}>
        {[...t.made]
          .sort((a, b) => a - b)
          .map((n) => (
            <div key={n} className={styles.or}>
              <button type="button" className={styles.on} onClick={() => onChange({ ...t, standard: n, extraCentavos: { ...t.extraCentavos, [String(n)]: 0 } })} aria-label={`Make ${tierLabel(n)} the size in the price`}>
                {tierLabel(n)}
              </button>
              <span className={styles.ov}>
                {n === t.standard ? (
                  <span className={`${styles.chip} ${styles.info}`}>
                    <i aria-hidden />
                    Standard
                  </span>
                ) : (
                  <Amount
                    label={`Extra for ${tierLabel(n)}`}
                    centavos={t.extraCentavos[String(n)] ?? 0}
                    onChange={(c) => onChange({ ...t, extraCentavos: { ...t.extraCentavos, [String(n)]: c } })}
                  />
                )}
              </span>
            </div>
          ))}
      </div>
      <p className={styles.onote}>
        <Info aria-hidden className="h-3.5 w-3.5 flex-none" />
        An extra can’t go below ₱0, so a size smaller than the one in the price costs the one price. Tap a size to put it in the price.
      </p>
    </>
  );
}

/* ── a list of choices (Flavour · Finish · Design · Topper) ────────────── */

function ChoiceList({
  list,
  kind,
  perTier = false,
  serviceId = null,
  onChange,
}: {
  list: CakeChoice[];
  kind: ListKey;
  perTier?: boolean;
  serviceId?: string | null;
  onChange: (next: CakeChoice[]) => void;
}) {
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const names = LIST_NAME[kind];
  const set = (ref: string, over: Partial<CakeChoice>) => onChange(list.map((c) => (c.ref === ref ? { ...c, ...over } : c)));
  const makeStandard = (ref: string) => onChange(list.map((c) => ({ ...c, standard: c.ref === ref, extraCentavos: c.ref === ref ? 0 : c.extraCentavos })));
  const remove = (ref: string) => {
    const before = list;
    const gone = list.find((c) => c.ref === ref);
    let next = list.filter((c) => c.ref !== ref);
    if (gone?.standard && next[0]) next = next.map((c, i) => (i === 0 ? { ...c, standard: true, extraCentavos: 0 } : c));
    onChange(next);
    pushUndo({ label: `${gone?.label || names.title} removed`, undo: async () => onChange(before) });
  };
  return (
    <div className={`${styles.frame} ${styles.in}`} data-cake-list={kind}>
      {kind === 'design' ? (
        <div className={styles.designs}>
          {list.map((c) => (
            <SwipeToDelete key={c.ref} label={`Remove ${c.label || 'this design'}`} word="Remove" onDelete={(close) => (close(), remove(c.ref))} radiusClass="rounded-xl" surfaceClass="bg-[color:var(--cake-s-bg)]">
              <div className={styles.design}>
                <button type="button" className={styles.photo} onClick={() => setPhotoFor(c.ref)} aria-label={`Pick a photo for ${c.label || 'this design'}`}>
                  {c.photoUrl ? <img src={c.photoUrl} alt="" /> : <ImagePlus aria-hidden className="h-5 w-5" />}
                </button>
                <ChoiceRow c={c} perTier={false} names={names} onSet={set} onStandard={makeStandard} />
              </div>
            </SwipeToDelete>
          ))}
          <p className={styles.onote}>From your portfolio — tap a photo to change it.</p>
        </div>
      ) : (
        list.map((c) => (
          <SwipeToDelete key={c.ref} label={`Remove ${c.label || `this ${names.one}`}`} word="Remove" onDelete={(close) => (close(), remove(c.ref))} radiusClass="rounded-none" surfaceClass="bg-[color:var(--cake-s-bg)]">
            <ChoiceRow c={c} perTier={perTier} names={names} onSet={set} onStandard={makeStandard} />
          </SwipeToDelete>
        ))
      )}
      <button
        type="button"
        className={styles.addRow}
        onClick={() => onChange([...list, { ref: newRef(kind), label: '', extraCentavos: 0, standard: list.length === 0 }])}
      >
        <Plus aria-hidden className="h-4 w-4" />
        <span>{names.add}</span>
      </button>
      {photoFor ? (
        <PortfolioSheet
          serviceId={serviceId}
          onClose={() => setPhotoFor(null)}
          onPick={(ref, url) => {
            set(photoFor, { photoRef: ref, photoUrl: url });
            setPhotoFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ChoiceRow({
  c,
  perTier,
  names,
  onSet,
  onStandard,
}: {
  c: CakeChoice;
  perTier: boolean;
  names: { one: string };
  onSet: (ref: string, over: Partial<CakeChoice>) => void;
  onStandard: (ref: string) => void;
}) {
  return (
    <div className={styles.or}>
      <input
        className={styles.name}
        value={c.label}
        maxLength={CAKE_LABEL_MAX}
        placeholder={`Name this ${names.one}`}
        aria-label={`Name of this ${names.one}`}
        onChange={(e) => onSet(c.ref, { label: e.target.value })}
      />
      <span className={styles.ov}>
        {c.standard ? (
          <span className={`${styles.chip} ${styles.info}`}>
            <i aria-hidden />
            Standard
          </span>
        ) : (
          <>
            <Amount label={`Extra for ${c.label || `this ${names.one}`}`} centavos={c.extraCentavos} onChange={(v) => onSet(c.ref, { extraCentavos: v })} />
            {perTier && c.extraCentavos > 0 ? <small className={styles.per}>a tier</small> : null}
            <button type="button" className={styles.mk} onClick={() => onStandard(c.ref)}>
              Make standard
            </button>
          </>
        )}
      </span>
    </div>
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
      <Stepper name="Couples pick" prefix="1 to" value={colours.max} min={1} max={CAKE_COLOURS_MAX} onChange={(max) => onChange({ ...colours, max })} />
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
          <input
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

/* ── small parts ───────────────────────────────────────────────────────── */

function Amount({ label, centavos, onChange }: { label: string; centavos: number; onChange: (c: number) => void }) {
  return (
    <label className={styles.amt}>
      <span aria-hidden>+ ₱</span>
      <input
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
  name,
  prefix,
  value,
  min,
  max,
  unit,
  step = 1,
  onChange,
}: {
  name: string;
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
      <span className={styles.stepName}>{name}</span>
      <button type="button" aria-label={`Fewer — ${name}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <b>
        {prefix ? `${prefix} ` : ''}
        {formatCount(value)}
        {unit ? ` ${unit}` : ''}
      </b>
      <button type="button" aria-label={`More — ${name}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

/** "From your portfolio" — the shop's own photos (ruling 4). A refused read says so; it is never an empty portfolio. */
function PortfolioSheet({ serviceId, onClose, onPick }: { serviceId: string | null; onClose: () => void; onPick: (ref: string, url: string) => void }) {
  const [read, setRead] = useState<{ at: 'loading' } | { at: 'failed' } | { at: 'ok'; photos: { ref: string; url: string }[] }>({ at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void cakeAction({ op: 'portfolio', serviceId })
      .then((r) => setRead(r.ok && r.op === 'portfolio' ? { at: 'ok', photos: r.photos } : { at: 'failed' }))
      .catch(() => setRead({ at: 'failed' }));
  }, [serviceId]);
  useEffect(load, [load]);
  const headId = useId();
  return (
    <Sheet open onClose={onClose} labelledById={headId} title="From your portfolio">
      {read.at === 'loading' ? (
        <div className={styles.grid} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={styles.ghost} />
          ))}
        </div>
      ) : read.at === 'failed' ? (
        <div role="alert" className="grid gap-2 py-2">
          <p className={styles.failTitle}>Couldn’t load your portfolio</p>
          <p className={styles.failLine}>Your photos are safe; only this read failed.</p>
          <button type="button" className={styles.pill} onClick={load}>
            Try again
          </button>
        </div>
      ) : read.photos.length === 0 ? (
        <p className={styles.failLine}>No photos in your portfolio yet — add some in Portfolio, then pick one here.</p>
      ) : (
        <div className={styles.grid}>
          {read.photos.map((p) => (
            <button key={p.ref} type="button" className={styles.pick} onClick={() => onPick(p.ref, p.url)}>
              <img src={p.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
