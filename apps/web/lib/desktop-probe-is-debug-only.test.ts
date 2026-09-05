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
  const lib = stripComments(read('src/lib.rs'));
  assert.match(lib, /#\[cfg\(debug_assertions\)\]\s*\n\s*mod probe;/, 'mod probe; must sit directly under #[cfg(debug_assertions)]');

  // The PROPERTY, not the shape: every probe:: site must be reachable only in a
  // debug build. S10 added keep-awake commands that ship in every profile, so the
  // debug invoke_handler is no longer the two-probe one-liner S0 wrote — asserting
  // that literal made the guard fail on a change that kept the property intact.
  // What must stay true is that the RELEASE builder mentions no probe.
  const releaseArm = /#\[cfg\(not\(debug_assertions\)\)\]([\s\S]*?)(?=\n\s*#\[cfg|\n\s*builder\b|$)/.exec(lib);
  if (releaseArm) {
    assert.doesNotMatch(releaseArm[1] ?? '', /probe/, 'the #[cfg(not(debug_assertions))] arm must not mention probe');
  }
  // Each probe:: use must be preceded, somewhere above it, by a debug gate and no
  // intervening not(debug_assertions) gate.
  for (const m of lib.matchAll(/probe::/g)) {
    const before = lib.slice(0, m.index);
    const lastDebug = before.lastIndexOf('#[cfg(debug_assertions)]');
    const lastRelease = before.lastIndexOf('#[cfg(not(debug_assertions))]');
    assert.ok(lastDebug > lastRelease, `a probe:: reference at ${m.index} is not under #[cfg(debug_assertions)]`);
  }
  const mentions = lib.match(/probe::/g)?.length ?? 0;
  assert.equal(mentions, 3, `expected exactly 3 probe:: references (two commands + on_page_load), got ${mentions}`);
});

test('build.rs widens the capabilities glob only when PROFILE=debug', () => {
  const build = stripComments(read('build.rs'));
  assert.match(build, /let debug = std::env::var\("PROFILE"\)\.map\(\|p\| p == "debug"\)/);
  const ifDebug = /if debug \{([\s\S]*?)\n\s*\}\n/.exec(build);
  assert.notEqual(ifDebug, null, 'no `if debug { … }` block in build.rs');
  const debugBody = ifDebug![1] ?? '';
  assert.match(debugBody, /capabilities_path_pattern\("\.\/capabilities\*\/\*\*\/\*\.json"\)/, 'the widened glob must live inside the debug branch');

  // The command manifest itself is no longer debug-only — S10's keep-awake commands
  // ship in every profile, so `.commands(...)` moved out and now picks between two
  // arrays. The property to hold is narrower and more honest: the PROBE commands
  // must appear only where `debug` is true.
  const selector = /if debug \{([\s\S]*?)\}\s*else\s*\{([\s\S]*?)\}/.exec(build);
  if (selector) {
    assert.match(selector[1] ?? '', /"probe_report"[\s\S]*"probe_ipc"/, 'the debug arm must list the probe commands');
    assert.doesNotMatch(selector[2] ?? '', /probe_report|probe_ipc/, 'the release arm must not list any probe command');
  } else {
    assert.match(debugBody, /\.commands\(&\["probe_report", "probe_ipc"\]\)/, 'the command manifest must live inside the debug branch');
  }

  // Outside any debug-conditional code, probe commands and the widened glob must
  // not appear at all.
  const withoutConditionals = build.replace(ifDebug![0], '').replace(selector ? selector[0] : '', '');
  assert.doesNotMatch(withoutConditionals, /capabilities\*|probe_report|probe_ipc/, 'probe commands / widened glob referenced outside a debug conditional');
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
