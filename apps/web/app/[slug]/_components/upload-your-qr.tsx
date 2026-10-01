'use client';

import { useRef, useState } from 'react';
import { NOT_THIS_EVENTS_CODE, UNREADABLE_QR, uploadedQrTarget } from '@/lib/uploaded-qr';

/**
 * "UPLOAD YOUR QR" (owner 2026-09-27: *"sign in to enter or upload your qr to
 * login"*). The guest picks a photo or screenshot of their personal QR — the
 * one the couple sent them on Messenger — and it is decoded HERE, in the
 * browser, with the repo's own `jsqr` (the same dynamic import the check-in
 * desk uses). The picture never leaves the phone.
 *
 * A code that is this event's invitation goes to that key (`uploadedQrTarget`),
 * so the ordinary key flow runs — the redeem route, then the RSVP-first gate.
 * Anything else gets one plain line.
 */
export function UploadYourQr({ slug }: { slug: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setSaid(null);
    setBusy(true);
    try {
      const [{ default: jsQR }, bitmap] = await Promise.all([import('jsqr'), createImageBitmap(file)]);
      // Big phone photos are scaled down first — decoding is faster and no less sure.
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(bitmap, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      const found = jsQR(pixels.data, w, h, { inversionAttempts: 'attemptBoth' });
      // Nothing read at all is not "the wrong code" — it says how to fix it.
      if (!found) {
        setSaid(UNREADABLE_QR);
        return;
      }
      const target = uploadedQrTarget(found.data, slug);
      if (target) {
        window.location.assign(target);
        return;
      }
      setSaid(NOT_THIS_EVENTS_CODE);
    } catch {
      setSaid(UNREADABLE_QR);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2" data-upload-your-qr="">
      <label className="button-primary flex min-h-[52px] w-full cursor-pointer items-center justify-center">
        {busy ? 'Reading your QR…' : 'Upload your QR'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
      </label>
      <p className="text-center text-xs text-ink/60">A photo or screenshot of the QR sent to you.</p>
      {said ? (
        <p role="alert" className="text-center text-sm font-medium text-terracotta-700">
          {said}
        </p>
      ) : null}
    </div>
  );
}
