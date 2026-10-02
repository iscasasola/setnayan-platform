import type { GuestOwnShots } from '@/lib/guest-live-gallery';

/**
 * 📸 THE GALLERY'S "YOUR SHOTS" — and the door to everyone's, only when shared.
 *
 * Owner 2026-10-01, DECISION_LOG "THE EVENT HUB IS FULL SCREEN WITH ONE EXIT ·
 * CAMERA EXIT → LIVE · GALLERY = YOUR SHOTS + PHOTOS OF YOU (ALL ONLY IF
 * SHARED)": *"the event hub's gallery will show all their photo (their shot and
 * the tagged photos) or all photos if the user activates the option to share
 * the whole gallery."* "Photos of you" (the tagged half) is the shipped
 * `PhotosOfYouGallery` above this; this is the other half — what the guest
 * took — and, ONLY when the couple's shipped "Shared gallery" switch is on
 * (`events.pool_gallery_open`), a way into everyone's photos. There is no
 * second setting for it.
 *
 * SAVING (DECISION_LOG "THE DAY GUEST PAGES — APPROVED, WITH ANSWERS", answer
 * 4): a guest saves only their own shots and photos of them. Each own shot opens
 * full size through the token-scoped, EXIF-stripped route, which now admits the
 * shooter's own capture (`/papic/me/[token]/photo`); everyone's stays view-only
 * on the shared page.
 *
 * Three states, three different words — never one for two: a failed read
 * (`null`) says so; an empty one says where shots come from (only when the
 * camera is on — an event with no camera draws nothing); otherwise the shots.
 * Server markup: no client code.
 */
export function YourShotsGallery({
  shots,
  qrToken,
  cameraOn,
  everyoneHref,
}: {
  shots: GuestOwnShots | null;
  /** The guest's own key — the Save link's credential. Null: the tiles do not link. */
  qrToken: string | null;
  /** Is there a camera for this guest today? An event with none draws no empty "Your shots". */
  cameraOn: boolean;
  /** The shared gallery, when the couple shares it; null hides the door. */
  everyoneHref: string | null;
}) {
  const everyone = everyoneHref ? (
    <a
      data-everyones-photos=""
      href={everyoneHref}
      className="flex min-h-[44px] items-center justify-between rounded-2xl border border-ink/10 bg-cream/60 px-4 py-3 text-sm font-medium text-ink"
    >
      <span>Everyone&rsquo;s photos</span>
      <span aria-hidden className="text-ink/40">
        &rarr;
      </span>
    </a>
  ) : null;

  if (shots === null) {
    return (
      <section aria-label="Your shots" data-your-shots="" className="space-y-3">
        <p className="sn-eye text-ink/55">Your shots</p>
        <p className="text-sm text-ink/65">We couldn&rsquo;t load your shots just now. Refresh the page to try again.</p>
        {everyone}
      </section>
    );
  }
  if (shots.shots.length === 0) {
    if (!cameraOn) return everyone;
    return (
      <section aria-label="Your shots" data-your-shots="" className="space-y-3">
        <p className="sn-eye text-ink/55">Your shots</p>
        <p className="text-sm text-ink/65">Photos you take with the Camera land here.</p>
        {everyone}
      </section>
    );
  }
  return (
    <section aria-label="Your shots" data-your-shots="" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="sn-eye text-ink/55">Your shots</p>
        <p className="text-sm text-ink/60">{shots.total.toLocaleString('en-PH')}</p>
      </div>
      <ul className="grid grid-cols-3 gap-1.5">
        {shots.shots.map((s) => (
          <li key={s.id} className="aspect-square overflow-hidden rounded-lg bg-ink/5">
            {qrToken ? (
              <a
                href={`/papic/me/${encodeURIComponent(qrToken)}/photo?id=${encodeURIComponent(s.id)}&src=guest`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open full size to save"
                className="block h-full w-full"
              >
                {/* Presigned URL — raw <img> (the optimizer would cache the expiry). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}
          </li>
        ))}
      </ul>
      {everyone}
    </section>
  );
}
