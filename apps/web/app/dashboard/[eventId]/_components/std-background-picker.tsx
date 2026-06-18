'use client';

/**
 * Step-1 Background picker (controlled). Four kinds: plain colour · paper texture
 * · realistic scene · upload-your-own. The live preview is the shared device
 * frame in StdBuilderClient (StdBackgroundLayer behind the film); this card only
 * drives WHICH background is selected and lifts it to the parent.
 *
 * Upload is a labelled placeholder this build — it ships with the depth/parallax
 * engine (its whole point is the auto-3D lean). Plain/paper/realistic work now.
 */

import { Check, Sparkles, Upload } from 'lucide-react';
import {
  STD_PLAIN_PRESETS,
  STD_PAPER_BACKGROUNDS,
  STD_REALISTIC_BACKGROUNDS,
  paperBackgroundStyle,
  type StdBackground,
} from '@/lib/std-backgrounds';

type Props = {
  value: StdBackground;
  onChange: (bg: StdBackground) => void;
};

const tile =
  'relative flex items-center justify-center overflow-hidden rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

export function StdBackgroundPicker({ value, onChange }: Props) {
  const sel = (kind: StdBackground['kind'], v: string) => value.kind === kind && value.value === v;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Step 1 · Background
        </p>
        <h2 className="font-serif text-xl italic">Set the scene</h2>
        <p className="text-sm text-ink/65">
          The backdrop your whole Save the Date plays over. Pick a colour, a paper, or a scene —
          your names and details float on top.
        </p>
      </div>

      {/* Plain colour */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink/55">Plain colour</p>
        <div className="flex flex-wrap items-center gap-2">
          {STD_PLAIN_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Background colour ${hex}`}
              aria-pressed={sel('plain', hex)}
              onClick={() => onChange({ kind: 'plain', value: hex })}
              className={`h-9 w-9 rounded-full border ${
                sel('plain', hex) ? 'ring-2 ring-terracotta ring-offset-2' : 'border-ink/20'
              }`}
              style={{ backgroundColor: hex }}
            >
              {sel('plain', hex) ? (
                <Check
                  aria-hidden
                  className="mx-auto h-4 w-4"
                  strokeWidth={3}
                  style={{ color: '#fff', mixBlendMode: 'difference' }}
                />
              ) : null}
            </button>
          ))}
          <label
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-ink/30 text-ink/50"
            title="Custom colour"
          >
            <span className="text-base leading-none">+</span>
            <input
              type="color"
              className="absolute h-0 w-0 opacity-0"
              value={value.kind === 'plain' ? value.value : '#f3ece1'}
              onChange={(e) => onChange({ kind: 'plain', value: e.target.value })}
              aria-label="Custom background colour"
            />
          </label>
        </div>
      </div>

      {/* Paper */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink/55">Paper</p>
        <div className="grid grid-cols-5 gap-2">
          {STD_PAPER_BACKGROUNDS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={sel('paper', p.id)}
              onClick={() => onChange({ kind: 'paper', value: p.id })}
              className={`${tile} h-14 ${
                sel('paper', p.id) ? 'border-terracotta ring-2 ring-terracotta/20' : 'border-ink/15'
              }`}
              style={paperBackgroundStyle(p.id)}
              title={p.label}
            >
              {sel('paper', p.id) ? (
                <Check aria-hidden className="h-4 w-4 text-ink" strokeWidth={2.5} />
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink/45">
          {STD_PAPER_BACKGROUNDS.find((p) => sel('paper', p.id))?.label ?? 'Textured stationery — subtle, editorial.'}
        </p>
      </div>

      {/* Realistic scenes */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink/55">Realistic scenes</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {STD_REALISTIC_BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={sel('realistic', b.id)}
              onClick={() => onChange({ kind: 'realistic', value: b.id })}
              className={`${tile} aspect-square ${
                sel('realistic', b.id)
                  ? 'border-terracotta ring-2 ring-terracotta/30'
                  : 'border-ink/15'
              }`}
              title={b.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt={b.label} className="h-full w-full object-cover" loading="lazy" />
              {sel('realistic', b.id) ? (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
                  <Check aria-hidden className="h-5 w-5 text-cream" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink/45">
          {STD_REALISTIC_BACKGROUNDS.find((b) => sel('realistic', b.id))?.label ??
            'Photoreal scenes — they gently lean with the viewer (parallax).'}
        </p>
      </div>

      {/* Upload — placeholder until the parallax engine lands */}
      <div className="flex items-center gap-3 rounded-md border border-dashed border-ink/25 bg-ink/5 px-4 py-3">
        <Upload aria-hidden className="h-5 w-5 shrink-0 text-ink/40" strokeWidth={1.75} />
        <div className="flex-1">
          <p className="text-sm font-medium text-ink/70">Upload your own photo</p>
          <p className="text-xs text-ink/45">
            Auto-converted to a 3D-depth background — arriving with the parallax engine.
          </p>
        </div>
        <span className="rounded-full bg-ink/10 px-2.5 py-1 text-[11px] font-medium text-ink/55">
          Soon
        </span>
      </div>
    </section>
  );
}
