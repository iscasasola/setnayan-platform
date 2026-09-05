/**
 * desktop-probe-is-debug-only.test.ts — the S0 spike harness never reaches a release build.
 *
 * `src-tauri/src/probe.rs` adds two IPC commands (`probe_report`, `probe_ipc`) and a
 * page-load hook that evaluates a probe script inside the webview on https://setnayan.com.
 * That is a measurement tool for `build-sessions/encoder/S0-FINDING.md`, not a product
 * surface: a shipped binary must have neither the commands nor a capability granting
 * them to the remote origin. The gate is three-fold and every leg is a plain string in a
 * source file, so this test reads the files as text (same shape as
 * csp-embeds-are-allowed.test.ts — the sentence in a comment is not the mechanism):
 *
 *   1. lib.rs compiles the module and registers the handler ONLY under
 *      `#[cfg(debug_assertions)]`.
 *   2. build.rs widens the capabilities glob to `capabilities*` ONLY when cargo
 *      PROFILE=debug, so `capabilities-debug/` is invisible to a release build.
 *   3. The release capability directory (`src-tauri/capabilities/`) grants no
 *      `allow-probe-*` permission, and the debug directory grants nothing BUT those.
 *
 * Mutation check (2026-09-05): deleting the `#[cfg(debug_assertions)]` line above
 * `mod probe;` turns assertion 1 red; adding `allow-probe-report` to
 * capabilities/default.json turns assertion 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAURI = join(HERE, '..', '..', '..', 'src-tauri');
const read = (rel: string) => readFileSync(join(TAURI, rel), 'utf8');

test('lib.rs compiles the probe module only under #[cfg(debug_assertions)]', () => {
  const lib = read('src/lib.rs');
  assert.match(lib, /#\[cfg\(debug_assertions\)\]\s*\n\s*mod probe;/, 'mod probe; must sit directly under #[cfg(debug_assertions)]');
  assert.match(
    lib,
    /#\[cfg\(debug_assertions\)\]\s*\n\s*let builder = builder\s*\n?\s*\.invoke_handler\(tauri::generate_handler!\[probe::probe_report, probe::probe_ipc\]\)/,
    'the invoke_handler registration must be under its own #[cfg(debug_assertions)]',
  );
  // Nothing else in lib.rs may mention probe:: outside those two gated sites.
  const mentions = lib.match(/probe::/g)?.length ?? 0;
  assert.equal(mentions, 3, `expected exactly 3 probe:: references (two commands + on_page_load), got ${mentions}`);
});

test('build.rs widens the capabilities glob only when PROFILE=debug', () => {
  const build = read('build.rs');
  assert.match(build, /let debug = std::env::var\("PROFILE"\)\.map\(\|p\| p == "debug"\)/);
  const ifDebug = /if debug \{([\s\S]*?)\n\s*\}\n/.exec(build);
  assert.notEqual(ifDebug, null, 'no `if debug { … }` block in build.rs');
  const debugBody = ifDebug![1] ?? '';
  assert.match(debugBody, /capabilities_path_pattern\("\.\/capabilities\*\/\*\*\/\*\.json"\)/, 'the widened glob must live inside the debug branch');
  assert.match(debugBody, /\.commands\(&\["probe_report", "probe_ipc"\]\)/, 'the command manifest must live inside the debug branch');
  // Comments may name the commands (build.rs documents the release `strings` check); code may not.
  const outside = stripComments(build.replace(ifDebug![0], ''));
  assert.doesNotMatch(outside, /capabilities\*|probe_report|probe_ipc/, 'probe commands / widened glob referenced outside the debug branch');
});

test('release capabilities grant no probe permission; debug capabilities grant only probe permissions', () => {
  const releaseFiles = readdirSync(join(TAURI, 'capabilities')).filter((f) => f.endsWith('.json'));
  assert.ok(releaseFiles.length > 0, 'src-tauri/capabilities/ has no capability files');
  for (const f of releaseFiles) {
    const cap = JSON.parse(read(join('capabilities', f))) as { permissions: unknown[] };
    for (const p of cap.permissions) {
      assert.doesNotMatch(String(typeof p === 'string' ? p : JSON.stringify(p)), /probe/, `${f} grants a probe permission — that ships in release`);
    }
  }
  const debugFiles = readdirSync(join(TAURI, 'capabilities-debug')).filter((f) => f.endsWith('.json'));
  assert.ok(debugFiles.length > 0, 'src-tauri/capabilities-debug/ has no capability files');
  for (const f of debugFiles) {
    const cap = JSON.parse(read(join('capabilities-debug', f))) as { permissions: string[] };
    assert.deepEqual([...cap.permissions].sort(), ['allow-probe-ipc', 'allow-probe-report'], `${f} must grant exactly the two probe permissions`);
  }
});
