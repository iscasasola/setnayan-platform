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
 * Overlays are draggable (body) + resizable & rotatable (corner handle), the
 * standard transform-handle model. Positions/rotation are FRACTIONS / degrees
 * relative to the stage, so the edit stage and the export canvas agree exactly
 * regardless of pixel size.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCw, Smile, Type, Undo2, X } from 'lucide-react';
import { PAPIC_STYLES, cssPreviewFilter, type PapicStyle } from '@/lib/papic-photo-styles';

const STICKERS = [
  '❤️', '😍', '🥰', '😘', '😂', '🥹', '😭', '🔥',
  '🎉', '🥂', '🍾', '🎊', '💍', '💐', '🌸', '🌺',
  '🕊️', '🦋', '✨', '🌟', '💫', '👑', '🫶', '💯',
];
const TEXT_COLORS = ['#ffffff', '#1f1a17', '#e2725b', '#b3446c', '#d4af37'];
const MAX_EXPORT_PX = 1440; // cap the long edge → sane JPEG size
const MIN_SIZE = 0.04;
const MAX_SIZE = 0.6;

type Overlay = {
  id: string;
  kind: 'sticker' | 'text';
  content: string;
  x: number; // 0..1 of stage width (center)
  y: number; // 0..1 of stage height (center)
  size: number; // fraction of stage width
  rotation: number; // degrees
  color: string;
};

type Drag =
  | { id: string; mode: 'move'; dx: number; dy: number }
  | {
      id: string;
      mode: 'transform';
      cx: number;
      cy: number;
      startDist: number;
      startAngle: number;
      startSize: number;
      startRot: number;
    };

let seq = 0;
const nextId = () => `o${++seq}`;

export function KwentoDecorator({
  eventName,
  canKwento,
}: {
  eventName: string;
  canKwento: boolean;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<PapicStyle>('ORIG');
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<Overlay[][]>([]); // undo stack (add/delete)

  // Slice 2 — the Kwento CAPTION on the decorated photo (words + decoration).
  const [savedCaptureId, setSavedCaptureId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [captionConsent, setCaptionConsent] = useState(false);
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionDone, setCaptionDone] = useState(false);
  const [captionStatus, setCaptionStatus] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<Drag | null>(null);

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

  // Undo stack — snapshots the overlays before each add/delete (drags are easy
  // to redo by hand; this covers the "oops, wrong sticker / deleted it" case).
  const pushHistory = () => setHistory((h) => [...h.slice(-29), overlays]);
  const undo = () => {
    if (history.length === 0) return;
    setOverlays(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
    setActiveId(null);
  };

  const addSticker = (emoji: string) => {
    pushHistory();
    const id = nextId();
    setOverlays((o) => [
      ...o,
      { id, kind: 'sticker', content: emoji, x: 0.5, y: 0.5, size: 0.18, rotation: 0, color: '#000' },
    ]);
    setActiveId(id);
  };

  const addText = () => {
    const t = textDraft.trim();
    if (!t) return;
    pushHistory();
    const id = nextId();
    setOverlays((o) => [
      ...o,
      { id, kind: 'text', content: t, x: 0.5, y: 0.5, size: 0.09, rotation: 0, color: textColor },
    ]);
    setActiveId(id);
    setTextDraft('');
  };

  const removeActive = () => {
    pushHistory();
    setOverlays((o) => o.filter((x) => x.id !== activeId));
  };

  // BODY drag → move (fraction-based). stopPropagation so tapping an overlay
  // doesn't bubble to the stage's deselect handler.
  const onBodyDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current?.getBoundingClientRect();
    const ov = overlays.find((o) => o.id === id);
    if (!stage || !ov) return;
    setActiveId(id);
    dragRef.current = {
      id,
      mode: 'move',
      dx: (e.clientX - stage.left) / stage.width - ov.x,
      dy: (e.clientY - stage.top) / stage.height - ov.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  // CORNER handle → resize + rotate around the overlay's center.
  const onHandleDown = (e: React.PointerEvent, ov: Overlay) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    setActiveId(ov.id);
    const cx = stage.left + ov.x * stage.width;
    const cy = stage.top + ov.y * stage.height;
    dragRef.current = {
      id: ov.id,
      mode: 'transform',
      cx,
      cy,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
      startSize: ov.size,
      startRot: ov.rotation,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!d || !stage) return;
    if (d.mode === 'move') {
      const x = Math.min(1, Math.max(0, (e.clientX - stage.left) / stage.width - d.dx));
      const y = Math.min(1, Math.max(0, (e.clientY - stage.top) / stage.height - d.dy));
      setOverlays((o) => o.map((ov) => (ov.id === d.id ? { ...ov, x, y } : ov)));
    } else {
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      const angle = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
      const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, (d.startSize * dist) / d.startDist));
      const rotation = d.startRot + ((angle - d.startAngle) * 180) / Math.PI;
      setOverlays((o) => o.map((ov) => (ov.id === d.id ? { ...ov, size, rotation } : ov)));
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

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
        ctx.save();
        ctx.translate(px, py);
        if (ov.rotation) ctx.rotate((ov.rotation * Math.PI) / 180);
        if (ov.kind === 'text') {
          ctx.font = `700 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = ov.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = Math.max(1, fontPx * 0.06);
          ctx.strokeText(ov.content, 0, 0);
          ctx.fillText(ov.content, 0, 0);
        } else {
          ctx.font = `${fontPx}px sans-serif`;
          ctx.fillText(ov.content, 0, 0);
        }
        ctx.restore();
      }

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('export_failed');

      const form = new FormData();
      form.append('file', blob, `kwento-${Date.now()}.jpg`);
      form.append('media_type', 'photo');
      const resp = await fetch('/api/papic/guest-capture', { method: 'POST', body: form });
      const data = (await resp.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
        captureId?: string | null;
      };
      if (resp.ok && data.status === 'ok') {
        setDone(true);
        setSavedCaptureId(data.captureId ?? null);
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

  // Slice 2 — anchor a Kwento caption on the just-saved decorated photo. Uses
  // the shipped /api/papic/kwento contract (story voice, ≤280, explicit consent).
  const saveCaption = useCallback(async () => {
    const text = caption.trim();
    if (!savedCaptureId || text.length < 1) return;
    setCaptionSaving(true);
    setCaptionStatus(null);
    try {
      const resp = await fetch('/api/papic/kwento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId: savedCaptureId,
          body: text,
          consent: captionConsent,
          voiceDepth: 'story',
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (resp.ok && data.ok) {
        setCaptionDone(true);
        setCaptionStatus('Your caption was added ✨');
      } else if (data.error === 'consent_required') {
        setCaptionStatus('Please tick the box to share your caption.');
      } else if (data.error === 'keep_it_sweet') {
        setCaptionStatus('Let’s keep it kind — try rephrasing.');
      } else if (data.error === 'limit_reached') {
        setCaptionStatus('You’ve reached the caption limit for this wedding.');
      } else {
        setCaptionStatus('Couldn’t add the caption — please try again.');
      }
    } catch {
      setCaptionStatus('Couldn’t add the caption — please try again.');
    } finally {
      setCaptionSaving(false);
    }
  }, [caption, savedCaptureId, captionConsent]);

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
            <style>{`@keyframes kdpop{0%{transform:scale(1)}42%{transform:scale(1.22)}100%{transform:scale(1)}}`}</style>
            <div
              ref={stageRef}
              className="relative mt-5 touch-none select-none overflow-hidden rounded-2xl bg-ink/5 shadow-sm"
              style={{ containerType: 'inline-size' }}
              onPointerDown={() => setActiveId(null)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
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
              {overlays.map((ov) => {
                const isActive = ov.id === activeId;
                return (
                  <div
                    key={ov.id}
                    onPointerDown={(e) => onBodyDown(e, ov.id)}
                    className="absolute cursor-move leading-none"
                    style={{
                      left: `${ov.x * 100}%`,
                      top: `${ov.y * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${ov.rotation}deg)`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {/* Selection is a shape-tracing GLOW + a POP — no square outline.
                        cqw sizes the glyph off the stage width (matches the export). */}
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: `${ov.size * 100}cqw`,
                        color: ov.color,
                        fontWeight: ov.kind === 'text' ? 700 : 400,
                        textShadow: ov.kind === 'text' ? '0 1px 2px rgba(0,0,0,0.35)' : undefined,
                        filter: isActive
                          ? 'drop-shadow(0 0 5px rgba(216,90,48,0.95)) drop-shadow(0 0 12px rgba(216,90,48,0.55))'
                          : undefined,
                        animation: isActive ? 'kdpop 0.3s ease' : undefined,
                      }}
                    >
                      {ov.content}
                    </span>
                    {isActive ? (
                      <>
                        <span
                          onPointerDown={(e) => onHandleDown(e, ov)}
                          role="button"
                          aria-label="Resize and rotate"
                          className="absolute -bottom-3 -right-3 flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-full bg-terracotta text-cream shadow"
                        >
                          <RotateCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </span>
                        <span
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeActive();
                          }}
                          role="button"
                          aria-label="Delete"
                          className="absolute -left-3 -top-3 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-ink text-cream shadow"
                        >
                          <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                      </>
                    ) : null}
                  </div>
                );
              })}
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
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
                  <Smile aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Stickers
                </p>
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.length === 0}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/60 hover:bg-ink/5 disabled:opacity-40"
                >
                  <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Undo
                </button>
              </div>
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

            {/* Interaction hint — delete now lives on the overlay's × handle. */}
            <p className="mt-3 text-center text-xs text-ink/45">
              Drag to move · corner knob to resize &amp; rotate · × to delete
            </p>

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

            {/* Slice 2 — the Kwento caption on the saved decorated photo. Only
                after a successful save, and only if the event has Kwento on. */}
            {done && canKwento && savedCaptureId && !captionDone ? (
              <div className="mt-5 rounded-xl border border-ink/10 bg-surface p-4">
                <p className="text-sm font-medium text-ink">Add a caption</p>
                <p className="mt-0.5 text-xs text-ink/55">
                  Tell the couple the story behind this photo.
                </p>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="What was happening here?"
                  className="mt-2 w-full rounded-md border border-ink/15 bg-cream px-2.5 py-2 text-sm"
                />
                <label className="mt-2 flex items-start gap-2 text-xs text-ink/65">
                  <input
                    type="checkbox"
                    checked={captionConsent}
                    onChange={(e) => setCaptionConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I&rsquo;m okay with the couple sharing my caption with this photo.</span>
                </label>
                <button
                  type="button"
                  disabled={captionSaving || caption.trim().length < 1}
                  onClick={saveCaption}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60"
                >
                  {captionSaving ? (
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : null}
                  Add caption
                </button>
                {captionStatus ? (
                  <p className="mt-2 text-center text-sm text-ink/70">{captionStatus}</p>
                ) : null}
              </div>
            ) : null}
            {captionDone ? (
              <p className="mt-3 text-center text-sm text-success-600">{captionStatus}</p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
