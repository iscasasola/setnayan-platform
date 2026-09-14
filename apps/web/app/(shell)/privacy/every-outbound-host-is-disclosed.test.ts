/**
 * every-outbound-host-is-disclosed.test.ts — a company that receives our users'
 * data must be NAMED on /privacy, or carry a written reason for not being.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * On 2026-09-14 the live page said product analytics carried "no personal
 * identifiers". `lib/analytics.ts` sets `distinctId` to the Supabase `user_id`,
 * and the browser SDK calls `posthog.identify(user.id)`. The sentence was
 * false, published, and nobody had checked it against the code in the four
 * months it was up. The same sweep found three live processors the page had
 * never named — OpenAI, LanguageTool and OpenStreetMap/Nominatim — plus the
 * Gemini image model, which receives the pictures on a paid mood board.
 *
 * 🔑 NONE OF THAT COULD FAIL. A privacy page is prose, and prose has no test,
 * so the page drifted from the code silently while the owner — who is the
 * registered Data Protection Officer under RA 10173 — carried the liability.
 *
 * ── The property ───────────────────────────────────────────────────────────
 * Every external host the app can `fetch` at runtime is either:
 *   · NAMED on /privacy (by company or by host), or
 *   · listed in EXEMPT below WITH A REASON.
 *
 * So adding a processor tomorrow turns this red, and the only two honest ways
 * to green it are to disclose it or to write down why it needs no disclosure.
 * That is the published-or-baselined-with-a-reason shape used elsewhere here.
 *
 * ⚠ WHAT THIS CANNOT SEE, stated rather than left to be discovered: a host
 * assembled at runtime from parts, or reached through an SDK that never names
 * its endpoint in our source (Supabase, Sentry, PostHog and Resend are all in
 * EXEMPT for that reason AND are all already disclosed). This guard raises the
 * floor; it is not a proof of completeness.
 *
 * 🛡 Mutation-checked: adding a fake `fetch('https://api.example-tracker.com')`
 * to a lib file turns it RED naming that host; removing "OpenAI" from the page
 * turns it RED naming api.openai.com.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const PRIVACY = join(HERE, 'page.tsx');

/**
 * Hosts that receive no user data, or whose disclosure lives elsewhere.
 * A new entry needs a reason a person can disagree with.
 */
const EXEMPT: ReadonlyArray<{ host: string; why: string }> = [
  { host: 'unpkg.com', why: 'CDN for a third-party library bundle; no request carries user data.' },
  {
    host: 'external.api.recraft.ai',
    why:
      'Build-time SVG illustration generation only — `lib/recraft.ts` has no runtime importer ' +
      '(verify: grep for "from \'@/lib/recraft\'"). Prompts are ours, not user content. ' +
      'If a runtime caller ever appears, this exemption is void and it must be disclosed.',
  },
  { host: 'accounts.google.com', why: 'OAuth consent screen the user is sent to; Google is disclosed.' },
  { host: 'developers.tiktok.com', why: 'Documentation link, not an API call. TikTok is disclosed.' },
  {
    host: 'open.tiktokapis.com',
    why:
      "TikTok's own API host. The page discloses the company by name (\"TikTok\"), which is what a " +
      'reader needs; the host string is an implementation detail. Exempt because it is DISCLOSED, not because it is harmless.',
  },
  { host: 'tiktok.com', why: 'Share/profile links. TikTok is disclosed.' },
  { host: 'vm.tiktok.com', why: 'Short-link host for shared videos. TikTok is disclosed.' },
  { host: 'www.recraft.ai', why: 'Documentation URL inside a comment-free constant; see recraft exemption.' },
];

/** Every `.ts`/`.tsx` under lib/ and app/, comments stripped. */
function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === '.next') continue;
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Hosts we actually CALL — not every URL that appears in source.
 *
 * ⚠ THE FIRST VERSION OF THIS FUNCTION MATCHED EVERY `https://` STRING and
 * flagged 16 hosts that receive nothing: Waze and Apple Maps links a user taps,
 * the DTI/SEC/BIR pages our help text points at, a `picsum.photos` fixture,
 * `x.invalid` inside a CSP example. **A guard that cries wolf teaches you to
 * skim past the one time it is right**, so the signal is narrowed to two shapes
 * that mean "our server sent a request":
 *   1. a literal `fetch('https://host/…')`
 *   2. `const NAME = 'https://host/…'` where `NAME` is later used in a `fetch(`
 * Anything else — an href, a fixture, a doc link — is out of scope by design.
 */
function outboundHosts(): Map<string, string> {
  const found = new Map<string, string>();
  const note = (host: string, file: string) => {
    const h = host.toLowerCase();
    if (h.endsWith('setnayan.com') || h.endsWith('localhost')) return;
    if (!found.has(h)) found.set(h, file);
  };
  for (const dir of ['lib', 'app']) {
    for (const file of sourceFiles(join(WEB, dir))) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.slice(WEB.length + 1);
      // 1 — fetch('https://…')
      for (const m of src.matchAll(/fetch\(\s*[`'"]https:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
        // `noUncheckedIndexedAccess` is on: a capture group is `string | undefined`
        // to the compiler even when the pattern guarantees it. Narrow, don't assert.
        const host = m[1];
        if (host) note(host, rel);
      }
      // 2 — const NAME = 'https://…'  … later  fetch(NAME  or  fetch(`${NAME}
      for (const m of src.matchAll(
        /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*[`'"]https:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi,
      )) {
        const [, name, host] = m;
        if (!name || !host) continue;
        const used = new RegExp(`fetch\\(\\s*(?:\`\\$\\{)?${name}\\b`).test(src);
        if (used) note(host, rel);
      }
    }
  }
  return found;
}

test('every outbound host is named on /privacy, or exempt with a reason', () => {
  const page = readFileSync(PRIVACY, 'utf8').toLowerCase();
  const exempt = new Set(EXEMPT.map((e) => e.host));
  for (const e of EXEMPT) {
    assert.ok(e.why.trim().length > 20, `EXEMPT entry for ${e.host} needs a real reason, not a placeholder`);
  }

  const undisclosed: string[] = [];
  for (const [host, where] of outboundHosts()) {
    if (exempt.has(host)) continue;
    // Named by host, or by the company that owns it.
    const labels = [host, host.replace(/^(www|api|open|external|graph|oauth2|us|app)\./, '')];
    const org = host.split('.').slice(-2, -1)[0] ?? '';
    if (org) labels.push(org);
    if (labels.some((l) => l.length > 3 && page.includes(l))) continue;
    undisclosed.push(`${host}  (first seen in ${where})`);
  }

  assert.deepEqual(
    undisclosed,
    [],
    'These hosts receive requests from our code and are not named on /privacy. ' +
      'Disclose each on the page, or add it to EXEMPT with a reason somebody could disagree with. ' +
      'The owner is the registered DPO under RA 10173 — an undisclosed processor is his liability, not a lint warning.',
  );
});

test('the page does not claim analytics are anonymous', () => {
  const page = readFileSync(PRIVACY, 'utf8');
  for (const claim of ['no personal identifiers', 'Anonymized product analytics', 'anonymous analytics']) {
    assert.ok(
      !page.includes(claim),
      `/privacy still says "${claim}". lib/analytics.ts sets distinctId to the Supabase user_id and the ` +
        'browser SDK calls posthog.identify(user.id), so analytics events are linked to a named account.',
    );
  }
});
