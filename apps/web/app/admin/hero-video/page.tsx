import { fetchHeroVideoConfigForAdmin } from '@/lib/hero-video';
import { HeroUploader } from './hero-uploader';

export const metadata = { title: 'Hero video · Admin' };

/**
 * Admin · Homepage hero video. Upload a short clip → it's extracted to frames
 * in the browser → published as the homepage scroll-scrub hero. Falls back to
 * the default hero whenever nothing is published. Migration:
 * 20261217000000_homepage_hero_video.sql.
 */
export default async function AdminHeroVideoPage() {
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
    <div className="px-5 py-8 sm:px-8 max-w-3xl">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-1">Content</div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1e2229)]">Homepage hero video</h1>
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
                alt=""
                className="h-28 w-28 rounded-lg border border-[var(--m-line,#e2ded4)] object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
