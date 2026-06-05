/**
 * Client-side iTunes Search lookup for song previews — keyless, no login.
 *
 * Per the Song Bank spec (Onboarding_Style_and_Song_Bank_2026-06-04 · §5.2,
 * LOCKED): the Apple/iTunes Search API returns, in ONE call, both the 30-sec
 * `previewUrl` (plays in <audio>) AND the album `artworkUrl` (the cover). It
 * sends no CORS header (content-type text/javascript) so we use JSONP (the
 * `&callback=` param) rather than fetch.
 *
 * Why client-side (§5.4): the lookup is ~20/min/IP. Calling from the browser
 * spreads that across every user's own IP; a per-song cache means each song is
 * looked up at most once per session. Throttle/network failures resolve to
 * `throttled` (the UI keeps the gold placeholder + retries later); a clean
 * miss resolves to `none` ("no preview on file"). Production can later cache
 * the resolved trackId/previewUrl/artwork in our DB for near-zero live calls.
 *
 * Legal: previews are Apple-hosted clips we neither host nor license — taste/
 * reference only, consistent with the owned-AI-music-only rule for RENDERS.
 */

export type ItunesResult =
  | { status: 'ok'; previewUrl: string; artworkUrl: string; trackId: number }
  | { status: 'none' } // loaded fine, but no clip on file
  | { status: 'throttled' }; // 403 throttle / network / timeout → retryable

type ItunesRaw = {
  results?: { previewUrl?: string; artworkUrl100?: string; trackId?: number }[];
};

const cache = new Map<string, ItunesResult>();
const inflight = new Map<string, Promise<ItunesResult>>();
let cbSeq = 0;

const keyFor = (title: string, artist: string) =>
  `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;

/** Resolve a song to its iTunes preview + album cover. Cached + in-flight-deduped. */
export function lookupItunes(title: string, artist: string): Promise<ItunesResult> {
  const k = keyFor(title, artist);
  const cached = cache.get(k);
  if (cached) return Promise.resolve(cached); // ok / none are cached; throttled is not
  const existing = inflight.get(k);
  if (existing) return existing;

  const p = new Promise<ItunesResult>((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ status: 'throttled' });
      return;
    }
    const cb = `__sn_itunes_${cbSeq++}`;
    const script = document.createElement('script');
    let settled = false;

    const finish = (r: ItunesResult) => {
      if (settled) return;
      settled = true;
      // Only cache definitive results — a throttle should retry on next view.
      if (r.status !== 'throttled') cache.set(k, r);
      inflight.delete(k);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
      clearTimeout(timer);
      resolve(r);
    };

    (window as unknown as Record<string, (d: ItunesRaw) => void>)[cb] = (data) => {
      const hit = data?.results?.[0];
      if (hit?.previewUrl && hit.artworkUrl100) {
        finish({
          status: 'ok',
          previewUrl: hit.previewUrl,
          // Upscale the cover from the default 100×100 to a crisp 300×300.
          artworkUrl: hit.artworkUrl100.replace('100x100bb', '300x300bb'),
          trackId: hit.trackId ?? 0,
        });
      } else {
        finish({ status: 'none' });
      }
    };

    // A 403 throttle or network error fails the <script> load → retryable.
    script.onerror = () => finish({ status: 'throttled' });
    const timer = setTimeout(() => finish({ status: 'throttled' }), 8000);

    const term = encodeURIComponent(`${title} ${artist}`);
    script.src = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1&callback=${cb}`;
    document.body.appendChild(script);
  });

  inflight.set(k, p);
  return p;
}
