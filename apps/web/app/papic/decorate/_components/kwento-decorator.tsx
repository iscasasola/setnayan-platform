'use client';

/**
 * Kwento Decorator (slice 1 · owner 2026-07-08 "this is ideally kwento").
 *
 * Instagram-Stories-style photo decoration: the guest picks a photo from their
 * device, layers a FILTER (the 5 shipped Papic looks) + EMOJI STICKERS + TEXT
 * on it, and saves it to the couple's gallery. Fully client-side (₱0) — the
 * composite is baked on-device to a canvas, then uploaded through the EXISTING
 * /api/papic/guest-capture route (R2 + NSFW screen + wall + Drive), so a
 * decorated photo is a first-class, moderation-gated gallery capture.
 *
 * Design notes:
 *  • Decorate a DEVICE-SELECTED photo (local object URL) → no cross-origin
 *    canvas tainting (a presigned R2 image would taint toBlob).
 *  • Overlay positions are FRACTIONS of the stage (0..1) so the edit stage and
 *    the export canvas agree regardless of pixel size.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Smile, Trash2, Type } from 'lucide-react';
import { PAPIC_STYLES, cssPreviewFilter, type PapicStyle } from '@/lib/papic-photo-styles';

const STICKERS = ['❤️', '😍', '🎉', '🥂', '💍', '💐', '✨', '🔥', '😂', '🥹', '👑', '🕊️'];
const TEXT_COLORS = ['#ffffff', '#1f1a17', '#e2725b', '#b3446c', '#d4af37'];
const MAX_EXPORT_PX = 1440; // cap the long edge → sane JPEG size

type Overlay = {
  id: string;
  kind: 'sticker' | 'text';
  content: string;
  x: number; // 0..1 of stage width (center)
  y: number; // 0..1 of stage height (center)
  size: number; // fraction of stage width
  color: string;
};

let seq = 0;
const nextId = () => `o${++seq}`;

export function KwentoDecorator({ eventName }: { eventName: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<PapicStyle>('ORIG');
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Revoke the object URL when the photo changes/unmounts.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setOverlays([]);
    setActiveId(null);
    setDone(false);
    setStatus(null);
  };

  const addSticker = (emoji: string) =>
    setOverlays((o) => {
      const id = nextId();
      setActiveId(id);
      return [...o, { id, kind: 'sticker', content: emoji, x: 0.5, y: 0.5, size: 0.16, color: '#000' }];
    });

  const addText = () => {
    const t = textDraft.trim();
    if (!t) return;
    const id = nextId();
    setOverlays((o) => [...o, { id, kind: 'text', content: t, x: 0.5, y: 0.5, size: 0.09, color: textColor }]);
    setActiveId(id);
    setTextDraft('');
  };

  const removeActive = () =>
    setOverlays((o) => o.filter((x) => x.id !== activeId));

  // Pointer drag — fraction-based so it maps 1:1 to the export canvas.
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    const stage = stageRef.current?.getBoundingClientRect();
    const ov = overlays.find((o) => o.id === id);
    if (!stage || !ov) return;
    setActiveId(id);
    dragRef.current = {
      id,
      dx: (e.clientX - stage.left) / stage.width - ov.x,
      dy: (e.clientY - stage.top) / stage.height - ov.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!d || !stage) return;
    const x = Math.min(1, Math.max(0, (e.clientX - stage.left) / stage.width - d.dx));
    const y = Math.min(1, Math.max(0, (e.clientY - stage.top) / stage.height - d.dy));
    setOverlays((o) => o.map((ov) => (ov.id === d.id ? { ...ov, x, y } : ov)));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const resizeActive = (v: number) =>
    setOverlays((o) => o.map((ov) => (ov.id === activeId ? { ...ov, size: v } : ov)));

  const active = overlays.find((o) => o.id === activeId) ?? null;

  const save = useCallback(async () => {
    const img = imgElRef.current;
    if (!img || !img.naturalWidth) return;
    setSaving(true);
    setStatus(null);
    try {
      const scale = Math.min(1, MAX_EXPORT_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no_ctx');

      ctx.filter = cssPreviewFilter(style);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.filter = 'none';

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const ov of overlays) {
        const px = ov.x * w;
        const py = ov.y * h;
        const fontPx = ov.size * w;
        if (ov.kind === 'text') {
          ctx.font = `700 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = ov.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = Math.max(1, fontPx * 0.06);
          ctx.strokeText(ov.content, px, py);
          ctx.fillText(ov.content, px, py);
        } else {
          ctx.font = `${fontPx}px sans-serif`;
          ctx.fillText(ov.content, px, py);
        }
      }

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('export_failed');

      const form = new FormData();
      form.append('file', blob, `kwento-${Date.now()}.jpg`);
      form.append('media_type', 'photo');
      const resp = await fetch('/api/papic/guest-capture', { method: 'POST', body: form });
      const data = (await resp.json().catch(() => ({}))) as { status?: string; error?: string };
      if (resp.ok && data.status === 'ok') {
        setDone(true);
        setStatus('Saved to the couple’s gallery ✨');
      } else if (data.status === 'quota_exhausted') {
        setStatus('You’ve used all your photos for this wedding.');
      } else if (data.status === 'terms_required') {
        setStatus('Please accept the photo terms on the camera page first.');
      } else {
        setStatus('Couldn’t save — please try again.');
      }
    } catch {
      setStatus('Couldn’t save — please try again.');
    } finally {
      setSaving(false);
    }
  }, [overlays, style]);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Decorate a photo</h1>
        <p className="mt-1 text-sm text-ink/60">
          Add stickers, text, and a filter, then save it to {eventName}&rsquo;s gallery.
        </p>

        {!photoUrl ? (
          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 bg-surface px-6 py-16 text-center hover:border-terracotta/50">
            <ImagePlus aria-hidden className="h-8 w-8 text-terracotta" strokeWidth={1.75} />
            <span className="text-sm font-medium text-ink/80">Choose a photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
        ) : (
          <>
            <div
              ref={stageRef}
              className="relative mt-5 overflow-hidden rounded-2xl bg-ink/5 shadow-sm"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not remote */}
              <img
                ref={imgElRef}
                src={photoUrl}
                alt=""
                className="block max-h-[60vh] w-full object-contain"
                style={{ filter: cssPreviewFilter(style) }}
                draggable={false}
              />
              {overlays.map((ov) => (
                <div
                  key={ov.id}
                  onPointerDown={(e) => onPointerDown(e, ov.id)}
                  className={`absolute cursor-move select-none leading-none ${
                    ov.id === activeId ? 'outline outline-2 outline-terracotta/70' : ''
                  }`}
                  style={{
                    left: `${ov.x * 100}%`,
                    top: `${ov.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `calc(${ov.size} * min(100%, 60vh))`,
                    color: ov.color,
                    fontWeight: ov.kind === 'text' ? 700 : 400,
                    textShadow: ov.kind === 'text' ? '0 1px 2px rgba(0,0,0,0.35)' : undefined,
                    touchAction: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ov.content}
                </div>
              ))}
            </div>

            {/* Filter picker — the 5 shipped Papic looks. */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {PAPIC_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  aria-pressed={style === s.id}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    style === s.id ? 'bg-mulberry text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Sticker palette. */}
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
                <Smile aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Stickers
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {STICKERS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addSticker(emoji)}
                    className="rounded-md px-2 py-1 text-xl hover:bg-ink/5"
                    aria-label={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Text tool. */}
            <div className="mt-3 flex items-center gap-2">
              <Type aria-hidden className="h-4 w-4 flex-none text-ink/50" strokeWidth={2} />
              <input
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addText()}
                maxLength={60}
                placeholder="Add a caption…"
                className="min-w-0 flex-1 rounded-md border border-ink/15 bg-surface px-2.5 py-1.5 text-sm"
              />
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColor(c)}
                  aria-label={`Text colour ${c}`}
                  className={`h-5 w-5 flex-none rounded-full border ${
                    textColor === c ? 'border-ink ring-2 ring-terracotta/50' : 'border-ink/20'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                type="button"
                onClick={addText}
                className="flex-none rounded-md bg-ink/10 px-2.5 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/15"
              >
                Add
              </button>
            </div>

            {/* Active-overlay controls. */}
            {active ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-ink/[0.03] px-3 py-2">
                <span className="text-xs text-ink/60">Size</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.4}
                  step={0.01}
                  value={active.size}
                  onChange={(e) => resizeActive(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={removeActive}
                  aria-label="Delete selected"
                  className="rounded p-1 text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              disabled={saving || done}
              onClick={save}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-semibold text-cream hover:bg-terracotta/90 disabled:opacity-60"
            >
              {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
              {done ? 'Saved' : 'Save to gallery'}
            </button>
            {status ? (
              <p className={`mt-2 text-center text-sm ${done ? 'text-success-600' : 'text-ink/70'}`}>
                {status}
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
