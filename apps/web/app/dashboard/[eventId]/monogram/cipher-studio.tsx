'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Check,
  FlipHorizontal2,
  FlipVertical2,
  Undo2,
} from 'lucide-react';
import {
  CIPHER_CANVAS,
  CIPHER_FONTS,
  CIPHER_INKS,
  cipherFont,
  cipherFontDataUrl,
  defaultCipherConfig,
  type CipherConfig,
  type CipherMode,
} from '@/lib/cipher-shared';
import { renderCipher, type CipherFontData } from '@/lib/cipher-render';
import { saveCipherAction, clearCipherAction } from './cipher-actions';

/**
 * CipherStudio — the couple's interlocking-monogram editor (Phase 3 of the
 * monogram overhaul · owner-designed). Two initials, freely POSITIONED
 * (drag · size · rotate · mirror), combined as:
 *   · Flow as one (restroke) — single-line scripts joined into ONE
 *     variable-width pen ribbon (tips blend smoothly),
 *   · Over/under weave — filled faces where the front letter knocks an
 *     adjustable gap out of the back letter where they cross,
 *   · Simple overlap.
 *
 * The live preview renders through the SAME pure renderCipher() the save
 * action uses server-side, on the same prebuilt glyph geometry (fetched
 * per-font from /cipher/…) — so the preview IS the saved mark. Deterministic
 * SVG, no AI, no per-use cost. Saved to events.monogram_custom_svg (already
 * consumed by the wedding-site hero) + monogram_cipher_config (re-editable).
 */

const FRAME = `0 0 ${CIPHER_CANVAS} ${CIPHER_CANVAS}`;
const DRAG_RADIUS = 90; // design-units hit radius around a letter's center

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save as my monogram'}
    </button>
  );
}

export function CipherStudio({
  eventId,
  defaultInitials,
  initialConfig,
  hasCipher,
  notice,
}: {
  eventId: string;
  defaultInitials: string;
  /** Persisted events.monogram_cipher_config (already sanitized), or null. */
  initialConfig: CipherConfig | null;
  /** True when the saved monogram_custom_svg came from this editor. */
  hasCipher: boolean;
  notice: { tone: 'ok' | 'error'; text: string } | null;
}) {
  const [config, setConfig] = useState<CipherConfig>(
    () =>
      initialConfig ??
      defaultCipherConfig(defaultInitials[0] ?? 'A', defaultInitials[1] ?? 'K'),
  );
  const [fonts, setFonts] = useState<Record<string, CipherFontData>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ idx: 0 | 1; dx: number; dy: number } | null>(null);

  const font = cipherFont(config.fontKey) ?? CIPHER_FONTS[0]!;
  const fontData = fonts[font.key];

  // Fetch the chosen font's prebuilt geometry once, cache by key.
  useEffect(() => {
    if (fonts[font.key]) return;
    let alive = true;
    fetch(cipherFontDataUrl(font))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CipherFontData | null) => {
        if (alive && data) setFonts((m) => ({ ...m, [font.key]: data }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [font, fonts]);

  const preview = useMemo(() => {
    if (!fontData) return null;
    return renderCipher(config, fontData, 'cipher-prev', { frame: FRAME });
  }, [config, fontData]);

  function patch(p: Partial<CipherConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }
  function patchLetter(idx: 0 | 1, p: Partial<CipherConfig['letters'][0]>) {
    setConfig((c) => {
      const letters = [...c.letters] as CipherConfig['letters'];
      letters[idx] = { ...letters[idx], ...p };
      return { ...c, letters };
    });
  }

  function onFontChange(key: string) {
    const next = cipherFont(key);
    if (!next) return;
    // Keep the mode coherent with the font kind (mirrors sanitizeCipherConfig).
    let mode: CipherMode = config.mode;
    if (mode === 'restroke' && next.kind !== 'stroke') mode = 'weave';
    if (mode === 'weave' && next.kind !== 'filled') mode = 'restroke';
    patch({ fontKey: key, mode });
  }

  function onInitials(value: string) {
    const letters = (value.match(/[A-Za-z]/g) ?? []).slice(0, 2).map((c) => c.toUpperCase());
    if (letters.length === 2) patch({ initials: [letters[0]!, letters[1]!] });
    else if (letters.length === 1) patch({ initials: [letters[0]!, config.initials[1]] });
  }

  /** Pointer position → design-space coords. */
  function toDesign(e: React.PointerEvent): { x: number; y: number } {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CIPHER_CANVAS,
      y: ((e.clientY - rect.top) / rect.height) * CIPHER_CANVAS,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!preview) return;
    const p = toDesign(e);
    let best: 0 | 1 | null = null;
    let bestD = DRAG_RADIUS;
    ([0, 1] as const).forEach((i) => {
      const l = config.letters[i]!;
      const d = Math.hypot(p.x - l.x, p.y - l.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best === null) return;
    const l = config.letters[best]!;
    dragRef.current = { idx: best, dx: p.x - l.x, dy: p.y - l.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toDesign(e);
    patchLetter(drag.idx, {
      x: Math.round(p.x - drag.dx),
      y: Math.round(p.y - drag.dy),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const modeOptions: { key: CipherMode; label: string }[] =
    font.kind === 'stroke'
      ? [
          { key: 'restroke', label: 'Flow as one' },
          { key: 'overlap', label: 'Overlap' },
        ]
      : [
          { key: 'weave', label: 'Over/under weave' },
          { key: 'overlap', label: 'Overlap' },
        ];

  const segBtn = (selected: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      selected
        ? 'border-mulberry bg-mulberry/10 text-mulberry'
        : 'border-ink/15 bg-white text-ink/70 hover:border-ink/30'
    }`;

  return (
    <section
      id="cipher-studio"
      className="scroll-mt-6 rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8"
    >
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Cipher studio
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Design your interlocking monogram
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Place your two initials however you like — overlap them, weave one
          through the other, or let a flowing script join them into a single
          pen stroke. Drag the letters right on the canvas.
        </p>
      </header>

      {notice ? (
        <p
          className={`mt-4 rounded-lg px-4 py-2.5 text-sm font-medium ${
            notice.tone === 'ok' ? 'bg-success-50 text-success-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {hasCipher ? (
        <div className="mt-4 space-y-2 rounded-xl border border-success-300/60 bg-success-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              Your cipher monogram is live on your wedding website.
            </p>
            <form action={clearCipherAction}>
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
              >
                <Undo2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                Switch back to lettering
              </button>
            </form>
          </div>
          <p className="text-xs text-success-800/80">
            Your QR codes and dashboard keep your lettered monogram so your
            initials stay crisp at small sizes.
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ── Canvas ── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative aspect-square w-full touch-none rounded-2xl border border-ink/10 bg-[#FAF7F2]"
            role="application"
            aria-label="Monogram canvas — drag each letter to position it"
          >
            {preview ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                // Markup comes from our own pure renderer over prebuilt
                // geometry — no user-supplied strings beyond A–Z keys.
                dangerouslySetInnerHTML={{ __html: preview.svg }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink/40">
                Loading letterforms…
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-ink/50">
            Drag each letter to position it.
          </p>
        </div>

        {/* ── Controls ── */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="cipher-initials" className="block text-sm font-semibold text-ink">
                Initials
              </label>
              <input
                id="cipher-initials"
                value={config.initials.join('')}
                onChange={(e) => onInitials(e.target.value)}
                maxLength={2}
                autoComplete="off"
                className="mt-1 w-24 rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-center font-serif text-xl tracking-[0.2em] text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <label htmlFor="cipher-font" className="block text-sm font-semibold text-ink">
                Letterform
              </label>
              <select
                id="cipher-font"
                value={config.fontKey}
                onChange={(e) => onFontChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
              >
                <optgroup label="Flowing scripts — can flow as one stroke">
                  {CIPHER_FONTS.filter((f) => f.kind === 'stroke').map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} — {f.hint}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Classic faces — overlap & weave">
                  {CIPHER_FONTS.filter((f) => f.kind === 'filled').map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} — {f.hint}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Mode + its parameter */}
          <div className="space-y-2 rounded-xl border border-ink/10 bg-white/60 p-4">
            <p className="text-sm font-semibold text-ink">How the letters meet</p>
            <div className="flex flex-wrap gap-2">
              {modeOptions.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => patch({ mode: m.key })}
                  aria-pressed={config.mode === m.key}
                  className={segBtn(config.mode === m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {config.mode === 'weave' ? (
              <label className="mt-2 flex items-center gap-3 text-xs text-ink/65">
                <span className="w-20 shrink-0 font-medium text-ink">Weave gap</span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={0.5}
                  value={config.gap}
                  onChange={(e) => patch({ gap: Number(e.target.value) })}
                  className="flex-1"
                />
              </label>
            ) : null}
            {config.mode === 'restroke' ? (
              <label className="mt-2 flex items-center gap-3 text-xs text-ink/65">
                <span className="w-20 shrink-0 font-medium text-ink">Join flow</span>
                <input
                  type="range"
                  min={0.2}
                  max={1.1}
                  step={0.05}
                  value={config.tension}
                  onChange={(e) => patch({ tension: Number(e.target.value) })}
                  className="flex-1"
                />
              </label>
            ) : null}
            {config.mode !== 'restroke' ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-ink/65">
                <span className="font-medium text-ink">In front:</span>
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ front: n as 1 | 2 })}
                    aria-pressed={config.front === n}
                    className={segBtn(config.front === n)}
                  >
                    {config.initials[n - 1]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Per-letter controls */}
          {([0, 1] as const).map((i) => {
            const l = config.letters[i];
            return (
              <div key={i} className="space-y-2 rounded-xl border border-ink/10 bg-white/60 p-4">
                <p className="text-sm font-semibold text-ink">
                  Letter {config.initials[i]}
                </p>
                <label className="flex items-center gap-3 text-xs text-ink/65">
                  <span className="w-20 shrink-0">Size</span>
                  <input
                    type="range"
                    min={0.06}
                    max={0.4}
                    step={0.005}
                    value={l.scale}
                    onChange={(e) => patchLetter(i, { scale: Number(e.target.value) })}
                    className="flex-1"
                  />
                </label>
                <label className="flex items-center gap-3 text-xs text-ink/65">
                  <span className="w-20 shrink-0">Rotate</span>
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    step={1}
                    value={l.rot}
                    onChange={(e) => patchLetter(i, { rot: Number(e.target.value) })}
                    className="flex-1"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => patchLetter(i, { fx: (l.fx * -1) as 1 | -1 })}
                    aria-pressed={l.fx === -1}
                    className={segBtn(l.fx === -1)}
                  >
                    <FlipHorizontal2 aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={2} />
                    Mirror
                  </button>
                  <button
                    type="button"
                    onClick={() => patchLetter(i, { fy: (l.fy * -1) as 1 | -1 })}
                    aria-pressed={l.fy === -1}
                    className={segBtn(l.fy === -1)}
                  >
                    <FlipVertical2 aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={2} />
                    Flip
                  </button>
                </div>
              </div>
            );
          })}

          {/* Ink */}
          <div className="space-y-2 rounded-xl border border-ink/10 bg-white/60 p-4">
            <p className="text-sm font-semibold text-ink">Ink</p>
            <div className="flex flex-wrap gap-2">
              {CIPHER_INKS.map((ink) => (
                <button
                  key={ink.key}
                  type="button"
                  onClick={() => patch({ ink: ink.key })}
                  aria-pressed={config.ink === ink.key}
                  className={segBtn(config.ink === ink.key)}
                >
                  {ink.label}
                </button>
              ))}
            </div>
          </div>

          <form
            action={saveCipherAction}
            className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="config" value={JSON.stringify(config)} />
            <p className="text-xs text-ink/55">
              Saves as your monogram on your wedding website&rsquo;s hero.
            </p>
            <SaveButton />
          </form>
        </div>
      </div>
    </section>
  );
}
