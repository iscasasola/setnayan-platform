import { fetchHeroVideoConfigForAdmin } from '@/lib/hero-video';
import { HeroUploader } from '@/app/admin/hero-video/hero-uploader';

/**
 * HeroVideoSurface — the Homepage hero video body, re-homed byte-identical
 * from app/admin/hero-video/page.tsx into the tabbed /admin/studio studio
 * (Studio Studio slice 1). No searchParams, no filter/mutation form in the
 * body — the browser-side upload + publish lives in the HeroUploader client
 * component, imported unchanged from @/app/admin/hero-video/hero-uploader
 * (which imports its own actions from @/app/admin/hero-video/actions). The
 * only change is mechanical: the outer max-w-3xl container is dropped (the
 * studio shell provides layout), matching the surface convention.
 */
export async function HeroVideoSurface() {
  const config = await fetchHeroVideoConfigForAdmin();
  const thumbs =
    config.frameUrls.length > 0
      ? [
          config.frameUrls[0],
          config.frameUrls[Math.floor(config.frameUrls.length / 2)],
          config.frameUrls[config.frameUrls.length - 1],
        ].filter((u): u is string => typeof u === 'string')
      : [];

  return (
    <div>
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-1">Content</div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1b1a17)]">Homepage hero video</h1>
        <p className="text-[14px] leading-relaxed text-[var(--m-slate,#4f535b)] mt-2">
          Upload a short video and it becomes the homepage hero — a full-screen scroll-scrub that ends on a
          {' '}&ldquo;Start your wedding planning here — free&rdquo; call to action. Frames are extracted right here in
          your browser, stored, and played frame-by-frame as visitors scroll. Until you publish, the homepage keeps
          its current hero.
        </p>
      </div>

      <HeroUploader initialPublished={config.isPublished} initialFrameCount={config.frameCount} />

      {thumbs.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-2">
            Current frames · first · middle · last
          </div>
          <div className="flex gap-3">
            {thumbs.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={u}
                alt={`Hero video ${['first', 'middle', 'last'][i] ?? 'sample'} frame`}
                className="h-28 w-28 rounded-lg border border-[var(--m-line,#e2ded4)] object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
