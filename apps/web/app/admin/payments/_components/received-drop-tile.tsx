'use client';

/**
 * "Add received screenshots" — the admin drops many pictures of money that
 * ARRIVED in our BDO app at once (owner 2026-11-17, specs
 * prototypes/admin_payment_verify_2026-11-17/).
 *
 * Each picture is shrunk on the phone first (the reader never benefits past
 * 1568px), then sent in groups of RECEIVED_PER_DROP so no request breaches the
 * 6 MB action body limit. The server reads each one, keeps the reference,
 * amount and time, and throws the picture away.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { approvePayment } from '../actions';

const PER_DROP = 4; // = RECEIVED_PER_DROP in ../received.ts
const MAX_EDGE = 1568;
const MAX_BYTES = 1_400_000;

async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
    if (blob && blob.size <= MAX_BYTES) return blob;
  } catch {
    /* a picture this browser cannot draw is sent as it is */
  }
  return file;
}

export function ReceivedDropTile({ disabledReason }: { disabledReason: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(files: File[]) {
    setError(null);
    const pictures = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (pictures.length === 0) return;
    try {
      for (let i = 0; i < pictures.length; i += PER_DROP) {
        setBusy(`Reading ${Math.min(i + PER_DROP, pictures.length)} of ${pictures.length}…`);
        const fd = new FormData();
        fd.set('intent', 'received-drop');
        for (const f of pictures.slice(i, i + PER_DROP)) {
          const blob = await shrink(f);
          if (blob.size > 5_500_000) continue;
          fd.append('shots', blob, f.name.replace(/\.[^.]+$/, '') + '.jpg');
        }
        await approvePayment(fd);
      }
      router.refresh();
    } catch {
      setError('Some pictures could not be read. Try those again.');
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  const off = disabledReason !== null || busy !== null;
  return (
    <div data-payments-received-drop="">
      <button
        type="button"
        className="ab ab-main flex min-h-14 w-full items-center gap-3 text-left"
        disabled={off}
        aria-busy={busy !== null}
        onClick={() => input.current?.click()}
      >
        <ImagePlus aria-hidden className="h-5 w-5 flex-none" strokeWidth={2} />
        <span className="min-w-0">
          <span className="block font-semibold">{busy ?? 'Add received screenshots'}</span>
          <span className="block text-[13px] opacity-80">{disabledReason ?? 'From your BDO app · many at once'}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void send(Array.from(e.currentTarget.files ?? []))}
      />
      {error ? (
        <p role="alert" className="mt-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
