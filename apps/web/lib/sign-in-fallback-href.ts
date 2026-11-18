/**
 * The no-JavaScript fallback, BUILT ONCE (W1-B1, 16 Nov 2026). It used to append `?next=` to whatever `href` was given,
 * so a caller that already named its own return (`/login?next=%2Fopen-shop&as=vendor`) drew
 * `/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop` — a second `?` inside the last value. Now: a `next` the caller
 * chose is kept as it is; otherwise `next` is added with the right joiner. Pure — `lib/sign-in-fallback-href.test.ts` runs it.
 */
export function signInFallbackHref(href: string, here: string): string {
  if (here === '/') return href;
  const [beforeHash, hash = ''] = href.split('#', 2) as [string, string?];
  const q = beforeHash.indexOf('?');
  const query = q === -1 ? '' : beforeHash.slice(q + 1);
  if (new URLSearchParams(query).has('next')) return href;
  const joined = `${beforeHash}${q === -1 ? '?' : query ? '&' : ''}next=${encodeURIComponent(here)}`;
  return hash ? `${joined}#${hash}` : joined;
}
