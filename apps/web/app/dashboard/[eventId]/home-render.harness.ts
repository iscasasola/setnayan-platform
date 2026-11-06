/**
 * home-render.harness.ts — draws the REAL Home (`HomeFirstScreen`) to static markup for the control-row guards, on the
 * prototype's own sample (`lib/home-control-fixture.ts`, the lab's fixture too).
 *
 * The repo's render harness: `"jsx": "preserve"` compiles to the classic runtime, so `React` must be global BEFORE the
 * component is (dynamically) imported; and a `server-only` shim, because the Papic buy sheet reaches server actions.
 */
import React from 'react';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { aiStatus, homeServices, papicStatus } from '@/lib/home-first-screen';
import { fixtureControl } from '@/lib/home-control-fixture';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_home_render_harness__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let Screen: typeof import('./_components/home-first-screen').HomeFirstScreen | null = null;

/** Import the real component once the shims are in place. Call from `test.before`. */
export async function loadHome(): Promise<void> {
  Screen = (await import('./_components/home-first-screen')).HomeFirstScreen;
}

/** Home as the page draws it on the fixture; `over` replaces any prop. */
export function drawHome(over: Partial<HomeFirstScreenProps> = {}): string {
  const control = over.control ?? fixtureControl('e1');
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding · December 12, 2026', name: 'Ana & Miguel' },
    next: control.next,
    control,
    services: homeServices({
      next: control.next.kind,
      storeShell: false,
      papic: papicStatus({ permitted: true, tile: { photosGathered: 0, preCapture: true } }),
      ai: aiStatus(false),
    }),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}

/** The markup of one part, from its opening tag's marker to the next sibling marker of the same kind. */
export function slice(html: string, marker: string, until: string[]): string {
  const at = html.indexOf(marker);
  if (at < 0) return '';
  const ends = until.map((m) => html.indexOf(m, at + marker.length)).filter((i) => i > at);
  return html.slice(at, ends.length ? Math.min(...ends) : undefined);
}

export const count = (html: string, needle: string) => html.split(needle).length - 1;
