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

export function DemoCaptureReel({ slug }: { slug: string }) {
  const scenes = RICH_SCENES[slug];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!scenes || scenes.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % scenes.length), STEP_MS);
    return () => clearInterval(t);
  }, [scenes]);

  if (!scenes || scenes.length === 0) {
    return <div className="reel-root">unknown demo slug</div>;
  }
  const f = scenes[Math.min(i, scenes.length - 1)];
  if (!f) return null;

  return (
    <div className="reel-root" data-reel-ready>
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
        <div className="reel-caption">
          <p className="reel-cap">{f.caption}</p>
          {f.hint ? <p className="reel-hint">{f.hint}</p> : null}
        </div>
      </div>
      <style>{`
        html,body{margin:0;padding:0;overflow:hidden;background:#000;}
        /* Hide the Next.js dev-mode indicator + any toast so the capture is
           clean (dev-only chrome; never in the recorded frame). */
        nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important;}
        .reel-root{position:fixed;inset:0;z-index:2147483647;background:#000;
          display:flex;align-items:center;justify-content:center;}
        .reel{position:relative;width:230px;height:486px;overflow:hidden;background:#000;}
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
