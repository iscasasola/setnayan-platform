'use client';

import { useEffect, useState } from 'react';
import { RICH_SCENES } from '@/app/_components/app-store/studio-card-demo';

// Deterministic capture reel — renders ONE feature's four native scenes on a
// loop with the result caption + operation hint baked in at the bottom, sized
// to the exact 9:19 content box of the in-app phone frame (no bezel; the
// in-app <video> sits inside the bezel). A fixed full-screen black overlay
// covers the app chrome so Playwright records only the scene. NOT a user
// surface — see page.tsx (dev/CI-gated). The output mp4 IS this, recorded.

const STEP_MS = 3000; // mirrors ADVANCE_MS in studio-card-demo.tsx

export function DemoCaptureReel({
  slug,
  scene,
  plain = false,
}: {
  slug: string;
  /**
   * Pin ONE scene instead of looping — for `scripts/capture-demo-stills.mjs`,
   * which photographs each scene for the product pages' spotlights. A
   * timing-based grab of a 3-second loop is a coin toss on a slow CI runner;
   * a pinned frame is a measurement. Absent (the recorder's case), the reel
   * loops exactly as before.
   */
  scene?: number;
  /** Drop the baked caption strip. A spotlight sets its own title beside the
   *  picture, so a second caption inside it would say the thing twice. */
  plain?: boolean;
}) {
  const scenes = RICH_SCENES[slug as keyof typeof RICH_SCENES];
  const pinned = scene != null && Number.isInteger(scene) && scene >= 0;
  const [i, setI] = useState(pinned ? scene : 0);

  useEffect(() => {
    if (pinned || !scenes || scenes.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % scenes.length), STEP_MS);
    return () => clearInterval(t);
  }, [pinned, scenes]);

  if (!scenes || scenes.length === 0) {
    return <div className="reel-root">unknown demo slug</div>;
  }
  const f = scenes[Math.min(i, scenes.length - 1)];
  if (!f) return null;

  return (
    // `data-reel-count` / `data-reel-scene` let the still capture loop exactly
    // as many times as there are scenes, instead of guessing from the pixels
    // (animated scenes never produce two identical frames, so "stop at the
    // first repeat" wrote duplicates).
    <div
      className="reel-root"
      data-reel-ready
      data-reel-count={scenes.length}
      data-reel-scene={Math.min(i, scenes.length - 1)}
    >
      <div className="reel">
        <div key={i} className="reel-scene">
          {/* A real-screenshot-backed scene (RichFrame.image) records into the
              MP4 just like a native scene; scene is the fallback. */}
          {f.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.image} alt={f.caption} className="h-full w-full object-cover" />
          ) : (
            f.scene
          )}
        </div>
        {plain ? null : (
          <div className="reel-caption">
            <p className="reel-cap">{f.caption}</p>
            {f.hint ? <p className="reel-hint">{f.hint}</p> : null}
          </div>
        )}
      </div>
      <style>{`
        html,body{margin:0;padding:0;overflow:hidden;background:#000;}
        /* Hide the Next.js dev-mode indicator + any toast so the capture is
           clean (dev-only chrome; never in the recorded frame). */
        nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important;}
        .reel-root{position:fixed;inset:0;z-index:2147483647;background:#000;
          display:flex;align-items:center;justify-content:center;}
        /* The stage is authored at the in-app 230x486 content box. The capture
           viewport is 2x that (see capture-demo-videos.mjs), and CSS zoom --
           not a transform -- makes it fill: zoom re-lays-out at the larger
           size so text is rasterised at true 2x, where a transform would
           upscale an already-rasterised bitmap. Without this the recorder
           padded three quarters of every frame.
           NO BACKTICKS IN HERE: this comment lives inside a template
           literal, and one closes the string. */
        .reel{position:relative;width:230px;height:486px;overflow:hidden;background:#000;
          zoom:2;}
        .reel-scene{position:absolute;inset:0;animation:reelFade .32s ease;}
        .reel-caption{position:absolute;left:0;right:0;bottom:0;padding:16px 13px 14px;
          background:linear-gradient(to top, rgba(17,17,19,.9), rgba(17,17,19,.55) 58%, transparent);}
        .reel-cap{margin:0;color:#fff;font-weight:600;font-size:13px;line-height:1.25;
          letter-spacing:-.01em;}
        .reel-hint{margin:3px 0 0;color:rgba(255,255,255,.8);font-size:10.5px;line-height:1.3;}
        @keyframes reelFade{from{opacity:.4}to{opacity:1}}
      `}</style>
    </div>
  );
}
