import { Trophy } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchVendorSponsoredShots } from '@/lib/vendor-sponsored-shots';
import { displayUrlForStoredAsset } from '@/lib/uploads';

/**
 * SHOTS GUESTS TOOK FOR THIS SUPPLIER'S CHALLENGE — and nothing else.
 *
 * Owner, 2026-08-26: *"the host will allow access. they only get shots from the
 * sponsored papic challenge."*
 *
 * Every gate that makes this narrow lives in `fetchVendorSponsoredShots` and is
 * pinned by `vendor-sponsored-shots-are-scoped.test.ts` — eight of them, each
 * somebody's decision: the host approved the challenge, the guest consented to
 * the photograph, the couple has not taken it down, the safety screen passed it.
 *
 * ⚠ IT RENDERS NOTHING WHEN THERE IS NOTHING. A supplier with no approved
 * challenge should not meet an empty frame implying photographs exist somewhere
 * behind it.
 *
 * ⚠ A FAILED READ SAYS SO. `ok: false` is not "there are none" — telling a
 * supplier their challenge produced nothing when we simply could not look is
 * the same lie as an unread count rendered as zero.
 */
export async function SponsoredShotsStrip({
  vendorProfileId,
  eventId,
}: {
  vendorProfileId: string;
  eventId: string;
}) {
  const { ok, shots } = await fetchVendorSponsoredShots(
    createAdminClient(),
    vendorProfileId,
    eventId,
  );

  if (!ok) {
    return (
      <p className="mt-6 text-sm" style={{ color: 'var(--m-slate-2)' }}>
        We couldn&rsquo;t load your challenge photos just now — this isn&rsquo;t a
        sign there are none. Try again in a moment.
      </p>
    );
  }
  if (shots.length === 0) return null;

  // ⚠ RESOLVE THE URLS FIRST — `displayUrlForStoredAsset` is ASYNC, and calling
  // it inside the render map would put a Promise into `src` and render nothing,
  // silently. `r2://` refs are not URLs; an unresolved one fails as an empty
  // frame with no error, which this repo has paid for across sixteen surfaces.
  const resolved = await Promise.all(
    shots.map(async (s) => ({
      ...s,
      src: await displayUrlForStoredAsset(s.displayR2Key ?? s.posterR2Key),
    })),
  );

  const byPrompt = new Map<string, typeof resolved>();
  for (const s of resolved) {
    const list = byPrompt.get(s.prompt) ?? [];
    list.push(s);
    byPrompt.set(s.prompt, list);
  }

  return (
    <section className="mt-8">
      <p
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--m-slate-3)' }}
      >
        <Trophy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        From your challenge
      </p>
      <p className="mt-2 max-w-prose text-sm" style={{ color: 'var(--m-slate-2)' }}>
        Guests took these for the challenge you sponsored, and chose to share
        them. Only photos the couple approved your challenge for appear here.
      </p>

      {[...byPrompt.entries()].map(([prompt, group]) => (
        <div key={prompt} className="mt-5">
          <p className="text-sm font-medium">{prompt}</p>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.map((s) => (
              <li
                key={s.captureId}
                className="aspect-square overflow-hidden rounded-lg bg-ink/5"
              >
                {s.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.src}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
