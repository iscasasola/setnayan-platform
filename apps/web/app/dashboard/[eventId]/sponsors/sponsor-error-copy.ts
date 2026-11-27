/**
 * The ONLY words the Sponsors page prints for a failed action (A2-I18, SW-RAWDB, final check 25 Nov 2026).
 *
 * The actions used to redirect with `?error=<the exception's message>` and the page printed `search.error` as is: the
 * database's own text reached the couple, and anyone could craft a link that showed any words under Setnayan's name.
 * Now an action sends a fixed KEY, the page looks the key up here, and anything it does not know reads as the plain
 * fallback. The raw message goes to the log only.
 */
export const SPONSOR_ERROR_COPY = {
  name_required: 'Full name is required.',
  email_invalid: 'Email looks invalid.',
  not_found: 'That sponsor isn’t on your list any more.',
  save_failed: 'Couldn’t save that — nothing was changed. Try again.',
} as const;

export type SponsorErrorKey = keyof typeof SPONSOR_ERROR_COPY;

/** The key for a thrown error: our own validation sentences map to their key; anything else is `save_failed`. */
export function sponsorErrorKey(e: unknown): SponsorErrorKey {
  const msg = e instanceof Error ? e.message : '';
  for (const [key, words] of Object.entries(SPONSOR_ERROR_COPY) as Array<[SponsorErrorKey, string]>) {
    if (key !== 'save_failed' && msg === words) return key;
  }
  if (msg === 'Sponsor not found.') return 'not_found';
  return 'save_failed';
}

/** The words for `?error=` — a known key's sentence, else the fallback. Never the address bar's own text. */
export function sponsorErrorWords(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return (SPONSOR_ERROR_COPY as Record<string, string>)[raw] ?? SPONSOR_ERROR_COPY.save_failed;
}
