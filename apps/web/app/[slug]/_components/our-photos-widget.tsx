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
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        Our photos
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((url, i) => (
          <div
            key={`${i}-${url.slice(0, 24)}`}
            className="relative aspect-square overflow-hidden rounded-lg bg-ink/5"
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
    </section>
  );
}
