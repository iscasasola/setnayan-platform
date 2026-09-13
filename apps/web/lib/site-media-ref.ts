/**
 * lib/site-media-ref.ts — AN EVENT'S WEBSITE MEDIA MAY NAME ONLY THE PUBLIC
 * BUCKET, ON ITS WAY TO BEING SIGNED.
 *
 * Pure (no `server-only`, no SDK) so the rule is a unit test. The write-side
 * twin is the CHECK `events_site_media_names_only_the_public_bucket` (migration
 * 20271220579615) — same allow-list, same anchoring.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * The hero photo, hero film, site music, `our_photos` and the Save-the-Date
 * upload background are couple-writable (`authenticated` holds column UPDATE on
 * `events`, and anyone can be the couple of an event they create). The PUBLIC
 * wedding site, the editorial, the showcase and the OG cards resolve them with
 * `displayUrlForStoredAsset`, which presigns — with the ADMIN R2 credentials —
 * whatever bucket the value names. A value naming `setnayan-thread-files`
 * (payment proofs, chat files) or `setnayan-vendor-verification` (government
 * IDs) would make a couple's own public page hand every visitor a signed link
 * to somebody else's private file.
 *
 * ── THE RULE, AND WHY IT CANNOT BE NORMALISED AROUND ───────────────────────
 * `siteMediaServeRef` returns either
 *   · `null` — nothing to show (empty, a private or unknown bucket, a malformed
 *     `r2://`), or
 *   · a value that is ALREADY TRIMMED and begins with `r2://setnayan-media/`, or
 *   · a trimmed value that does not begin with `r2://` at all (a legacy
 *     http(s) or relative URL — the resolver passes those through verbatim and
 *     never signs them).
 * Because the output is trim-stable, the resolver's own `trim()` is the
 * identity on it, so the resolver parses EXACTLY the string checked here —
 * there is no leading space, BOM or no-break space that can turn an accepted
 * value into a different ref downstream (the deny-list failure #5414's review
 * found). Case is not folded: `R2://…` is not an `r2://` ref to the resolver
 * either, so it can only ever be passed through as a dead URL, never signed.
 *
 * Pinned by BUCKET, not by event folder: the media bucket is served unsigned to
 * the public anyway, so a folder pin would buy no secrecy — and the living hero
 * files under `living-heroes/`, which a folder pin would break. The DELETE
 * side's folder pin is #5414's (lib/cleanup-delete-scope.ts).
 */
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';

const R2_SCHEME = 'r2://';

/** A website-media value the server may hand to its signer — or null. */
export function siteMediaServeRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith(R2_SCHEME)) {
    // Not a ref: a legacy absolute/relative URL, rendered verbatim, never signed.
    return trimmed;
  }
  const rest = trimmed.slice(R2_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  const bucket = rest.slice(0, slash);
  // The ONE bucket allowed. Everything else — every private bucket, and any
  // name the resolver does not know — is refused rather than signed.
  if (bucket !== PUBLIC_R2_BUCKET) return null;
  return trimmed;
}

/**
 * THE SAME RULE, AS THE GENERIC SIGNER'S OWN GATE (N4 part 3, 2026-09-11).
 *
 * `displayUrlForStoredAsset` (lib/uploads.ts) used to presign an `r2://` ref in
 * ANY bucket for any caller, and three browser-writable columns reached it
 * beyond the website media above — `event_editorial.draft_json`,
 * `guests.photo_url`, `vendor_profiles.logo_url` (plus a dispute's
 * `evidence_urls`, written by a server action that accepted any ref). Pinning
 * each column would leave the next one open, so the SIGNER now applies this
 * rule to every value it is handed: only the public media bucket is ever
 * signed there. A private file is read ONLY through
 * `displayUrlForPrivateStoredAsset(value, policy)`, whose caller names the
 * bucket AND the tenant folder (lib/r2-client-ref.ts policies).
 *
 * An alias rather than a copy: one rule, one allow-list, two names — so the
 * website-media reads and the signer can never disagree about what "public"
 * means.
 */
export function publicBucketServeRef(value: unknown): string | null {
  return siteMediaServeRef(value);
}

/** `siteMediaServeRef` over a stored array (e.g. `our_photos`): strings only, refusals dropped. */
export function siteMediaServeRefs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const ref = siteMediaServeRef(v);
    if (ref) out.push(ref);
  }
  return out;
}
