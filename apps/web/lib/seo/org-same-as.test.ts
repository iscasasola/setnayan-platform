/**
 * Guards the two "the check pointed at the wrong source" bugs found 2026-07-31.
 *
 * Both had the same shape: the SEO audit read an input that NOTHING ELSE
 * consumed, so it described a reality that did not exist.
 *   1. `Organization.sameAs` — audit read env `SETNAYAN_ORG_SAMEAS` (unused
 *      anywhere) while the JSON-LD shipped a hardcoded Facebook Page. Result: a
 *      daily "empty — create FB Page" nag for a Page that was already live.
 *   2. Verification tokens — audit read `GOOGLE_SITE_VERIFICATION`, but the meta
 *      tag renders from `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`. Setting the var
 *      that actually works would never have silenced the audit.
 *
 * A nag that manufactures work is worse than no nag, so these are pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ORG_SAME_AS_SHIPPED, orgSameAs, siteVerification } from './org-same-as';

test('the shipped sameAs list is never empty — the audit must not nag for a live profile', () => {
  assert.ok(ORG_SAME_AS_SHIPPED.length > 0);
  assert.ok(
    ORG_SAME_AS_SHIPPED.some((u) => u.includes('facebook.com')),
    'the owner-confirmed Facebook Page must stay in the shipped list',
  );
});

test('env additions are ADDITIVE, never a replacement', () => {
  const prev = process.env.SETNAYAN_ORG_SAMEAS;
  try {
    process.env.SETNAYAN_ORG_SAMEAS = 'https://www.linkedin.com/company/setnayan';
    const list = orgSameAs();
    for (const shipped of ORG_SAME_AS_SHIPPED) {
      assert.ok(list.includes(shipped), 'an env addition must not drop a shipped profile');
    }
    assert.ok(list.includes('https://www.linkedin.com/company/setnayan'));
  } finally {
    if (prev === undefined) delete process.env.SETNAYAN_ORG_SAMEAS;
    else process.env.SETNAYAN_ORG_SAMEAS = prev;
  }
});

test('env additions are deduped and trimmed', () => {
  const prev = process.env.SETNAYAN_ORG_SAMEAS;
  try {
    process.env.SETNAYAN_ORG_SAMEAS = ` ${ORG_SAME_AS_SHIPPED[0]} , , https://x.com/setnayan `;
    const list = orgSameAs();
    assert.equal(new Set(list).size, list.length, 'no duplicates');
    assert.ok(!list.includes(''), 'no empty entries');
    assert.ok(list.includes('https://x.com/setnayan'));
  } finally {
    if (prev === undefined) delete process.env.SETNAYAN_ORG_SAMEAS;
    else process.env.SETNAYAN_ORG_SAMEAS = prev;
  }
});

test('verification reads the NEXT_PUBLIC_ names the meta tag actually renders from', () => {
  const keys = [
    'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION',
    'NEXT_PUBLIC_BING_SITE_VERIFICATION',
    'GOOGLE_SITE_VERIFICATION',
    'BING_SITE_VERIFICATION',
  ] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];

    assert.deepEqual(siteVerification(), { google: undefined, bing: undefined });

    // The prefixed names — the ones app/layout.tsx renders — must be honoured.
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = 'g-prefixed';
    process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION = 'b-prefixed';
    assert.deepEqual(siteVerification(), { google: 'g-prefixed', bing: 'b-prefixed' });

    // Unprefixed still accepted so an existing deployment cannot regress.
    delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
    process.env.GOOGLE_SITE_VERIFICATION = 'g-legacy';
    assert.equal(siteVerification().google, 'g-legacy');
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
