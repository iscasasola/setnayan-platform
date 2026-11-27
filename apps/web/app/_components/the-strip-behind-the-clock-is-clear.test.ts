/**
 * ⬛ THE STRIP BEHIND THE CLOCK IS CLEAR (Apple build 10 screenshots, 27 Nov 2026: a black band above the top bar on
 * every screen of the iOS app).
 *
 * `setOverlaysWebView({ overlay: false })` makes @capacitor/status-bar (iOS) add its own view over the status-bar
 * strip, coloured with the plugin's `backgroundColor`, which defaults to `UIColor.black`. The page-coloured strip
 * SideSafeAreaHost.swift paints sat under it. The web now sets that view fully transparent before it is laid, so the
 * page's colour shows through.
 *
 * Driven with a fake plugin (the real function), plus one source guard that NativeBridge goes through it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { STATUS_STRIP_CLEAR, keepTheStripClear } from './native-bridge';

/** Capacitor's `UIColor.capacitor.color(fromHex:)`, as shipped in @capacitor/ios 8: 6 digits = opaque, 8 = RRGGBBAA. */
function capacitorAlpha(hex: string): number | null {
  const h = hex.trim().replace(/#/g, '');
  if (!/^[0-9a-f]+$/i.test(h)) return null;
  if (h.length === 6) return 1;
  if (h.length === 8) return parseInt(h.slice(6, 8), 16) / 255;
  return null;
}

test('the strip colour reads as fully transparent in Capacitor\'s hex reader', () => {
  assert.equal(capacitorAlpha(STATUS_STRIP_CLEAR), 0, `${STATUS_STRIP_CLEAR} must parse, with alpha 0`);
});

test('the strip is made clear BEFORE the plugin lays it, and the web view still sits below the clock', async () => {
  const calls: string[] = [];
  const plugin = {
    setBackgroundColor: async ({ color }: { color: string }) => void calls.push(`color ${color}`),
    setOverlaysWebView: async ({ overlay }: { overlay: boolean }) => void calls.push(`overlay ${overlay}`),
  };
  keepTheStripClear(plugin);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, [`color ${STATUS_STRIP_CLEAR}`, 'overlay false']);
});

test('a missing plugin or a failing call never throws', async () => {
  assert.doesNotThrow(() => keepTheStripClear(undefined));
  const failing = {
    setBackgroundColor: () => Promise.reject(new Error('no')),
    setOverlaysWebView: () => Promise.reject(new Error('no')),
  };
  assert.doesNotThrow(() => keepTheStripClear(failing));
  await new Promise((r) => setImmediate(r));
});

test('NativeBridge lays the strip only through keepTheStripClear', () => {
  const src = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'native-bridge.tsx'), 'utf8'));
  const body = src.slice(src.indexOf('export function NativeBridge'));
  assert.match(body, /keepTheStripClear\(StatusBar/, 'NativeBridge must call keepTheStripClear');
  assert.doesNotMatch(body, /setOverlaysWebView/, 'a bare setOverlaysWebView would lay the plugin\'s black strip again');
});
