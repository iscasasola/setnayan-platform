'use client';

/**
 * Admin manager for the six homepage background videos.
 *
 * One card per slot:
 *   • slot 0    — the MAIN homepage background video (looping hero).
 *   • slots 1-5 — the five PILLAR "icon" videos in the bottom dock.
 *
 * Flow per slot (simpler than the scroll-scrub hero — no frame extraction):
 *   1. Admin picks a video file.
 *   2. We upload it to R2 (presigned PUT via /api/upload, media bucket).
 *   3. We persist the clip's R2 key (server action) — lands as a DRAFT.
 *   4. Admin clicks Publish → the homepage shows the looping clip.
 *
 * Plain looping clips: short, web-friendly MP4/WebM, muted-autoplay-friendly.
 */

import { useState, type ChangeEvent } from 'react';
import { saveBackgroundVideo, toggleBackgroundVideoPublish } from './actions';

export type SlotState = {
  slot: number;
  pillarKey: string | null;
  label: string;
  url: string | null;
  isPublished: boolean;
  hasVideo: boolean;
};

type Phase = 'idle' | 'uploading' | 'saving' | 'done' | 'error';

async function presignAndPut(body: Blob, pathPrefix: string, filename: string, contentType: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'media', pathPrefix, filename, contentType, sizeBytes: body.size }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Upload failed (${res.status})`);
  }
  const { uploadUrl, r2Key } = (await res.json()) as { uploadUrl: string; r2Key: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!put.ok) throw new Error(`Storage PUT failed (${put.status})`);
  return r2Key;
}

function SlotCard({ initial }: { initial: SlotState }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState(initial.url);
  const [hasVideo, setHasVideo] = useState(initial.hasVideo);
  const [published, setPublished] = useState(initial.isPublished);
  const [busyPublish, setBusyPublish] = useState(false);

  const isMain = initial.slot === 0;
  const working = phase === 'uploading' || phase === 'saving';

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      setPhase('uploading');
      setMsg('Uploading…');
      const videoKey = await presignAndPut(
        file,
        `homepage-bg/slot-${initial.slot}`,
        file.name || `slot-${initial.slot}.mp4`,
        file.type || 'video/mp4',
      );

      setPhase('saving');
      setMsg('Saving…');
      const result = await saveBackgroundVideo({ slot: initial.slot, videoKey, videoMime: file.type || 'video/mp4' });
      if (!result.ok) throw new Error(result.error);

      // Preview the just-picked file locally (the stored URL resolves on reload).
      setUrl(URL.createObjectURL(file));
      setHasVideo(true);
      setPublished(false);
      setPhase('done');
      setMsg('Uploaded — click Publish to make it live.');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  async function onTogglePublish(next: boolean) {
    setBusyPublish(true);
    setError('');
    const result = await toggleBackgroundVideoPublish(initial.slot, next);
    setBusyPublish(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPublished(next);
  }

  return (
    <div className="rounded-2xl border border-[var(--m-line,#e2ded4)] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">
            {isMain ? 'Main · slot 1' : `Bottom icon · slot ${initial.slot + 1}`}
          </div>
          <div className="text-sm font-medium text-[var(--m-ink,#1b1a17)] mt-0.5">{initial.label}</div>
        </div>
        <span
          className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{
            background: published ? 'rgba(60,140,90,.12)' : 'rgba(0,0,0,.05)',
            color: published ? '#2f7d4f' : '#6a6e76',
          }}
        >
          {published ? '● Live' : hasVideo ? 'Draft' : 'Empty'}
        </span>
      </div>

      <div
        className="relative rounded-xl overflow-hidden bg-[#0d0f12] mb-3 flex items-center justify-center"
        style={{ aspectRatio: isMain ? '16 / 9' : '1 / 1' }}
      >
        {url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={url} className="h-full w-full object-cover" muted loop autoPlay playsInline />
        ) : (
          <div className="text-[12px] text-white/50">No video yet</div>
        )}
      </div>

      <label
        className="block cursor-pointer rounded-xl border-2 border-dashed border-[var(--m-line,#e2ded4)] px-4 py-4 text-center hover:border-[var(--m-orange,#a9834b)] transition-colors"
        style={{ opacity: working ? 0.6 : 1, pointerEvents: working ? 'none' : 'auto' }}
      >
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={onPick}
          disabled={working}
        />
        <div className="text-[13px] text-[var(--m-ink,#1b1a17)] font-medium">
          {working ? msg || 'Working…' : hasVideo ? 'Replace video' : 'Upload video'}
        </div>
        <div className="text-[12px] text-[var(--m-slate,#4f535b)] mt-0.5">
          MP4 / WebM / MOV · keep it short &amp; web-friendly{isMain ? ' (16:9 ideal)' : ' (square ideal)'}
        </div>
      </label>

      {phase === 'done' && <div className="mt-2 text-[12px] text-[#2f7d4f]">{msg}</div>}
      {error && <div className="mt-2 text-[12px] text-[#b4252f]">{error}</div>}

      <div className="mt-3 flex items-center gap-2">
        {hasVideo && !published && (
          <button
            type="button"
            onClick={() => onTogglePublish(true)}
            disabled={busyPublish || working}
            className="m-btn m-btn-primary px-4 py-2 text-[13px] rounded-full"
            style={{ opacity: busyPublish || working ? 0.6 : 1 }}
          >
            {busyPublish ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {published && (
          <button
            type="button"
            onClick={() => onTogglePublish(false)}
            disabled={busyPublish}
            className="px-4 py-2 text-[13px] rounded-full border border-[var(--m-line,#e2ded4)] text-[var(--m-slate,#4f535b)]"
            style={{ opacity: busyPublish ? 0.6 : 1 }}
          >
            {busyPublish ? 'Unpublishing…' : 'Unpublish'}
          </button>
        )}
      </div>
    </div>
  );
}

export function BackgroundVideosManager({ slots }: { slots: SlotState[] }) {
  const main = slots.find((s) => s.slot === 0);
  const pillars = slots.filter((s) => s.slot >= 1).sort((a, b) => a.slot - b.slot);
  return (
    <div className="space-y-8">
      {main && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-2">
            Main background video
          </div>
          <div className="max-w-md">
            <SlotCard initial={main} />
          </div>
        </div>
      )}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-2">
          Bottom pillar icons (5)
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((s) => (
            <SlotCard key={s.slot} initial={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
