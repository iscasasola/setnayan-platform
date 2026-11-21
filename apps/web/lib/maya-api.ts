/**
 * lib/maya-api.ts — Maya's HTTP API: create a checkout (PUBLIC key), read a
 * payment (SECRET key), manage webhooks (SECRET key). Paths and fields are cited
 * in lib/maya-checkout.ts from developers.maya.ph (read 2026-11-21).
 *
 * No database and no stored secret in here: the caller hands in the resolved
 * `MayaConfig` (lib/integration-config.ts) and, in tests, a fetch. Kept free of
 * `server-only` for that reason — the keys only ever arrive as arguments from
 * lib/maya-checkout.server.ts, which IS server-only.
 */
import type { MayaConfig } from '@/lib/integration-config';
import {
  MAYA_WEBHOOK_EVENTS,
  mayaApiBase,
  mayaBasicAuth,
  mayaCheckoutBody,
  mayaEnvironment,
  type MayaEnvironment,
  type MayaPaymentLike,
} from '@/lib/maya-checkout';

export type FetchLike = typeof fetch;

/** Maya answers within a few seconds; a hung call must not hold a page or a webhook. */
const MAYA_TIMEOUT_MS = 8_000;

async function mayaCall(
  fetchImpl: FetchLike,
  url: string,
  init: { method: string; key: string; body?: unknown },
): Promise<{ ok: true; status: number; json: unknown } | { ok: false; status: number | null }> {
  try {
    const res = await fetchImpl(url, {
      method: init.method,
      headers: {
        Authorization: mayaBasicAuth(init.key),
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(MAYA_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, status: res.status, json: text ? (JSON.parse(text) as unknown) : null };
  } catch {
    return { ok: false, status: null };
  }
}

export type CreateCheckoutResult =
  | { ok: true; checkoutId: string; redirectUrl: string; environment: MayaEnvironment }
  | { ok: false; reason: 'bad_endpoint' | 'refused' | 'bad_answer' };

/** POST /checkout/v1/checkouts with the PUBLIC key. */
export async function createMayaCheckout(
  config: MayaConfig,
  input: { amountPhp: number; reference: string; description: string; origin: string },
  fetchImpl: FetchLike = fetch,
): Promise<CreateCheckoutResult> {
  const base = mayaApiBase(config.checkoutEndpoint);
  if (!base) return { ok: false, reason: 'bad_endpoint' };
  const res = await mayaCall(fetchImpl, `${base}/checkout/v1/checkouts`, {
    method: 'POST',
    key: config.publicKey,
    body: mayaCheckoutBody(input),
  });
  if (!res.ok) return { ok: false, reason: 'refused' };
  const j = (res.json ?? {}) as { checkoutId?: unknown; redirectUrl?: unknown };
  const checkoutId = typeof j.checkoutId === 'string' ? j.checkoutId.trim() : '';
  const redirectUrl = typeof j.redirectUrl === 'string' ? j.redirectUrl.trim() : '';
  // The payer is sent to this address, so it must be Maya's own https page.
  let safe = false;
  try {
    safe = new URL(redirectUrl).protocol === 'https:';
  } catch {
    safe = false;
  }
  if (!checkoutId || !safe) return { ok: false, reason: 'bad_answer' };
  return { ok: true, checkoutId, redirectUrl, environment: mayaEnvironment(config.checkoutEndpoint) };
}

/** GET /payments/v1/payments/{id} with the SECRET key. null = Maya has no such payment. */
export async function fetchMayaPayment(
  config: MayaConfig,
  mayaPaymentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<MayaPaymentLike | null | 'error'> {
  const base = mayaApiBase(config.checkoutEndpoint);
  if (!base || !config.secretKey.trim()) return 'error';
  const res = await mayaCall(fetchImpl, `${base}/payments/v1/payments/${encodeURIComponent(mayaPaymentId)}`, {
    method: 'GET',
    key: config.secretKey,
  });
  if (!res.ok) return res.status === 404 ? null : 'error';
  return res.json && typeof res.json === 'object' ? (res.json as MayaPaymentLike) : 'error';
}

/** GET /payments/v1/payment-rrns/{rrn} with the SECRET key — every payment carrying our reference. */
export async function fetchMayaPaymentsByReference(
  config: MayaConfig,
  reference: string,
  fetchImpl: FetchLike = fetch,
): Promise<MayaPaymentLike[] | 'error'> {
  const base = mayaApiBase(config.checkoutEndpoint);
  if (!base || !config.secretKey.trim()) return 'error';
  const res = await mayaCall(fetchImpl, `${base}/payments/v1/payment-rrns/${encodeURIComponent(reference)}`, {
    method: 'GET',
    key: config.secretKey,
  });
  if (!res.ok) return res.status === 404 ? [] : 'error';
  return Array.isArray(res.json) ? (res.json as MayaPaymentLike[]) : 'error';
}

export type RegisterWebhooksResult =
  | { ok: true; registered: string[]; kept: string[] }
  | { ok: false; reason: 'no_secret_key' | 'bad_endpoint' | 'refused' };

/**
 * Register our webhook for each PAYMENT_* event. An event already pointing at
 * our URL is kept; one pointing elsewhere is replaced (DELETE then POST — both
 * documented; Maya allows one URL per event name).
 */
export async function registerMayaWebhooks(
  config: MayaConfig,
  callbackUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<RegisterWebhooksResult> {
  if (!config.secretKey.trim()) return { ok: false, reason: 'no_secret_key' };
  const base = mayaApiBase(config.checkoutEndpoint);
  if (!base) return { ok: false, reason: 'bad_endpoint' };
  const list = await mayaCall(fetchImpl, `${base}/payments/v1/webhooks`, { method: 'GET', key: config.secretKey });
  if (!list.ok) return { ok: false, reason: 'refused' };
  const existing = (Array.isArray(list.json) ? list.json : []) as Array<{ id?: unknown; name?: unknown; callbackUrl?: unknown }>;
  const registered: string[] = [];
  const kept: string[] = [];
  for (const name of MAYA_WEBHOOK_EVENTS) {
    const same = existing.filter((w) => w.name === name);
    if (same.some((w) => w.callbackUrl === callbackUrl)) {
      kept.push(name);
      continue;
    }
    for (const w of same) {
      if (typeof w.id !== 'string') continue;
      const del = await mayaCall(fetchImpl, `${base}/payments/v1/webhooks/${encodeURIComponent(w.id)}`, {
        method: 'DELETE',
        key: config.secretKey,
      });
      if (!del.ok) return { ok: false, reason: 'refused' };
    }
    const add = await mayaCall(fetchImpl, `${base}/payments/v1/webhooks`, {
      method: 'POST',
      key: config.secretKey,
      body: { name, callbackUrl },
    });
    if (!add.ok) return { ok: false, reason: 'refused' };
    registered.push(name);
  }
  return { ok: true, registered, kept };
}

