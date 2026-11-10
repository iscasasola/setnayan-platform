/**
 * stale-claims.ts — the names and claims that must never reach a search engine or an AI assistant again
 * (Build 6 Lane K, owner 10 Nov 2026: *"update them all as well"*).
 *
 * ONE list, read twice: by the daily SEO audit (`runSeoHealthChecks`, against the SERVED `/llms.txt`) and by the CI
 * guard (`lib/seo/answer-engines-read-todays-product.test.ts`, against the rendered file and the public pages'
 * structured data). A retired name that slips back into either is caught by both.
 *
 * Each entry says WHY it is wrong — a pattern with no reason gets deleted the first time it is inconvenient.
 * PURE: no I/O.
 */
export type StaleClaim = { pattern: RegExp; why: string };

export const STALE_CLAIMS: readonly StaleClaim[] = [
  // The plan a person sees is "Ultra" (owner 2026-10-23). `enterprise` survives only as an internal key and SKU id.
  { pattern: /\bEnterprise\b/, why: 'the top supplier plan is called Ultra (owner 2026-10-23)' },
  { pattern: /\bCustom plan\b|\bCustom tier\b/i, why: 'the negotiated Custom tier was retired 2026-11-06 — Ultra add-ons replace it' },
  // Event Hub Pro was folded into Event Pro; "Pro Event Hub" is the same retired product in other words.
  { pattern: /Event Hub Pro\b|Pro Event Hub/i, why: 'Event Hub Pro is retired — the paid event plans are Event Plus and Event Pro' },
  { pattern: /4-in-1/i, why: 'the "4-in-1 Event Hub" description was removed as untrue in Build 6 Lane J' },
  // The token wallet was retired 2026-05-11 (token-economy-is-retired.test.ts holds the code side).
  { pattern: /token wallet|\btokens?\b/i, why: 'the token wallet is retired (2026-05-11) — prices are PHP-direct' },
  // "Gallery" was renamed Memories; a guest's photos live in Memories.
  { pattern: /\bgallery\b/i, why: 'the guest photo place is called Memories — the old word is retired (owner 2026-10-23)' },
  // Nothing in the app builds proposals — the line was in llms.txt with no code behind it.
  { pattern: /Proposal Builder/i, why: 'no proposal builder exists in the app (grep finds it only in old llms.txt copy)' },
  // No public API in V1 (CLAUDE.md locked decision).
  { pattern: /\bread API\b|\bpublic API\b/i, why: 'there is no public API in V1 (locked decision)' },
  // Setnayan AI is not sold on its own since 2026-11-04 — it comes inside Event Plus and Event Pro.
  { pattern: /Setnayan AI (?:costs|is sold|for ₱)|buy Setnayan AI\b/i, why: 'Setnayan AI is not sold on its own (owner 2026-11-04)' },
  // An unqualified "No" to the commission question is the error every AI repeats (google-ai-says-2026-11-10.md §5).
  {
    pattern: /take a commission\?\*\*\s*No\b/i,
    why: 'suppliers pay a booking fee — "No" alone is the half-truth AI repeats as "keep 100%"',
  },
];

/** Every stale claim found in `text`, with the matched words — empty when clean. */
export function findStaleClaims(text: string): { match: string; why: string }[] {
  const out: { match: string; why: string }[] = [];
  for (const c of STALE_CLAIMS) {
    const m = text.match(c.pattern);
    if (m) out.push({ match: m[0], why: c.why });
  }
  return out;
}
