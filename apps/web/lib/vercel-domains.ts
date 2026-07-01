// Thin wrapper around the Vercel Domains API — used by the custom-domain
// add/verify server actions (BYO domains, PR8). Runtime-only; reads
// VERCEL_API_TOKEN + VERCEL_PROJECT_ID (+ optional VERCEL_TEAM_ID) from the
// server environment. These are Vercel PROJECT env vars (the running app reads
// them at request time), NOT GitHub Actions secrets.
//
// Docs: https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project

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

/** Whether the runtime is configured to talk to Vercel at all. */
export function vercelDomainsConfigured(): boolean {
  return creds() !== null;
}

function withTeam(path: string, teamId: string | null): string {
  return teamId ? `${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}` : path;
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
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network_error' };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error as { message?: string; code?: string } | undefined);
    return { ok: false, status: res.status, error: err?.code ?? err?.message ?? `http_${res.status}` };
  }
  return { ok: true, status: res.status, data: json as T };
}

export type VercelDomain = {
  name: string;
  verified: boolean;
  // DNS records the owner must add to prove control / route traffic.
  verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
};

/** Register the domain on the Setnayan Vercel project. Idempotent-ish: Vercel
 *  returns the existing record (409/200) if it's already attached. */
export function addProjectDomain(domain: string) {
  return call<VercelDomain>('POST', `/v10/projects/${projectSeg()}/domains`, { name: domain });
}

/** Current status of a domain (verified? which DNS records still pending?). */
export function getProjectDomain(domain: string) {
  return call<VercelDomain>('GET', `/v9/projects/${projectSeg()}/domains/${encodeURIComponent(domain)}`);
}

/** Ask Vercel to (re)check verification now — call after the owner sets DNS. */
export function verifyProjectDomain(domain: string) {
  return call<VercelDomain>('POST', `/v9/projects/${projectSeg()}/domains/${encodeURIComponent(domain)}/verify`);
}

/** Detach a domain from the project (on delete). */
export function removeProjectDomain(domain: string) {
  return call<{ error?: unknown }>('DELETE', `/v9/projects/${projectSeg()}/domains/${encodeURIComponent(domain)}`);
}

function projectSeg(): string {
  return encodeURIComponent(process.env.VERCEL_PROJECT_ID ?? '');
}
