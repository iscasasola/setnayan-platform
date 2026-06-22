'use client';

/**
 * Inline preview of the delivered Same-Day Edit film on the couple's studio
 * detail page. A plain controlled <video> (presigned R2 URL) — no autoplay, so
 * the couple taps to watch. Client component so the raw presigned src isn't
 * cached by next/image and the video element keeps its own state.
 */
export function SdeFilmPreview({ src }: { src: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-ink/5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- crew-delivered keepsake film, no caption track */}
      <video src={src} controls playsInline preload="metadata" className="max-h-[28rem] w-full" />
    </div>
  );
}
