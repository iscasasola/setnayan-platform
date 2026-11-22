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
import { mayaReversalBody, mayaReversalPath, type MayaReversalKind } from '@/lib/maya-reversal';
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
): Promise<{ ok: true; status: number; json: unknown } | { ok: false; status: number | null; json?: unknown }> {
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
    if (!res.ok) {
      // Maya's refusal body carries its PY code (lib/maya-reversal.ts reads it). Best-effort: a body that is not
      // JSON is simply absent, never a throw.
      let json: unknown;
      try {
        const text = await res.text();
        json = text ? (JSON.parse(text) as unknown) : undefined;
      } catch {
        json = undefined;
      }
      return { ok: false, status: res.status, json };
    }
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
  | { ok: false; reason: 'no_secret_key' | 'bad_endpoint' | MayaFaultReason };

/**
 * Why a Maya call failed, kept apart so the admin can tell them apart (never with a key in it):
 * 401/403 → the keys were refused for this endpoint · no HTTP answer → Maya did not answer · anything else → refused.
 */
export type MayaFaultReason = 'keys_refused' | 'no_answer' | 'refused';
export function mayaFaultReason(status: number | null): MayaFaultReason {
  if (status === null) return 'no_answer';
  if (status === 401 || status === 403) return 'keys_refused';
  return 'refused';
}

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
  // Maya answers 404 when this account has no webhook yet — that is an empty list, not a refusal (same as the
  // payment-rrns read above), so a first-ever registration goes on to the POSTs.
  if (!list.ok && list.status !== 404) return { ok: false, reason: mayaFaultReason(list.status) };
  const existing = (list.ok && Array.isArray(list.json) ? list.json : []) as Array<{ id?: unknown; name?: unknown; callbackUrl?: unknown }>;
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
      if (!del.ok) return { ok: false, reason: mayaFaultReason(del.status) };
    }
    const add = await mayaCall(fetchImpl, `${base}/payments/v1/webhooks`, {
      method: 'POST',
      key: config.secretKey,
      body: { name, callbackUrl },
    });
    if (!add.ok) return { ok: false, reason: mayaFaultReason(add.status) };
    registered.push(name);
  }
  return { ok: true, registered, kept };
}


export type PostReversalResult =
  | { ok: true }
  | { ok: false; status: number | null; code: string | null; message: string | null };

/**
 * POST the void or the refund of one payment, for its FULL amount, with the SECRET key
 * (owner 2026-11-22 · specs DECISION_LOG 86f20253). The route and body are in lib/maya-reversal.ts, with what the
 * public docs do and do not confirm about them. Never throws; a refusal carries Maya's own code and message.
 */
export async function postMayaReversal(
  config: MayaConfig,
  input: { mayaPaymentId: string; kind: MayaReversalKind; amountPhp: number; reason: string },
  fetchImpl: FetchLike = fetch,
): Promise<PostReversalResult> {
  const base = mayaApiBase(config.checkoutEndpoint);
  if (!base || !config.secretKey.trim()) return { ok: false, status: null, code: null, message: null };
  const res = await mayaCall(fetchImpl, `${base}${mayaReversalPath(input.mayaPaymentId, input.kind)}`, {
    method: 'POST',
    key: config.secretKey,
    body: mayaReversalBody(input),
  });
  if (res.ok) return { ok: true };
  const j = (res.json ?? {}) as { code?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } };
  const code = typeof j.code === 'string' ? j.code : typeof j.error?.code === 'string' ? j.error.code : null;
  const message =
    typeof j.message === 'string' ? j.message : typeof j.error?.message === 'string' ? j.error.message : null;
  return { ok: false, status: res.status, code, message };
}
