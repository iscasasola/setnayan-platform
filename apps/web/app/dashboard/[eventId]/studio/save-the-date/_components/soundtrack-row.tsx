'use client';

import { useRef, useState } from 'react';
import { Check, Music, X } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { saveSoundtrack } from '../actions';

type Props = {
  eventId: string;
  currentMusicRef: string | null;
  currentFilename: string | null;
  currentMusicUrl: string | null;
};

export function SoundtrackRow({
  eventId,
  currentMusicRef,
  currentFilename,
  currentMusicUrl,
}: Props) {
  const [replacing, setReplacing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const initialDisplayUrls =
    currentMusicRef && currentMusicUrl
      ? { [currentMusicRef]: currentMusicUrl }
      : undefined;

  function handleUploadDone(value: string | string[] | null) {
    if (value && formRef.current) {
      formRef.current.requestSubmit();
    }
  }

  // Settled state — music is set and we're not replacing it.
  if (currentMusicRef && !replacing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Music aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink/85">Soundtrack</p>
            {currentFilename ? (
              <p className="truncate text-xs text-ink/55">{currentFilename}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
            Added
          </span>
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className="rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/70 transition hover:border-terracotta hover:text-terracotta"
          >
            Replace
          </button>
        </div>
      </div>
    );
  }

  // Upload form — shown when no music yet, or when replacing.
  return (
    <form ref={formRef} action={saveSoundtrack} className="space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink/85">Soundtrack</p>
        {replacing ? (
          <button
            type="button"
            onClick={() => setReplacing(false)}
            className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/70 transition hover:border-ink/30"
          >
            <X aria-hidden className="h-3 w-3" strokeWidth={2} />
            Cancel
          </button>
        ) : null}
      </div>
      <FileUpload
        bucket="media"
        pathPrefix={`events/${eventId}/site-music`}
        name="music_r2_ref"
        maxSizeMB={20}
        acceptedTypes={['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']}
        currentValue={replacing ? null : undefined}
        initialDisplayUrls={replacing ? undefined : initialDisplayUrls}
        onChange={handleUploadDone}
        help="MP3 · M4A · WAV · up to 20 MB"
      />
    </form>
  );
}
