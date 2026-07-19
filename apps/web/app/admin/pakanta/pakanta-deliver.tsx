'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Music } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { deliverPakantaSong } from './actions';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * Per-row delivery control on /admin/pakanta. The music team picks the finished
 * song; the shared <FileUpload> uploads it to R2 (same widget + audio MIME set
 * as the couple's site-music row) and emits the r2:// ref via onChange, which we
 * forward to the deliverPakantaSong server action. On success the song is
 * recorded as 'ready' and (when the couple hasn't set their own song)
 * auto-adopted as their site background music.
 */
export function PakantaDeliver({
  eventId,
  alreadyDelivered,
  deliveredFilename,
}: {
  eventId: string;
  alreadyDelivered: boolean;
  deliveredFilename: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();
  const [pickedFilename, setPickedFilename] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { ok: true; adopted: boolean }
    | { ok: false; error: string }
    | null
  >(null);

  function handleChange(value: string | string[] | null) {
    const ref = Array.isArray(value) ? value[0] : value;
    if (!ref) return;
    setResult(null);
    startTransition(async () => {
      const res = await save.run(
        () =>
          deliverPakantaSong({
            eventId,
            songRef: ref,
            filename: pickedFilename ?? 'pakanta-song',
          }),
        { steps: ['Delivering the song'], hint: 'Saving' },
      );
      setResult(res);
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-ink/10 bg-cream/50 p-4">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
        <Music aria-hidden className="h-3.5 w-3.5 text-terracotta" /> Deliver finished song
      </p>

      {alreadyDelivered ? (
        <p className="mb-2 inline-flex items-center gap-1.5 text-sm text-success-700">
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          Delivered{deliveredFilename ? ` — ${deliveredFilename}` : ''}. Upload again to replace.
        </p>
      ) : null}

      <FileUpload
        bucket="media"
        pathPrefix={`events/${eventId}/pakanta-song`}
        multiple={false}
        maxSizeMB={20}
        acceptedTypes={['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']}
        onFilePicked={(file) => setPickedFilename(file.name)}
        onChange={handleChange}
        variant="wide"
        label="Finished song file"
        help="MP3, M4A, AAC, OGG, or WAV. Up to 20 MB. It auto-plays on the couple's site once delivered (unless they already set their own song)."
        disabled={pending}
      />

      {pending ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink/60">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Delivering…
        </p>
      ) : null}

      {result && result.ok ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-success-700">
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {result.adopted
            ? 'Delivered and now playing on the couple’s site.'
            : 'Delivered. The couple already set their own site song — they can switch to this one in their Studio.'}
        </p>
      ) : null}

      {result && !result.ok ? (
        <p className="mt-2 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
