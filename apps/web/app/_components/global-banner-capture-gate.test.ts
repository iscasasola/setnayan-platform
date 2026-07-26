import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * REGRESSION GUARD — every banner the root layout mounts must be route-gated.
 *
 * WHY A STRUCTURAL TEST RATHER THAN A RENDER TEST: this package tests with
 * `node:test` and has no DOM/RTL, so a component cannot be rendered here. But
 * the bug worth catching is not "does this one banner return null" — it is the
 * one that has now recurred THREE times:
 *
 *   · <CookieConsentBanner> shipped with no route gate at all (#3721).
 *   · <DemoModeBanner> was gated in the same sweep.
 *   · <PilotModeBanner> was missed by BOTH and is fixed here (2026-07-26).
 *
 * Each was added to the root layout by someone who had no reason to know that
 * `/panood/program/[eventId]` is window-captured by a couple's OBS, so anything
 * the layout paints goes out live on a wedding that cannot be re-run. The next
 * banner will be added by someone who also does not know that. This test is how
 * they find out — at CI time, not on a wedding day.
 *
 * It reads the root layout, finds every `*-banner` component mounted there, and
 * requires each to reach `capture-safe-routes` — either directly or through one
 * local child component (the pilot banner splits server/client precisely so its
 * ~19 KB pricing import stays server-side, so its gate lives in the child).
 *
 * TO ADD A BANNER THAT LEGITIMATELY NEEDS NO GATE: do not delete this test.
 * Add it to ALLOWED_UNGATED below with a comment saying why it cannot leak —
 * which forces the question to be answered rather than skipped.
 */

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = here;
const layoutPath = join(here, '..', 'layout.tsx');

/**
 * Banners exempt from the gate, each with the reason it cannot leak.
 * Empty today — every mounted banner is gated. Keep it that way if you can.
 */
const ALLOWED_UNGATED = new Set<string>([]);

const GATE_MODULE = 'capture-safe-routes';

/** Local `./x` imports of a component file, resolved to real paths. */
function localChildren(sourcePath: string): string[] {
  const src = readFileSync(sourcePath, 'utf8');
  // `m[1]` is `string | undefined` under noUncheckedIndexedAccess even though
  // the group is not optional, so narrow rather than assert — a `!` here would
  // be the same "trust me" move this whole file exists to prevent.
  const specifiers = [...src.matchAll(/from\s+'\.\/([\w.-]+)'/g)]
    .map((m) => m[1])
    .filter((s): s is string => typeof s === 'string');
  return specifiers
    .map((s) => join(componentsDir, `${s}.tsx`))
    .filter((p) => existsSync(p));
}

/** True if the file, or one local child of it, imports the gate. */
function reachesGate(sourcePath: string): boolean {
  if (readFileSync(sourcePath, 'utf8').includes(GATE_MODULE)) return true;
  return localChildren(sourcePath).some((child) =>
    readFileSync(child, 'utf8').includes(GATE_MODULE),
  );
}

test('every *-banner mounted in the root layout reaches the capture gate', () => {
  const layout = readFileSync(layoutPath, 'utf8');

  // Components imported from ./_components/ whose module name ends in -banner.
  const mounted = [
    ...layout.matchAll(/from\s+'\.\/_components\/([\w-]*banner)'/g),
  ]
    .map((m) => m[1])
    .filter((n): n is string => typeof n === 'string');

  assert.ok(
    mounted.length >= 3,
    `Expected to find the known banners in the root layout, found ${mounted.length}: ` +
      `${mounted.join(', ')}. If the layout was restructured, update this test ` +
      `rather than weakening it — it is the only thing standing between a new ` +
      `global banner and a live wedding broadcast.`,
  );

  for (const name of mounted) {
    if (ALLOWED_UNGATED.has(name)) continue;
    const file = join(componentsDir, `${name}.tsx`);
    assert.ok(
      existsSync(file),
      `Root layout mounts ./_components/${name} but ${file} does not exist.`,
    );
    assert.ok(
      reachesGate(file),
      `<${name}> is mounted in the ROOT LAYOUT but never reaches ` +
        `'${GATE_MODULE}'.\n\n` +
        `The root layout paints on /panood/program/[eventId] — the chrome-less ` +
        `window a couple's OBS window-captures and streams to their YouTube. ` +
        `Anything this banner draws there goes out on their live broadcast, on a ` +
        `day that cannot be re-run.\n\n` +
        `Fix: gate it with isBroadcastCaptureRoute(usePathname()) — see ` +
        `pilot-mode-banner-client.tsx for the server/client split that keeps a ` +
        `heavy server-only import out of the client bundle.`,
    );
  }
});

test('the pilot banner specifically is gated (the 2026-07-26 miss)', () => {
  const file = join(componentsDir, 'pilot-mode-banner.tsx');
  assert.ok(reachesGate(file), 'PilotModeBanner lost its capture-route gate.');
});

