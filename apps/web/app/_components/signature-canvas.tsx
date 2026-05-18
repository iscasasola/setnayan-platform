'use client';

import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

type Props = {
  /** Hidden-input name so the data URL is submitted with the surrounding form. */
  name: string;
  /** Required input — form-submit is blocked if no signature is drawn. */
  required?: boolean;
  /** Optional label, e.g. "Sign here". */
  label?: string;
  /** Optional accessibility hint shown below the canvas. */
  hint?: string;
};

/**
 * SignatureCanvas — pointer-event drawing surface that emits a PNG data URL
 * into a hidden input on every stroke. Touch + mouse + pen all work via the
 * Pointer Events API. PNG output is small (single black stroke on transparent
 * background, ≤200 KB enforced server-side in `parseSignatureDataUrl`).
 *
 * Used by the dual-signature flow (vendor contract page + customer signing
 * page). Caller wraps a form around it; the hidden input lands in FormData.
 */
export function SignatureCanvas({ name, required = true, label, hint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [dataUrl, setDataUrl] = useState('');

  // Initial blank canvas + DPR-aware sizing so the PNG renders crisply on retina.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a1a';
  }, []);

  function localPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = localPoint(e);
  }

  function moveStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const next = localPoint(e);
    const prev = lastPointRef.current ?? next;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastPointRef.current = next;
    setHasInk(true);
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDataUrl(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setDataUrl('');
  }

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-sm font-medium text-ink">
          {label}
          {required ? <span className="ml-1 text-terracotta">*</span> : null}
        </label>
      ) : null}
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-ink/25 bg-cream">
        <canvas
          ref={canvasRef}
          className="block h-44 w-full touch-none sm:h-56"
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={(e) => {
            if (drawingRef.current) endStroke(e);
          }}
          aria-label={label ?? 'Signature area'}
          role="img"
        />
        {!hasInk ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink/40">
            Draw your signature here
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between text-xs">
        <p className="text-ink/55">{hint ?? 'Sign with your finger, mouse, or stylus.'}</p>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="rounded-md px-2 py-1 font-medium text-terracotta hover:bg-terracotta/10 disabled:cursor-not-allowed disabled:text-ink/30 disabled:hover:bg-transparent"
        >
          Clear
        </button>
      </div>
      <input type="hidden" name={name} value={dataUrl} required={required} />
    </div>
  );
}
