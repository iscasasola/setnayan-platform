import { notFound } from 'next/navigation';
import { DemoCaptureReel } from './reel';

// Internal demo-capture surface. NOT a product route — it exists so
// `scripts/capture-demo-videos.mjs` (Playwright) can record each feature's
// native scenes into the looping MP4s under public/add-ons/demo/. 404s in
// production unless ALLOW_DEMO_CAPTURE=1 is explicitly set (so a CI/preview
// job could regenerate). Renders the reel ONLY (a fixed full-screen overlay
// covers the app chrome — see reel.tsx).

export const dynamic = 'force-dynamic';

export default async function DemoCapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /** `?scene=N` pins one frame and `&plain=1` drops the caption — the still
   *  capture's contract (`scripts/capture-demo-stills.mjs`). Neither is set by
   *  the video recorder, which keeps the looping reel. */
  searchParams: Promise<{ scene?: string; plain?: string }>;
}) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_CAPTURE !== '1') {
    notFound();
  }
  const { slug } = await params;
  const { scene, plain } = await searchParams;
  const pinned = scene != null && /^\d+$/.test(scene) ? Number(scene) : undefined;
  // The reel (a client component) validates the slug against RICH_SCENES and
  // shows "unknown demo slug" if it's not a real feature — no server-side slug
  // list needed (importing the client module's value array here would yield a
  // client-reference proxy, not the array).
  return <DemoCaptureReel slug={slug} scene={pinned} plain={plain === '1'} />;
}
