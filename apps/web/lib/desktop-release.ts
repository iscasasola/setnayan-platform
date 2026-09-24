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
  /** A Developer ID signature is present. NOT the same claim as `notarized`. */
  signed: boolean;
  /**
   * ⛔ SIGNED IS NOT NOTARIZED, AND THE DIFFERENCE IS WHAT A COUPLE MEETS.
   *
   * Measured against the live build on 2026-09-22 (`Setnayan_0.0.1_aarch64.dmg`,
   * the one `/api/download/mac` serves):
   *
   *     xcrun stapler validate → "does not have a ticket stapled to it"
   *     spctl -a -t open -vv   → "rejected"
   *                              source=Unnotarized Developer ID
   *                              origin=Developer ID Application: … (P95JPDWWB3)
   *
   * So `signed` was TRUE and true — and `/download` read that one boolean and
   * told visitors "Signed & notarized by Apple". Gatekeeper disagrees, in their
   * wedding week, with "cannot be opened because Apple cannot check it for
   * malicious software."
   *
   * 🔑 ONE BOOLEAN WAS CARRYING TWO CLAIMS and the copy asserted the stronger
   * one. The manifest never claimed notarization; the page invented it.
   *
   * Absent ⇒ FALSE. Fail closed: a manifest written before this field existed
   * must not read as notarized, and `.github/workflows/build-desktop.yml` does
   * not notarize today. Set it only when the pipeline actually staples a ticket.
   */
  notarized?: boolean;
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
    // Absent or non-boolean ⇒ false. Never inferred from `signed`: that
    // inference is the defect this field exists to end.
    notarized: v.notarized === true,
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
