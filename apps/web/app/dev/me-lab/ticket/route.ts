import { layoutPassCard, type PrintSetData } from '@/lib/print-layout';
import { printLookFor } from '@/lib/print-pieces';
import { renderPassCardPng } from '@/lib/pass-card-render';
import { renderInvitationQrPng } from '@/lib/qr';
import { FREE_QR_LOOK } from '@/lib/qr-look';
import { guestArriveBy } from '@/lib/role-group-dress-code';
import { LAB_DOORS, LAB_PEOPLE, labMeDressConfig } from '../lab-people';

/**
 * 🎟 THE ME LAB'S TICKET — the real card drawing (`layoutPassCard` → `renderPassCardPng`, Classic), with Arrive read as
 * the real ticket reads it (`guestArriveBy`: the role's own call time, else the doors' time). No database.
 */
export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const who = new URL(req.url).searchParams.get('who');
  /* `&couple=mj` — the maker-lab guest's couple (Maria & Jose, 12 Dec 2026), for its after-a-Yes thank-you. */
  const mj = new URL(req.url).searchParams.get('couple') === 'mj';
  const p = LAB_PEOPLE.find((x) => x.key === who) ?? LAB_PEOPLE[0]!;
  const data: PrintSetData = {
    names: mj ? { first: 'Maria', second: 'Jose' } : { first: 'Indalecio', second: 'Claire' },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel: mj ? 'Saturday · December 12, 2026' : 'Friday · December 18, 2026',
    ceremonyTime: '2:00 PM',
    ceremonyVenue: mj ? 'Seda Vertis North' : 'San Agustin Church',
    receptionTime: null,
    receptionVenue: null,
    monogram: null,
    initials: mj ? 'M & J' : 'I & C',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], setnayanMark: true },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: null,
    hasStill: false,
    hasEventQr: false,
  };
  const qr = await renderInvitationQrPng({ appUrl: 'https://setnayan.com', slug: 'me-lab', qrToken: `lab-${p.key}`, look: { ...FREE_QR_LOOK, dark: '#111111', light: '#FFFFFF' }, ownerSlug: null, width: 720 });
  const pass = {
    name: [p.name_prefix, p.display_name].filter(Boolean).join(' '),
    seat: null,
    seatNumber: null,
    qrRef: 'qr-lab',
    serial: null,
    arrive: guestArriveBy({ role: p.role, config: labMeDressConfig(), general: LAB_DOORS }),
    party: 0,
  };
  const doc = layoutPassCard({ look: printLookFor('house'), data, mode: 'screen', foil: false }, pass, 'classic');
  const png = await renderPassCardPng(doc, { 'qr-lab': { bytes: new Uint8Array(qr), mime: 'image/png' } });
  return new Response(Buffer.from(png), { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
}
