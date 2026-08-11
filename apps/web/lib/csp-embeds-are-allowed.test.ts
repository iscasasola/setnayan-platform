/**
 * csp-embeds-are-allowed.test.ts — an iframe the CSP forbids is a grey box.
 *
 * WHAT IT COST (measured on the live site, 2026-08-08). The owner approved his
 * own shop, opened the public address, and the location map was an empty grey
 * panel with a broken-content glyph. `openstreetmap.org` responds 200 and the
 * markup was perfect; the enforced `frame-src` in next.config.ts simply never
 * listed it, so Chrome refused the frame. Nothing threw. Nothing logged
 * anything a person would read. The map had been dead on every shop page with
 * coordinates since it shipped.
 *
 * 🔑 THE DISEASE, NOT THE INSTANCE: a blocked iframe fails EXACTLY like a
 * missing one. Same family as a phantom column (query rejected, not thrown), a
 * phantom enum value, and an `r2://` reference in an `<img>` — the browser or
 * the database declines, and the only symptom is an absence.
 *
 * next.config.ts already said "New embed origins later extend this one list."
 * That comment was true, correct, and did not stop this. A sentence is not a
 * mechanism.
 *
 * ⚠ ON SCOPE. This resolves an iframe `src` only as far as the FILE it lives
 * in: a literal, or a local `const` holding one. A src built from a prop or a
 * row (`watchLive.embedUrl`) cannot be known statically, so it is COUNTED AND
 * PRINTED rather than dropped — an unchecked embed you can see is worth more
 * than a clean report that quietly skipped it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 WIDENED 2026-08-11 — THE FIRST VERSION COULD NOT HAVE CAUGHT THE NEXT ONE
 * ══════════════════════════════════════════════════════════════════════════
 * Written for OSM, this guard looked for a literal `<iframe` in `.tsx` files.
 * Cloudflare Turnstile — the bot check that gates EVERY sign-in once it is
 * switched on — paints its challenge in a window that CLOUDFLARE'S SCRIPT
 * creates. There is no `<iframe` in our source to find, and half its plumbing
 * lives in a `.ts` file the scan never opened. So `challenges.cloudflare.com`
 * was absent from `frame-src` with this guard passing, and the first person to
 * turn captcha on would have locked out every user and himself.
 *
 * 🔑 THE MARKUP IS NOT THE FRAME. A third-party script is a frame you have not
 * written yet. So this file now checks TWO things:
 *   1. every external host we inject a <script> from is named in the
 *      report-only `script-src` (that policy blocks nothing today, but it is
 *      the draft of the enforced one — an origin missing there is an outage
 *      scheduled for the day it is enforced); and
 *   2. every such host KNOWN to open a frame (FRAME_CREATING_SCRIPT_HOSTS) is
 *      also in the enforced `frame-src`.
 * (2) is a short hand-kept list, and that is honest: whether a vendor's script
 * opens a window is a fact about THEIR product, not something our source can
 * be read for. It is small, it is loud, and it fails closed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * ⚠ `.ts` AS WELL AS `.tsx`. The original scan took `.tsx` only, on the
 * reasonable-sounding theory that embeds live in markup. `lib/turnstile-client.ts`
 * injects a third-party script from a plain `.ts` module — invisible to that
 * theory, and the whole reason this guard missed Turnstile.
 */
function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (
      (p.endsWith('.tsx') || p.endsWith('.ts')) &&
      !p.endsWith('.test.tsx') &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.d.ts')
    ) {
      out.push(p);
    }
  }
  return out;
}

const CONFIG = () => readFileSync(join(WEB, 'next.config.ts'), 'utf8');

/** The ENFORCED policy — the report-only one blocks nothing and proves nothing. */
function enforcedFrameSrc(): string {
  const config = CONFIG();
  // Anchored on the directive so a bare /frame-src/ can't match the word inside
  // a comment. Same anchoring as watch-live-block.test.ts.
  const match = /frame-src 'self'[^"']*/.exec(config);
  assert.notEqual(match, null, 'no enforced frame-src directive found in next.config.ts');
  return match![0];
}

/**
 * The REPORT-ONLY `script-src`. It blocks nothing today — but it is the draft of
 * the policy that gets enforced, and its own comment says anything missing from
 * it is what the reports will surface. A script origin absent here is therefore
 * an outage with a date on it, not a nit.
 */
function reportOnlyScriptSrc(): string {
  const config = CONFIG();
  // ⚠ `[^"]*`, NOT `[^"']*` (which is right for frame-src). This directive keeps
  // `'unsafe-inline' 'unsafe-eval'` INSIDE it, so excluding single quotes stops
  // the match dead at `'unsafe-eval'` and silently returns a fragment — every
  // origin after it then reads as "missing" (or, worse in a laxer check, the
  // whole thing reads as fine). Caught by running it; it is the same
  // two-values-that-look-alike trap the policy itself is about.
  const match = /script-src 'self' 'unsafe-inline'[^"]*/.exec(config);
  assert.notEqual(match, null, 'no report-only script-src directive found in next.config.ts');
  return match![0];
}

/**
 * Does a CSP source list admit this host? Handles the `https://*.posthog.com`
 * wildcard form — a plain `.includes(host)` would say no for
 * `us-assets.i.posthog.com` and cry wolf on an origin that is genuinely allowed.
 */
function allowsHost(directive: string, host: string): boolean {
  for (const source of directive.split(/\s+/)) {
    const bare = source.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!bare || bare.startsWith("'")) continue;
    if (bare === host) return true;
    if (bare.startsWith('*.') && host.endsWith(bare.slice(1))) return true;
  }
  return false;
}

/**
 * Third-party script hosts that OPEN A FRAME of their own once loaded.
 *
 * Hand-kept on purpose: whether a vendor's script paints an iframe is a fact
 * about their product, not something our source can be read for. Keep it short,
 * and add a line the day you add such a script — the reason string is printed in
 * the failure, so whoever hits it learns what breaks rather than just what to
 * paste.
 */
const FRAME_CREATING_SCRIPT_HOSTS: Record<string, string> = {
  'challenges.cloudflare.com':
    'Cloudflare Turnstile renders its challenge in an iframe from this origin. ' +
    'Supabase captcha is GLOBAL, so a blocked challenge is every sign-in, ' +
    'sign-up, password reset and login-free camera claim refused at once — ' +
    'including the owner’s. It fails as an absence: no error, no log, no widget.',
};

/** External hosts this file injects a <script> from, as far as the file says. */
function scriptHosts(code: string): { hosts: Set<string>; unresolved: string[] } {
  const hosts = new Set<string>();
  const unresolved: string[] = [];

  const add = (text: string) => {
    for (const m of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      if (m[1]) hosts.add(m[1]);
    }
  };

  // ⚠ SCOPED TO SCRIPT ELEMENTS BY NAME. A first cut matched every `.src =` in
  // the app and printed 13 "verify by hand" lines that were all <img>/<video>
  // textures, watermarks and reel frames — none of them scripts. A guard that
  // cries wolf teaches you to skim past the one time it is right, so it now
  // resolves the variable that actually holds a created <script>.
  const scriptVars = new Set<string>();
  for (const m of code.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*document\.createElement(?:<[^>]*>)?\(\s*['"`]script['"`]/g,
  )) {
    if (m[1]) scriptVars.add(m[1]);
  }

  for (const name of scriptVars) {
    // 1. `s.src = 'https://…'` / `s.src = \`https://…\`` — JSONP + widget loaders.
    for (const m of code.matchAll(
      new RegExp(`\\b${name}\\.src\\s*=\\s*['"\`](https?://[^'"\`]+)`, 'g'),
    )) {
      if (m[1]) add(m[1]);
    }
    // 2. `s.src = SOME_CONST` — resolved through a const in the same file.
    for (const m of code.matchAll(
      new RegExp(`\\b${name}\\.src\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*[;,)]`, 'g'),
    )) {
      const ref = m[1];
      if (!ref) continue;
      const decl = new RegExp(
        `(?:const|let|var)\\s+${ref}\\s*(?::[^=]*)?=([\\s\\S]{0,600}?);`,
      ).exec(code);
      if (!decl?.[1]) {
        unresolved.push(`${ref} (assigned to script element \`${name}\`)`);
        continue;
      }
      if (/https?:\/\//.test(decl[1])) add(decl[1]);
    }
  }

  // A file that builds a <script> without naming it is beyond static reach —
  // say so rather than reporting a clean sweep over it.
  if (scriptVars.size === 0 && /createElement(?:<[^>]*>)?\(\s*['"`]script['"`]/.test(code)) {
    unresolved.push('an unnamed document.createElement("script")');
  }

  // 3. `<script src="https://…">` / `<Script src={…}>` in markup.
  for (const m of code.matchAll(/<[Ss]cript\b[\s\S]{0,300}?src=(?:\{([^}]*)\}|["']([^"']*)["'])/g)) {
    const expr = (m[1] ?? m[2] ?? '').trim();
    if (!expr) continue;
    if (/https?:\/\//.test(expr)) {
      add(expr);
    } else if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
      const decl = new RegExp(
        `(?:const|let|var)\\s+${expr}\\s*(?::[^=]*)?=([\\s\\S]{0,600}?);`,
      ).exec(code);
      if (decl?.[1] && /https?:\/\//.test(decl[1])) add(decl[1]);
      else unresolved.push(`${expr} (a <script src>)`);
    }
    // A relative/same-origin src ('/sw.js') needs no allowlist entry beyond 'self'.
  }

  return { hosts, unresolved };
}

/** Hosts an iframe in this file is pointed at, as far as the file itself says. */
function embedHosts(code: string): { hosts: Set<string>; unresolved: string[] } {
  const hosts = new Set<string>();
  const unresolved: string[] = [];

  for (const frame of code.matchAll(/<iframe\b[\s\S]{0,400}?src=(?:\{([^}]*)\}|"([^"]*)")/g)) {
    const expr = (frame[1] ?? frame[2] ?? '').trim();
    if (!expr) continue;

    // A literal src, or a `const` whose initialiser we can read in this file.
    const literal = /^https?:\/\//.test(expr) ? expr : null;
    let text = literal;
    if (!text && /^[A-Za-z_$][\w$]*$/.test(expr)) {
      const decl = new RegExp(
        `(?:const|let|var)\\s+${expr}\\s*(?::[^=]*)?=([\\s\\S]{0,600}?);`,
      ).exec(code);
      text = decl?.[1] ?? null;
    }
    if (!text) {
      unresolved.push(expr);
      continue;
    }

    const urls = [...text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)]
      .map((m) => m[1])
      .filter((h): h is string => Boolean(h));
    if (urls.length === 0) {
      // Resolvable, and same-origin — a relative path needs no allowlist entry
      // beyond `'self'`, which is always present.
      continue;
    }
    for (const h of urls) hosts.add(h);
  }

  return { hosts, unresolved };
}

test('every iframe host the app embeds is allowed by the enforced frame-src', () => {
  const frameSrc = enforcedFrameSrc();
  const offenders: string[] = [];
  const unresolvedSites: string[] = [];
  let checked = 0;

  for (const file of sources(join(WEB, 'app')).concat(sources(join(WEB, 'components')))) {
    const code = readFileSync(file, 'utf8');
    if (!code.includes('<iframe')) continue;
    const rel = relative(WEB, file);
    const { hosts, unresolved } = embedHosts(code);
    for (const u of unresolved) unresolvedSites.push(`${rel} — src={${u}}`);
    for (const host of hosts) {
      checked += 1;
      if (!frameSrc.includes(host)) offenders.push(`${rel} — embeds ${host}`);
    }
  }

  // NO SILENT CAP. Anything this guard could not resolve is named out loud, so
  // "0 failures" is never mistaken for "everything is covered".
  if (unresolvedSites.length > 0) {
    console.log(
      `csp-embeds: ${checked} host(s) checked · ${unresolvedSites.length} iframe src(s) ` +
        `not statically resolvable (verify these by hand):\n  ${unresolvedSites.join('\n  ')}`,
    );
  }

  assert.deepEqual(
    offenders,
    [],
    `An iframe points at a host the enforced CSP blocks. It will render as an ` +
      `EMPTY GREY BOX — no error, no console warning worth noticing, and no test ` +
      `will catch it. Add the origin to frame-src in next.config.ts, or stop ` +
      `embedding it.\n\nfr` + `ame-src: ${frameSrc}\n\n${offenders.join('\n')}`,
  );
});

test('every external script host the app injects is named in the report-only script-src', () => {
  const scriptSrc = reportOnlyScriptSrc();
  const offenders: string[] = [];
  const unresolvedSites: string[] = [];
  let checked = 0;

  for (const file of sources(join(WEB, 'app'))
    .concat(sources(join(WEB, 'components')))
    .concat(sources(join(WEB, 'lib')))) {
    const code = readFileSync(file, 'utf8');
    if (!code.includes('.src') && !/<[Ss]cript\b/.test(code)) continue;
    const rel = relative(WEB, file);
    const { hosts, unresolved } = scriptHosts(code);
    for (const u of unresolved) unresolvedSites.push(`${rel} — ${u}`);
    for (const host of hosts) {
      checked += 1;
      if (!allowsHost(scriptSrc, host)) offenders.push(`${rel} — loads a script from ${host}`);
    }
  }

  // NO SILENT CAP — same rule as the iframe sweep above.
  if (unresolvedSites.length > 0) {
    console.log(
      `csp-scripts: ${checked} host(s) checked · ${unresolvedSites.length} script src(s) ` +
        `not statically resolvable (verify these by hand):\n  ${unresolvedSites.join('\n  ')}`,
    );
  }

  assert.deepEqual(
    offenders,
    [],
    `The app loads a script from an origin the report-only policy does not name. ` +
      `That policy blocks nothing today, so nothing is broken right now — which is ` +
      `exactly why this rots quietly. It is the DRAFT of the enforced policy, so an ` +
      `origin missing here is an outage with a date on it. Add it to CSP_REPORT_ONLY ` +
      `in next.config.ts, or stop loading the script.\n\nscr` +
      `ipt-src: ${scriptSrc}\n\n${offenders.join('\n')}`,
  );
});

test('🔴 a script that OPENS A FRAME is allowed to open it — the Turnstile class', () => {
  // THE BUG THIS EXISTS FOR: the sweep above only proves we may LOAD the script.
  // Turnstile then draws its challenge in a window from the same origin, and
  // `frame-src` is a separate directive. Passing the first check and failing this
  // one is a bot check that downloads fine and can never appear.
  const frameSrc = enforcedFrameSrc();
  const loaded = new Set<string>();

  for (const file of sources(join(WEB, 'app'))
    .concat(sources(join(WEB, 'components')))
    .concat(sources(join(WEB, 'lib')))) {
    const code = readFileSync(file, 'utf8');
    if (!code.includes('.src') && !/<[Ss]cript\b/.test(code)) continue;
    for (const host of scriptHosts(code).hosts) loaded.add(host);
  }

  const offenders = [...loaded]
    .filter((host) => host in FRAME_CREATING_SCRIPT_HOSTS)
    .filter((host) => !frameSrc.includes(host))
    .map((host) => `${host} — ${FRAME_CREATING_SCRIPT_HOSTS[host]}`);

  assert.deepEqual(
    offenders,
    [],
    `A third-party script the app loads opens a FRAME, and the enforced frame-src ` +
      `forbids it. There is no <iframe> in our source to grep for and nothing will ` +
      `throw — the window simply never appears.\n\nfr` +
      `ame-src: ${frameSrc}\n\n${offenders.join('\n')}`,
  );
});

test('the bot check stays reachable in BOTH policies', () => {
  // Pins the specific regression, exactly as the OSM test below does: the sweeps
  // go quiet the moment the script URL stops being statically resolvable, and a
  // silent sweep must not let these two origins be dropped.
  assert.match(
    enforcedFrameSrc(),
    /challenges\.cloudflare\.com/,
    'Turnstile fell out of the enforced frame-src — the challenge cannot render, ' +
      'so with Supabase captcha on, NOBODY can sign in, sign up or reset a password',
  );
  assert.match(
    reportOnlyScriptSrc(),
    /challenges\.cloudflare\.com/,
    'Turnstile fell out of the report-only script-src — harmless today, an ' +
      'app-wide lockout the day that policy is enforced',
  );
});

test('the map host that caused this stays in frame-src', () => {
  // The general sweep above only fires while an iframe still names the host in
  // a way it can resolve. This one pins the specific regression: if the map
  // moves to a prop-fed src, the sweep goes quiet and the origin could be
  // dropped from the policy with nothing to notice.
  assert.match(
    enforcedFrameSrc(),
    /openstreetmap\.org/,
    'the OpenStreetMap embed host fell out of frame-src — the vendor location ' +
      'map on every shop page silently reverts to a grey box',
  );
});
