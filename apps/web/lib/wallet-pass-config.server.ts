import 'server-only';

import { envFlagEnabled } from '@/lib/env-flag';
import { pemFromEnvValue, type AppleWalletIds } from '@/lib/wallet-pass';
import type { AppleWalletSigner } from '@/lib/wallet-pass-pkpass';

/**
 * lib/wallet-pass-config.server.ts — THE ONE READER OF THE APPLE WALLET ENV.
 *
 * 🔒 SECRETS. The certificate, key, passphrase and WWDR certificate live ONLY in
 * Vercel env vars (owner set-up, 2026-10-13). This module is the ONE place they
 * are read, and it never logs, returns to a page or interpolates a value — a
 * missing or unreadable one is reported by NAME only (`missing`), and
 * `the-wallet-pass-keeps-its-secrets.test.ts` holds every file on that path to
 * the rule. Certificate expiry: 2027-11-12 (the Secrets board row
 * `apple_wallet_pass` carries the renewal steps).
 */

/** The env var NAMES (never values). The flag is separate: the pass is offered only when it is ON. */
export const APPLE_WALLET_ENV = {
  passTypeId: 'APPLE_PASS_TYPE_ID',
  teamId: 'APPLE_TEAM_ID',
  cert: 'APPLE_PASS_CERT_B64',
  key: 'APPLE_PASS_KEY_B64',
  keyPassphrase: 'APPLE_PASS_KEY_PASSPHRASE',
  wwdr: 'APPLE_WWDR_CERT_B64',
} as const;

export type AppleWalletConfig =
  | { ok: true; ids: AppleWalletIds; signer: AppleWalletSigner }
  | { ok: false; missing: string[] };

/**
 * 🚦 THE SWITCH — `WALLET_PASS_ENABLED` (server-only, default OFF). With it off
 * nothing is offered and the route answers 404, whatever the certificates.
 */
export function isWalletPassEnabled(): boolean {
  return envFlagEnabled(process.env.WALLET_PASS_ENABLED);
}

/** The signing set, or the NAMES of what is missing. Never a value. */
export function readAppleWalletConfig(env: NodeJS.ProcessEnv = process.env): AppleWalletConfig {
  const passTypeIdentifier = env[APPLE_WALLET_ENV.passTypeId]?.trim() || null;
  const teamIdentifier = env[APPLE_WALLET_ENV.teamId]?.trim() || null;
  const certPem = pemFromEnvValue(env[APPLE_WALLET_ENV.cert]);
  const keyPem = pemFromEnvValue(env[APPLE_WALLET_ENV.key]);
  const wwdrPem = pemFromEnvValue(env[APPLE_WALLET_ENV.wwdr]);
  // The passphrase may legitimately be empty (an unencrypted key), so it is never "missing".
  const keyPassphrase = env[APPLE_WALLET_ENV.keyPassphrase] ?? null;
  const missing: string[] = [];
  if (!passTypeIdentifier) missing.push(APPLE_WALLET_ENV.passTypeId);
  if (!teamIdentifier) missing.push(APPLE_WALLET_ENV.teamId);
  if (!certPem) missing.push(APPLE_WALLET_ENV.cert);
  if (!keyPem) missing.push(APPLE_WALLET_ENV.key);
  if (!wwdrPem) missing.push(APPLE_WALLET_ENV.wwdr);
  if (missing.length > 0 || !passTypeIdentifier || !teamIdentifier || !certPem || !keyPem || !wwdrPem) return { ok: false, missing };
  return { ok: true, ids: { passTypeIdentifier, teamIdentifier }, signer: { certPem, keyPem, keyPassphrase, wwdrPem } };
}

/** Is the "Add to Apple Wallet" button offered at all — the switch ON and every value present. */
export function appleWalletOffered(): boolean {
  return isWalletPassEnabled() && readAppleWalletConfig().ok;
}

