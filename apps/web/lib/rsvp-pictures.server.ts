import 'server-only';
import { R2_BUCKETS, isR2Configured, r2HeadOutcome } from '@/lib/r2';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { rsvpPictureRefs } from '@/lib/rsvp-look';

/**
 * 🖼 THE RSVP PICTURE LINES' FILES, SIGNED ONCE PER PAGE — for the pages that draw a reply screen's lines
 * (`rsvp-lines.tsx`): the invitation's reply page, the Event Hub's own reply sheet, the page after a reply.
 *
 * Every picture the config holds (read by the one strict reader, so only refs into an event's own `scene-background`
 * folder) is ASKED OF STORAGE first: a file that is gone (`r2HeadOutcome` → `absent`) is left out, and a page given
 * no URL for a picture DRAWS NOTHING for that line — the owner-side call of 2026-10-12, (d): "a file that is gone
 * draws nothing". A broken-image box is never served to a guest. A file that is there is signed by the public
 * bucket's one signer (`displayUrlForStoredAsset`, the same the section backgrounds use); a ref that fails to sign
 * is left out the same way. Storage not configured (a dev machine): nothing is signed and nothing is drawn.
 *
 * A config with no picture costs nothing: no request is made.
 */
const PUBLIC_PREFIX = `r2://${R2_BUCKETS.media}/`;

export async function signRsvpPictures(config: unknown): Promise<Readonly<Record<string, string>>> {
  const refs = rsvpPictureRefs(config);
  if (refs.length === 0 || !isR2Configured()) return {};
  const urls: Record<string, string> = {};
  await Promise.all(
    refs.map(async (ref) => {
      if (!ref.startsWith(PUBLIC_PREFIX)) return;
      const head = await r2HeadOutcome({ bucket: R2_BUCKETS.media, key: ref.slice(PUBLIC_PREFIX.length) });
      if (head.kind === 'absent') return;
      const url = await displayUrlForStoredAsset(ref);
      if (url) urls[ref] = url;
    }),
  );
  return urls;
}
