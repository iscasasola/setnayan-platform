/**
 * Our Photos — the couple's own curated gallery (Increment A.4). Reads the
 * presigned display URLs resolved from events.our_photos (JSONB array of
 * r2:// refs) up at the page level. Renders a responsive grid; returns nothing
 * when the gallery is empty so the section hides. Distinct from YourPhotosWidget
 * (the guest's tagged photos). Raw <img> because the URLs are presigned (24h)
 * — next/image's optimizer would cache an expired URL.
 */
export function OurPhotosWidget({ urls }: { urls: string[] }) {
  const photos = (urls ?? []).filter((u) => typeof u === 'string' && u.length > 0);
  if (photos.length === 0) return null;

  // Pahina editorial mosaic (design 2026-07-25 §7): the uniform square grid
  // becomes a magazine spread — the first frame is a full-width cover plate,
  // the rest run two-up with a deliberate vertical offset on the right column
  // so the eye moves down the page instead of scanning a contact sheet.
  const [lead, ...rest] = photos;
  return (
    <section className="space-y-5">
      <p className="pahina-eyebrow">
        <span aria-hidden>№ 06</span>
        <span>Our photos</span>
      </p>
      {lead ? (
        <figure className="relative aspect-[4/3] overflow-hidden border border-ink/10 bg-ink/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lead}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </figure>
      ) : null}
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {rest.map((url, i) => (
            <div
              key={`${i}-${url.slice(0, 24)}`}
              className={`relative aspect-[3/4] overflow-hidden border border-ink/10 bg-ink/5 ${
                i % 2 === 1 ? 'mt-6 sm:mt-10' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
