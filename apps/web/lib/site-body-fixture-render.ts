/**
 * 🧪 THE REAL GUEST PAGE, DRAWN WITHOUT A DATABASE — `renderSiteBodyFixture(overrides?)` returns the HTML of
 * `SiteBody` (`app/[slug]/_components/site-body.tsx`) for the fixture invitation (`lib/site-body-fixture.ts`).
 * TEST TOOLING ONLY: nothing under `app/` imports this file; it changes no page.
 *
 * WHAT IS REAL: the component itself, imported and called as `app/[slug]/page.tsx` calls it — every line of its
 * 4,000, every child it draws, the loaders it awaits (`loadEventRoleNames` · `loadEventNameStyle` ·
 * `resolveHubTheme` · `mainGroundLayerFor` · `eventWordsFor` · `resolveProfile`), their own fall-backs included.
 * `site-body.tsx` is NOT edited for this, and no JSX of it is copied.
 *
 * THE SEAM — the database CLIENT, nothing above it. The two modules that build a Supabase client
 * (`lib/supabase/admin.ts` `createAdminClient` · `lib/supabase/server.ts` `createClient`) are replaced, through the
 * `Module._load` door this repo's render tests already use for `server-only` (`scene-words-follow-the-ground.test.ts`),
 * by a client that holds an EMPTY database: every read answers "no row", no error. So each loader runs its own code
 * and lands on its own documented default — the usual role words, the Full name style, the wedding profile, the
 * House theme. Every read is RECORDED (`reads`), so a guard can say exactly which tables the page asked for, and a
 * new read on the guest page shows up as a named difference instead of a silent one. A WRITE through this client
 * throws: a page render must never write.
 *
 * WHAT IS NORMALISED — and nothing else:
 *   · the CLOCK is pinned to `FIXTURE_NOW` for the length of the render (the page asks "what day is it in Manila",
 *     "how many days to go", "is the day behind us");
 *   · the process time zone is pinned to UTC (production's), so a line formatted in the server's own zone cannot
 *     differ between this Mac and CI;
 *   · the process's DEFAULT LOCALE is pinned to en-US (`PINNED_LOCALE`) — because the page really does format in it:
 *     the run of show's times are `toLocaleString(undefined, …)` (`lib/schedule.ts` `formatBlockTimeRange`), so a
 *     server started in German prints "14:30" where this one prints "2:30 PM" (measured 2026-10-10). Pinned for
 *     `Date#toLocale*String`, `Number#toLocaleString` and the `Intl` formatters, when called with no locale;
 *   · the ENVIRONMENT is hidden: for the length of the render every variable but the machine's own (`SYSTEM_ENV`:
 *     PATH, HOME, NODE_*, …) is "not set", so every switch the page or a loader reads is at THE CODE'S DEFAULT —
 *     the same on this Mac, in CI and under any shell. ⚠ A code default is not production's value: this is the
 *     page with nothing configured, not a copy of what Vercel serves.
 * The HTML is returned exactly as React wrote it — no attribute is stripped, no id rewritten, nothing re-ordered.
 *
 * WHAT IT IS NOT:
 *   · It is the server's HTML for the body, drawn by React's own HTML renderer (`react-dom/server`) with the
 *     components called directly — not Next's two-pass server-component render. So there is no document shell
 *     (`<html>`, the layout, the fonts), no flight payload, no `<script>` for a client island, and `next/link` is
 *     the plain build of it. A client island that draws nothing (`HubScrub`) leaves no byte — which is why the
 *     helper also COUNTS the islands it is asked to watch (`mounts`).
 *   · React's `cache()` does not memoise here (it does only inside a server-component render), so a cached loader
 *     runs once per call instead of once per request: the same answers, possibly more reads in `reads` than
 *     production makes. `reads` and `mounts` count CALLS; the guards compare them as a set, and against zero.
 *   · Nothing here runs in a browser: no layout, no script, no engine. What a page LOOKS like is not proven here.
 */
import { join } from 'node:path';
import { Writable } from 'node:stream';
import React from 'react';
/* TYPES ONLY from the fixture up here: its values are required inside the render, AFTER the seam is in place (the
   fixture's own imports reach the database client's module, and a module loaded before the seam keeps the real one). */
import type { SiteBodyFixtureProps } from './site-body-fixture';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');

/** One read the page made of the (empty) database. */
export type FixtureRead = { client: 'admin' | 'session'; kind: 'table' | 'rpc' | 'auth' | 'storage'; name: string };

export type SiteBodyFixtureRender = {
  html: string;
  /** Every database read the render made, in call order (see the docblock: calls, not requests). */
  reads: FixtureRead[];
  /** How many times each watched client island was called (`WATCHED_ISLANDS`). */
  mounts: Record<string, number>;
  /** Everything React or the page wrote to `console.error` / `console.warn` while rendering — nothing filtered. */
  complaints: string[];
};

/** The machine's own variables — the only ones left set while a fixture page renders. Every other one is hidden. */
export const SYSTEM_ENV = /^(?:PATH|HOME|TMPDIR|TEMP|TMP|TERM|LANG|LC_\w+|CI|FORCE_COLOR|NO_COLOR|NODE_\w+|npm_\w+|TSX_\w+|ESBUILD_\w+)$/;

/** Client islands that draw nothing, so only a count can say whether a page mounted them. Module (from `apps/web`) → export. */
export const WATCHED_ISLANDS = {
  HubScrub: 'app/[slug]/_components/hub-scrub.tsx',
} as const;

let reads: FixtureRead[] = [];
let mounts: Record<string, number> = {};

/** A Supabase client over an EMPTY database: a read answers "no row"; a write throws. */
function emptyDatabase(client: FixtureRead['client']): unknown {
  const WRITES = new Set(['insert', 'update', 'upsert', 'delete']);
  const query = (label: string) => {
    let one = false;
    const q: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const answer = { data: one ? null : [], error: null, count: 0, status: 200, statusText: 'OK' };
          return (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer).then(ok, bad);
        }
        if (typeof prop === 'symbol') return undefined;
        if (WRITES.has(prop)) {
          return () => {
            throw new Error(`site-body fixture: the page tried to WRITE (${prop}) to ${label} while rendering`);
          };
        }
        return (..._args: unknown[]) => {
          if (prop === 'single' || prop === 'maybeSingle') one = true;
          return q;
        };
      },
    });
    return q;
  };
  return {
    from(table: string) {
      reads.push({ client, kind: 'table', name: table });
      return query(`table ${table}`);
    },
    rpc(name: string) {
      reads.push({ client, kind: 'rpc', name });
      const q = query(`rpc ${name}`) as { single: () => unknown };
      /* A function's answer is one value, not a list. */
      return q.single();
    },
    auth: {
      async getUser() {
        reads.push({ client, kind: 'auth', name: 'getUser' });
        return { data: { user: null }, error: null };
      },
      async getSession() {
        reads.push({ client, kind: 'auth', name: 'getSession' });
        return { data: { session: null }, error: null };
      },
    },
    storage: {
      from(bucket: string) {
        reads.push({ client, kind: 'storage', name: bucket });
        throw new Error(`site-body fixture: the page asked storage for ${bucket} — the fixture holds no files`);
      },
    },
  };
}

/**
 * Replace the two client-building modules and `server-only`, and count the watched islands — ONCE, AS THIS MODULE
 * LOADS. A module that was loaded before the seam cannot be replaced afterwards (whoever imported it holds the real
 * one), and the failure would be quiet: an island counted as "never mounted" because nobody was counting. So that
 * case throws here, by name. ➜ Import this file BEFORE anything that draws the guest page (`hub-scenes`, `site-body`).
 */
function installSeam(): void {
  const Mod = require('node:module') as {
    _load: (request: string, parent: unknown, ...rest: unknown[]) => unknown;
    _resolveFilename: (request: string, parent: unknown) => string;
  };
  const ADMIN = join(WEB, 'lib/supabase/admin');
  const SESSION = join(WEB, 'lib/supabase/server');
  const islands = new Map<string, string>(
    Object.entries(WATCHED_ISLANDS).map(([name, file]) => [join(WEB, file).replace(/\.tsx?$/, ''), name]),
  );
  for (const loaded of Object.keys(require.cache)) {
    const file = loaded.replace(/\.tsx?$/, '');
    if (file === ADMIN || file === SESSION || islands.has(file)) {
      throw new Error(
        `site-body fixture: ${loaded} was loaded before the fixture's seam, so it can no longer be replaced or counted. ` +
          'Import lib/site-body-fixture-render before anything that draws the guest page.',
      );
    }
  }
  /* Only a request that could be one of ours is resolved (a bare package name never is). */
  const ours = new RegExp(`(?:supabase/(?:admin|server)|${[...islands.keys()].map((f) => f.slice(f.lastIndexOf('/') + 1)).join('|')})$`);
  const wrapped = new Map<string, unknown>();
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, parent: unknown, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (ours.test(request)) {
      let file = '';
      try {
        file = Mod._resolveFilename(request, parent).replace(/\.tsx?$/, '');
      } catch {
        file = '';
      }
      if (file === ADMIN) return { createAdminClient: () => emptyDatabase('admin') };
      if (file === SESSION) return { createClient: async () => emptyDatabase('session') };
      const island = islands.get(file);
      if (island) {
        if (!wrapped.has(file)) {
          const real = load.call(this, request, parent, ...rest) as Record<string, unknown>;
          const inner = real[island] as (props: unknown) => unknown;
          /* The REAL island, called as it is — only counted on the way in. */
          const counted = function (props: unknown) {
            mounts[island] = (mounts[island] ?? 0) + 1;
            return inner(props);
          };
          Object.defineProperty(counted, 'name', { value: island });
          wrapped.set(file, { ...real, [island]: counted });
        }
        return wrapped.get(file);
      }
    }
    return load.call(this, request, parent, ...rest);
  };
}

installSeam();

const fixture = () => require('./site-body-fixture') as typeof import('./site-body-fixture');

/** The default locale every fixture render formats in, whatever the machine's own is. */
export const PINNED_LOCALE = 'en-US';

/** Make "no locale given" mean `PINNED_LOCALE`; returns the undo. */
function pinLocale(): () => void {
  const undo: Array<() => void> = [];
  type Loose = Record<string, (this: unknown, locales?: unknown, ...rest: unknown[]) => unknown>;
  const method = (proto: object, name: string) => {
    const real = (proto as Loose)[name]!;
    (proto as Loose)[name] = function (locales, ...rest) {
      return real.call(this, locales ?? PINNED_LOCALE, ...rest);
    };
    undo.push(() => {
      (proto as Loose)[name] = real;
    });
  };
  for (const name of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) method(Date.prototype, name);
  method(Number.prototype, 'toLocaleString');
  const intl = Intl as unknown as Record<string, (new (...args: unknown[]) => unknown) | undefined>;
  for (const name of ['DateTimeFormat', 'NumberFormat', 'PluralRules', 'RelativeTimeFormat', 'ListFormat']) {
    const Real = intl[name];
    if (!Real) continue;
    intl[name] = new Proxy(Real, {
      construct: (target, [locales, ...rest]) => new target(locales ?? PINNED_LOCALE, ...rest) as object,
      apply: (target, _self, [locales, ...rest]) => (target as unknown as (...args: unknown[]) => unknown)(locales ?? PINNED_LOCALE, ...rest),
    });
    undo.push(() => {
      intl[name] = Real;
    });
  }
  return () => {
    for (const put of undo.reverse()) put();
  };
}

/** Run `work` with the clock, the time zone and the locale pinned and the environment hidden; put everything back afterwards. */
async function pinned<T>(work: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const at = RealDate.parse(fixture().FIXTURE_NOW);
  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(at);
      else super(...(args as ConstructorParameters<typeof Date>));
    }
    static override now() {
      return at;
    }
  }
  const env: Record<string, string | undefined> = { TZ: process.env.TZ };
  for (const key of Object.keys(process.env)) {
    if (SYSTEM_ENV.test(key)) continue;
    env[key] = process.env[key];
    delete process.env[key];
  }
  process.env.TZ = 'UTC';
  globalThis.Date = PinnedDate as unknown as DateConstructor;
  const unpinLocale = pinLocale();
  try {
    return await work();
  } finally {
    unpinLocale();
    globalThis.Date = RealDate;
    delete process.env.TZ;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** React's HTML renderer, waited to the end: every `await` in the tree has answered before a byte is taken. */
async function htmlOf(node: React.ReactElement): Promise<string> {
  const { renderToPipeableStream } = require('react-dom/server') as typeof import('react-dom/server');
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, done) {
        chunks.push(Buffer.from(chunk));
        done();
      },
      final(done) {
        resolve(Buffer.concat(chunks).toString('utf8'));
        done();
      },
    });
    const stream = renderToPipeableStream(node, {
      onAllReady() {
        stream.pipe(sink);
      },
      onShellError: reject,
      onError: reject,
    });
  });
}

/** The fixture page, with everything the render saw. */
export async function renderSiteBodyFixtureFull(overrides: Partial<SiteBodyFixtureProps> = {}): Promise<SiteBodyFixtureRender> {
  reads = [];
  mounts = Object.fromEntries(Object.keys(WATCHED_ISLANDS).map((k) => [k, 0]));
  const complaints: string[] = [];
  const real = { error: console.error, warn: console.warn };
  const hear = (...args: unknown[]) => {
    const said = args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? (a.stack ?? a.message) : String(a))).join(' ');
    complaints.push(said);
  };
  console.error = hear;
  console.warn = hear;
  try {
    const html = await pinned(async () => {
      const { SiteBody } = require('../app/[slug]/_components/site-body') as typeof import('../app/[slug]/_components/site-body');
      return htmlOf(React.createElement(SiteBody as unknown as React.FC<SiteBodyFixtureProps>, fixture().siteBodyFixtureProps(overrides)));
    });
    return { html, reads: [...reads], mounts: { ...mounts }, complaints };
  } finally {
    console.error = real.error;
    console.warn = real.warn;
  }
}

/** The fixture page's HTML — the REAL `SiteBody`, for the fixture invitation, with `overrides` laid over its props. */
export async function renderSiteBodyFixture(overrides: Partial<SiteBodyFixtureProps> = {}): Promise<string> {
  return (await renderSiteBodyFixtureFull(overrides)).html;
}
