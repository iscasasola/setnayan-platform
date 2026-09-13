import 'server-only';

import { parseDesktopRelease, type DesktopRelease } from './desktop-release';

/**
 * Fetches + validates `desktop/latest/release.json` from the public
 * `setnayan-media` R2 bucket. See `desktop-release.ts`'s docblock for why the
 * manifest exists and why every URL in it must be absolute.
 *
 * Returns `null` — never a relative or stale URL — when the manifest can't be
 * resolved (missing `R2_PUBLIC_URL`, network failure, or a malformed manifest).
 * Callers must render an honest "not available right now" state rather than a
 * link that 404s: rule 12 of the S10 build prompt ("never stall on a gate")
 * means build behind the gap, not throw; rule 14 ("if the defect is not there,
 * say so") means the page must not paper over a genuine gap with a fabricated
 * link either.
 */

const DESKTOP_MANIFEST_PATH = 'desktop/latest/release.json';

let warnedNoPublicUrl = false;
let warnedBadManifest = false;

/**
 * Revalidated hourly in step with `/download`'s own ISR window (`export const
 * revalidate = 3600`), so a new release shows up within the hour, not
 * instantly and not never.
 */
export async function resolveDesktopRelease(): Promise<DesktopRelease | null> {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) {
    if (!warnedNoPublicUrl) {
      console.warn(
        '[desktop-release] R2_PUBLIC_URL is unset — /download cannot resolve a release and will ' +
          'show its "not available right now" state. Set R2_PUBLIC_URL to the setnayan-media ' +
          "bucket's public host to fix this.",
      );
      warnedNoPublicUrl = true;
    }
    return null;
  }

  const manifestUrl = `${base.replace(/\/+$/, '')}/${DESKTOP_MANIFEST_PATH}`;
  let json: unknown;
  try {
    const res = await fetch(manifestUrl, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`[desktop-release] GET ${manifestUrl} -> HTTP ${res.status}`);
      return null;
    }
    json = await res.json();
  } catch (err) {
    console.warn(`[desktop-release] failed to fetch ${manifestUrl}:`, err);
    return null;
  }

  const release = parseDesktopRelease(json);
  if (!release && !warnedBadManifest) {
    console.warn(`[desktop-release] ${manifestUrl} did not match the expected shape — ignoring it.`);
    warnedBadManifest = true;
  }
  return release;
}
