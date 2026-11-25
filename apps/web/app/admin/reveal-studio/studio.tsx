'use client';

/**
 * Reveal Studio — the admin control panel for the Save-the-Date opening reveal.
 *
 * Left: the controls (master on/off · default + allowed templates · per-feature
 * toggles · default colours · the veil "look" sliders). Right: a LIVE preview —
 * the real <VeilReveal> rendered with the draft settings, so the sliders tune it
 * in place (per-frame knobs update instantly; structural knobs rebuild). Save
 * writes the single reveal_studio_config row; the couple sites read it on render.
 *
 * The preview is the VEIL template (that's what the look sliders drive); the
 * template/feature toggles still apply to every template on the live site.
 */

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  DEFAULT_REVEAL_CONFIG,
  REVEAL_TEMPLATE_IDS,
  type RevealStudioConfig,
  type RevealTemplateId,
  type VeilLook,
} from '@/lib/reveal-config-pure';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';
import { REVEAL_SPEEDS } from '@/lib/reveal-motion';
import { StdTouchGlow } from '@/app/[slug]/_components/reveal/std-touch-glow';
import { saveRevealStudio } from './actions';
import { SwitchTrack } from '@/app/_components/switch-track';

// gold/molten retired as reveal openings 2026-06-22 (now monogram-editor motions).
const VeilReveal = dynamic(() => import('@/app/[slug]/_components/reveal/veil-reveal'), { ssr: false });
// 🎭 The other eight of the nine reveals (owner 23 Nov 2026) — one stage, the same one guests get.
const SceneReveal = dynamic(() => import('@/app/[slug]/_components/reveal/scene-reveal'), { ssr: false });

/** Which reveal the live preview shows — every one of the nine (the veil drives the veil sliders). */
type PreviewTpl = RevealTemplateId;
const PREVIEW_TPLS: Array<[PreviewTpl, string]> = REVEAL_LIBRARY.map((r) => [r.id, r.label]);

const TEMPLATE_LABELS = Object.fromEntries(REVEAL_LIBRARY.map((r) => [r.id, r.label])) as Record<RevealTemplateId, string>;

type SliderDef = { key: keyof VeilLook; label: string; min: number; max: number; step?: number };
const LOOK_GROUPS: Array<{ group: string; sliders: SliderDef[] }> = [
  {
    group: 'Logo & weave',
    sliders: [
      { key: 'logoSize', label: 'Logo size', min: 2, max: 30 },
      { key: 'logoOpacity', label: 'Logo opacity', min: 0, max: 100 },
      { key: 'tilePx', label: 'Logo gap (px)', min: 40, max: 400, step: 5 },
    ],
  },
  {
    group: 'Fold & motion',
    sliders: [
      { key: 'topValance', label: 'Top valance %', min: 0, max: 70 },
      { key: 'fullness', label: 'Fullness', min: 0, max: 100 },
      { key: 'folds', label: 'Folds', min: 4, max: 30 },
      { key: 'reaches', label: 'Reaches (% from base)', min: 0, max: 30 },
      { key: 'wind', label: 'Wind', min: 0, max: 100 },
      { key: 'weight', label: 'Weight (gravity)', min: 0, max: 100 },
      { key: 'trail', label: 'Trail (fold follow)', min: 0, max: 100 },
      { key: 'floatUp', label: 'Float-up', min: 0, max: 100 },
      { key: 'bounce', label: 'Bounce (settle)', min: 0, max: 100 },
    ],
  },
  {
    group: 'Touch & petals',
    sliders: [
      { key: 'liftPk', label: 'Hold lift peak', min: 0, max: 100 },
      { key: 'hold', label: 'Hold radius', min: 0, max: 100 },
      { key: 'stretch', label: 'Stretch give', min: 0, max: 100 },
      { key: 'petalsDensity', label: 'Petal density', min: 0, max: 100 },
    ],
  },
];

const INK = 'var(--m-ink)';
const SLATE = 'var(--m-slate)';
const LINE = 'var(--m-line)';
const ACCENT = 'var(--m-mulberry)';

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-[12px]" style={{ color: SLATE }}>
        <span>{label}</span>
        <span className="tabular-nums font-medium" style={{ color: INK }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full"
        style={{ accentColor: ACCENT }}
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
      style={{ borderColor: LINE }}
      aria-pressed={checked}
    >
      <span>
        <span className="block text-[13px] font-medium" style={{ color: INK }}>
          {label}
        </span>
        {hint ? (
          <span className="block text-[11px]" style={{ color: SLATE }}>
            {hint}
          </span>
        ) : null}
      </span>
      <SwitchTrack on={checked} />
    </button>
  );
}

export function RevealStudio({ initial }: { initial: RevealStudioConfig }) {
  const [draft, setDraft] = useState<RevealStudioConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Bumping this remounts the preview veil → it re-drapes from scratch. Used to
  // bring the veil back after a reveal (and via the ↻ Replay button) so the
  // studio preview never dead-ends on a settled, off-screen revealed veil.
  const [previewKey, setPreviewKey] = useState(0);
  const redrapePreview = () => setPreviewKey((k) => k + 1);
  const [previewTpl, setPreviewTpl] = useState<PreviewTpl>('veil-sheer');
  // The preview phone-frame — the touch-glow scopes itself here so HQ can press
  // inside the frame and see the glow tune live with the sliders below.
  const previewBoxRef = useRef<HTMLDivElement>(null);

  const setLook = (key: keyof VeilLook, v: number) =>
    setDraft((d) => ({ ...d, veil: { ...d.veil, [key]: v } }));
  const setFeature = (key: keyof RevealStudioConfig['features'], v: boolean) =>
    setDraft((d) => ({ ...d, features: { ...d.features, [key]: v } }));
  const setTemplateAllowed = (id: RevealTemplateId, v: boolean) =>
    setDraft((d) => ({ ...d, templates: { ...d.templates, [id]: v } }));

  async function onSave() {
    setSaving(true);
    setMsg(null);
    const res = await saveRevealStudio(draft);
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: 'Saved — live on couple sites.' } : { ok: false, text: res.error });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* Activation */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
            Activation
          </h2>
          {/* A8·G-6: the "Show the reveal on couple sites" switch is gone — it saved `enabled`, which nothing reads
              (every reveal needs Event Pro, owner 2026-09-24; lib/reveal-access.ts). The value stays in the saved
              row untouched. */}
          <p className="text-[12px]" style={{ color: SLATE }}>
            Every reveal needs Event Pro. A Pro couple who has not chosen gets the default template below; a free couple
            gets no reveal.
          </p>
          <div>
            <div className="mb-1 text-[12px]" style={{ color: SLATE }}>
              Default template
            </div>
            <select
              value={draft.defaultTemplate}
              onChange={(e) => setDraft((d) => ({ ...d, defaultTemplate: e.target.value as RevealTemplateId }))}
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: LINE, color: INK }}
            >
              {REVEAL_TEMPLATE_IDS.map((id) => (
                <option key={id} value={id}>
                  {TEMPLATE_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-[12px]" style={{ color: SLATE }}>
              Templates couples may use
            </div>
            <div className="grid grid-cols-2 gap-2">
              {REVEAL_TEMPLATE_IDS.map((id) => (
                <Toggle
                  key={id}
                  label={TEMPLATE_LABELS[id]}
                  checked={draft.templates[id]}
                  onChange={(v) => setTemplateAllowed(id, v)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
            Features
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <Toggle label="Petals" hint="Rose shower" checked={draft.features.petals} onChange={(v) => setFeature('petals', v)} />
            <Toggle label="Logo" hint="Woven mark" checked={draft.features.logo} onChange={(v) => setFeature('logo', v)} />
            <Toggle label="Music" hint="On-page audio" checked={draft.features.music} onChange={(v) => setFeature('music', v)} />
          </div>
        </section>

        {/* Colours */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
            Default colours
          </h2>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 text-[13px]" style={{ color: INK }}>
              <input
                type="color"
                value={draft.veilColorDefault}
                onChange={(e) => setDraft((d) => ({ ...d, veilColorDefault: e.target.value }))}
                className="h-9 w-12 cursor-pointer rounded border"
                style={{ borderColor: LINE }}
              />
              <span>
                Veil tulle
                <span className="block text-[11px]" style={{ color: SLATE }}>
                  Couple’s Mood Board overrides this
                </span>
              </span>
            </label>
            <label className="flex items-center gap-3 text-[13px]" style={{ color: INK }}>
              <input
                type="color"
                value={draft.petalsColor}
                onChange={(e) => setDraft((d) => ({ ...d, petalsColor: e.target.value }))}
                className="h-9 w-12 cursor-pointer rounded border"
                style={{ borderColor: LINE }}
              />
              <span>Petals</span>
            </label>
          </div>
        </section>

        {/* Touch glow */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
            Touch glow
          </h2>
          <Toggle
            label="Glow where guests press"
            hint="A soft light blooms under a finger on the Save-the-Date — like a floor that glows when you touch it."
            checked={draft.touchGlow.enabled}
            onChange={(v) =>
              setDraft((d) => ({ ...d, touchGlow: { ...d.touchGlow, enabled: v } }))
            }
          />
          <label className="flex items-center gap-3 text-[13px]" style={{ color: INK }}>
            <input
              type="color"
              value={draft.touchGlow.color}
              onChange={(e) =>
                setDraft((d) => ({ ...d, touchGlow: { ...d.touchGlow, color: e.target.value } }))
              }
              className="h-9 w-12 cursor-pointer rounded border"
              style={{ borderColor: LINE }}
            />
            <span>
              Glow colour
              <span className="block text-[11px]" style={{ color: SLATE }}>
                A warm light reads best on the dark reveal
              </span>
            </span>
          </label>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Slider
              label="Brightness"
              value={draft.touchGlow.intensity}
              min={0}
              max={100}
              onChange={(v) =>
                setDraft((d) => ({ ...d, touchGlow: { ...d.touchGlow, intensity: v } }))
              }
            />
            <Slider
              label="Size"
              value={draft.touchGlow.size}
              min={0}
              max={100}
              onChange={(v) =>
                setDraft((d) => ({ ...d, touchGlow: { ...d.touchGlow, size: v } }))
              }
            />
          </div>
        </section>

        {/* Veil look sliders */}
        <section className="space-y-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
            Veil look
          </h2>
          {LOOK_GROUPS.map((g) => (
            <div key={g.group} className="space-y-3">
              <div className="text-[12px] font-medium" style={{ color: INK }}>
                {g.group}
              </div>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {g.sliders.map((s) => (
                  <Slider
                    key={s.key}
                    label={s.label}
                    value={draft.veil[s.key]}
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    onChange={(v) => setLook(s.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ⏱ The house speed — every reveal's hands-free open, 9 · 12 · 16 s (lib/reveal-motion.ts). A couple's own
            Speed ▾ in the Maker outranks it. It replaced the veil's own "feather" (2–8 s) on 23 Nov 2026. */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
            Speed — every reveal
          </h2>
          <div className="flex flex-wrap gap-1.5" data-studio-speed={draft.veil.speed}>
            {REVEAL_SPEEDS.map((sec) => (
              <button
                key={sec}
                type="button"
                aria-pressed={draft.veil.speed === sec}
                onClick={() => {
                  setLook('speed', sec);
                  redrapePreview();
                }}
                className="rounded-full border px-3 py-1 text-[11px] font-medium"
                style={{
                  borderColor: draft.veil.speed === sec ? ACCENT : LINE,
                  color: draft.veil.speed === sec ? '#fff' : SLATE,
                  background: draft.veil.speed === sec ? ACCENT : 'transparent',
                }}
              >
                {sec} s
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── Live preview + save ──────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: SLATE }}>
          Live preview
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PREVIEW_TPLS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPreviewTpl(id);
                redrapePreview();
              }}
              className="rounded-full border px-3 py-1 text-[11px] font-medium"
              style={{
                borderColor: previewTpl === id ? ACCENT : LINE,
                color: previewTpl === id ? '#fff' : SLATE,
                background: previewTpl === id ? ACCENT : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          ref={previewBoxRef}
          className="relative mx-auto aspect-[9/19] w-full max-w-[300px] overflow-hidden rounded-[2rem] border shadow-xl"
          style={{ borderColor: LINE, background: '#0e0e10' }}
        >
          {/* the invitation card behind the veil */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1c1c20] to-[#0b0b0c] px-6 text-center">
            <div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/45">Save the Date</div>
            <div className="font-serif text-2xl text-white/90">Maria &amp; Jose</div>
            <div className="mt-2 text-[12px] text-white/45">12 · 12 · 2026</div>
          </div>
          {/* the live reveal — veil drives the veil sliders; the rigid templates
              auto-play with the effect particles so the effect sliders calibrate
              in view. Keyed so it re-drapes (remounts) after each reveal. */}
          {previewTpl === 'veil-sheer' ? (
            <VeilReveal
              key={previewKey}
              veilColor={draft.veilColorDefault}
              petalsColor={draft.petalsColor}
              look={draft.veil}
              features={draft.features}
              onRevealed={() => {
                // One-shot on the live site (overlay hands off + unmounts). The
                // studio has nothing to hand off to, so re-drape shortly after to
                // loop back to the tunable draped veil.
                window.setTimeout(redrapePreview, 1500);
              }}
            />
          ) : (
            <SceneReveal
              key={`${previewTpl}-${previewKey}`}
              kind={previewTpl}
              speedSec={draft.veil.speed}
              monogram="M & J"
              markSvg={null}
              autoplay
              autoplayAfterMs={900}
              onRevealed={() => undefined}
              onCleared={() => window.setTimeout(redrapePreview, 1200)}
            />
          )}
          {/* Press-to-glow, scoped to this frame — drag/press inside to see it
              tune live with the sliders. Mirrors the live STD experience. */}
          <StdTouchGlow
            containerRef={previewBoxRef}
            enabled={draft.touchGlow.enabled}
            color={draft.touchGlow.color}
            intensity={draft.touchGlow.intensity}
            size={draft.touchGlow.size}
          />
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="text-[11px]" style={{ color: SLATE }}>
            Swipe up to lift · press to glow · tap a petal to bounce it
          </p>
          <button
            type="button"
            onClick={redrapePreview}
            className="shrink-0 rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: LINE, color: SLATE }}
          >
            ↻ Replay
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: ACCENT }}
          >
            {saving ? 'Saving…' : 'Save — make it live'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(DEFAULT_REVEAL_CONFIG);
              setMsg(null);
            }}
            className="w-full rounded-lg border px-4 py-2 text-[12px]"
            style={{ borderColor: LINE, color: SLATE }}
          >
            Reset to locked defaults
          </button>
          {msg ? (
            <p className="text-center text-[12px]" style={{ color: msg.ok ? '#2f7d4f' : '#b23b3b' }}>
              {msg.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
