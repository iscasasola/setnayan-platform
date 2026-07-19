'use client';

import { useState } from 'react';
import { Loader, Sparkles } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { SDLoader } from '@/components/sd-loader';
import {
  DEFAULT_LOADER_CONFIG,
  type LoaderVariant,
} from '@/lib/loader-config';
import { saveLoaderAppearance } from '../actions';

/**
 * Loading-animation appearance card (owner 2026-07-05).
 *
 * A live <SDLoader> preview driven from local component state — the admin picks
 * a variant, drags the veil + speed sliders, toggles tap-to-pop, and sees the
 * exact loader they'll ship before saving. Explicit `variant` / `stepIntervalMs`
 * props override the context so the preview reflects the DRAFT, not the
 * currently-saved config. The veil slider previews via `--sd-veil` on a framed
 * backdrop that mimics the .sd-overlay wash. Save posts to saveLoaderAppearance.
 */

const VARIANTS: { key: LoaderVariant; label: string; blurb: string }[] = [
  { key: 'gather', label: 'Gather', blurb: 'Gold particles pull inward; twin orbit turns.' },
  { key: 'aurora', label: 'Aurora', blurb: 'A slow champagne sweep glows behind the mark.' },
  { key: 'pulse', label: 'Pulse', blurb: 'Concentric gold rings ripple outward, sonar-style.' },
];

export function LoaderAppearanceCard({
  initialVariant,
  initialVeilOpacity,
  initialStepIntervalMs,
  initialPopEnabled,
}: {
  initialVariant: LoaderVariant;
  initialVeilOpacity: number;
  initialStepIntervalMs: number;
  initialPopEnabled: boolean;
}) {
  const [variant, setVariant] = useState<LoaderVariant>(initialVariant);
  const [veil, setVeil] = useState<number>(initialVeilOpacity);
  const [interval, setIntervalMs] = useState<number>(initialStepIntervalMs);
  const [pop, setPop] = useState<boolean>(initialPopEnabled);

  const seconds = (interval / 1000).toFixed(1);

  return (
    <div className="mt-10 space-y-4 border-t border-ink/10 pt-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Loader className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Loading animation
          </h2>
        </div>
        <p className="text-sm text-ink/60">
          How the shared brand loader looks and behaves everywhere &mdash; the
          cold-start splash, route loading, and the full-screen &ldquo;working&rdquo;
          overlay. Pick a variant, tune the veil and narration speed, and toggle
          the tap-to-pop delight. Changes go live on the next navigation.
        </p>
      </header>

      <section className="grid gap-6 rounded-xl border border-ink/10 bg-cream p-5 md:grid-cols-[minmax(0,1fr)_260px]">
        {/* Controls */}
        <form action={saveLoaderAppearance} className="space-y-6">
          {/* Variant selector */}
          <fieldset className="space-y-2">
            <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              Variant
            </legend>
            {/* Hidden field carries the picked variant into the server action. */}
            <input type="hidden" name="loader_variant" value={variant} />
            <div className="grid gap-2 sm:grid-cols-3">
              {VARIANTS.map((v) => {
                const active = variant === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setVariant(v.key)}
                    aria-pressed={active}
                    className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-terracotta bg-terracotta/10 ring-1 ring-terracotta/30'
                        : 'border-ink/12 bg-white hover:border-terracotta/30'
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">{v.label}</span>
                    <span className="text-[11px] leading-tight text-ink/55">{v.blurb}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Veil solidity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="loader_veil_opacity"
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50"
              >
                Veil solidity
              </label>
              <span className="font-mono text-xs font-semibold text-ink/70">{veil}%</span>
            </div>
            <input
              id="loader_veil_opacity"
              name="loader_veil_opacity"
              type="range"
              min={70}
              max={100}
              step={1}
              value={veil}
              onChange={(e) => setVeil(Number(e.target.value))}
              className="sn-range w-full"
            />
            <p className="text-[11px] text-ink/50">
              How much the page behind a blocking action is hidden. Higher = more
              opaque.
            </p>
          </div>

          {/* Narration speed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="loader_step_interval_ms"
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50"
              >
                Narration speed
              </label>
              <span className="font-mono text-xs font-semibold text-ink/70">
                {seconds}s / line
              </span>
            </div>
            <input
              id="loader_step_interval_ms"
              name="loader_step_interval_ms"
              type="range"
              min={800}
              max={3000}
              step={100}
              value={interval}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              className="sn-range w-full"
            />
            <p className="text-[11px] text-ink/50">
              How fast the status line advances through its steps.
            </p>
          </div>

          {/* Tap-to-pop toggle */}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="loader_pop_enabled"
              checked={pop}
              onChange={(e) => setPop(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            <span className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Sparkles className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
                Tap-to-pop
              </span>
              <span className="text-xs text-ink/60">
                A small gold spark burst when someone taps the loading mark. Try it
                on the preview.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-3 border-t border-ink/10 pt-4">
            <SubmitButton
              className="button-primary inline-flex items-center gap-2"
              pendingLabel="Saving…"
            >
              Save loading animation
            </SubmitButton>
          </div>
        </form>

        {/* Live preview */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="loader-preview-stage"
            style={{ ['--sd-veil' as string]: `${veil}%` }}
          >
            {/* Backdrop mimics the .sd-overlay veil so the veil slider previews. */}
            <div className="loader-preview-veil" aria-hidden="true" />
            <SDLoader
              key={`${variant}-${interval}`}
              variant={variant}
              stepIntervalMs={interval}
              steps={[
                'Reading your preferences',
                'Analyzing your selections',
                'Composing your result',
              ]}
              hint="Preview"
              className="loader-preview-loader"
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Live preview {pop ? '· tap it' : ''}
          </span>
        </div>
      </section>
    </div>
  );
}
