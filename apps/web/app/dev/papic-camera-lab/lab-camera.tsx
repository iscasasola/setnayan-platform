'use client';

// The lab's client half: mounts the real camera, and shows the uploader's queue
// as data the walk can read (`[data-lab-queue]`). A lab button hands the
// uploader a real 8-second 1440p clip (≥ 6 MB — the size the old route could
// never take), fetched from the walk's own fixture route.

import { useEffect, useRef, useState } from 'react';
import { PapicGuestCapture } from '@/app/papic/guest/_components/papic-guest-capture';
import { PapicSeatCapture } from '@/app/papic/seat/[token]/_components/papic-seat-capture';
import { PapicBuyShell } from '@/app/papic/_components/papic-buy-shell';
import { buyWaitCopy } from '@/lib/papic-buy-urgency';
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

const LAB_TINT = '#7A1F2B';
const LAB_LOGO = (
  <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden>
    <circle cx="24" cy="24" r="22" fill="none" stroke={LAB_TINT} strokeWidth="2" />
    <text x="24" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="17" fill={LAB_TINT}>
      A&amp;B
    </text>
  </svg>
);

/** `?buy=1` — the real floating "Add credits" doorway over the camera, on one fixture rung (it never opens a purchase here). */
const LAB_OFFERS = [{ kind: 'pool_topup' as const, serviceCode: 'LAB_RUNG', points: 50, pricePhp: 249, phrase: '50 more photos' }];

export function LabCamera({ lane, pro = false, buy = false }: { lane: 'guest' | 'vendor' | 'seat'; pro?: boolean; buy?: boolean }) {
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
      lane: lane === 'vendor' ? 'vendor' : 'guest',
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
      {buy && lane !== 'vendor' ? <PapicBuyShell offers={LAB_OFFERS} returnTo="/dev/papic-camera-lab" wait={buyWaitCopy(false)} /> : null}
      {lane === 'seat' ? (
        <PapicSeatCapture
          token="lab-seat"
          seatIndex={1}
          eventId={LAB_EVENT_ID}
          initialPhotos={0}
          initialClips={0}
          isAnon
          eventStyle="ORIG"
          faceMode="mode_b"
          buyOffered={buy}
        />
      ) : lane === 'guest' ? (
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
          dress={pro ? { pro: true, tint: LAB_TINT, logo: LAB_LOGO } : { pro: false, tint: '#FFFFFF', logo: null }}
          photoMark={pro ? { kind: 'monogram', svg: null, text: 'A&B', ink: LAB_TINT } : { kind: 'setnayan' }}
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
