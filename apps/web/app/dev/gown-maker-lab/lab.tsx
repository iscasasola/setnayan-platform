'use client';

/** The Gown Maker lab's body (see page.lab.tsx). Fixture numbers only: a SAMPLE body, never a person's. */
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import {
  GOWN_BACKS,
  GOWN_BODY_RANGE,
  GOWN_CAPES,
  GOWN_CLOSURES,
  GOWN_SLEEVES,
  GOWN_VEILS,
  GOWN_BONE_SHOWS,
  GOWN_BONING,
  GOWN_ILLUSIONS,
  GOWN_ILLUSION_BACKS,
  GOWN_ILLUSION_COLOURS,
  GOWN_ILLUSION_CUPS,
  GOWN_PLUNGE_FILLS,
  GOWN_BEAD_COLOURS,
  GOWN_BEAD_DENSITIES,
  GOWN_BEAD_PLACES,
  GOWN_BEADS,
  GOWN_FLOWERS,
  GOWN_FLOWER_FROM,
  GOWN_FLOWER_TYPES,
  GOWN_FLOWER_SIZES,
  GOWN_FLOWER_DENSITIES,
  GOWN_FLOWER_COLOURS,
  GOWN_CAPE_FLOWERS,
  GOWN_LACE_FINISHES,
  GOWN_VEIL_FABRICS,
  GOWN_PEARLS,
  GOWN_STRAPS,
  GOWN_STRAP_COLOURS,
  GOWN_STRAP_EDGES,
  GOWN_TOP_EDGES,
  GOWN_CAPE_COLOURS,
  GOWN_CAPE_EDGES,
  GOWN_CAPE_FABRICS,
  GOWN_CAPE_FASTENINGS,
  GOWN_CAPE_LENGTHS,
  gownCapeNow,
  GOWN_VEIL_ORDER,
  GOWN_BLUSHERS,
  GOWN_BOWS,
  GOWN_VEIL_STYLES,
  GOWN_COLOURS,
  GOWN_HEMS,
  GOWN_CUTOUTS,
  GOWN_DARTS,
  GOWN_DRAPES,
  GOWN_PIECES,
  GOWN_TEXTURES,
  GOWN_TEXTURE_DIRECTIONS,
  GOWN_TEXTURE_PLACES,
  GOWN_TRIMS,
  GOWN_WAISTLINES,
  GOWN_CUT_EDGES,
  GOWN_CUT_FILLS,
  GOWN_CUT_FORBIDDEN,
  GOWN_LACES,
  GOWN_LACE_COLOURS,
  GOWN_LACE_PLACES,
  GOWN_NECKLINES,
  GOWN_OVERLAYS,
  GOWN_OVERLAY_FABRICS,
  GOWN_SILHOUETTES,
  GOWN_STEP_LABELS,
  GOWN_STOCK_FABRICS,
  GOWN_TRAINS,
  startingGownBody,
  startingGownConfig,
  type GownBodyKey,
  type GownBodyVals,
  type GownConfig,
} from '@/lib/gown-config';
import { gownChoose, gownHiddenChoices, type GownChoice } from '@/lib/gown/compat';
import { gownBraNote, gownLimit, gownSetNumber, gownSnapBustT } from '@/lib/gown/body-rules';
import { GOWN_SCENES, GOWN_SCENE_IDS, type GownSceneId } from '@/lib/gown/scenes';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GownView } from '@/app/_components/plan3d/kit/gown-view';
import type { GownHandInput, GownSolved } from '@/app/_components/plan3d/kit/gown-figure-3d';

// A7b: the hand tools and the lace designer are their own chunks, loaded when shown.
const GownHandTools = dynamic(() => import('@/app/_components/gown-maker/hand-tools').then((m) => m.GownHandTools), { ssr: false });
const GownLaceDesigner = dynamic(() => import('@/app/_components/gown-maker/lace-designer').then((m) => m.GownLaceDesigner), { ssr: false });

const isScene = (s: string): s is GownSceneId => (GOWN_SCENE_IDS as readonly string[]).includes(s);
const SLIDERS: GownBodyKey[] = ['height', 'weight', 'bust', 'waist', 'hips', 'underbust'];
const STEP: Partial<Record<GownBodyKey, number>> = { height: 1, weight: 1 };

/** SAMPLE looks for the parts check (A6a): each made through the pairing rules' own outcome. */
const LAB_PARTS: { label: string; turn: number; look: Partial<GownConfig> }[] = [
  { label: 'Cap sleeves, cathedral veil', turn: 2.4, look: { sleeve: 'cap', neck: 'bateau', veil: 'cathedral' } },
  { label: 'Long sleeves, lace-up back', turn: Math.PI, look: { sleeve: 'long', neck: 'high', back: 'closed', closure: 'lace' } },
  { label: 'Filipiniana, butterfly sleeves', turn: 0.5, look: { sil: 'terno', sleeve: 'butterfly', neck: 'bateau' } },
  { label: 'Off-shoulder, mantilla', turn: 0.6, look: { neck: 'off', veil: 'chapel', veilStyle: 'mantilla' } },
];

/** SAMPLE gown for the Inside check (A6b): three layers (soft, full, organza), a blush lining and a corset. */
const LAB_INSIDE: GownConfig = {
  ...startingGownConfig(),
  petti: 'full',
  skirtLayers: 3,
  layerTypes: ['soft', 'full', 'organza', 'soft', 'soft', 'soft'],
  layerCols: ['match', 'blush', 'ivory', 'match', 'match', 'match'],
  liningCol: 'blush',
  shape: 'corset',
  boning: 'corset',
  waistStay: true,
};
const LAB_INSIDE_STAGES = ['Body shaping', 'Lining', 'Layer 2', 'See inside'] as const;

/** SAMPLE bodies for the silhouette check (v169: thin, default, severe at about 155 cm). */
const LAB_BODIES = {
  thin: { height: 155, bust: 70, underbust: 64, waist: 54, hips: 76 },
  default: { height: 155, bust: 84, underbust: 72, waist: 68, hips: 90 },
  severe: { height: 155, bust: 140, underbust: 116, waist: 130, hips: 150 },
} as const;

export default function GownMakerLab({ view, scene: sceneIn, guides, body: bodyIn }: { view: string; scene: string; guides: boolean; body: string }) {
  const scene: GownSceneId = isScene(sceneIn) ? sceneIn : 'studio';
  const [vals, setVals] = useState<GownBodyVals>(() => ({ ...startingGownBody().vals }));
  const [given, setGiven] = useState<GownBodyKey[]>([]);
  const [bustT, setBustT] = useState(0);
  const [solved, setSolved] = useState<GownSolved | null>(null);
  const [design, setDesign] = useState<GownConfig>(() => startingGownConfig());
  const [note, setNote] = useState('');
  const [hipWant, setHipWant] = useState<number | null>(null);
  const waistTold = useRef(0);
  const [hand, setHand] = useState<GownHandInput | null>(null);
  const fine = { athletic: false, bustT, given };

  if (view === 'silhouettes') {
    // A5 check: the four silhouettes on one body (&body=thin · default · severe).
    const b = LAB_BODIES[bodyIn as keyof typeof LAB_BODIES] ?? LAB_BODIES.default;
    const v = { ...startingGownBody().vals, ...b };
    return (
      <main className="grid grid-cols-4 gap-2 p-2" data-lab-view="silhouettes">
        {(['aline', 'ball', 'mermaid', 'sheath'] as const).map((sil) => (
          <figure key={sil}>
            <GownView vals={v} fine={fine} scene={scene} design={{ ...startingGownConfig(), sil }} />
            <figcaption className="text-sn-12">{GOWN_SILHOUETTES.find((x) => x.id === sil)?.label}</figcaption>
          </figure>
        ))}
      </main>
    );
  }
  if (view === 'capes') {
    // A5b check: the three capes on one body, turned three-quarters to the back (&body=thin · default · severe).
    const b = LAB_BODIES[bodyIn as keyof typeof LAB_BODIES] ?? LAB_BODIES.default;
    const v = { ...startingGownBody().vals, ...b };
    return (
      <main className="grid grid-cols-3 gap-2 p-2" data-lab-view="capes">
        {(['side', 'back', 'capelet'] as const).map((cape) => (
          <figure key={cape}>
            <GownView vals={v} fine={fine} scene={scene} turn={2.4} design={{ ...startingGownConfig(), cape }} />
            <figcaption className="text-sn-12">{GOWN_CAPES.find((x) => x.id === cape)?.label}</figcaption>
          </figure>
        ))}
      </main>
    );
  }
  if (view === 'parts') {
    // A6a check: sleeves, the off-shoulder band, veils and the back closure on one body (&body=thin · default · severe).
    const b = LAB_BODIES[bodyIn as keyof typeof LAB_BODIES] ?? LAB_BODIES.default;
    const v = { ...startingGownBody().vals, ...b };
    return (
      <main className="grid grid-cols-4 gap-2 p-2" data-lab-view="parts">
        {LAB_PARTS.map(({ label, turn, look }) => (
          <figure key={label}>
            <GownView vals={v} fine={fine} scene={scene} turn={turn} design={{ ...startingGownConfig(), ...look }} />
            <figcaption className="text-sn-12">{label}</figcaption>
          </figure>
        ))}
      </main>
    );
  }
  if (view === 'inside') {
    // A6b check: the Inside stage dresses her in order (v192), on a SAMPLE three-layer gown with a corset.
    const b = LAB_BODIES[bodyIn as keyof typeof LAB_BODIES] ?? LAB_BODIES.default;
    const v = { ...startingGownBody().vals, ...b };
    return (
      <main className="grid grid-cols-4 gap-2 p-2" data-lab-view="inside">
        {LAB_INSIDE_STAGES.map((stage) => (
          <figure key={stage}>
            <GownView vals={v} fine={fine} scene={scene} turn={0.5} design={LAB_INSIDE} inside={{ stage, off: [] }} />
            <figcaption className="text-sn-12">{stage}</figcaption>
          </figure>
        ))}
      </main>
    );
  }
  if (view === 'faceless') {
    return (
      <main className="grid grid-cols-2 gap-2 p-2" data-lab-view="faceless">
        <GownView vals={vals} fine={fine} scene={scene} turn={0} />
        <GownView vals={vals} fine={fine} scene={scene} turn={Math.PI / 2} />
      </main>
    );
  }
  if (view === 'scenes') {
    return (
      <main className="grid grid-cols-3 gap-2 p-2" data-lab-view="scenes">
        {GOWN_SCENE_IDS.map((id) => (
          <figure key={id}>
            <GownView vals={vals} fine={fine} scene={id} />
            <figcaption className="text-sn-12">{GOWN_SCENES[id].label}</figcaption>
          </figure>
        ))}
      </main>
    );
  }

  // The cape's details as they really are (its own defaults until she picks), and the choices the design rules out.
  const now = gownCapeNow(design), hidden = gownHiddenChoices(design);
  const capeNow = { capeFab: now.fab, capeLen: now.len, capeEdge: now.edge, capeFasten: now.fasten };
  // Every pick goes through the pairing rules, so the lab shows what the maker will (one line, then Undo in the maker).
  const choose = (k: 'sil' | 'neck' | 'fabric' | 'colour' | 'hem' | 'train' | 'cape' | 'sleeve' | 'back' | 'closure' | 'veil' | 'veilStyle' | 'blusher' | 'bow' | 'capeFab' | 'capeLen' | 'capeEdge' | 'capeFasten' | 'capeCol' | 'illu' | 'illuBase' | 'illuCol' | 'illuBack' | 'boneShow' | 'straps' | 'strapCol' | 'strapEdge' | 'topEdge' | 'plungeFill' | 'flowers' | 'flowerFrom' | 'flowerType' | 'flowerSize' | 'flowerDen' | 'flowerCol' | 'capeFlowers' | 'laceFinish' | 'veilFab' | 'pearls' | 'bead' | 'beadAt' | 'beadDen' | 'beadCol' | 'boning' | 'overlay' | 'ovFab' | 'lace' | 'laceAt' | 'laceCol' | 'laceBeads' | 'cutEdge' | 'cutFill' | 'pieces' | 'waist' | 'tex' | 'texAt' | 'texDir' | 'drape' | 'darts', v: string) => {
    const out = gownChoose(design, { key: k, value: v } as GownChoice);
    setDesign(out.config);
    setNote(out.notes.join(' '));
  };
  const set = (k: GownBodyKey, v: number) => {
    const next = gownSetNumber(vals, given, k, v, hipWant);
    setVals(next.vals);
    setGiven(next.given);
    setHipWant(next.hipWant);
    // v206: the waist's stop line, at most once every 4 s.
    if (next.note && Date.now() - waistTold.current > 4000) { waistTold.current = Date.now(); setNote(next.note); }
  };
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 md:grid-cols-2" data-lab-view={view}>
      <GownView vals={vals} fine={fine} scene={scene} guides={guides} force2d={view === 'fallback'} design={view === 'dress' ? design : null} onSolved={setSolved} hand={view === 'dress' ? hand : null} />
      <section className="sn-frame grid gap-3 p-4" aria-label="Her numbers">
        {SLIDERS.map((k) => {
          const [lo, hi] = k === 'height' ? GOWN_BODY_RANGE.height : gownLimit(vals, k);
          return (
            <label key={k} className="grid gap-1 text-sn-13">
              <span className="flex justify-between">
                <span>{GOWN_STEP_LABELS[k]}</span>
                <output data-lab-val={k}>
                  {vals[k]} {k === 'weight' ? 'kg' : 'cm'}
                </output>
              </span>
              <input type="range" min={lo} max={hi} step={STEP[k] ?? 0.5} value={vals[k]} onChange={(e) => set(k, Number(e.target.value))} aria-label={GOWN_STEP_LABELS[k]} />
            </label>
          );
        })}
        <label className="grid gap-1 text-sn-13">
          <span>{GOWN_STEP_LABELS.bustPos}</span>
          <input type="range" min={-1} max={1} step={0.02} value={bustT} onChange={(e) => setBustT(gownSnapBustT(Number(e.target.value)))} aria-label={GOWN_STEP_LABELS.bustPos} />
        </label>
        {view === 'dress' ? (
          <div className="grid grid-cols-2 gap-2 text-sn-13" aria-label="The gown">
            {(
              [
                ['sil', 'Silhouette', GOWN_SILHOUETTES],
                ['neck', 'Neckline', GOWN_NECKLINES.filter((n) => !hidden.neck.includes(n.id))],
                // v199: what fills a plunge to the waist; the straps this neckline takes and their details; the top edge.
                ...(hidden.plungeFill ? [] : [['plungeFill', 'Plunge filled with', GOWN_PLUNGE_FILLS] as const]),
                ...(hidden.strapRow ? [] : [['straps', 'Straps', GOWN_STRAPS.filter((x) => !hidden.straps.includes(x.id))] as const]),
                ...(hidden.strapDetails ? [] : [...(hidden.strapCol ? [] : [['strapCol', 'Strap colour', GOWN_STRAP_COLOURS] as const]), ['strapEdge', 'Strap edge', GOWN_STRAP_EDGES] as const]),
                ...(hidden.topEdge ? [] : [['topEdge', 'Top edge', GOWN_TOP_EDGES] as const]),
                ['fabric', 'Fabric', GOWN_STOCK_FABRICS],
                ['colour', 'Colour', GOWN_COLOURS.filter((c) => c.id !== 'custom')],
                ['hem', 'Length', GOWN_HEMS],
                ['train', 'Train', GOWN_TRAINS],
                ['cape', 'Cape', GOWN_CAPES],
                // v196 Cape details: what the cape really is (its own defaults until she picks), only the lengths it can be.
                ...(design.cape === 'none' ? [] : ([
                  ['capeFab', 'Cape made of', GOWN_CAPE_FABRICS],
                  ['capeLen', 'Cape length', GOWN_CAPE_LENGTHS.filter((l) => !hidden.capeLen.includes(l.id))],
                  ['capeEdge', 'Cape edge', GOWN_CAPE_EDGES],
                  ...(hidden.capeFasten ? [] : [['capeFasten', 'Back cape fastened', GOWN_CAPE_FASTENINGS] as const]),
                  ...(hidden.capeCol ? [] : [['capeCol', 'Cape colour', GOWN_CAPE_COLOURS] as const]),
                  // v200: 3D flowers on the cape (their type, size and colour as set under 3D flowers).
                  ['capeFlowers', '3D flowers on the cape', GOWN_CAPE_FLOWERS],
                ] as const)),
                ['sleeve', 'Sleeves', GOWN_SLEEVES],
                ['back', 'Back', GOWN_BACKS],
                // v198: the bodice in sheer tulle, an illusion back, boning you can see.
                ['illu', 'Bodice made of', GOWN_ILLUSIONS],
                ...(hidden.illuDetails ? [] : ([['illuBase', 'Lined cups', GOWN_ILLUSION_CUPS], ['illuCol', 'Tulle colour', GOWN_ILLUSION_COLOURS]] as const)),
                ...(hidden.illuBack ? [] : [['illuBack', 'Illusion back', GOWN_ILLUSION_BACKS] as const]),
                ['boning', 'Boning', GOWN_BONING],
                ['boneShow', 'Boning you can see', GOWN_BONE_SHOWS],
                ['closure', 'Closure', GOWN_CLOSURES],
                ['veil', 'Veil', GOWN_VEIL_ORDER.map((id) => GOWN_VEILS.find((o) => o.id === id)!)],
                ['veilStyle', 'Veil style', GOWN_VEIL_STYLES],
                // v200: the veil in plain or glitter tulle.
                ...(hidden.veilFab ? [] : [['veilFab', 'Veil made of', GOWN_VEIL_FABRICS] as const]),
                ['blusher', 'Blusher', GOWN_BLUSHERS],
                ['bow', 'Bow', GOWN_BOWS],
                ['overlay', 'Overlay', GOWN_OVERLAYS],
                ['ovFab', 'Overlay made of', GOWN_OVERLAY_FABRICS],
                // v200: 3D flowers and their details; scattered pearls. (Lace is in the lace designer below.)
                ['flowers', '3D flowers', GOWN_FLOWERS.filter((x) => !hidden.flowers.includes(x.id))],
                ...(hidden.flowerDetails ? [] : ([
                  ...(hidden.flowerFromRow ? [] : [['flowerFrom', 'Cascade starts at', GOWN_FLOWER_FROM.filter((x) => !hidden.flowerFrom.includes(x.id))] as const]),
                  ['flowerType', 'Flower type', GOWN_FLOWER_TYPES],
                  ['flowerSize', 'Flower size', GOWN_FLOWER_SIZES.filter((x) => !hidden.flowerSize.includes(x.id))],
                  ['flowerDen', 'How many flowers', GOWN_FLOWER_DENSITIES],
                  ['flowerCol', 'Flower colour', GOWN_FLOWER_COLOURS.filter((x) => !hidden.flowerCol.includes(x.id))],
                ] as const)),
                ['pearls', 'Scattered pearls', GOWN_PEARLS.filter((x) => !hidden.pearls.includes(x.id))],
                // A7 (v202): the first bead layer (a custom colour needs the maker's colour picker, so not here).
                ['bead', 'Beading', GOWN_BEADS],
                ['beadAt', 'Beads placed', GOWN_BEAD_PLACES],
                ['beadDen', 'How many beads', GOWN_BEAD_DENSITIES],
                ['beadCol', 'Bead colour', GOWN_BEAD_COLOURS.filter((x) => x.id !== 'custom')],
                ['cutEdge', 'Cut-out edge', GOWN_CUT_EDGES],
                ['cutFill', 'Cut-out fill', GOWN_CUT_FILLS],
                ['pieces', 'Made as', GOWN_PIECES],
                ['waist', 'Waistline', GOWN_WAISTLINES],
                ['tex', 'Texture', GOWN_TEXTURES],
                ['texAt', 'Texture on', GOWN_TEXTURE_PLACES],
                ['texDir', 'Texture runs', GOWN_TEXTURE_DIRECTIONS],
                ['drape', 'Drape', GOWN_DRAPES],
                ['darts', 'Darts and seams', GOWN_DARTS],
              ] as const
            ).map(([k, label, list]) => (
              <div key={k} className="grid gap-1">
                <span>{label}</span>
                <PickMenu
                  label={label}
                  value={(k in capeNow ? capeNow[k as keyof typeof capeNow] : design[k]) as string}
                  options={list.map((o) => ({ key: o.id, label: o.label }))}
                  onPick={(v) => choose(k, v)}
                  dataAttr={`data-lab-pick-${k.toLowerCase()}`}
                  className="w-full !min-h-11"
                />
              </div>
            ))}
            <div className="grid gap-1">
              <span>Bead size</span>
              <PickMenu
                label="Bead size"
                value={String(design.beadMm)}
                options={[2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].map((mm) => ({ key: String(mm), label: `${mm} mm` }))}
                onPick={(v) => setDesign({ ...design, beadMm: Number(v) })}
                dataAttr="data-lab-pick-beadmm"
                className="w-full !min-h-11"
              />
            </div>
            <div className="grid gap-1">
              <span>Second bead layer</span>
              <PickMenu
                label="Second bead layer"
                value={design.beadLayers[0]?.bead ?? 'none'}
                options={GOWN_BEADS.map((o) => ({ key: o.id, label: o.label }))}
                onPick={(v) => setDesign({ ...design, beadLayers: v === 'none' ? [] : [{ bead: v as (typeof GOWN_BEADS)[number]['id'], beadAt: 'hem', beadDen: 'medium', beadCol: 'ivory', beadMm: 4, beadHex: null, mix: [] }] })}
                dataAttr="data-lab-pick-beadlayer2"
                className="w-full !min-h-11"
              />
            </div>
            <div className="grid gap-1">
              <span>Cut-out</span>
              <PickMenu
                label="Cut-out"
                value={design.cuts[0] ?? 'none'}
                options={[{ key: 'none', label: 'None' }, ...GOWN_CUTOUTS.map((c) => ({ key: c.id, label: c.label, disabledNote: GOWN_CUT_FORBIDDEN[c.id] }))]}
                onPick={(v) => setDesign({ ...design, cuts: v === 'none' ? [] : [v as (typeof GOWN_CUTOUTS)[number]['id']] })}
                dataAttr="data-lab-pick-cuts"
                className="w-full !min-h-11"
              />
            </div>
            <div className="grid gap-1">
              <span>Trims</span>
              <PickMenu
                label="Trims"
                value={null}
                buttonText={design.trims.length ? `${design.trims.length} picked` : 'None'}
                picked={design.trims}
                options={GOWN_TRIMS.map((t) => ({ key: t.id, label: t.label }))}
                onPick={(v) => { const t = v as (typeof GOWN_TRIMS)[number]['id']; setDesign({ ...design, trims: design.trims.includes(t) ? design.trims.filter((x) => x !== t) : [...design.trims, t] }); }}
                dataAttr="data-lab-pick-trims"
                className="w-full !min-h-11"
              />
            </div>
            <div className="col-span-2">
              <GownLaceDesigner design={design} onChoose={(k, v) => choose(k, v)} onWidth={(cm) => setDesign({ ...design, laceCm: cm })} />
            </div>
            <div className="col-span-2">
              <GownHandTools design={design} onDesign={setDesign} onInput={setHand} />
            </div>
            <p className="col-span-2 text-sn-12" data-lab-note aria-live="polite">
              {note}
            </p>
          </div>
        ) : null}
        <p className="text-sn-12" data-lab-bra>{gownBraNote(vals, given)}</p>
        <p className="text-sn-12" data-lab-tape>
          {solved
            ? `The tape reads: bust ${solved.got.bust.toFixed(1)} · underbust ${solved.got.underbust.toFixed(1)} · waist ${solved.got.waist.toFixed(1)} · hips ${solved.got.hips.toFixed(1)} cm · ${solved.kg} kg`
            : view === 'fallback'
              ? 'No 3D here: the tape is read on the mannequin, so it reads nothing.'
              : 'Building the mannequin…'}
        </p>
      </section>
    </main>
  );
}
