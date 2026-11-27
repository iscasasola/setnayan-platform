'use client';

/** The Gown Maker lab's body (see page.lab.tsx). Fixture numbers only: a SAMPLE body, never a person's. */
import { useState } from 'react';
import { GOWN_BODY_RANGE, GOWN_STEP_LABELS, startingGownBody, type GownBodyKey, type GownBodyVals } from '@/lib/gown-config';
import { gownBraNote, gownLimit, gownSetNumber, gownSnapBustT } from '@/lib/gown/body-rules';
import { GOWN_SCENES, GOWN_SCENE_IDS, type GownSceneId } from '@/lib/gown/scenes';
import { GownView } from '@/app/_components/plan3d/kit/gown-view';
import type { GownSolved } from '@/app/_components/plan3d/kit/gown-figure-3d';

const isScene = (s: string): s is GownSceneId => (GOWN_SCENE_IDS as readonly string[]).includes(s);
const SLIDERS: GownBodyKey[] = ['height', 'weight', 'bust', 'waist', 'hips', 'underbust'];
const STEP: Partial<Record<GownBodyKey, number>> = { height: 1, weight: 1 };

export default function GownMakerLab({ view, scene: sceneIn, guides }: { view: string; scene: string; guides: boolean }) {
  const scene: GownSceneId = isScene(sceneIn) ? sceneIn : 'studio';
  const [vals, setVals] = useState<GownBodyVals>(() => ({ ...startingGownBody().vals }));
  const [given, setGiven] = useState<GownBodyKey[]>([]);
  const [bustT, setBustT] = useState(0);
  const [solved, setSolved] = useState<GownSolved | null>(null);
  const fine = { athletic: false, bustT, given };

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

  const set = (k: GownBodyKey, v: number) => {
    const next = gownSetNumber(vals, given, k, v);
    setVals(next.vals);
    setGiven(next.given);
  };
  return (
    <main className="mx-auto grid max-w-3xl gap-4 p-4 md:grid-cols-2" data-lab-view={view}>
      <GownView vals={vals} fine={fine} scene={scene} guides={guides} force2d={view === 'fallback'} onSolved={setSolved} />
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
