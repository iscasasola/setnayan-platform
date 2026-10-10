/**
 * RELEASE REHEARSAL — the request counter.
 *
 * Owner rule (2026-10-08): "the program created will create the least amount of
 * request for the tasks to be done." This makes that number visible per release.
 *
 * It is a pass-through that sits between the app and the local Supabase stack:
 * the app is BUILT and STARTED with `NEXT_PUBLIC_SUPABASE_URL` pointing here,
 * so every request the server makes AND every request the guest's/host's
 * browser makes straight to Supabase goes through this one door and is counted.
 * The walk tells it which step is running (`/__rehearsal/step?name=…`) and
 * reads the table back at the end (`/__rehearsal/report`).
 *
 * What is counted, per step:
 *   db read    GET/HEAD  /rest/v1/<table>          (PostgREST)
 *   db write   POST/PATCH/PUT/DELETE /rest/v1/<table>
 *   db rpc     any       /rest/v1/rpc/<function>
 *   auth       any       /auth/v1/…                (GoTrue)
 *   other      storage / realtime / anything else
 * each split by who asked: the app's server, or the browser.
 *
 * ⚠ ONE KNOWN DIFFERENCE FROM PRODUCTION, AND IT ONLY INFLATES `auth`:
 * the local stack signs sessions the legacy way (HS256), so the middleware's
 * local token check (`getClaims`) falls back to asking the auth server on each
 * navigation. Production signs ES256 and answers that locally. The `db` columns
 * — the ones the Supabase free plan's connection limit is about — are real.
 *
 * ⛔ Upstream must be loopback (`assertLocalUrl`). It forwards nowhere else.
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { assertLocalUrl } from './local-only';

type Who = 'server' | 'browser';
type Kind = 'read' | 'write' | 'rpc' | 'auth' | 'other';
type StepCount = {
  step: string;
  counts: Record<Who, Record<Kind, number>>;
  /** table or function name → hits, for the "what asked so much?" follow-up. */
  targets: Record<string, number>;
  failed: number;
  /** "<target> → <status>" → hits: WHICH requests the database refused. */
  refused: Record<string, number>;
  /** The first refusal of each kind: what was asked, and what the database said. */
  refusedSamples: Record<string, { asked: string; said: string }>;
};

const upstream = assertLocalUrl(process.env.COUNT_UPSTREAM ?? 'http://127.0.0.1:54321', 'the counter upstream');
const port = Number(process.env.COUNT_PORT ?? 54320);
const outFile = process.env.COUNT_OUT ?? '';

const emptyKinds = (): Record<Kind, number> => ({ read: 0, write: 0, rpc: 0, auth: 0, other: 0 });
const newStep = (step: string): StepCount => ({
  step,
  counts: { server: emptyKinds(), browser: emptyKinds() },
  targets: {},
  failed: 0,
  refused: {},
  refusedSamples: {},
});

const steps: StepCount[] = [newStep('(before the walk)')];
const current = (): StepCount => steps[steps.length - 1]!;

function classify(method: string, pathname: string): { kind: Kind; target: string } {
  if (pathname.startsWith('/rest/v1/rpc/')) {
    return { kind: 'rpc', target: `rpc:${pathname.slice('/rest/v1/rpc/'.length)}` };
  }
  if (pathname.startsWith('/rest/v1/')) {
    const table = pathname.slice('/rest/v1/'.length).split('/')[0] || '(root)';
    const read = method === 'GET' || method === 'HEAD';
    return { kind: read ? 'read' : 'write', target: `${read ? 'read' : 'write'}:${table}` };
  }
  if (pathname.startsWith('/auth/v1/')) {
    return { kind: 'auth', target: `auth:${pathname.slice('/auth/v1/'.length).split('/')[0] ?? ''}` };
  }
  return { kind: 'other', target: `other:${pathname.split('/').slice(1, 3).join('/')}` };
}

/** A browser always sends a Mozilla user agent; the app's server never does. */
function whoAsked(req: http.IncomingMessage): Who {
  return /Mozilla\//.test(String(req.headers['user-agent'] ?? '')) ? 'browser' : 'server';
}

function persist(): void {
  if (!outFile) return;
  try {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ steps }, null, 2));
  } catch {
    /* the report endpoint still answers; a full disk must not stop the walk */
  }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://counter.local');

  if (u.pathname === '/__rehearsal/step') {
    steps.push(newStep(u.searchParams.get('name') ?? `step ${steps.length}`));
    persist();
    res.writeHead(204).end();
    return;
  }
  if (u.pathname === '/__rehearsal/total') {
    // For "has it gone quiet?" and "what did THIS step cost so far?".
    const db = (c: StepCount): number =>
      (['server', 'browser'] as const).reduce((n, w) => n + c.counts[w].read + c.counts[w].write + c.counts[w].rpc, 0);
    const all = steps.reduce((n, c) => n + db(c) + c.counts.server.auth + c.counts.browser.auth, 0);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ total: all, stepDb: db(current()) }));
    return;
  }
  if (u.pathname === '/__rehearsal/report') {
    persist();
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ steps }));
    return;
  }

  // CORS preflights are the browser asking permission, not a request for data.
  const counted = req.method !== 'OPTIONS';
  const step = current();
  let asked = '';
  if (counted) {
    const { kind, target } = classify(req.method ?? 'GET', u.pathname);
    asked = target;
    step.counts[whoAsked(req)][kind]++;
    step.targets[target] = (step.targets[target] ?? 0) + 1;
  }
  const refuse = (status: number | string): string => {
    step.failed++;
    const key = `${asked} → ${status}`;
    step.refused[key] = (step.refused[key] ?? 0) + 1;
    return key;
  };

  const proxied = http.request(
    {
      host: upstream.hostname,
      port: upstream.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: upstream.host },
    },
    (up) => {
      if (counted && (up.statusCode ?? 0) >= 400) {
        const key = refuse(up.statusCode ?? 0);
        // Keep the first refusal of each kind, in the database's own words —
        // "which request, and why" is the whole value of knowing it was refused.
        // (PostgREST's message names columns and tables, never a row's contents.)
        if (!step.refusedSamples[key] && !up.headers['content-encoding']) {
          const parts: Buffer[] = [];
          let size = 0;
          up.on('data', (chunk: Buffer) => {
            if (size < 600) {
              parts.push(chunk);
              size += chunk.length;
            }
          });
          up.on('end', () => {
            step.refusedSamples[key] = {
              asked: `${req.method ?? 'GET'} ${(req.url ?? '').slice(0, 400)}`,
              said: Buffer.concat(parts).toString('utf8').slice(0, 600),
            };
          });
        }
      }
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  proxied.on('error', (e) => {
    if (counted) refuse('unreachable');
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`rehearsal counter: upstream unreachable (${e.message})`);
  });
  req.pipe(proxied);
});

// Realtime websockets: pass the socket straight through, count the connection.
server.on('upgrade', (req, socket, head) => {
  const step = current();
  step.counts[whoAsked(req)].other++;
  step.targets['other:realtime-socket'] = (step.targets['other:realtime-socket'] ?? 0) + 1;
  const up = net.connect(Number(upstream.port), upstream.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i]!;
      const value = name.toLowerCase() === 'host' ? upstream.host : req.rawHeaders[i + 1]!;
      lines.push(`${name}: ${value}`);
    }
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length > 0) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[rehearsal] request counter on http://127.0.0.1:${port} → ${upstream.origin}`);
});
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    persist();
    process.exit(0);
  });
}
