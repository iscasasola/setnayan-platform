/**
 * Full-bleed hero background — a looping video when the couple uploaded one
 * (Increment B · §6.2 "scrub-video hero"), otherwise the still photo. The
 * video autoplays muted + looped + inline (browser-allowed), with the photo as
 * its poster so there's no black flash before the first frame. Raw <video>/<img>
 * because the URLs are presigned (24h) — next/image's optimizer would cache an
 * expired URL.
 */
export function HeroBackgroundMedia({
  videoUrl,
  photoUrl,
}: {
  videoUrl?: string | null;
  photoUrl?: string | null;
}) {
  if (videoUrl) {
    return (
      // Decorative, muted, looping background — no captions needed.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={photoUrl ?? undefined}
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={videoUrl} />
      </video>
    );
  }
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }
  return null;
}
