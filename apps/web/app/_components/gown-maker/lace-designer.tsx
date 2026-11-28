'use client';

/**
 * 👗 The lace designer (A7; prototype v202 `renderLib`, the Lace appliqué card): the lace designs as pictures to pick
 * from, then where they go, their colour, their width, beads sewn on them and a raised finish. Motifs can also be placed
 * one by one with the Lace hand tool. Picks go through the pairing rules (`onChoose`), so a border lace lands on the
 * hem as the maker says. Loaded on its own (lazily), like the hand tools.
 *
 * The pictures are drawn here from the same motifs the gown wears (`drawGownLaceThumb`); nothing is fetched.
 * A supplier's own lace from a photo is the shop's side (A10 / Builder B) and is not in this picker.
 */
import { useEffect, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { Slider, SLIDER_VALUE } from '@/app/_components/slider';
import { GOWN_LACE_BEADS, GOWN_LACE_COLOURS, GOWN_LACE_FINISHES, GOWN_LACE_PLACES, GOWN_LACES, GOWN_RANGES, type GownConfig, type GownLace } from '@/lib/gown-config';
import { GOWN_LACE_THUMB, drawGownLaceThumb } from '@/lib/gown/parts/lace';

type LaceKey = 'lace' | 'laceAt' | 'laceCol' | 'laceBeads' | 'laceFinish';

/** The thumbnails, drawn once per page. */
let thumbs: Partial<Record<Exclude<GownLace, 'none'>, string>> | null = null;
function laceThumbs(): Partial<Record<Exclude<GownLace, 'none'>, string>> {
  if (thumbs) return thumbs;
  const out: Partial<Record<Exclude<GownLace, 'none'>, string>> = {}, c = document.createElement('canvas');
  c.width = c.height = GOWN_LACE_THUMB.px;
  const g = c.getContext('2d');
  if (!g) return out;
  for (const l of GOWN_LACES) if (l.id !== 'none') { g.clearRect(0, 0, c.width, c.height); drawGownLaceThumb(g, l.id); out[l.id] = c.toDataURL(); }
  thumbs = out;
  return out;
}

export function GownLaceDesigner({ design, onChoose, onWidth }: {
  design: GownConfig;
  /** A pick, through the pairing rules. */
  onChoose: (key: LaceKey, value: string) => void;
  /** The motif width (cm). */
  onWidth: (cm: number) => void;
}) {
  const [pics, setPics] = useState<Partial<Record<Exclude<GownLace, 'none'>, string>>>({});
  useEffect(() => { setPics(laceThumbs()); }, []);
  const [lo, hi, step] = GOWN_RANGES.laceCm;
  const on = design.lace !== 'none';
  return (
    <section className="grid gap-3" aria-label="Lace appliqué" data-gown-lace>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Lace design">
        {GOWN_LACES.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={design.lace === l.id}
            onClick={() => onChoose('lace', l.id)}
            className="sn-tile grid min-h-11 justify-items-center gap-1 p-2 text-sn-12 aria-pressed:ring-2 aria-pressed:ring-sn-accent"
            data-gown-lace-pick={l.id}
          >
            {l.id === 'none' ? <span className="grid aspect-square w-full place-items-center">None</span> : pics[l.id] ? <img src={pics[l.id]} alt="" className="aspect-square w-full rounded-md" /> : <span className="aspect-square w-full" />}
            {l.id === 'none' ? null : <span>{l.label}</span>}
          </button>
        ))}
      </div>
      {on ? (
        <div className="grid gap-3">
          {([
            ['laceAt', 'Lace placed', GOWN_LACE_PLACES],
            ['laceCol', 'Lace colour', GOWN_LACE_COLOURS],
            ['laceBeads', 'Beads on the lace', GOWN_LACE_BEADS],
            ['laceFinish', 'Lace finish', GOWN_LACE_FINISHES],
          ] as const).map(([k, label, list]) => (
            <div key={k} className="grid gap-1 text-sn-13">
              <span>{label}</span>
              <PickMenu label={label} value={design[k] as string} options={list.map((o) => ({ key: o.id, label: o.label }))} onPick={(v) => onChoose(k, v)} dataAttr={`data-gown-lace-${k.toLowerCase()}`} className="w-full !min-h-11" />
            </div>
          ))}
          <label className="flex items-center gap-3 text-sn-13">
            <span className="w-28 shrink-0">Motif width</span>
            <Slider label="Motif width" value={design.laceCm} min={lo} max={hi} step={step} onChange={onWidth} valueText={`${design.laceCm} cm`} data="gown-lace-cm" />
            <output className={SLIDER_VALUE}>{design.laceCm} cm</output>
          </label>
        </div>
      ) : null}
      <p className="text-sn-12">You can also place motifs one by one: Place by hand, then Lace.</p>
    </section>
  );
}
