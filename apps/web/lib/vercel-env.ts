import 'server-only';

// Thin wrapper around the Vercel Projects/Env + Deployments API — used by the
// Secrets & Rotation board (/admin/secrets) to write a rotated secret straight
// into the project env and trigger the production redeploy that applies it.
//
// Shape deliberately mirrors lib/vercel-domains.ts (creds() / withTeam() /
// call()) so there is ONE Vercel client idiom in this codebase. Runtime-only;
// reads VERCEL_API_TOKEN + VERCEL_PROJECT_ID (+ optional VERCEL_TEAM_ID) from
// the server environment.
//
// SECURITY: this module WRITES secret values to Vercel and never reads them
// back. listProjectEnvMeta() strips `value` from every row before returning,
// even though the API already redacts encrypted vars — the metadata (key,
// target, timestamps) is all the board needs, so the value never enters a
// render tree, a log line, or a server-action return.
//
// Docs: https://vercel.com/docs/rest-api/endpoints/projects

const API = 'https://api.vercel.com';

type VercelResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

function creds(): { token: string; projectId: string; teamId: string | null } | null {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID ?? null };
}

/** Whether the runtime can talk to the Vercel env API at all. */
export function vercelEnvConfigured(): boolean {
  return creds() !== null;
}

function withTeam(path: string, teamId: string | null): string {
  return teamId
    ? `${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}`
    : path;
}

function projectSeg(): string {
  return encodeURIComponent(process.env.VERCEL_PROJECT_ID ?? '');
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<VercelResult<T>> {
  const c = creds();
  if (!c) return { ok: false, status: 0, error: 'vercel_not_configured' };
  let res: Response;
  try {
    res = await fetch(`${API}${withTeam(path, c.teamId)}`, {
      method,
      headers: {
        Authorization: `Bearer ${c.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string; code?: string } | undefined;
    return {
      ok: false,
      status: res.status,
      error: err?.code ?? err?.message ?? `http_${res.status}`,
    };
  }
  return { ok: true, status: res.status, data: json as T };
}

/** Value-free metadata for one project env var. */
export type VercelEnvMeta = {
  key: string;
  target: string[];
  updatedAt: number | null;
  createdAt: number | null;
};

export type VercelEnvTarget = 'production' | 'preview' | 'development';

/**
 * Every project env var as METADATA ONLY — no values, ever. `updatedAt` is the
 * board's age signal for vercel-stored secrets.
 */
export async function listProjectEnvMeta(): Promise<VercelResult<VercelEnvMeta[]>> {
  const res = await call<{ envs?: unknown }>('GET', `/v10/projects/${projectSeg()}/env`);
  if (!res.ok) return res;
  const raw = Array.isArray(res.data?.envs) ? (res.data.envs as unknown[]) : [];
  // Explicit field pick — NOT a spread. A spread would carry `value` through.
  const metas: VercelEnvMeta[] = raw.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const target = r.target;
    return {
      key: typeof r.key === 'string' ? r.key : '',
      target: Array.isArray(target)
        ? target.filter((t): t is string => typeof t === 'string')
        : typeof target === 'string'
          ? [target]
          : [],
      updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : null,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : null,
    };
  });
  return { ok: true, status: res.status, data: metas.filter((m) => m.key) };
}

/**
 * `{ [ENV_VAR]: newestUpdatedAt }` — collapses the multi-target rows Vercel
 * returns (one per environment) into one timestamp per key.
 */
export function envUpdatedAtMap(
  metas: readonly VercelEnvMeta[],
): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const m of metas) {
    const ts = m.updatedAt ?? m.createdAt;
    if (typeof ts !== 'number') continue;
    const current = map[m.key];
    if (current == null || ts > current) map[m.key] = ts;
  }
  return map;
}

/**
 * Create-or-replace one env var. `type: 'encrypted'` is Vercel's write-only
 * storage — once written the value can never be read back through the API.
 * A redeploy is still required for the running app to see it.
 */
export function upsertProjectEnv(
  key: string,
  value: string,
  targets: VercelEnvTarget[],
): Promise<VercelResult<{ created?: unknown }>> {
  return call<{ created?: unknown }>(
    'POST',
    `/v10/projects/${projectSeg()}/env?upsert=true`,
    { key, value, type: 'encrypted', target: targets },
  );
}

type VercelProject = {
  name?: string;
  link?: { type?: string; repoId?: number | string; org?: string; repo?: string };
};

/**
 * Kick a fresh PRODUCTION deployment off the current `main` — the step that
 * makes a just-written env var take effect.
 *
 * Fails GRACEFULLY: any missing git link / API error comes back as
 * `{ ok:false, error }` so the board can fall back to "couldn't trigger a
 * deploy — push any commit or redeploy from Vercel" instead of throwing.
 */
export async function triggerProdRedeploy(): Promise<
  VercelResult<{ id: string; url: string }>
> {
  const projectRes = await call<VercelProject>('GET', `/v9/projects/${projectSeg()}`);
  if (!projectRes.ok) return projectRes;

  const link = projectRes.data.link;
  if (!link || link.type !== 'github' || link.repoId == null) {
    return { ok: false, status: 0, error: 'project_not_linked_to_github' };
  }

  const res = await call<{ id?: string; url?: string }>('POST', '/v13/deployments', {
    name: projectRes.data.name ?? process.env.VERCEL_PROJECT_ID,
    project: process.env.VERCEL_PROJECT_ID,
    target: 'production',
    gitSource: { type: 'github', repoId: link.repoId, ref: 'main' },
  });
  if (!res.ok) return res;
  return {
    ok: true,
    status: res.status,
    data: { id: res.data.id ?? '', url: res.data.url ?? '' },
  };
}
