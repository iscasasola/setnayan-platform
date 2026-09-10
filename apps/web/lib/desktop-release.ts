/**
 * Types + pure validation for the desktop release manifest. NO `server-only`
 * import here (deliberately, same split as `live-studio-readiness.ts` /
 * `live-studio-readiness-server.ts`) — `import 'server-only'` throws outside an
 * RSC context, and `parseDesktopRelease` needs to run under the plain Node test
 * runner (`desktop-release.test.ts`). The actual R2 fetch lives in
 * `desktop-release-server.ts`.
 *
 * `.github/workflows/build-desktop.yml`'s `publish-latest` job writes
 * `desktop/latest/release.json` to the PUBLIC `setnayan-media` R2 bucket on every
 * successful build; `parseDesktopRelease` is the boundary that validates it
 * before `/download` or `/api/download/*` ever link a visitor to it.
 *
 * Previously this module was a hardcoded object pointing at ONE committed
 * `.dmg` under Vercel's `/public` folder (a RELATIVE `/downloads/<file>` URL) —
 * the repo is private, so a GitHub Release asset URL 404s for an anonymous
 * visitor, which is why the file lived under `/public` in the first place. That
 * had no Windows build and required a manual edit (plus a fresh multi-MB binary
 * commit) on every release. R2 solves both: `setnayan-media` is the one
 * PUBLICLY-served R2 bucket (see `publicUrlFor` in `lib/r2.ts` — the other four
 * hold vendor contracts, IDs, and other private uploads and were never
 * candidates), and the manifest it serves means "the latest download link" is
 * infrastructure, not a line of code someone has to remember to update.
 */

export type DesktopPlatformRelease = {
  url: string;
  sizeBytes: number;
  signed: boolean;
  filename?: string;
};

export type DesktopRelease = {
  version: string;
  publishedAt: string;
  mac: { aarch64: DesktopPlatformRelease };
  /** `null` when no Windows build has published successfully yet. */
  windows: DesktopPlatformRelease | null;
};

function isAbsoluteHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

function parsePlatformRelease(value: unknown): DesktopPlatformRelease | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  // The one invariant that matters most: a relative path here is exactly the
  // defect this module replaces (the old `/downloads/<file>.dmg` shape, which
  // only worked because the file was co-hosted with the page). Reject it rather
  // than silently rendering a link that only worked by accident.
  if (!isAbsoluteHttpUrl(v.url)) return null;
  if (typeof v.sizeBytes !== 'number' || !Number.isFinite(v.sizeBytes) || v.sizeBytes <= 0) return null;
  if (typeof v.signed !== 'boolean') return null;
  return {
    url: v.url,
    sizeBytes: v.sizeBytes,
    signed: v.signed,
    filename: typeof v.filename === 'string' ? v.filename : undefined,
  };
}

/**
 * Pure — no network. Validates the shape `publish-latest` writes and rejects
 * anything that isn't safe to link a public visitor to.
 */
export function parseDesktopRelease(json: unknown): DesktopRelease | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  if (typeof j.version !== 'string' || !j.version) return null;
  if (typeof j.publishedAt !== 'string' || !j.publishedAt) return null;

  const macRaw = j.mac && typeof j.mac === 'object' ? (j.mac as Record<string, unknown>).aarch64 : null;
  const mac = parsePlatformRelease(macRaw);
  if (!mac) return null;

  const windows = j.windows == null ? null : parsePlatformRelease(j.windows);

  return { version: j.version, publishedAt: j.publishedAt, mac: { aarch64: mac }, windows };
}
