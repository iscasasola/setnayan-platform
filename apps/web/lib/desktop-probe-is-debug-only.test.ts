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
 *
 * Assertion 3's release-side check matches the S0 harness's own permission
 * NAMES (`allow-probe-report`, `allow-probe-ipc`) rather than a bare `/probe/`
 * substring. S5 (build-sessions/encoder/S5.md) shipped `allow-encoder-probe` —
 * a real, every-build product permission for the go-live transport-envelope
 * probe, an ordinary English word for a different concept than the S0 spike
 * module — and a bare substring match flagged it as if it were the debug
 * harness leaking into release. The two S0 permission names are enumerated
 * exactly, so this stays just as strict about the actual banned commands.
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

  // S8 (2026-09-05) added stream-key commands that ship in EVERY build.
  // `invoke_handler` can only be called once, so the debug branch's
  // `generate_handler!` now lists the S8 commands alongside the two probe
  // commands, rather than the two probe commands alone. The invariant this
  // test protects is unchanged — probe_report/probe_ipc must be registered
  // ONLY from inside the #[cfg(debug_assertions)] branch, and must be ABSENT
  // from the #[cfg(not(debug_assertions))] branch — so both are checked
  // directly instead of requiring one exact, now-stale invoke_handler shape.
  const debugBranch = /#\[cfg\(debug_assertions\)\]\s*\n\s*let builder = builder([\s\S]*?);/.exec(lib);
  assert.notEqual(debugBranch, null, 'no #[cfg(debug_assertions)] "let builder = builder" branch found');
  // The regex has exactly one capturing group and `debugBranch` is confirmed
  // non-null above, so group 1 is always a real string here — the `?? ''`
  // only satisfies TS's (correctly conservative) `string | undefined` typing
  // for regex capture groups.
  const debugBody = debugBranch![1] ?? '';
  assert.match(debugBody, /probe::probe_report/, 'probe_report must be registered inside the debug branch');
  assert.match(debugBody, /probe::probe_ipc/, 'probe_ipc must be registered inside the debug branch');

  const releaseBranch = /#\[cfg\(not\(debug_assertions\)\)\]\s*\n\s*let builder = builder([\s\S]*?);/.exec(lib);
  assert.notEqual(releaseBranch, null, 'no #[cfg(not(debug_assertions))] "let builder = builder" branch found');
  const releaseBody = releaseBranch![1] ?? '';
  assert.doesNotMatch(releaseBody, /probe::/, 'the release invoke_handler branch must never mention probe::');

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
  // S8 (2026-09-05): the probe command names are pushed onto a runtime Vec
  // inside this branch (rather than passed as a literal array straight to
  // `.commands()`) because that same Vec also carries the S8 stream-key
  // commands, which ship in every build and can only reach the manifest via
  // ONE `.app_manifest(...).commands(...)` call. The invariant is unchanged —
  // "probe_report"/"probe_ipc" enter that Vec ONLY here.
  assert.match(debugBody, /commands\.push\("probe_report"\)/, 'probe_report must be pushed inside the debug branch');
  assert.match(debugBody, /commands\.push\("probe_ipc"\)/, 'probe_ipc must be pushed inside the debug branch');
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
      // Named exactly, not `/probe/` as a bare substring: S5's `allow-encoder-probe`
      // (a real, every-build permission — the go-live transport-envelope probe) also
      // contains the word "probe" without being the S0 spike harness this guards
      // against — see the module docblock.
      assert.doesNotMatch(
        String(typeof p === 'string' ? p : JSON.stringify(p)),
        /^allow-probe-(report|ipc)$/,
        `${f} grants an S0 probe-harness permission — that ships in release`,
      );
    }
  }
  const debugFiles = readdirSync(join(TAURI, 'capabilities-debug')).filter((f) => f.endsWith('.json'));
  assert.ok(debugFiles.length > 0, 'src-tauri/capabilities-debug/ has no capability files');
  for (const f of debugFiles) {
    const cap = JSON.parse(read(join('capabilities-debug', f))) as { permissions: string[] };
    assert.deepEqual([...cap.permissions].sort(), ['allow-probe-ipc', 'allow-probe-report'], `${f} must grant exactly the two probe permissions`);
  }
});
