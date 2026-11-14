'use client';
/**
 * 🎬 STORY VIDEO (the loaded half — `story-video.tsx` is the door that fetches this only when tapped). A port of
 * `storyMake` from the approved prototype `badge-milestones_v35.html` (owner 15 Nov: *"we do not share them a 10
 * second animation for their story, just a photo?"* — so it is a 10-second VIDEO): the 1080×1920 scene of
 * `story-rig.ts` is recorded on the phone with MediaRecorder, codec order mp4 avc1 → mp4 → webm → a still PNG where a
 * phone cannot record. Save is a plain `<a download>` of the blob; Share uses the phone's share sheet when it can take
 * files. NOTHING IS UPLOADED — no fetch, no server.
 *
 * v46: `reveal` (No. 1 only) records the 15-second velvet-curtain reveal; `durationS` overrides the length
 * (default: the scene's own — 15 with the reveal, else 10).
 */
import { useEffect, useRef, useState } from 'react';
import s from './award.module.css';
import { pickStoryMime, storyRig, type StoryInput } from './story-rig';
import { useModalDialog } from './shared';

export type StoryVideoProps = {
  input: StoryInput;
  /** What the clip shows, for a screen reader ("Gold Completed bookings badge awarded to Petal & Pine"). */
  label: string;
  /** Saved file's name without extension. */
  fileName?: string;
  /** v46: the No. 1 velvet-curtain reveal (No. 1 only). Same as `input.reveal`; either one turns it on. */
  reveal?: boolean;
  /** v46: the clip's length in seconds. Defaults to the scene's own (15 with the reveal, else 10). */
  durationS?: number;
  onClose: () => void;
};

type Made = { url: string; file: File; video: boolean; canShare: boolean; secs: number };

export function StoryVideoImpl({ input, label, fileName = 'setnayan-badge', reveal, durationS, onClose }: StoryVideoProps) {
  const dlg = useModalDialog(onClose);
  const bar = useRef<HTMLElement>(null);
  const [made, setMade] = useState<Made | null>(null);
  const cancelled = useRef(false);
  const saveRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // one run per effect (StrictMode mounts twice in dev): `dead` is this run's, `cancelled` is the person's Cancel
    let dead = false;
    const gone = () => dead || cancelled.current;
    let url = '';
    let raf = 0;
    let rec: MediaRecorder | null = null;
    (async () => {
      const rig = await storyRig(reveal ? { ...input, reveal: true } : input);
      if (gone()) return;
      // v46: storyMake records rig.dur (15 for the No. 1 reveal, else 10)
      const DUR = durationS && durationS > 0 ? durationS : rig.dur;
      const c = rig.canvas;
      const canRecord = typeof window.MediaRecorder !== 'undefined' && typeof c.captureStream === 'function';
      const mime = pickStoryMime(canRecord ? (m) => MediaRecorder.isTypeSupported(m) : null);
      let blob: Blob | null = null;
      let ext = 'png';
      if (mime) {
        const st = c.captureStream(30);
        rec = new MediaRecorder(st, { mimeType: mime, videoBitsPerSecond: 8e6 });
        const ch: Blob[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) ch.push(e.data);
        };
        const r = rec;
        const done = new Promise<void>((res) => (r.onstop = () => res()));
        rig.frame(0);
        r.start(250);
        const t0 = performance.now();
        await new Promise<void>((res) => {
          const tick = () => {
            if (gone()) {
              if (r.state !== 'inactive') r.stop();
              return res();
            }
            const t = (performance.now() - t0) / 1000;
            rig.frame(Math.min(t, DUR));
            if (bar.current) bar.current.style.width = Math.min(100, (t / DUR) * 100) + '%';
            if (t >= DUR + 0.5) {
              r.stop();
              res();
            } else raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });
        await done;
        if (gone()) return;
        blob = new Blob(ch, { type: mime.split(';')[0] });
        ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      } else {
        rig.frame(DUR);
        blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
      }
      if (!blob || gone()) return;
      url = URL.createObjectURL(blob);
      const file = new File([blob], `${fileName}.${ext}`, { type: blob.type });
      let canShare = false;
      try {
        canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      } catch {
        canShare = false;
      }
      setMade({ url, file, video: ext !== 'png', canShare, secs: Math.round(DUR) });
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      if (rec && rec.state !== 'inactive') rec.stop();
      if (url) URL.revokeObjectURL(url);
    };
    // made once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (made) saveRef.current?.focus();
  }, [made]);

  const close = () => {
    cancelled.current = true;
    onClose();
  };

  return (
    <dialog
      ref={dlg}
      className={s.sty}
      aria-label="Share to story"
      data-award-story=""
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {made ? (
        <>
          {made.video ? (
            <video src={made.url} autoPlay loop muted playsInline aria-label={`Your ${made.secs}-second story: ${label}`} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Your story picture" src={made.url} />
          )}
          <div className={s.styRow}>
            <a ref={saveRef} className={`${s.styBtn} ${s.stySave}`} href={made.url} download={made.file.name}>
              Save {made.video ? 'video' : 'picture'}
            </a>
            {made.canShare ? (
              <button
                type="button"
                className={`${s.styBtn} ${s.styGo}`}
                onClick={async () => {
                  try {
                    await navigator.share({ files: [made.file], title: 'Awarded by Setnayan' });
                  } catch {
                    /* the person closed the share sheet */
                  }
                }}
              >
                Share
              </button>
            ) : null}
            <button type="button" className={`${s.styBtn} ${s.styClose}`} onClick={close}>
              Close
            </button>
          </div>
          <p>Save the {made.video ? `${made.secs}-second video` : 'picture'}, then post it to your Instagram or Facebook story.</p>
        </>
      ) : (
        <>
          <p className={s.styMaking} role="status">
            Making your story…
          </p>
          <div className={s.styTrack}>
            <i ref={bar} className={s.styBar} style={{ background: input.tone }} />
          </div>
          <div className={s.styRow}>
            <button type="button" className={`${s.styBtn} ${s.styClose}`} onClick={close}>
              Cancel
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
