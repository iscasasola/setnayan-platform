import 'server-only';
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import {
  LIVE_CHECK_MAX_BYTES,
  LIVE_CHECK_MAX_REDIRECTS,
  LIVE_CHECK_TIMEOUT_MS,
  ipIsPublic,
  liveCheckAllowed,
  readRegistryPage,
  type LivePageResult,
} from '@/lib/qr-live-check';

/**
 * The socket half of the live QR check — see `qr-live-check.ts` for the rules.
 *
 * 🔒 THIS IS THE ONLY FILE IN THE PAPER-READING PATH THAT TOUCHES THE NETWORK
 * WITH A URL A SUPPLIER PRINTED, and it opens it only after `liveCheckAllowed`
 * and `ipIsPublic` both say yes — on every hop. `verification-paper-read.test.ts`
 * fails if another file in the path grows a fetch.
 */

export type Resolver = (host: string) => Promise<string[]>;
export type Requester = (args: {
  url: URL;
  address: string;
  signal: AbortSignal;
}) => Promise<{ status: number; location: string | null; contentType: string | null; body: string }>;

const defaultResolver: Resolver = async (host) =>
  (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * GET over https, connected to the ONE address we checked (DNS pinned), no
 * cookies, a 1 MB cap. Never follows redirects itself — the caller re-checks
 * every hop.
 */
const defaultRequester: Requester = ({ url, address, signal }) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        method: 'GET',
        host: url.hostname,
        servername: url.hostname,
        path: `${url.pathname}${url.search}`,
        port: 443,
        signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; paper-check)', accept: 'text/html' },
        lookup: (_h, _o, cb) => cb(null, address, address.includes(':') ? 6 : 4),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > LIVE_CHECK_MAX_BYTES) {
            chunks.push(c.subarray(0, Math.max(0, LIVE_CHECK_MAX_BYTES - (size - c.length))));
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const done = () =>
          resolve({
            status: res.statusCode ?? 0,
            location: typeof res.headers.location === 'string' ? res.headers.location : null,
            contentType: typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : null,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        res.on('end', done);
        res.on('close', done);
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });

const result = (url: string, outcome: LivePageResult['outcome'], note: string, extra: Partial<LivePageResult> = {}): LivePageResult => ({
  url,
  outcome,
  httpStatus: null,
  numberOnPage: null,
  nameOnPage: null,
  status: null,
  validity: null,
  scriptOnly: false,
  note,
  ...extra,
});

/**
 * Open an allowlisted registry page and read it for the paper's name and
 * number. NEVER THROWS; every failure is an outcome the decision treats as
 * "fall back to the number-in-link rule".
 */
export async function liveCheckRegistryPage(
  rawUrl: string,
  paper: { name: string | null; number: string | null },
  deps: { resolve?: Resolver; request?: Requester; timeoutMs?: number } = {},
): Promise<LivePageResult> {
  const resolve = deps.resolve ?? defaultResolver;
  const request = deps.request ?? defaultRequester;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? LIVE_CHECK_TIMEOUT_MS);
  try {
    let url = liveCheckAllowed(rawUrl);
    if (!url) return result(rawUrl, 'not_allowed', 'Not an allowlisted https registry link — not opened.');
    for (let hop = 0; hop <= LIVE_CHECK_MAX_REDIRECTS; hop++) {
      let addresses: string[];
      try {
        addresses = await resolve(url.hostname);
      } catch {
        return result(url.href, 'unreachable', 'The registry host did not resolve.');
      }
      if (addresses.length === 0 || !addresses.every(ipIsPublic)) {
        return result(url.href, 'blocked_address', 'The host resolved to a private or reserved address — not opened.');
      }
      let res: Awaited<ReturnType<Requester>>;
      try {
        res = await request({ url, address: addresses[0]!, signal: controller.signal });
      } catch {
        return controller.signal.aborted
          ? result(url.href, 'timeout', 'The registry page took longer than 10 seconds.')
          : result(url.href, 'unreachable', 'The registry page could not be reached.');
      }
      if (res.status >= 300 && res.status < 400 && res.location) {
        let next: URL | null = null;
        try {
          next = liveCheckAllowed(new URL(res.location, url).href);
        } catch {
          next = null;
        }
        if (!next) {
          return result(url.href, 'redirect_off_list', 'The page redirected off the registry allowlist — not followed.', {
            httpStatus: res.status,
          });
        }
        url = next;
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        return result(url.href, 'http_error', `The registry answered ${res.status}.`, { httpStatus: res.status });
      }
      if (res.contentType && !/html|text\/plain/i.test(res.contentType)) {
        return result(url.href, 'not_html', 'The registry answered with something other than a page.', { httpStatus: res.status });
      }
      const read = readRegistryPage(res.body, paper);
      return result(url.href, 'reached', read.scriptOnly ? 'The page needs JavaScript; nothing to read.' : 'Read the registry page.', {
        httpStatus: res.status,
        ...read,
      });
    }
    return result(url.href, 'redirect_off_list', 'Too many redirects — stopped.');
  } catch {
    return result(rawUrl, 'unreachable', 'The registry page could not be checked.');
  } finally {
    clearTimeout(timer);
  }
}
