/**
 * lib/printed-pass-stress.fixture.ts — THE HARDEST GUESTS A PASS IS PRINTED FOR.
 *
 * Owner 2026-10-16: *"check the alignment of the names and elements on the
 * print. make sure nothing overlaps, make everything legible"*. These rows are
 * INVENTED — no guest of any real event is copied here — and each one is the
 * shape that breaks a card: a very long name, a household of two, a long table
 * name, a seat with no table, a table with no seat, nothing at all, emoji and
 * ñ and accents, one long unbroken word, and a request not yet accepted.
 *
 * Every format × every ticket style × every row is drawn and measured by
 * `the-printed-pass-fits.test.ts`; the contact sheet reads the same rows.
 */
import { flattenSvgMark } from '@/lib/print-mark';
import type { PrintPass, PrintSetData } from '@/lib/print-layout';
import type { InviteThemeId } from '@/lib/invite-themes';

export type StressRow = { key: string; pass: PrintPass };

export const STRESS_ROWS: StressRow[] = [
  {
    key: 'longest',
    pass: { name: 'Ma. Concepcion Dela Cruz-Villanueva y Santos', seat: 'Table 12 · Ninong & Ninang Family (Batangas side)', seatNumber: '14', qrRef: 'qr-1', serial: 'Nº 0042', arrive: '2:30 PM', party: 2 },
  },
  {
    key: 'household',
    pass: { name: 'Rafael Antonio & Ma. Theresa Santos-Dela Paz', seat: 'Table 3', seatNumber: '1–2', qrRef: 'qr-2', serial: 'Nº 0108', arrive: '10:30 AM', party: 1 },
  },
  { key: 'no-table', pass: { name: 'Bo', seat: null, seatNumber: null, qrRef: 'qr-3', serial: 'Nº 0001', arrive: null, party: 0 } },
  { key: 'no-seat', pass: { name: 'Rosalinda Buenaventura', seat: 'Table 7', seatNumber: null, qrRef: 'qr-4', serial: 'Nº 0777', arrive: '3:00 PM' } },
  {
    key: 'accents',
    pass: { name: 'Señor José Ñoño Peñaflorida 🎉 Ángeles', seat: 'Mesa Ñ — Ábaca Garden', seatNumber: '9', qrRef: 'qr-5', serial: 'Nº 0505', arrive: '4:45 PM' },
  },
  { key: 'one-word', pass: { name: 'Wolfeschlegelsteinhausenbergerdorff', seat: 'Table 21', seatNumber: '108', qrRef: 'qr-6', serial: 'Nº 9999', arrive: '11:15 AM' } },
  // The owner's own case (2026-10-16, "a text overlaps on lines"): a Classic phone
  // card with the DATE · ARRIVE row, whose door line printed on the frame. Invented name.
  { key: 'caption-vs-frame', pass: { name: 'Teodora Liwanag', seat: null, seatNumber: null, qrRef: 'qr-8', serial: 'Nº 0016', arrive: '2:30 PM' } },
  { key: 'pending', pass: { name: 'Purificacion Evangelista-Ocampo', seat: null, seatNumber: null, qrRef: 'qr-7', serial: null, pending: 'waiting for Juan Miguel & Maria Isabella' } },
];

/** The ticket styles the print offers: two free looks, the neon one, and a Pro look printed as a sample. */
export const STRESS_THEMES: Array<{ theme: InviteThemeId; label: string; mode: 'print' | 'sample' }> = [
  { theme: 'house', label: 'Classic', mode: 'print' },
  { theme: 'galeriya', label: 'Modern', mode: 'print' },
  { theme: 'cyber', label: 'Cyber Neon', mode: 'print' },
  { theme: 'abaca', label: 'Rustic (sample)', mode: 'sample' },
];

const STUDIO_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">' +
  '<path d="M200 200H800V800H200Z M350 350V650H650V350Z" fill="#7a5c3e" fill-rule="evenodd"/>' +
  '<path d="M450 100a50 50 0 1 0 100 0a50 50 0 1 0 -100 0z" fill="#7a5c3e"/></svg>';

/**
 * The event around the rows. `long` is the couple that runs to two lines
 * ("Juan Miguel & Maria Isabella" as two long names) with a long venue; the
 * other is an ordinary wedding. Both with and without the couple's logo.
 */
export function stressEvent(opts: { long: boolean; logo: boolean; still: boolean; nfc: boolean; round: boolean; mark: boolean }): PrintSetData {
  const logo = opts.logo ? flattenSvgMark(STUDIO_LOGO) : null;
  return {
    names: opts.long ? { first: 'Maria Isabella Concepcion Villaseñor-Castañeda', second: 'Juan Miguel Indalecio Dimaculangan' } : { first: 'Juan Miguel', second: 'Maria Isabella' },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel: 'Wednesday · December 18, 2026',
    ceremonyTime: '10:30 AM',
    ceremonyVenue: opts.long ? 'Santuario de San Vicente de Paul Parish & Shrine of the Poor, Tandang Sora, Quezon City' : 'San Agustin Church, Intramuros',
    receptionTime: '6:00 PM',
    receptionVenue: 'The Grand Ballroom',
    monogram: logo ? { kind: 'outline', ...logo } : null,
    initials: 'J & M',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], nfc: opts.nfc, guestNames: true, setnayanMark: opts.mark },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: 'setnayan.com/juan-and-maria',
    hasStill: opts.still,
    hasEventQr: true,
    qrShape: opts.round ? 'circle' : 'square',
    asOf: 'As of October 16, 2026',
  };
}
