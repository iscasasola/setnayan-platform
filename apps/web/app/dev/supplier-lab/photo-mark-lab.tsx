'use client';

/**
 * /dev/supplier-lab?s=photo-mark — 🔏 the Seal and plate + the Frame step (owner-approved 2026-11-04, #7246 · #7247) on
 * the REAL uploader, with no storage and no database. DEV-ONLY (the lab page 404s in production).
 *
 *   The Card Maker's cover — the same `<FileUpload>` props `canvas-maker.tsx` passes (thumb, square frame,
 *   service-card previews) except two lab facts: `mark="setnayan"` (the server answers that tier without a session,
 *   and it is exactly what an UNVERIFIED shop's photos carry) and a `send` stand-in that keeps the marked bytes in
 *   the browser instead of R2. Pick a photo → the Frame step → "Looks good" → the marked, framed cover; tap the thumb
 *   to re-frame it in place.
 *
 *   ?s=photo-mark&verified=1 — also paints a sample with a VERIFIED shop's spec, through the same browser painter
 *   (`markPhotoFile`). Painter only: in the app that spec is read on the server from the shop's own row.
 *
 * Names are samples: nobody real.
 */
import { useEffect, useState } from 'react';
import { FileUpload } from '@/app/_components/file-upload';
import type { UploadSend } from '@/lib/upload-send';

const labSend: UploadSend = (job) => {
  const url = URL.createObjectURL(job.file);
  const done = new Promise<{ ok: true; r2Ref: string; displayUrl: string }>((resolve) =>
    setTimeout(() => resolve({ ok: true, r2Ref: `r2://setnayan-media/vendors/lab/services/${job.file.name}`, displayUrl: url }), 400),
  );
  return { done, sent: done.then(() => undefined), cancel: () => {} };
};

/** A colour token from globals.css (`--color-*` holds "R G B" channels), as a canvas colour. */
function tok(name: string, alpha = 1): string {
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `rgb(${rgb} / ${alpha})`;
}

/** A sample photo drawn in the browser (no asset to ship): a warm sky, a horizon, two figures — painted from the
 *  app's own colour tokens, never raw hex. */
async function samplePhoto(w: number, h: number): Promise<File> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = tok('--color-cream');
  g.fillRect(0, 0, w, h);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, tok('--color-terracotta', 0.35));
  sky.addColorStop(0.6, tok('--color-mulberry', 0.55));
  sky.addColorStop(1, tok('--color-ink', 0.85));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = tok('--color-ink');
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.fillStyle = tok('--color-cream');
  g.beginPath();
  g.ellipse(w * 0.44, h * 0.6, w * 0.05, h * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = tok('--ink-soft');
  g.beginPath();
  g.ellipse(w * 0.56, h * 0.6, w * 0.05, h * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
  return new File([blob], 'cover.jpg', { type: 'image/jpeg' });
}

function VerifiedSample() {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { markPhotoFile } = await import('@/lib/watermark');
        const out = await markPhotoFile(await samplePhoto(1200, 1500), {
          spec: { kind: 'supplier', verified: true, shopName: 'Bloom & Vine Studio', slug: 'bloom-vine', hasLogo: false },
        });
        if (alive) setUrl(URL.createObjectURL(out));
      } catch (e) {
        if (alive) setErr(String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="space-y-2" data-lab-verified={url ? 'painted' : err ? 'failed' : 'painting'}>
      <h2 className="text-[15px] font-semibold text-ink">A verified shop’s mark (painter only)</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="A sample photo with the verified Seal and plate" className="w-full rounded-xl" /> : null}
      {err ? <p className="text-[13px] text-danger-700">{err}</p> : null}
    </section>
  );
}

export function PhotoMarkLab({ verified }: { verified: boolean }) {
  return (
    <main className="mx-auto max-w-[440px] space-y-6 px-4 py-6">
      <header>
        <h1 className="text-[20px] font-semibold text-ink">Your service card</h1>
        <p className="text-[14px] text-ink/65">Lab · the cover upload, marked and framed. Nothing is stored.</p>
      </header>
      <FileUpload
        bucket="media"
        pathPrefix="vendors/lab/services"
        name="primary_photo_r2_key"
        unsavedHint="press Create below"
        maxSizeMB={5}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
        mark="setnayan"
        frame="square"
        previews="service-card"
        compressImage
        variant="square"
        thumb={{ add: 'Add a cover', replace: 'Replace' }}
        send={labSend}
      />
      <button
        type="button"
        data-lab-pick=""
        className="text-[13px] font-medium text-terracotta-700 underline"
        onClick={async () => {
          const input = document.querySelector<HTMLInputElement>('input[type="file"]');
          if (!input) return;
          const dt = new DataTransfer();
          dt.items.add(await samplePhoto(1200, 1600));
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }}
      >
        Lab: pick the sample photo
      </button>
      {verified ? <VerifiedSample /> : null}
    </main>
  );
}
