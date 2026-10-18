/**
 * 🍎 READ AN APPLE TRANSACTION — after `verifyAppleJws` said Apple signed it.
 *
 * Verified is not the same as OURS. A genuine Apple transaction can still be
 * for another app, for a product we do not sell, for a subscription shape we
 * never offered, or carry no appAccountToken (so no event). Each of those is a
 * refusal here, before anything touches the database. Pure.
 */

import { verifyAppleJws, APPLE_ROOT_CA_G3_SHA256, type JwsRefusal } from './apple-jws';
import { iapProductById, type IapProduct } from './products';

/** The iPhone app's bundle id — `appId` in apps/mobile/capacitor.config.ts. */
export const APP_BUNDLE_ID = 'com.setnayan.app';

/** Production trusts Apple Root CA - G3 and nothing else. */
export const PRODUCTION_TRUSTED_ROOTS: readonly string[] = [APPLE_ROOT_CA_G3_SHA256];

export type AppleEnvironment = 'Production' | 'Sandbox';

/** The fields of Apple's JWSTransactionDecodedPayload this build reads. */
export type AppleTransaction = {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  product: IapProduct;
  appAccountToken: string;
  environment: AppleEnvironment;
  /** Apple's price in milli-units of `currency`, when Apple sent one. */
  priceMilliunits: number | null;
  currency: string | null;
  purchaseDate: Date | null;
  revocationDate: Date | null;
  revocationReason: number | null;
};

export type TransactionRefusal =
  | JwsRefusal
  | 'wrong_app'
  | 'unknown_product'
  | 'not_consumable'
  | 'no_token'
  | 'bad_quantity'
  | 'unknown_environment'
  | 'bad_shape';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= 200 ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function date(v: unknown): Date | null {
  const n = num(v);
  return n === null ? null : new Date(n);
}

/** Shape-check a VERIFIED transaction payload against what we sell. */
export function readAppleTransaction(
  payload: Record<string, unknown>,
): { ok: true; tx: AppleTransaction } | { ok: false; reason: TransactionRefusal } {
  const transactionId = str(payload.transactionId);
  const bundleId = str(payload.bundleId);
  if (!transactionId || !bundleId) return { ok: false, reason: 'bad_shape' };
  if (bundleId !== APP_BUNDLE_ID) return { ok: false, reason: 'wrong_app' };
  const product = iapProductById(str(payload.productId));
  if (!product) return { ok: false, reason: 'unknown_product' };
  if (payload.type !== 'Consumable') return { ok: false, reason: 'not_consumable' };
  const quantity = num(payload.quantity);
  if (quantity !== null && quantity !== 1) return { ok: false, reason: 'bad_quantity' };
  const token = str(payload.appAccountToken);
  if (!token || !UUID_RE.test(token)) return { ok: false, reason: 'no_token' };
  const environment = payload.environment;
  if (environment !== 'Production' && environment !== 'Sandbox') {
    return { ok: false, reason: 'unknown_environment' };
  }
  const currency = str(payload.currency);
  return {
    ok: true,
    tx: {
      transactionId,
      originalTransactionId: str(payload.originalTransactionId) ?? transactionId,
      bundleId,
      product,
      appAccountToken: token.toLowerCase(),
      environment,
      priceMilliunits: num(payload.price),
      currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
      purchaseDate: date(payload.purchaseDate),
      revocationDate: date(payload.revocationDate),
      revocationReason: num(payload.revocationReason),
    },
  };
}

/** Verify + read in one step: the only door from a JWS string to a transaction. */
export function verifyAppleTransaction(
  jws: string,
  trustedRootSha256: readonly string[] = PRODUCTION_TRUSTED_ROOTS,
): { ok: true; tx: AppleTransaction } | { ok: false; reason: TransactionRefusal } {
  const v = verifyAppleJws<Record<string, unknown>>(jws, { trustedRootSha256 });
  if (!v.ok) return v;
  return readAppleTransaction(v.payload);
}

/**
 * What Apple charged, in pesos — ONLY when Apple charged in PHP. Any other
 * currency is null: converting it here would be inventing an exchange rate.
 */
export function chargedPhp(tx: Pick<AppleTransaction, 'priceMilliunits' | 'currency'>): number | null {
  if (tx.currency !== 'PHP' || tx.priceMilliunits === null || tx.priceMilliunits < 0) return null;
  return Math.round(tx.priceMilliunits / 10) / 100;
}

/** App Store Server Notifications v2 — the decoded fields this build reads. */
export type AppleNotification = {
  notificationType: string;
  subtype: string | null;
  notificationUUID: string | null;
  bundleId: string | null;
  environment: string | null;
  signedTransactionInfo: string | null;
};

export function readAppleNotification(payload: Record<string, unknown>): AppleNotification | null {
  const notificationType = str(payload.notificationType);
  if (!notificationType) return null;
  const data = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : {};
  const signed = data.signedTransactionInfo;
  return {
    notificationType,
    subtype: str(payload.subtype),
    notificationUUID: str(payload.notificationUUID),
    bundleId: str(data.bundleId),
    environment: str(data.environment),
    signedTransactionInfo: typeof signed === 'string' && signed.length <= 64_000 ? signed : null,
  };
}
