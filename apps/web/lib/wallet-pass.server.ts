import 'server-only';

import sharp from 'sharp';
import { envFlagEnabled } from '@/lib/env-flag';
import { logQueryError } from '@/lib/supabase/error-detect';
import { nameStyleOfPrintDetails } from '@/lib/name-style';
import { passCardFileNameFor, passCardPass, passCardGuestName, type PassCardGuest, type PassCardKit } from '@/lib/pass-card.server';
import { SETNAYAN_WALLET_IMAGES } from '@/lib/wallet-pass-icons';
import { pemFromEnvValue, type AppleWalletSigner } from '@/lib/wallet-pass-pkpass';
import { walletPassFileName, type AppleWalletIds, type WalletPassFacts } from '@/lib/wallet-pass';

/**
 * lib/wallet-pass.server.ts — THE APPLE WALLET PASS'S READS: the one reader of
 * its env, the facts shaped from the ticket's kit, and the pass's pictures.
 *
 * 🔒 SECRETS. The certificate, key, passphrase and WWDR certificate live ONLY in
 * Vercel env vars (owner set-up, 2026-10-13). This module is the ONE place they
 * are read, and it never logs, returns or interpolates a value — a missing or
 * unreadable one is reported by NAME only (`missing`), and
 * `the-wallet-pass-keeps-its-secrets.test.ts` holds every file on the path to
 * that rule. Certificate expiry: 2027-11-12 (set-up log; the Secrets board row
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
  const missing = [
    !passTypeIdentifier && APPLE_WALLET_ENV.passTypeId,
    !teamIdentifier && APPLE_WALLET_ENV.teamId,
    !certPem && APPLE_WALLET_ENV.cert,
    !keyPem && APPLE_WALLET_ENV.key,
    !wwdrPem && APPLE_WALLET_ENV.wwdr,
  ].filter((n): n is (typeof APPLE_WALLET_ENV)[keyof typeof APPLE_WALLET_ENV] => Boolean(n));
  if (missing.length > 0 || !passTypeIdentifier || !teamIdentifier || !certPem || !keyPem || !wwdrPem) return { ok: false, missing };
  return { ok: true, ids: { passTypeIdentifier, teamIdentifier }, signer: { certPem, keyPem, keyPassphrase, wwdrPem } };
}

/** Is the "Add to Apple Wallet" button offered at all — the switch ON and every value present. */
export function appleWalletOffered(): boolean {
  return isWalletPassEnabled() && readAppleWalletConfig().ok;
}

/**
 * The pass's facts, from the SAME kit and the SAME `passCardPass` the PNG is
 * drawn from — so the two can never disagree about a name, a table, a time.
 */
export function walletPassFactsFor(kit: PassCardKit, g: PassCardGuest): WalletPassFacts | null {
  const { set } = kit;
  if (!g.qr_token || !set.event.slug) return null;
  const pass = passCardPass(kit, g, null);
  const second = set.data.names.second?.trim();
  return {
    guestId: g.guest_id,
    qrToken: g.qr_token,
    guestName: pass.name || passCardGuestName(g, nameStyleOfPrintDetails(set.event.print_details)),
    party: pass.party ?? 0,
    table: pass.seat,
    seatNumber: pass.seatNumber ?? null,
    couple: set.event.display_name?.trim() || [set.data.names.first, second].filter(Boolean).join(' & '),
    eyebrow: set.data.eyebrow,
    eventWord: set.data.eventWord ?? null,
    eventDate: set.event.event_date,
    arriveLabel: pass.arrive ?? null,
    arriveAt: kit.arriveAt ?? null,
    venue: set.data.receptionVenue ?? set.data.ceremonyVenue,
    venueAddress: set.event.venue_address,
    appUrl: set.appUrl,
    slug: set.event.slug,
    ownerSlug: set.ownerSlug,
    look: { paper: set.look.paper, ink: set.look.ink, accent: set.look.accent },
  };
}

export function walletPassFileNameFor(kit: PassCardKit, g: PassCardGuest): string {
  return walletPassFileName(passCardFileNameFor(kit, g));
}

const ICON_SIZES = [
  ['icon.png', 29],
  ['icon@2x.png', 58],
  ['icon@3x.png', 87],
] as const;
const LOGO_SIZES = [
  ['logo.png', 50],
  ['logo@2x.png', 100],
  ['logo@3x.png', 150],
] as const;

/**
 * 🖼 THE PASS'S PICTURES — the PNG's own rule (`setnayanMark: !ownsPro`): a Pro
 * event's pass wears the couple's mark, a free event's the Setnayan mark. A
 * mark that will not resize falls back to Setnayan's, never to no icon (Wallet
 * refuses a pass without `icon.png`).
 */
export async function walletPassImages(kit: PassCardKit): Promise<Record<string, Buffer>> {
  const setnayan = Object.fromEntries(Object.entries(SETNAYAN_WALLET_IMAGES).map(([k, v]) => [k, Buffer.from(v, 'base64')]));
  const couples = kit.set.data.details.setnayanMark === false ? kit.set.images.mark : null;
  if (!couples?.bytes) return setnayan;
  try {
    const src = Buffer.from(couples.bytes);
    const fit = (s: number) =>
      sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const out: Record<string, Buffer> = {};
    for (const [name, s] of [...ICON_SIZES, ...LOGO_SIZES]) out[name] = await fit(s);
    return out;
  } catch (err) {
    logQueryError('wallet-pass.mark', err instanceof Error ? err.name : 'mark', { event_id: kit.set.event.event_id }, 'graceful_degrade');
    return setnayan;
  }
}
