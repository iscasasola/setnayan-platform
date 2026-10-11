import { NextResponse } from 'next/server';

/**
 * guest-did-not-load.ts — what a guest's ROUTE HANDLER answers when a read
 * failed: the guest boundary's own words, in place.
 *
 * A page under `app/[slug]` that throws is answered by the guest boundary
 * (`app/[slug]/error.tsx`): "This invitation didn't load. … Your link is fine".
 * A route handler has no boundary — an uncaught throw is the browser's blank
 * "this page isn't working", and a redirect to somewhere that "works" drops the
 * code the guest arrived with. The two hops a personal link or a printed QR
 * passes through (`/[slug]/redeem`, `/[slug]/seat/claim`) therefore answer HERE:
 *
 *   · the SAME three strings as the boundary — no new words;
 *   · in place, so the address still holds the code: "Try again" (and a plain
 *     reload) re-runs the very hop that failed;
 *   · it reads nothing — the database is the thing that is not answering;
 *   · HTTP 503, never cached, no cookie.
 *
 * 🔒 `tryAgainHref` MUST be built by the caller from validated parts and
 * percent-encoded values (a same-origin path + query) — never from the raw
 * request. It is HTML-escaped again here, so a value that slipped through still
 * cannot become markup.
 *
 * The colours are the theme's own cream · ink · mulberry (tailwind.config.ts),
 * inline because this page loads no stylesheet; the faces fall back to the
 * system's, since no font file is fetched either.
 *
 * 🛡 app/[slug]/redeem/a-failed-read-is-not-a-dead-link.test.ts
 */
export function didNotLoadAnswer(tryAgainHref: string): NextResponse {
  const href = tryAgainHref
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return new NextResponse(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta name="robots" content="noindex, nofollow"><title>Your invitation</title>' +
      '<style>html,body{margin:0}body{min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'padding:64px 24px;box-sizing:border-box;background:#FBFBFA;color:#1E2229;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center}' +
      'main{width:100%;max-width:28rem}h1{margin:0 0 20px;font-family:Georgia,"Times New Roman",serif;' +
      'font-style:italic;font-weight:400;font-size:30px;line-height:1.25}' +
      'p{margin:0 auto 36px;max-width:24rem;font-size:16px;line-height:1.625;color:rgba(30,34,41,.7)}' +
      'p.brand{margin:0 0 24px;font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.2em;' +
      'text-transform:uppercase;color:rgba(30,34,41,.4)}' +
      'a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 24px;' +
      'border-radius:2px;background:#5C2542;color:#FBFBFA;font-size:14px;font-weight:500;letter-spacing:.025em;' +
      'text-decoration:none}' +
      '@media (prefers-color-scheme:dark){body{background:#1E2229;color:#FBFBFA}p{color:rgba(251,251,250,.7)}' +
      'p.brand{color:rgba(251,251,250,.4)}a{background:#B8889C;color:#1E2229}}</style></head>' +
      '<body><main><p class="brand">Setnayan</p>' +
      '<h1>This invitation didn&rsquo;t load.</h1>' +
      '<p>Your link is fine — something on our end is having trouble. Give it a moment and try again.</p>' +
      `<a href="${href}">Try again</a></main></body></html>`,
    {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'private, no-store',
        'retry-after': '5',
      },
    },
  );
}
