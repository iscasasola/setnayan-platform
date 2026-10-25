import 'server-only';

import sharp from 'sharp';
import { logQueryError } from '@/lib/supabase/error-detect';
import { nameStyleOfPrintDetails } from '@/lib/name-style';
import { passCardFileNameFor, passCardPass, passCardGuestName, type PassCardGuest, type PassCardKit } from '@/lib/pass-card.server';
import { SETNAYAN_WALLET_IMAGES } from '@/lib/wallet-pass-icons';
import { walletPassFileName, type WalletPassFacts } from '@/lib/wallet-pass';

/**
 * lib/wallet-pass.server.ts — THE APPLE WALLET PASS'S READS: the facts shaped
 * from the ticket's kit, and the pass's pictures. The env (the certificates and
 * the switch) is read in ONE other place, lib/wallet-pass-config.server.ts —
 * kept apart so the guest page, which only asks "is it offered?", never loads
 * sharp, node-forge or the embedded icons.
 */

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
