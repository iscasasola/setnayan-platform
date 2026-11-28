'use client';

/** The Gown Maker lab's body (see page.lab.tsx). Fixture numbers only: a SAMPLE body, never a person's. */
import { useState } from 'react';
import {
  GOWN_BACKS,
  GOWN_BODY_RANGE,
  GOWN_CAPES,
  GOWN_CLOSURES,
  GOWN_SLEEVES,
  GOWN_VEILS,
  GOWN_VEIL_STYLES,
  GOWN_COLOURS,
  GOWN_HEMS,
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
import { gownChoose, type GownChoice } from '@/lib/gown/compat';
import { gownBraNote, gownLimit, gownSetNumber, gownSnapBustT } from '@/lib/gown/body-rules';
import { GOWN_SCENES, GOWN_SCENE_IDS, type GownSceneId } from '@/lib/gown/scenes';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GownView } from '@/app/_components/plan3d/kit/gown-view';
import type { GownSolved } from '@/app/_components/plan3d/kit/gown-figure-3d';

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

  // Every pick goes through the pairing rules, so the lab shows what the maker will (one line, then Undo in the maker).
  const choose = (k: 'sil' | 'neck' | 'fabric' | 'colour' | 'hem' | 'train' | 'cape' | 'sleeve' | 'back' | 'closure' | 'veil' | 'veilStyle' | 'overlay' | 'ovFab', v: string) => {
    const out = gownChoose(design, { key: k, value: v } as GownChoice);
    setDesign(out.config);
    setNote(out.notes.join(' '));
  };
  const set = (k: GownBodyKey, v: number) => {
    const next = gownSetNumber(vals, given, k, v);
    setVals(next.vals);
    setGiven(next.given);
  };
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 md:grid-cols-2" data-lab-view={view}>
      <GownView vals={vals} fine={fine} scene={scene} guides={guides} force2d={view === 'fallback'} design={view === 'dress' ? design : null} onSolved={setSolved} />
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
                ['neck', 'Neckline', GOWN_NECKLINES],
                ['fabric', 'Fabric', GOWN_STOCK_FABRICS],
                ['colour', 'Colour', GOWN_COLOURS.filter((c) => c.id !== 'custom')],
                ['hem', 'Length', GOWN_HEMS],
                ['train', 'Train', GOWN_TRAINS],
                ['cape', 'Cape', GOWN_CAPES],
                ['sleeve', 'Sleeves', GOWN_SLEEVES],
                ['back', 'Back', GOWN_BACKS],
                ['closure', 'Closure', GOWN_CLOSURES],
                ['veil', 'Veil', GOWN_VEILS],
                ['veilStyle', 'Veil style', GOWN_VEIL_STYLES],
                ['overlay', 'Overlay', GOWN_OVERLAYS],
                ['ovFab', 'Overlay made of', GOWN_OVERLAY_FABRICS],
              ] as const
            ).map(([k, label, list]) => (
              <div key={k} className="grid gap-1">
                <span>{label}</span>
                <PickMenu
                  label={label}
                  value={design[k] as string}
                  options={list.map((o) => ({ key: o.id, label: o.label }))}
                  onPick={(v) => choose(k, v)}
                  dataAttr={`data-lab-pick-${k.toLowerCase()}`}
                  className="w-full !min-h-11"
                />
              </div>
            ))}
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
