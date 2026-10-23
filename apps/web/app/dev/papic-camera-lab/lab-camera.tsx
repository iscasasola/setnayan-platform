'use client';

// The lab's client half: mounts the real camera, and shows the uploader's queue
// as data the walk can read (`[data-lab-queue]`). A lab button hands the
// uploader a real 8-second 1440p clip (≥ 6 MB — the size the old route could
// never take), fetched from the walk's own fixture route.

import { useEffect, useRef, useState } from 'react';
import { PapicGuestCapture } from '@/app/papic/guest/_components/papic-guest-capture';
import { PapicCaptureController } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller';
import { papicUploader, saveShot } from '@/lib/papic-upload/browser';
import { newClientCaptureId } from '@/lib/papic-client-capture-id';
import type { UploaderSnapshot } from '@/lib/papic-upload/replayer';
import * as labStore from '@/lib/papic-upload/store';
import { developCanvas } from '@/lib/papic-upload/develop';
import { applyPapicStylePixels } from '@/lib/papic-photo-styles';

export const LAB_EVENT_ID = '00000000-0000-4000-8000-00000000e1ab';

async function posterOf(clip: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(clip);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error('video'));
    });
    // A real camera's poster is its last live frame; take one from inside the clip.
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      v.currentTime = Math.min(1, (v.duration || 2) / 2);
    });
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LabCamera({ lane }: { lane: 'guest' | 'vendor' }) {
  const [snap, setSnap] = useState<UploaderSnapshot | null>(null);
  useEffect(() => papicUploader().subscribe(setSnap), []);
  // The walk's probes reach the real modules through this (lab only).
  useEffect(() => {
    (window as unknown as { __lab?: unknown }).__lab = { saveShot, papicUploader, store: labStore, developCanvas, applyPapicStylePixels };
  }, []);
  // The fixture clip is fetched while the page is online, so the walk can add it
  // with the link cut — exactly like a clip recorded at a venue with no signal.
  const clipRef = useRef<Blob | null>(null);
  useEffect(() => {
    void fetch('/__lab/clip.mp4')
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        clipRef.current = b;
      })
      .catch(() => {});
  }, []);

  const addClip = async () => {
    const clip = clipRef.current;
    if (!clip) return;
    const poster = await posterOf(clip);
    await saveShot({
      id: newClientCaptureId(),
      lane,
      eventId: LAB_EVENT_ID,
      media: 'clip',
      capturedAtMs: Date.now(),
      durationMs: 8000,
      consent: lane === 'vendor' ? true : undefined,
      primary: new Blob([clip], { type: 'video/mp4' }),
      poster,
    });
  };

  const queue = (snap?.shots ?? []).map((s) => ({
    id: s.id,
    media: s.media,
    prepared: s.prepared,
    settled: s.settled,
    hold: s.hold ?? null,
    attempts: s.attempts,
    lastError: s.lastError ?? null,
    waitMs: Math.max(0, s.nextAttemptAtMs - Date.now()),
    tiers: Object.fromEntries(Object.entries(s.tiers).map(([k, v]) => [k, { size: v!.size, type: v!.contentType, up: v!.uploaded }])),
  }));

  return (
    <div className="bg-ink">
      {lane === 'guest' ? (
        <PapicGuestCapture
          guestName="Lab Guest"
          eventName="Lab Event"
          eventId={LAB_EVENT_ID}
          uploadOwner={null}
          initialRemaining={150}
          total={150}
          termsAccepted
          capApplies
          sponsorShare={false}
          eventStyle="ORIG"
          faceMode="mode_b"
          embedded={false}
          exitTo={{ slug: 'lab', tab: null }}
        />
      ) : (
        <div className="bg-cream px-4">
          <PapicCaptureController
            eventId={LAB_EVENT_ID}
            uploadOwner={null}
            coupleName="Lab Couple"
            tier="ltd"
            allowVideo
            pointsCap={500}
            pointsSpent={0}
          />
        </div>
      )}
      <div className="px-4 py-3 text-xs text-cream/70">
        <button type="button" data-lab-add-clip onClick={() => void addClip()} className="rounded-full bg-cream/10 px-3 py-2 text-cream">
          Add an 8 s 1440p clip
        </button>
        <pre data-lab-queue className="mt-2 hidden">{JSON.stringify({ chip: snap?.chip ?? null, online: snap?.online ?? null, debug: snap ? papicUploader().debugState() : null, queue })}</pre>
      </div>
    </div>
  );
}
