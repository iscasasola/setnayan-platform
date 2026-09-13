/**
 * csp-encoder-ipc.test.ts — S5 (build-sessions/encoder/S5.md, trap 2).
 *
 * `next.config.ts`'s draft `connect-src` must name `ipc:` and
 * `http://ipc.localhost`, because Tauri's custom-protocol IPC on WINDOWS
 * (WebView2) requests `http://ipc.localhost/<command>` — without it in
 * connect-src, that fetch is a CSP violation and `ipc-protocol.js` latches
 * into its JSON/postMessage fallback for the rest of the session.
 *
 * ⚠ THIS LINE ALONE DOES NOT MAKE THE TRANSPORT RAW EVERYWHERE. `contract.rs`'s
 * own docblock and S0's measurement: on macOS/WebKit, the `ipc://` custom
 * protocol is refused from an `https://` document for a MIXED-CONTENT
 * reason, not a CSP one — no `connect-src` entry fixes that. That is exactly
 * why the chosen production transport (owner decision 2026-09-06) is the
 * base64-JSON envelope on every platform (`ipc-envelope.ts`), not "CSP-fixed
 * raw IPC on Windows, still-broken raw IPC on macOS". This test only proves
 * the necessary-but-not-sufficient half: the directive is present.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = () => readFileSync(join(WEB, 'next.config.ts'), 'utf8');

/**
 * The REPORT-ONLY (draft) `connect-src` — anchored inside the
 * `CSP_REPORT_ONLY` array, same technique as
 * `csp-embeds-are-allowed.test.ts`'s frame-src extractors, so this cannot
 * accidentally read some other directive that happens to share a prefix.
 */
function draftConnectSrc(config: string): string | null {
  const block = /const CSP_REPORT_ONLY = \[([\s\S]*?)\]\.join/.exec(config);
  if (!block?.[1]) return null;
  for (const line of block[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    const m = /^"(connect-src [^"]*)"/.exec(trimmed);
    if (m) return m[1]!;
  }
  return null;
}

function connectSrc(): string {
  const found = draftConnectSrc(CONFIG());
  assert.notEqual(found, null, 'no report-only connect-src directive found in next.config.ts');
  return found!;
}

test('connect-src names ipc: (the custom-protocol scheme)', () => {
  assert.match(
    connectSrc(),
    /(^|\s)ipc:(\s|$)/,
    'connect-src is missing the bare `ipc:` scheme — Tauri IPC on the custom ' +
      'protocol would be a CSP violation, permanently downgrading the transport ' +
      'to the JSON/postMessage fallback',
  );
});

test('connect-src names http://ipc.localhost (the WebView2/Windows IPC origin)', () => {
  assert.match(
    connectSrc(),
    /(^|\s)http:\/\/ipc\.localhost(\s|$)/,
    'connect-src is missing `http://ipc.localhost` — on Windows/WebView2, ' +
      'Tauri IPC requests THIS origin specifically; without it here every ' +
      'encoder_* invoke on Windows is a CSP violation',
  );
});

test('REGRESSION GUARD — removing the ipc: line must fail this file', () => {
  // Proves the extractor+assertions actually read the real connect-src rather
  // than a synthetic string — feed it a config with the line stripped.
  const withoutIpc = CONFIG().replace(/\s*ipc:\s*http:\/\/ipc\.localhost/, '');
  const found = draftConnectSrc(withoutIpc);
  assert.notEqual(found, null);
  assert.doesNotMatch(found!, /ipc:/);
});
