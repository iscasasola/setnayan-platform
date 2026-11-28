'use client';

/**
 * 👗 Place by hand (A7b; prototype v202, the owner's v194 four tools): Beads · Lace · Scissors · Eraser. Picking a tool
 * turns drawing on, tapping it again (or Done) turns it off; only the settings that tool uses are shown, with one plain
 * line. Mirror draws both sides and rubs out both sides. Undo steps back; Clear asks first, and Undo brings it back.
 * Everything placed is her hand work (`GownHand`), kept BESIDE the design (a design is held to 8 KB), and goes to the
 * designer with it.
 *
 * Loaded on its own (the maker imports it lazily), so the first load of the maker does not carry it.
 * The edits are the engine's (`lib/gown/parts/hand.ts`); the stage only reports where a finger touches the gown.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, Gem, Flower2, Scissors, Trash2, Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PillSelector } from '@/app/_components/pill-selector';
import { Slider, SLIDER_VALUE } from '@/app/_components/slider';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { GownConfig, GownHand } from '@/lib/gown-config';
import {
  GOWN_HAND_BRUSH, gownHandClear, gownHandStrokeEnd, gownHandStrokeMove, gownHandStrokeStart,
  type GownHandBrush, type GownHandStroke, type GownHandTool,
} from '@/lib/gown/parts/hand';
import type { GownHandCtx, GownHandInput } from '@/app/_components/plan3d/kit/gown-figure-3d';

type Hand = GownHand;
const handOf = (d: GownHand): Hand => ({ handBeads: d.handBeads, handHoles: d.handHoles, handLace: d.handLace, handCuts: d.handCuts });

/** The four tools, as v194 words them. */
export const GOWN_HAND_TOOLS: readonly { id: GownHandTool; label: string; icon: typeof Gem }[] = [
  { id: 'beads', label: 'Beads', icon: Gem },
  { id: 'lace', label: 'Lace', icon: Flower2 },
  { id: 'cut', label: 'Scissors', icon: Scissors },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
];
/** One plain line for each tool (v202 `TIP`). */
export const GOWN_HAND_TIP: Record<GownHandTool, string | Record<'line' | 'scatter', string>> = {
  beads: { line: 'Beads follow the line you draw. Tap once for a single bead.', scatter: 'Each dab sprinkles beads inside the brush width.' },
  lace: { line: 'Lace motifs follow the line you draw. Tap once for a single motif.', scatter: 'Each dab sprinkles lace motifs inside the brush width.' },
  cut: 'Draw all the way round the part to take out, or tap for a round hole. Cutting opens the fabric to show her skin or the lining.',
  eraser: 'Pick what it rubs out. It also clears ready-made beads and lace under it.',
};
const ERASES = [
  { key: 'all', label: 'Everything' },
  { key: 'beads', label: 'Beads' },
  { key: 'lace', label: 'Lace' },
  { key: 'cuts', label: 'Cuts' },
] as const;
const UNDO_MAX = 40;

/** Phones (and the phone layout) say fingers (v202's own test). */
const PHONE_QUERY = '(pointer: coarse), (max-width: 899px)';

export function GownHandTools({ design, hand, onHand, onInput }: {
  /** The design: which bead and lace the tools place. Never changed here. */
  design: GownConfig;
  /** Her hand work, and where an edit to it goes. */
  hand: GownHand;
  onHand: (next: GownHand) => void;
  /** What the stage needs while a tool is picked (null when drawing is off). */
  onInput: (input: GownHandInput | null) => void;
}) {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(PHONE_QUERY), on = () => setPhone(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  const [brush, setBrush] = useState<Omit<GownHandBrush, 'tool'> & { tool: GownHandTool | null }>({ ...GOWN_HAND_BRUSH, tool: null });
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [undo, setUndo] = useState<Hand[]>([]);
  // The stroke and the newest design live in refs: a stroke is many pointer moves between two renders.
  const work = useMemo(() => ({ ...design, ...hand }), [design, hand]);
  const live = useRef({ design: work, stroke: null as GownHandStroke | null, before: null as Hand | null });
  live.current.design = work;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const remember = useCallback((h: Hand) => setUndo((u) => [...u.slice(-(UNDO_MAX - 1)), h]), []);

  const onHit = useCallback((phase: 'down' | 'move' | 'up' | 'cancel', hit: { ph: number; y: number; r: number } | null, moved: boolean, ctx: GownHandCtx) => {
    const b = brushRef.current, L = live.current;
    if (!b.tool) return;
    const tool = b.tool, full = { ...b, tool }, c = { ...ctx, rnd: Math.random };
    if (phase === 'down' && hit) { L.stroke = gownHandStrokeStart(hit, tool); L.before = handOf(L.design); return; }
    if (!L.stroke) return;
    if (phase === 'cancel') { L.stroke = null; L.before = null; return; }
    let next = L.design, msg = '';
    if (phase === 'move' && hit) {
      const r = gownHandStrokeMove(L.design, L.stroke, hit, moved, full, c);
      L.stroke = r.stroke; next = r.config; msg = r.note;
    } else if (phase === 'up') {
      const r = gownHandStrokeEnd(L.design, L.stroke, full, c);
      next = r.config; msg = r.note;
      const before = L.before;
      L.stroke = null; L.before = null;
      if (before && JSON.stringify(before) !== JSON.stringify(handOf(next))) remember(before);
    }
    if (msg) setNote(msg);
    if (next !== L.design) { L.design = next; onHand(handOf(next)); }
  }, [onHand, remember]);

  const input = useMemo<GownHandInput | null>(() => (brush.tool ? { tool: brush.tool, onHit } : null), [brush.tool, onHit]);
  useEffect(() => { onInput(input); }, [input, onInput]);
  useEffect(() => () => onInput(null), [onInput]);

  const t = brush.tool, drawsLine = (t === 'beads' || t === 'lace') && brush.stroke === 'line';
  const tip = t ? (typeof GOWN_HAND_TIP[t] === 'string' ? GOWN_HAND_TIP[t] : GOWN_HAND_TIP[t][brush.stroke]) : '';
  const set = (p: Partial<GownHandBrush>) => setBrush((b) => ({ ...b, ...p }));
  const placed = hand.handBeads.length + hand.handLace.length + hand.handCuts.length + hand.handHoles.length;

  return (
    <section className="grid gap-3" aria-label="Place by hand" data-gown-hand>
      <p className="text-sn-13">Pick a tool and draw on the gown; tap once to place a single piece. Everything you place goes to the designer.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Hand tool">
        {GOWN_HAND_TOOLS.map((x) => (
          <ActionButton key={x.id} tone="brand" icon={x.icon} label={x.label} aria-pressed={t === x.id} filled={t === x.id} onClick={() => { setNote(''); setBrush((b) => ({ ...b, tool: b.tool === x.id ? null : x.id })); }} data-gown-hand-tool={x.id} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sn-12" aria-live="polite" data-gown-hand-how>{!t ? 'Pick a tool, then draw on the gown.' : phone ? 'One finger draws · two fingers turn her' : 'Drag on the gown to draw · right-drag turns her'}</p>
        {t ? <ActionButton tone="ok" icon={Check} label="Done" onClick={() => setBrush((b) => ({ ...b, tool: null }))} data-gown-hand-done="" /> : null}
      </div>
      {t ? (
        <div className="grid gap-3" data-gown-hand-settings>
          <p className="text-sn-12">{tip}</p>
          {t === 'beads' || t === 'lace' ? (
            <PillSelector label="How to place" value={brush.stroke} options={[{ key: 'line', label: 'Line' }, { key: 'scatter', label: 'Scatter' }]} onPick={(k) => set({ stroke: k })} data="gown-hand-stroke" />
          ) : null}
          {t === 'eraser' ? (
            <PickMenu label="What the eraser removes" value={brush.what} options={ERASES.map((o) => ({ key: o.key, label: o.label }))} onPick={(k) => set({ what: k as GownHandBrush['what'] })} dataAttr="data-gown-hand-what" className="w-full !min-h-11" />
          ) : null}
          {drawsLine ? (
            <label className="flex items-center gap-3 text-sn-13">
              <span className="w-28 shrink-0">Spacing</span>
              <Slider label="Spacing" value={brush.gap} min={0} max={5} step={0.1} onChange={(v) => set({ gap: v })} valueText={`${Math.round(brush.gap * 10)} mm`} data="gown-hand-gap" />
              <output className={SLIDER_VALUE}>{Math.round(brush.gap * 10)} mm</output>
            </label>
          ) : (
            <label className="flex items-center gap-3 text-sn-13">
              <span className="w-28 shrink-0">{t === 'eraser' ? 'Eraser width' : t === 'cut' ? 'Hole size' : 'Brush width'}</span>
              <Slider label={t === 'eraser' ? 'Eraser width' : t === 'cut' ? 'Hole size' : 'Brush width'} value={brush.cm} min={1} max={15} step={0.5} onChange={(v) => set({ cm: v })} valueText={`${brush.cm} cm`} data="gown-hand-size" />
              <output className={SLIDER_VALUE}>{brush.cm} cm</output>
            </label>
          )}
          {(t === 'beads' || t === 'lace') && brush.stroke === 'scatter' ? (
            <label className="flex items-center gap-3 text-sn-13">
              <span className="w-28 shrink-0">Amount</span>
              <Slider label="Amount" value={brush.qty} min={1} max={30} step={1} onChange={(v) => set({ qty: v })} valueText={`${brush.qty} per dab`} data="gown-hand-qty" />
              <output className={SLIDER_VALUE}>{brush.qty} per dab</output>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" role="switch" aria-checked={brush.mirror} className={`${SWITCH_BUTTON} gap-3 px-1 text-sn-13`} onClick={() => set({ mirror: !brush.mirror })} data-gown-hand-mirror="">
          <span>Mirror both sides</span>
          <SwitchTrack on={brush.mirror} />
        </button>
        <ActionButton tone="neutral" icon={Undo2} label="Undo" waiting={!undo.length} onClick={() => { const last = undo.at(-1); if (!last) return; setUndo((u) => u.slice(0, -1)); setNote(''); onHand(last); }} data-gown-hand-undo="" />
      </div>
      {placed ? (
        asking ? (
          <div className="grid gap-2" data-gown-hand-ask>
            <p className="text-sn-13">Remove every bead, lace piece and cut you placed by hand?</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="danger" icon={Trash2} label="Yes, clear all" onClick={() => { remember(handOf(hand)); onHand(handOf(gownHandClear(work))); setAsking(false); setNote('Hand work cleared. Undo brings it back.'); }} data-gown-hand-clear-yes="" />
              <ActionButton tone="neutral" icon={Check} label="Keep it" onClick={() => setAsking(false)} data-gown-hand-clear-no="" />
            </div>
          </div>
        ) : (
          <ActionButton tone="neutral" quiet icon={Trash2} label="Clear all hand work" onClick={() => setAsking(true)} data-gown-hand-clear="" />
        )
      ) : null}
      <p className="text-sn-12" aria-live="polite" data-gown-hand-note>{note}</p>
      <p className="text-sn-12" data-gown-hand-count>
        {hand.handBeads.length || hand.handLace.length || hand.handCuts.length
          ? `Placed by hand: ${hand.handBeads.length} beads, ${hand.handLace.length * 2} lace motifs, ${hand.handCuts.length} cuts. Added to the designer's count.`
          : ''}
      </p>
    </section>
  );
}
