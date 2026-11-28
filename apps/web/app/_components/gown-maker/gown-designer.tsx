'use client';

/**
 * 👗 The bride's gown maker (prototype v210 phone flow): the stage on top, one step at a time below it.
 *
 * - Measurements in the owner's order: Height, Weight, Body shape, Bust, Waist, Hips. Then she is asked "Fine-tune?".
 *   Yes adds Bust position, Underbust, Shoulders, Arm length, Leg length, Elevation and What matters to her, each with
 *   Skip in the bottom row (v202) that puts back what she changed on the step.
 * - Each step opens on its own close-up, measured on her live body (v204), and holds it for the whole step.
 * - Then the design steps (v210 `RECIPE`): Your colours, Silhouette, Fabric, Colour, and on through the parts. A pick
 *   follows the pairing rules and says what else changed. A design step's close-up holds a moment, then eases out.
 * - Undo steps back through her last changes. Units: cm or inches (and kg or lb).
 * - The double-check note is a small card on top of the stage; she can close it.
 *
 * House pieces only: ActionButton, PickMenu, PillSelector, Slider, SwitchRow, `.sn-frame`. No price is ever here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, SkipForward, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PillSelector } from '@/app/_components/pill-selector';
import { Slider } from '@/app/_components/slider';
import { SwitchRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GownView } from '@/app/_components/plan3d/kit/gown-view';
import type { GownSolved } from '@/app/_components/plan3d/kit/gown-figure-3d';
import type { GownFocusAsk } from '@/app/_components/plan3d/kit/gown-focus';
import { GownStageButtons } from './stage-buttons';
import {
  GOWN_BODY_RANGE, GOWN_BODY_SHAPES, GOWN_BUST_POSITIONS, GOWN_COLOUR_FAMILIES, GOWN_MATTERS, GOWN_PALETTE_MAX,
  type GownBody, type GownBodyKey, type GownConfig, type GownColourFamily, type GownMatter,
} from '@/lib/gown-config';
import { GOWN_HEEL_STOPS, gownBustPosition, gownDoubleCheck, gownLimit, gownScaleToWeight, gownSetNumber, gownShapeAtWeight, gownSnapBustT, gownSnapHeel } from '@/lib/gown/body-rules';
import { gownChoose, type GownChoice } from '@/lib/gown/compat';
import {
  gownDesignSteps, gownMeasSteps, gownPickOptions, gownRemember, gownSayHeight, gownSayLength, gownSayWeight, gownSkipStep, gownSnapStep,
  type GownMoment, type GownStepSnap, type GownUnits,
} from '@/lib/gown/flow';
import type { GownPoseName } from '@/lib/gown/motion/poses';
import type { GownMotionKind } from '@/lib/gown/motion/walks';
import type { GownTurnStyle, GownTwirlStyle } from '@/lib/gown/motion/turn';
import { formatCount } from '@/lib/format-number';
import css from './gown-designer.module.css';

export type GownDesignerState = { config: GownConfig; body: GownBody };
export type GownDesignerProps = {
  /** Where she starts: a fresh design, the bride's attire pick, or a design she saved. */
  seed: GownDesignerState;
  /** The fabric types this shop works in (the Fabric step lists only these). */
  fabrics: readonly { id: string; label: string }[];
  /** Every change, for the send (A10) to read. */
  onChange?: (s: GownDesignerState) => void;
  /** The last design step's Next. Left out, the last step has no Next. */
  onDone?: () => void;
};

type Tab = 'meas' | 'design';
const GIRTHS = ['bust', 'waist', 'hips', 'underbust', 'shoulders'] as const;

export function GownDesigner({ seed, fabrics, onChange, onDone }: GownDesignerProps) {
  const [config, setConfig] = useState(seed.config);
  const [body, setBody] = useState(seed.body);
  const [tab, setTab] = useState<Tab>('meas');
  const [fineOn, setFineOn] = useState(false);
  const [mi, setMi] = useState(0);
  const [di, setDi] = useState(0);
  const [units, setUnits] = useState<GownUnits>({ len: 'cm', mass: 'kg' });
  const [undo, setUndo] = useState<GownMoment[]>([]);
  const [hipWant, setHipWant] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [solved, setSolved] = useState<GownSolved | null>(null);
  const [shut, setShut] = useState('');
  const [focus, setFocus] = useState<GownFocusAsk | null>(null);
  const [pose, setPose] = useState<GownPoseName>('a');
  const [motion, setMotion] = useState<GownMotionKind | 'stop'>('stop');
  const [twirl, setTwirl] = useState<{ n: number; style: GownTwirlStyle }>({ n: 0, style: 'classic' });
  const [autoTurn, setAutoTurn] = useState<{ speed: number; style: GownTurnStyle }>({ speed: 0, style: 'spin' });
  const snap = useRef<{ i: number; s: GownStepSnap } | null>(null);
  const focusN = useRef(0);

  const msSteps = useMemo(() => gownMeasSteps(fineOn), [fineOn]);
  const dsSteps = useMemo(() => gownDesignSteps(config), [config]);
  const ms = msSteps[Math.min(mi, msSteps.length - 1)]!;
  const ds = dsSteps[Math.min(di, dsSteps.length - 1)]!;
  const steps = tab === 'meas' ? msSteps : dsSteps, at = tab === 'meas' ? Math.min(mi, msSteps.length - 1) : Math.min(di, dsSteps.length - 1);

  useEffect(() => { onChange?.({ config, body }); }, [config, body, onChange]);
  // Each step opens on its own close-up: a measurement step holds it for the whole step (v204).
  const stepKey = tab === 'meas' ? `m:${ms.id}` : `d:${ds.id}`;
  useEffect(() => {
    focusN.current++;
    setFocus({ key: tab === 'meas' ? ms.focus : ds.focus, n: focusN.current, stay: tab === 'meas' });
    setNote('');
    // A fine step remembers what she arrived with, for Skip.
    if (tab === 'meas' && ms.fine) { if (!snap.current || snap.current.i !== mi) snap.current = { i: mi, s: gownSnapStep(body, config.heel) }; } else snap.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new step, not each change on it
  }, [stepKey]);

  const remember = () => setUndo((u) => gownRemember(u, { config, body, heel: config.heel }));
  const doUndo = () => {
    const last = undo[undo.length - 1];
    if (!last) return;
    setUndo(undo.slice(0, -1));
    setConfig(last.config);
    setBody(last.body);
  };

  // ─── her numbers ───
  const setNum = (k: GownBodyKey, v: number) => {
    remember();
    const r = gownSetNumber(body.vals, body.given, k, v, hipWant);
    setBody({ ...body, vals: r.vals, given: r.given });
    setHipWant(r.hipWant);
    setNote(r.note);
  };
  const setWeight = (kg: number) => {
    remember();
    setBody({ ...body, vals: gownScaleToWeight(body.vals, body.given, kg), given: body.given.includes('weight') ? body.given : [...body.given, 'weight'] });
  };
  const setShape = (shape: GownBody['shape']) => {
    remember();
    setBody({ ...body, shape, vals: { ...body.vals, ...gownShapeAtWeight(body.vals, shape, solved?.kg || body.vals.weight) } });
  };
  const say = (k: GownBodyKey, v: number) => (k === 'height' ? gownSayHeight(v, units) : k === 'weight' ? gownSayWeight(v, units) : k === 'arm' || k === 'leg' ? `${Math.round(v * 100)} %` : gownSayLength(v, units));
  const range = (k: GownBodyKey): [number, number] => (GIRTHS as readonly string[]).includes(k) || k === 'weight' ? gownLimit(body.vals, k) : [GOWN_BODY_RANGE[k][0], GOWN_BODY_RANGE[k][1]];
  const stepOf = (k: GownBodyKey) => (k === 'height' || k === 'weight' ? 1 : k === 'arm' || k === 'leg' ? 0.01 : 0.5);
  const numberRow = (k: GownBodyKey, label: string) => {
    const [lo, hi] = range(k), v = body.vals[k], st = stepOf(k), set = k === 'weight' ? setWeight : (x: number) => setNum(k, x);
    return (
      <div className={css.row} data-gown-number={k}>
        <ActionButton tone="neutral" icon={Minus} label={`Less ${label.toLowerCase()}`} iconOnly onClick={() => set(Math.max(lo, v - st))} disabled={v <= lo} />
        <Slider label={label} value={v} min={lo} max={hi} step={st} onChange={set} valueText={say(k, v)} />
        <ActionButton tone="neutral" icon={Plus} label={`More ${label.toLowerCase()}`} iconOnly onClick={() => set(Math.min(hi, v + st))} disabled={v >= hi} />
        <output className={css.value}>{say(k, v)}</output>
      </div>
    );
  };

  // ─── the design ───
  const choose = (c: GownChoice) => {
    remember();
    const r = gownChoose(config, c);
    setConfig(r.config);
    setNote(r.notes.join(' '));
  };

  const measBody = () => {
    switch (ms.id) {
      case 'height': case 'weight': case 'bust': case 'waist': case 'hips': case 'underbust': case 'shoulders': case 'arm': case 'leg':
        return numberRow(ms.id, ms.label);
      case 'shape':
        return (
          <>
            <PickMenu label="Body shape" value={body.shape} options={GOWN_BODY_SHAPES.map((s) => ({ key: s.id, label: s.label }))} onPick={(v) => setShape(v as GownBody['shape'])} dataAttr="data-gown-pick-shape" className="w-full !min-h-11" />
            <SwitchRow name="Athletic build" about={{ words: 'Muscle weighs more than the tape shows.' }} on={body.athletic} onChange={(on) => { remember(); setBody({ ...body, athletic: on }); }} data="gown-athletic" />
          </>
        );
      case 'fineAsk':
        return (
          <div className="grid gap-3">
            <p className="text-sn-14">Fine-tune her proportions? Bust position, underbust, shoulders, arms, legs and shoes.</p>
            <div className={css.row}>
              <ActionButton tone="brand" main icon={ChevronRight} label="Yes, fine-tune" onClick={() => { setFineOn(true); setMi(gownMeasSteps(true).findIndex((s) => s.fine)); }} />
              <ActionButton tone="neutral" quiet icon={SkipForward} label="No, go to the design" onClick={() => setTab('design')} />
            </div>
          </div>
        );
      case 'bustPos':
        return (
          <>
            <Slider label="Bust position" value={body.bustT} min={-1} max={1} step={0.02} from="centre" onChange={(t) => { remember(); const s = gownSnapBustT(t); setBody({ ...body, bustT: s, bustPos: gownBustPosition(s) }); }} valueText={GOWN_BUST_POSITIONS.find((p) => p.id === body.bustPos)!.label} />
            <output className={css.value}>{GOWN_BUST_POSITIONS.find((p) => p.id === body.bustPos)!.label}</output>
          </>
        );
      case 'heel':
        return (
          <div className={css.row}>
            <Slider label="Elevation" value={config.heel} min={GOWN_HEEL_STOPS[0]} max={GOWN_HEEL_STOPS[GOWN_HEEL_STOPS.length - 1]!} step={0.5} onChange={(cm) => { remember(); setConfig({ ...config, heel: gownSnapHeel(cm) }); }} valueText={gownSayLength(config.heel, units)} />
            <output className={css.value}>{config.heel ? gownSayLength(config.heel, units) : 'Flat'}</output>
          </div>
        );
      case 'whatMatters':
        return (
          <PillSelector label="What matters to her" slide={false} value={body.matters} options={GOWN_MATTERS.map((m) => ({ key: m.id, label: m.label }))}
            onPick={(k: GownMatter) => { remember(); setBody({ ...body, matters: body.matters.includes(k) ? body.matters.filter((x) => x !== k) : [...body.matters, k] }); }} data="gown-matters" />
        );
    }
  };

  const designBody = () => {
    if (ds.id === 'palette') {
      return (
        <PillSelector label="Your colours" slide={false} value={config.palette} options={GOWN_COLOUR_FAMILIES.map((f) => ({ key: f.id, label: f.label }))}
          onPick={(k: GownColourFamily) => { const on = config.palette.includes(k); if (!on && config.palette.length >= GOWN_PALETTE_MAX) { setNote(`Up to ${GOWN_PALETTE_MAX} colour families.`); return; } remember(); setConfig({ ...config, palette: on ? config.palette.filter((x) => x !== k) : [...config.palette, k] }); }} data="gown-palette" />
      );
    }
    if (ds.id === 'fabric') {
      return <PickMenu label="Fabric" value={config.fabric} options={fabrics.map((f) => ({ key: f.id, label: f.label }))} onPick={(v) => choose({ key: 'fabric', value: v })} dataAttr="data-gown-pick-fabric" className="w-full !min-h-11" />;
    }
    return ds.picks.filter((p) => !p.when || p.when(config)).map((p) => (
      <PickMenu key={String(p.key)} label={p.label} value={String(config[p.key] ?? '')} options={gownPickOptions(p, config).map((o) => ({ key: o.id, label: o.label }))}
        onPick={(v) => choose({ key: p.key, value: v } as GownChoice)} dataAttr={`data-gown-pick-${String(p.key).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`} className="w-full !min-h-11" />
    ));
  };

  // ─── the bottom row ───
  const last = at >= steps.length - 1;
  const back = () => { if (at > 0) { if (tab === 'meas') setMi(at - 1); else setDi(at - 1); } else if (tab === 'design') { setTab('meas'); setMi(msSteps.length - 1); } };
  const next = () => {
    if (tab === 'meas') { if (ms.id === 'fineAsk' || last) { setTab('design'); setDi(0); } else setMi(at + 1); return; }
    if (last) onDone?.(); else setDi(at + 1);
  };
  const skip = () => {
    if (snap.current) { const r = gownSkipStep(body, snap.current.s, ms.id); setBody(r.body); setConfig({ ...config, heel: r.heel }); }
    next();
  };
  const check = gownDoubleCheck(body.vals, body.given, solved ? { reached: solved.got, bodyKg: solved.kg } : {});
  const nextWord = tab === 'meas' ? (last || ms.id === 'fineAsk' ? 'Design' : msSteps[at + 1]!.label) : last ? 'Done' : dsSteps[at + 1]!.label;

  return (
    <div className={css.maker} data-gown-designer>
      <div className={css.stage}>
        <GownView fill vals={body.vals} fine={{ athletic: body.athletic, bustT: body.bustT, given: body.given }} design={tab === 'design' ? config : null} shape={tab === 'design' ? config.shape : undefined}
          onSolved={setSolved} pose={pose} motion={motion} twirl={twirl} autoTurn={autoTurn} focus={focus} />
        {check && check !== shut ? (
          <div className={`sn-frame ${css.check}`} role="status" data-gown-check>
            <p className="text-sn-13">{check}</p>
            <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close the note" onClick={() => setShut(check)} />
          </div>
        ) : null}
        <div className={css.stageButtons}>
          <GownStageButtons pose={pose} motion={motion} onPose={setPose} onMotion={setMotion} twirlStyle={twirl.style} onTwirlStyle={(style) => setTwirl((t) => ({ ...t, style }))}
            onTwirl={() => setTwirl((t) => ({ ...t, n: t.n + 1 }))} autoTurn={autoTurn} onAutoTurn={setAutoTurn} />
        </div>
      </div>
      <section className={`sn-frame ${css.panel}`} aria-labelledby="gown-step-name">
        <div className={css.row}>
          <PillSelector label="Part of the maker" value={tab} options={[{ key: 'meas', label: 'Measurements' }, { key: 'design', label: 'Design' }]} onPick={(k: Tab) => setTab(k)} data="gown-tab" />
          <ActionButton tone="neutral" quiet icon={Undo2} label="Undo" onClick={doUndo} disabled={!undo.length} />
        </div>
        <p className="text-sn-12 text-ink/70" data-gown-count>{`${tab === 'meas' ? 'Measurements' : 'Design'} · ${formatCount(at + 1)} of ${formatCount(steps.length)}`}</p>
        <h2 id="gown-step-name" className="text-sn-19">{tab === 'meas' ? ms.label : ds.label}</h2>
        <div className="grid gap-3" data-gown-step={tab === 'meas' ? ms.id : ds.id}>{tab === 'meas' ? measBody() : designBody()}</div>
        {note ? <p className="text-sn-13 text-ink/75" role="status">{note}</p> : null}
        {tab === 'meas' ? (
          <PillSelector label="Units" grow={false} value={units.len} options={[{ key: 'cm', label: 'cm · kg' }, { key: 'in', label: 'in · lb' }]} onPick={(k: 'cm' | 'in') => setUnits(k === 'cm' ? { len: 'cm', mass: 'kg' } : { len: 'in', mass: 'lb' })} data="gown-units" />
        ) : null}
        <nav className={css.nav} aria-label="Steps">
          <ActionButton tone="neutral" iconOnly icon={ChevronLeft} label="Back" onClick={back} disabled={tab === 'meas' && at === 0} />
          {tab === 'meas' && ms.fine ? <ActionButton tone="neutral" quiet icon={SkipForward} label="Skip" onClick={skip} data-gown-skip="" /> : null}
          {ms.id === 'fineAsk' && tab === 'meas' ? null : tab === 'design' && last && !onDone ? null : (
            <ActionButton tone="brand" main icon={ChevronRight} label={`Next: ${nextWord}`} onClick={next} data-gown-next="" />
          )}
        </nav>
      </section>
    </div>
  );
}
