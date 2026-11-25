/**
 * 🔒 STAGING LOCK (e), THE PURE CORE — every `NEXT_PUBLIC_*` switch the app reads, and what staging must set it to.
 *
 * A staging copy built with CODE DEFAULTS is not the site: a feature production switched on would be dark on the
 * copy (eight checkers report it "missing"), and one production left off would be lit (they test something no person
 * can reach). So staging takes production's VALUES — except the handful that name the environment itself (its own
 * database, its own address), which must be staging's own, and the two that only production may carry.
 *
 * WHERE THE VALUES ARE READABLE (measured 24 Nov 2026, so nobody re-measures it):
 *   · the production BUNDLE cannot be read for them: Next inlines each value and drops its name, and production's
 *     source maps are deleted after the Sentry upload (`deleteSourcemapsAfterUpload`). Of 18 homepage chunks, one
 *     flag NAME survived (inside a string) and no name–value pair did;
 *   · `/api/health` is readable and names the commit production runs (`version`) and its `env` — the script pins
 *     the inventory to that;
 *   · the exact values live in Vercel: with a read token the script asks the Vercel env API (GET only) for the
 *     production values of `NEXT_PUBLIC_*` names and NOTHING else is kept; without one it prints a checklist row
 *     per flag to read by hand.
 *
 * Held by apps/web/lib/staging-kit.test.ts.
 */

export type FlagRead = 'parser' | 'strict-true' | 'default-on' | 'value';

export type FlagUse = { name: string; files: string[]; reads: FlagRead[] };

const READ_RE = /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g;

/**
 * Every `process.env.*` read in the given (comment-stripped) sources, with how each one is read — the public
 * `NEXT_PUBLIC_*` switches by default, or (with `scope: 'server'`) every server-only name.
 */
export function inventoryFlags(
  sources: ReadonlyArray<{ path: string; code: string }>,
  scope: 'public' | 'server' = 'public',
): FlagUse[] {
  const uses = new Map<string, { files: Set<string>; reads: Set<FlagRead> }>();
  for (const { path, code } of sources) {
    for (const m of code.matchAll(READ_RE)) {
      const name = m[1] ?? m[2]!;
      if (name.endsWith('_') || name.startsWith('NEXT_PUBLIC_') !== (scope === 'public')) continue;
      const before = code.slice(Math.max(0, (m.index ?? 0) - 24), m.index);
      const after = code.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 16);
      const read: FlagRead = /envFlagEnabled\(\s*$/.test(before)
        ? 'parser'
        : /^\s*===\s*['"]true['"]/.test(after)
          ? 'strict-true'
          : /^\s*!==\s*['"]false['"]/.test(after)
            ? 'default-on'
            : 'value';
      const u = uses.get(name) ?? { files: new Set<string>(), reads: new Set<FlagRead>() };
      u.files.add(path);
      u.reads.add(read);
      uses.set(name, u);
    }
  }
  return [...uses.entries()]
    .map(([name, u]) => ({ name, files: [...u.files].sort(), reads: [...u.reads].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type FlagClass =
  /** Copy production's value exactly. */
  | { kind: 'copy' }
  /** Never production's value: staging's own (the advice says what). */
  | { kind: 'own'; advice: string }
  /** Production only: leave it unset on staging. */
  | { kind: 'unset'; advice: string };

/** The flags that name the environment itself. Everything not listed here is a switch: copy production's value. */
export const ENVIRONMENT_FLAGS: Readonly<Record<string, FlagClass>> = {
  NEXT_PUBLIC_SUPABASE_URL: { kind: 'own', advice: "the staging branch's API URL (Supabase → the branch → API)" },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: { kind: 'own', advice: "the staging branch's anon (publishable) key" },
  NEXT_PUBLIC_APP_URL: { kind: 'own', advice: 'the staging preview address (https://<preview>.vercel.app)' },
  NEXT_PUBLIC_SITE_URL: { kind: 'own', advice: 'the staging preview address' },
  NEXT_PUBLIC_SETNAYAN_BASE_URL: { kind: 'own', advice: 'the staging preview address' },
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: { kind: 'own', advice: 'leave to Vercel (it stamps each build)' },
  NEXT_PUBLIC_BUILD_VERSION: { kind: 'own', advice: 'leave to the build' },
  NEXT_PUBLIC_CACHE_BUSTER: { kind: 'own', advice: 'leave unset (a fresh preview has nothing to bust)' },
  NEXT_PUBLIC_SENTRY_DSN: { kind: 'own', advice: "unset, or a staging Sentry project — never production's (its alerts are the live site's)" },
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: { kind: 'own', advice: "unset, or a staging key pair — it pairs with a server secret production keeps" },
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: { kind: 'own', advice: "Cloudflare's always-pass TEST site key — production's key is bound to setnayan.com" },
  NEXT_PUBLIC_OWNER_NOTIFICATION_EMAIL: { kind: 'own', advice: 'the staging test inbox (STAGING_EMAIL_SINK)' },
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: { kind: 'unset', advice: 'production only (search-console ownership of setnayan.com)' },
  NEXT_PUBLIC_BING_SITE_VERIFICATION: { kind: 'unset', advice: 'production only (Bing ownership of setnayan.com)' },
};

export function classifyFlag(name: string): FlagClass {
  return ENVIRONMENT_FLAGS[name] ?? { kind: 'copy' };
}

/**
 * The SERVER-side names (no `NEXT_PUBLIC_`). Switches (an `_ENABLED`, a `_GATE`…) are copied like the public ones;
 * every name below is NOT, and the reason is the point: several would make a staging copy act on something real.
 */
export const SERVER_ENVIRONMENT: Readonly<Record<string, FlagClass>> = {
  // ── the copy's own database and secrets — production's would make "staging" write to production ──
  SUPABASE_URL: { kind: 'own', advice: "the staging branch's API URL" },
  SUPABASE_SERVICE_ROLE_KEY: { kind: 'own', advice: "the staging branch's service key — production's would make the copy write to PRODUCTION" },
  SUPABASE_SERVICE_KEY: { kind: 'own', advice: "the staging branch's service key (legacy name) — never production's" },
  ENCRYPTION_KEY: { kind: 'own', advice: 'a fresh key for staging (the copy holds no encrypted secrets of production)' },
  ENCRYPTION_KEY_PREVIOUS: { kind: 'unset', advice: 'nothing on the copy was encrypted with an older key' },
  CRON_SECRET: { kind: 'own', advice: "a fresh secret — production's would let the copy call production's jobs" },
  OAUTH_REFRESH_CRON_SECRET: { kind: 'own', advice: 'a fresh secret' },
  INTERNAL_WORKER_SECRET: { kind: 'own', advice: 'a fresh secret' },
  NOTIFY_WEBHOOK_SECRET: { kind: 'own', advice: "a fresh secret, matching the branch vault's notify_webhook_secret only if notify_webhook_url points at the preview" },
  VIEWER_HASH_SALT: { kind: 'own', advice: 'a fresh salt' },
  DEVICE_HASH_SALT: { kind: 'own', advice: 'a fresh salt' },
  SITE_URL: { kind: 'own', advice: 'the staging preview address' },
  TURNSTILE_SECRET_KEY: { kind: 'own', advice: "Cloudflare's always-pass TEST secret (pairs with the test site key)" },
  VAPID_PRIVATE_KEY: { kind: 'own', advice: 'unset, or the private half of a staging key pair' },
  VAPID_SUBJECT: { kind: 'own', advice: 'unset, or the staging test inbox as mailto:' },
  // ── the five locks' own inputs ──
  R2_ACCOUNT_ID: { kind: 'own', advice: 'set only together with STAGING_R2_PREFIX (lock d) — or leave R2 keys unset' },
  R2_ACCESS_KEY_ID: { kind: 'own', advice: 'only with STAGING_R2_PREFIX (lock d)' },
  R2_SECRET_ACCESS_KEY: { kind: 'own', advice: 'only with STAGING_R2_PREFIX (lock d)' },
  R2_PUBLIC_URL: { kind: 'copy' },
  RESEND_API_KEY: { kind: 'own', advice: 'only together with STAGING_EMAIL_SINK (lock a); unset = every email is "not configured"' },
  MAYA_PUBLIC_API_KEY: { kind: 'own', advice: "Maya SANDBOX keys, or unset (lock b refuses a live endpoint's keys)" },
  MAYA_SECRET_API_KEY: { kind: 'own', advice: 'Maya SANDBOX keys, or unset' },
  MAYA_CHECKOUT_ENDPOINT: { kind: 'own', advice: 'unset (the sandbox default) — never the live endpoint' },
  OWNER_NOTIFICATION_EMAIL: { kind: 'own', advice: 'the staging test inbox (STAGING_EMAIL_SINK)' },
  // ── outside accounts: a value here makes the copy ACT on something real ──
  VERCEL_API_TOKEN: { kind: 'unset', advice: "NEVER on staging: /admin/secrets writes env vars to the PRODUCTION project and redeploys it" },
  VERCEL_PROJECT_ID: { kind: 'unset', advice: 'Vercel sets its own system values; the admin secrets board must stay unconfigured on staging' },
  VERCEL_TEAM_ID: { kind: 'unset', advice: 'never on staging (the admin secrets board reaches the production project through it)' },
  META_PAGE_ID: { kind: 'unset', advice: "NEVER on staging: the social sweep would post to Setnayan's real Facebook page" },
  META_PAGE_ACCESS_TOKEN: { kind: 'unset', advice: 'NEVER on staging (posts to the real Facebook page)' },
  META_IG_OAUTH_REDIRECT_URI: { kind: 'unset', advice: 'NEVER on staging (the real Instagram app)' },
  IG_USER_ID: { kind: 'unset', advice: 'NEVER on staging (posts to the real Instagram)' },
  IG_APP_ID: { kind: 'unset', advice: 'NEVER on staging' },
  IG_APP_SECRET: { kind: 'unset', advice: 'NEVER on staging' },
  TIKTOK_ACCESS_TOKEN: { kind: 'unset', advice: 'NEVER on staging (posts to the real TikTok)' },
  GSC_CLIENT_ID: { kind: 'unset', advice: "production's Search Console only" },
  GSC_CLIENT_SECRET: { kind: 'unset', advice: "production's Search Console only" },
  GSC_REFRESH_TOKEN: { kind: 'unset', advice: "production's Search Console only" },
  GSC_SITE_URL: { kind: 'unset', advice: "production's Search Console only" },
  GOOGLE_SITE_VERIFICATION: { kind: 'unset', advice: 'production only' },
  BING_SITE_VERIFICATION: { kind: 'unset', advice: 'production only' },
  SETNAYAN_ORG_SAMEAS: { kind: 'copy' },
  SENTRY_DSN: { kind: 'own', advice: "unset, or a staging Sentry project — never production's" },
  CLOUDFLARE_TURN_KEY_ID: { kind: 'unset', advice: 'unset unless live video calls are in scope (each call costs)' },
  CLOUDFLARE_TURN_API_TOKEN: { kind: 'unset', advice: 'unset unless live video calls are in scope (each call costs)' },
  ANTHROPIC_API_KEY: { kind: 'own', advice: 'optional: a key billed for staging (the admin assistant and supplier dossiers call it); unset = their keyless fallbacks' },
  OPENAI_API_KEY: { kind: 'own', advice: 'optional, billed per call; unset = the feature says it is not configured' },
  RECRAFT_API_KEY: { kind: 'own', advice: 'optional, billed per call' },
  // ── irreversible sweeps: on a copy they only touch the copy's own (prefixed) objects, but nothing needs them ──
  PAPIC_FULLRES_DROP_ENABLED: { kind: 'unset', advice: 'set to false on staging — the compression sweep is not under test and drops originals' },
  PAPIC_CLIP_DROP_ENABLED: { kind: 'unset', advice: 'leave unset (arms an irreversible drop)' },
  CSAM_HASH_MATCH_ENABLED: { kind: 'unset', advice: 'contract-gated; never on a copy' },
};

/** Names the platform or a build sets itself, and builder-lab knobs: never set by hand on staging. */
const PLATFORM_NAME = /^(NODE_ENV|NEXT_RUNTIME|CI|TZ|VERCEL_(ENV|REGION|GIT_COMMIT_SHA|DEPLOYMENT_ID|URL|BRANCH_URL))$|_READS_(DELAY_MS|WHO)$|^(WRITE_HEX_BASELINE|SETNAYAN_SPECS_DIR|HUB_VIEW_LAB_DIRECT|ALLOW_DEMO_CAPTURE)$/;

export function classifyServerName(name: string): FlagClass | { kind: 'platform' } {
  if (SERVER_ENVIRONMENT[name]) return SERVER_ENVIRONMENT[name]!;
  if (PLATFORM_NAME.test(name)) return { kind: 'platform' };
  return { kind: 'copy' };
}

/** A server value is printed only when it is switch-shaped; anything else could be a secret and is never shown. */
export function isSwitchShaped(value: string): boolean {
  return /^(true|false|1|0|yes|no|on|off|[0-9]{1,6})$/i.test(value.trim());
}

export type ProdValue = { value: string } | { sensitive: true };

/**
 * The Vercel env API's answer → production's `NEXT_PUBLIC_*` values, and nothing else. Every other row — every
 * secret — is dropped here, before anything can print or keep it.
 */
export function productionPublicValues(apiJson: unknown): Map<string, ProdValue> {
  return productionValues(apiJson, 'public');
}

/**
 * The same answer for SERVER names — and a server value survives only when it is switch-shaped (`isSwitchShaped`).
 * Anything else becomes `{ sensitive: true }` here, so a secret's value never leaves this function.
 */
export function productionValues(apiJson: unknown, scope: 'public' | 'server'): Map<string, ProdValue> {
  const out = new Map<string, ProdValue>();
  const envs = (apiJson as { envs?: unknown } | null)?.envs;
  if (!Array.isArray(envs)) return out;
  for (const row of envs as Array<Record<string, unknown>>) {
    const key = typeof row?.key === 'string' ? row.key : '';
    if (!key || key.startsWith('NEXT_PUBLIC_') !== (scope === 'public')) continue;
    const target = row.target;
    const targets = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
    if (!targets.includes('production')) continue;
    if (row.type === 'sensitive' || typeof row.value !== 'string') out.set(key, { sensitive: true });
    else if (scope === 'server' && !isSwitchShaped(row.value)) out.set(key, { sensitive: true });
    else out.set(key, { value: row.value });
  }
  return out;
}

/** A shell-safe single-quoted string. */
function sh(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

/**
 * The checklist the controller works through: one row per flag, production's value where it was read, and the
 * exact command that gives the staging preview that value (printed, never run).
 */
export function renderFlagChecklist(input: {
  flags: readonly FlagUse[];
  serverFlags?: readonly FlagUse[];
  serverValues?: Map<string, ProdValue> | null;
  values: Map<string, ProdValue> | null;
  prod: { version: string; env: string } | null;
  branch: string;
}): string {
  const lines: string[] = [];
  lines.push('# Staging flags — production\'s VALUES, not code defaults', '');
  lines.push(
    input.prod
      ? `Production runs commit \`${input.prod.version}\` (env \`${input.prod.env}\`, read from /api/health). Build staging from a commit at or after it.`
      : 'Production\'s /api/health could not be read — pin the commit by hand.',
  );
  lines.push(
    input.values
      ? `Production values: read from the Vercel env API (${input.values.size} NEXT_PUBLIC_* set in production).`
      : 'Production values: NOT read (no VERCEL_API_TOKEN). Every "copy" row says READ BY HAND: Vercel → Settings → Environment Variables → Production.',
    '',
  );
  const commands: string[] = [];
  for (const kind of ['copy', 'own', 'unset'] as const) {
    const rows = input.flags.filter((f) => classifyFlag(f.name).kind === kind);
    lines.push(
      kind === 'copy' ? `## Copy production's value (${rows.length})` : kind === 'own' ? `## Staging's own value — never production's (${rows.length})` : `## Production only — leave unset on staging (${rows.length})`,
      '',
    );
    for (const f of rows) {
      const cls = classifyFlag(f.name);
      const v = input.values?.get(f.name);
      let state: string;
      if (cls.kind !== 'copy') state = cls.advice;
      else if (!input.values) state = 'READ BY HAND';
      else if (!v) state = 'unset in production → leave unset (the code default is production\'s state)';
      else if ('sensitive' in v) state = 'set in production (sensitive) → copy by hand';
      else {
        state = `production = \`${v.value}\``;
        commands.push(`printf '%s' ${sh(v.value)} | vercel env add ${f.name} preview ${input.branch}`);
      }
      lines.push(`- [ ] \`${f.name}\` — ${state}  ·  read as ${f.reads.join('/')} in ${f.files.length} file(s)`);
    }
    lines.push('');
  }
  if (input.serverFlags?.length) {
    lines.push('# Server-side names (no NEXT_PUBLIC_) — the ones that keep the copy from touching anything real', '');
    const groups: Array<['copy' | 'own' | 'unset', string]> = [
      ['unset', "## NEVER on staging — leave unset (a value would act on production or a real outside account)"],
      ['own', "## Staging's own value — never production's"],
      ['copy', "## Switches — copy production's value"],
    ];
    for (const [kind, title] of groups) {
      const rows = input.serverFlags.filter((f) => classifyServerName(f.name).kind === kind);
      lines.push(`${title} (${rows.length})`, '');
      for (const f of rows) {
        const cls = classifyServerName(f.name);
        const v = input.serverValues?.get(f.name);
        let state: string;
        if (cls.kind === 'own' || cls.kind === 'unset') state = cls.advice;
        else if (!input.serverValues) state = 'READ BY HAND';
        else if (!v) state = 'unset in production → leave unset';
        else if ('sensitive' in v) state = 'set in production (not switch-shaped, so not printed) → copy by hand';
        else {
          state = `production = \`${v.value}\``;
          commands.push(`printf '%s' ${sh(v.value)} | vercel env add ${f.name} preview ${input.branch}`);
        }
        lines.push(`- [ ] \`${f.name}\` — ${state}`);
      }
      lines.push('');
    }
  }
  if (commands.length) {
    lines.push('## Commands (printed, not run — the controller runs them)', '', '```bash', ...commands, '```', '');
  }
  return lines.join('\n');
}
