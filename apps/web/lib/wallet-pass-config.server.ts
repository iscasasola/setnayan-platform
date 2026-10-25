import 'server-only';

import { pemFromEnvValue, type AppleWalletIds } from '@/lib/wallet-pass';
import type { AppleWalletSigner, WalletSignerProbe } from '@/lib/wallet-pass-pkpass';
import { logQueryError } from '@/lib/supabase/error-detect';

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

/** The env var NAMES (never values). */
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

/**
 * 🍎 IS "ADD TO APPLE WALLET" OFFERED — ON FOR EVERYONE, NEVER WITHOUT A SIGNABLE PASS.
 *
 * Owner, 2026-10-25 (DECISION_LOG "ADD TO APPLE WALLET IS ON FOR EVERYONE"): *"any build that we have should not be
 * for internal only"* — so there is no switch and no `is_internal` gate. What stays is the honest half: the button is
 * drawn only while the set in the env can actually SIGN a pass — every value present, the certificate inside its
 * dates, the key its own, and a probe signature made by the same code the route signs with (`probeSigner`). A missing
 * or broken set draws nothing; the guest still has "Save my ticket".
 *
 * The probe runs once per server instance (the env does not change under a running instance) and is re-asked once the
 * certificate's own expiry passes. node-forge is loaded only here, on demand — the guest page never imports it at the
 * top. A failure is logged by its STEP only.
 */
let probed: Promise<WalletSignerProbe | null> | null = null;

export async function appleWalletOffered(now: Date = new Date()): Promise<boolean> {
  const config = readAppleWalletConfig();
  if (!config.ok) return false;
  if (!probed) {
    probed = import('@/lib/wallet-pass-pkpass')
      .then(({ probeSigner }) => probeSigner(config.signer, now))
      .catch(() => null)
      .then((probe) => {
        // Once per instance, by STEP only — never on every page.
        if (!probe?.ok) logQueryError('wallet-pass.apple.probe', probe ? probe.step : 'load', {}, 'graceful_degrade');
        return probe;
      });
  }
  const probe = await probed;
  if (!probe?.ok) return false;
  if (now.getTime() < probe.notAfter.getTime()) return true;
  probed = null; // the certificate's own date passed: ask again (it will say "expired" until it is renewed)
  return false;
}
