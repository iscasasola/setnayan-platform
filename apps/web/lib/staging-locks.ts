/**
 * 🔒 THE STAGING LOCKS — what a staging copy of Setnayan may never do. Written ONCE, here.
 *
 * Owner, 24 Nov 2026 (the final check): once all coding is finished, 8 cloud sessions check a STAGING copy at the
 * same time — a Supabase preview branch plus a Vercel preview with test sign-ins. A copy that can mail a real
 * person, take real money, be found on Google, overwrite a real photo, or run with different switches than the live
 * site is not a copy anyone can safely press every button on. So a process started with `STAGING=1` is held by five
 * locks, and each one is a rule in this file:
 *
 *   (a) EMAIL     — every send goes only to the one allowlisted test inbox (`STAGING_EMAIL_SINK`), or is dropped.
 *                   Applied inside `sendEmail` (lib/email.ts), the one function every email goes through.
 *   (b) PAYMENTS  — test mode only: a Maya endpoint that is not Maya's sandbox is refused, keys and all.
 *                   Applied inside `resolveMayaConfig` (lib/integration-config.ts), the one place Maya's keys are read.
 *   (c) HIDDEN    — every published build that is not production (a Vercel preview, a staging copy) answers
 *                   `X-Robots-Tag: noindex`.
 *                   Applied in `next.config.ts` `headers()` (never in middleware — the doors PR owns it).
 *   (d) STORAGE   — every R2 object key is confined under `STAGING_R2_PREFIX`; with no valid prefix R2 is OFF.
 *                   Applied inside `getR2Client` (lib/r2.ts), the one constructor every R2 call goes through.
 *   (e) FLAGS     — staging runs production's VALUES, not code defaults: `scripts/staging/flags.ts` lists every
 *                   `NEXT_PUBLIC_*` switch, reads what it can, and prints a checklist for the rest.
 *
 * 🔑 THE LOCKS READ WIDE, THE SEED READS NARROW. `STAGING` is read with the shared parser (`true`/`1`/`yes`/`on`):
 * for a LOCK the safe direction is ON, so any spelling of yes engages it. The seed, which WRITES, demands exactly
 * `STAGING=1` (`scripts/staging/guard.ts`).
 *
 * PURE: no `server-only`, no `@/` imports, no I/O — `next.config.ts` imports this file at build time, and every rule
 * is exercised by behaviour in `lib/staging-locks.test.ts` (the wiring of each rule into its one choke point is held
 * there too, by reading those files).
 */
import { envFlagEnabled } from './env-flag';

type Env = Readonly<Record<string, string | undefined>>;

/** Production's Supabase project ref. The staging kit refuses any target that carries it. */
export const PRODUCTION_SUPABASE_REF = 'njrupjnvkjkitfctetvi';

/** Is this process a staging copy? `STAGING` set to any spelling of yes. */
export function isStagingCopy(env: Env): boolean {
  return envFlagEnabled(env.STAGING);
}

// ── (a) EMAIL ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** One address, nothing else: no list, no display name, no spaces. */
const ONE_ADDRESS = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"'.]+$/;

export type StagingEmailRoute =
  | { send: true; to: string; subject: string; rerouted: boolean }
  | { send: false; why: string };

function splitAddress(address: string): { local: string; domain: string } | null {
  const at = address.lastIndexOf('@');
  if (at <= 0 || at === address.length - 1) return null;
  return { local: address.slice(0, at).toLowerCase(), domain: address.slice(at + 1).toLowerCase() };
}

/**
 * The test inbox itself, or a `+tag` of it (`qa+couple@x` for a sink `qa@x`) — the same mailbox, so it may keep its
 * own address. Anything else is a person.
 */
function isTheSinkInbox(to: string, sink: string): boolean {
  const a = splitAddress(to.trim());
  const b = splitAddress(sink);
  if (!a || !b || a.domain !== b.domain) return false;
  return a.local.split('+')[0] === b.local.split('+')[0];
}

/** `ana@example.com` → `a***@example.com` — enough for a checker to see who it was for, never the whole address. */
export function maskForSubject(address: string): string {
  const p = splitAddress(address.trim());
  if (!p) return 'someone';
  return `${p.local.slice(0, 1)}***@${p.domain}`;
}

/**
 * (a) Where may this email go? Outside staging: exactly where it was addressed. On a staging copy: only to the one
 * allowlisted inbox `STAGING_EMAIL_SINK` (the original recipient is masked into the subject so a checker can see who
 * it was meant for), and with no valid sink it is DROPPED — never sent to the address it was given.
 */
export function stagingEmailRoute(email: { to: string; subject: string }, env: Env): StagingEmailRoute {
  if (!isStagingCopy(env)) return { send: true, to: email.to, subject: email.subject, rerouted: false };
  const sink = (env.STAGING_EMAIL_SINK ?? '').trim();
  if (!ONE_ADDRESS.test(sink)) {
    return { send: false, why: 'staging copy: no allowlisted test inbox (STAGING_EMAIL_SINK) — email dropped' };
  }
  if (isTheSinkInbox(email.to, sink)) {
    return { send: true, to: email.to.trim(), subject: `[staging] ${email.subject}`, rerouted: false };
  }
  return {
    send: true,
    to: sink,
    subject: `[staging → ${maskForSubject(email.to)}] ${email.subject}`,
    rerouted: true,
  };
}

// ── (b) PAYMENTS ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * (b) May this process talk to Maya at this environment? `environment` is `mayaEnvironment(endpoint)` from
 * lib/maya-checkout.ts — the ONE rule for "sandbox or real money" (anything that is not Maya's sandbox host is real
 * money). On a staging copy only the sandbox is allowed; a refusal means the caller must hand back NO keys, so the
 * Maya rail reads as closed and nothing is ever sent with a live key.
 */
export function stagingRefusesMoney(environment: 'sandbox' | 'production', env: Env): boolean {
  return isStagingCopy(env) && environment !== 'sandbox';
}

// ── (c) HIDDEN ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The live domains. A belt on top of the braces: even a build whose `VERCEL_ENV` was misread never sends `noindex`
 * from setnayan.com or any of its subdomains (supplier. / coordinator.). A Vercel preview host never matches.
 */
export const PRODUCTION_HOST_PATTERN = '(?:.+\\.)?setnayan\\.com';

export type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
  missing?: Array<{ type: 'host'; value: string }>;
};

/**
 * (c) The header rule `next.config.ts` adds: `X-Robots-Tag: noindex, nofollow` on every path of every PUBLISHED build
 * that is not production — a Vercel deployment whose `VERCEL_ENV` is `preview` or `development` (every preview, the
 * final-check staging copy among them), and any build with `STAGING` on. Production gets no rule at all, even with
 * `STAGING` set by mistake.
 *
 * 🔑 A build with NO `VERCEL_ENV` (a local or CI build that is not on Vercel) gets no rule either: nothing serves it
 * to the public, and it is what Lighthouse audits in CI — a `noindex` there scored the build's own SEO at 0.66 and
 * measured a header production never sends (found on this PR's first run).
 */
export function noindexHeaderRules(env: Env): HeaderRule[] {
  const vercelEnv = (env.VERCEL_ENV ?? '').trim();
  if (vercelEnv === 'production') return [];
  if (!vercelEnv && !isStagingCopy(env)) return [];
  return [
    {
      source: '/(.*)',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      missing: [{ type: 'host', value: PRODUCTION_HOST_PATTERN }],
    },
  ];
}

// ── (d) STORAGE ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A staging prefix: starts with `staging`, ends with `/`, lower-case letters, digits, `-` and `_` only, no empty or
 * dot segments — so it can never be `/`, `''`, `../` or a real top-level folder the live site writes to.
 */
const STAGING_PREFIX = /^staging[a-z0-9_-]*\/(?:[a-z0-9_-]+\/)*$/;

export type StagingStorage =
  /** Not a staging copy: R2 behaves exactly as it always has. */
  | { mode: 'live' }
  /** A staging copy with a valid prefix: every object key lives under it. */
  | { mode: 'confined'; prefix: string }
  /** A staging copy without one: R2 is OFF (the app's "not configured" path — uploads fall back or say so). */
  | { mode: 'off'; why: string };

/** (d) How may this process use R2? */
export function stagingStorage(env: Env): StagingStorage {
  if (!isStagingCopy(env)) return { mode: 'live' };
  const prefix = (env.STAGING_R2_PREFIX ?? '').trim();
  if (!STAGING_PREFIX.test(prefix)) {
    return {
      mode: 'off',
      why: 'staging copy: STAGING_R2_PREFIX is missing or not a staging prefix (e.g. "staging/final-check/") — R2 is off',
    };
  }
  return { mode: 'confined', prefix };
}

/** The key under the prefix. Idempotent: a key already inside it is returned unchanged. */
export function confineKey(key: string, prefix: string): string {
  const bare = key.replace(/^\/+/, '');
  return bare.startsWith(prefix) ? bare : `${prefix}${bare}`;
}

/** `bucket/key` (optionally `/`-led, `?versionId=` tailed, URL-encoded) with the key confined. */
export function confineCopySource(copySource: string, prefix: string): string {
  const lead = copySource.startsWith('/') ? '/' : '';
  const body = copySource.slice(lead.length);
  const q = body.indexOf('?');
  const path = q === -1 ? body : body.slice(0, q);
  const tail = q === -1 ? '' : body.slice(q);
  const slash = path.indexOf('/');
  if (slash <= 0) throw new Error(`staging copy: CopySource "${copySource}" names no object`);
  const bucket = path.slice(0, slash);
  const key = decodeURIComponent(path.slice(slash + 1));
  const confined = confineKey(key, prefix).split('/').map(encodeURIComponent).join('/');
  return `${lead}${bucket}/${confined}${tail}`;
}

/** Bucket-level writes (policy, CORS, lifecycle, create, delete) — never from a staging copy. */
const BUCKET_WRITE = /^(?:Create|Delete|Put)Bucket/;

/**
 * (d) A command's input with every object key confined under the prefix: `Key`, `Prefix` (a list with no prefix
 * lists only the staging folder), `CopySource`, and every key of a batch delete. A bucket-level write throws. Returns
 * a NEW object — the caller's input is never mutated.
 */
export function confineR2Input(
  commandName: string,
  input: Readonly<Record<string, unknown>>,
  prefix: string,
): Record<string, unknown> {
  const name = commandName.replace(/Command$/, '');
  if (BUCKET_WRITE.test(name)) {
    throw new Error(`staging copy: ${name} is a bucket-level write — refused on a staging copy`);
  }
  const out: Record<string, unknown> = { ...input };
  if (typeof out.Key === 'string') out.Key = confineKey(out.Key, prefix);
  if (/^ListObjects/.test(name) || /^ListMultipartUploads$/.test(name) || /^ListObjectVersions$/.test(name)) {
    out.Prefix = confineKey(typeof out.Prefix === 'string' ? out.Prefix : '', prefix);
  }
  if (typeof out.CopySource === 'string') out.CopySource = confineCopySource(out.CopySource, prefix);
  const del = out.Delete as { Objects?: Array<{ Key?: unknown }> } | undefined;
  if (del && Array.isArray(del.Objects)) {
    out.Delete = {
      ...del,
      Objects: del.Objects.map((o) => (typeof o?.Key === 'string' ? { ...o, Key: confineKey(o.Key, prefix) } : o)),
    };
  }
  return out;
}

/** Reads that may fall back to the live object when the staging copy has none (public media only — see lib/r2.ts). */
export const R2_READS_THAT_MAY_FALL_BACK: ReadonlySet<string> = new Set(['GetObject', 'HeadObject']);
