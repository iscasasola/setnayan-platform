import { createHash } from 'node:crypto';

/**
 * lib/print-preview-cache.ts — FAST PRINT PREVIEWS (owner 2026-09-28: the
 * boarding-pass preview in Prints & Tickets took ~8 s).
 *
 * ── WHAT WAS SLOW ──────────────────────────────────────────────────────────
 * Measured on the route (`/api/hub-print/pass?mode=screen&pass_format=boarding`):
 * 0.8–1.0 s of server work per preview (auth, the Pro question, ~10 reads, the
 * still, the QR, the layout), `cache-control: private, max-age=60`. And the
 * panel asked for EVERY preview at once, and asked again for EVERY preview on
 * every size-dropdown pick — each piece's address carried all three families'
 * sizes, so picking a pass size changed the invitation's address too.
 *
 * ── THE ADDRESS IS THE CACHE KEY ───────────────────────────────────────────
 * A preview is a pure function of the event's print inputs, the theme, the
 * piece's own size, the access (Pro / store shell) and the code that draws it.
 * The page hashes those inputs ONCE (`printInputsVersion` in
 * `print-set.server.ts`, from the SAME readers `loadPrintSet` draws from) and
 * puts the hash in the address as `v`. With a `v`, the route answers
 * `immutable` for a year: the same address can only ever mean the same
 * picture, and a changed input is a new address. Without one, the old 60 s.
 *
 * 🔑 The hash includes the BUILD. A new deploy that draws a piece differently
 * must not be answered from last week's cache.
 */

/** The shape of a version: 16 hex characters. Anything else is ignored. */
const VERSION = /^[0-9a-f]{16}$/;

export function isPreviewVersion(v: string | null | undefined): v is string {
  return typeof v === 'string' && VERSION.test(v);
}

/** One year — the most a browser keeps anything; the address changes long before. */
export const PREVIEW_IMMUTABLE = 'private, max-age=31536000, immutable';
/** No version in the address: exactly what the route said before. */
export const PREVIEW_UNVERSIONED = 'private, max-age=60, stale-while-revalidate=300';

export function previewCacheControl(v: string | null | undefined): string {
  return isPreviewVersion(v) ? PREVIEW_IMMUTABLE : PREVIEW_UNVERSIONED;
}

/** Keys sorted at every level, so two reads of the same rows hash alike. */
function stable(value: unknown): unknown {
  // A Set or a Map would JSON as `{}` — its contents would never reach the hash.
  if (value instanceof Set) return [...value].map(stable).map((v) => JSON.stringify(v)).sort();
  if (value instanceof Map) return [...value.entries()].map(([k, v]) => [JSON.stringify(stable(k)), stable(v)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = stable((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

/** The build that draws the pieces — Vercel's commit, else "local". */
export function drawingBuild(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL_GIT_COMMIT_SHA || env.VERCEL_DEPLOYMENT_ID || 'local';
}

/** 16 hex characters of SHA-256 over the inputs (and the build). */
export function printPreviewVersion(inputs: unknown, build: string = drawingBuild()): string {
  return createHash('sha256').update(JSON.stringify(stable({ build, inputs }))).digest('hex').slice(0, 16);
}
