/**
 * apps/web/lib/sample-event/pass.ts
 *
 * 🎫 A SAMPLE GUEST'S DIGITAL TICKET — drawn by the SHIPPED ticket, from fixtures.
 *
 * A real guest's ticket is `/api/guest/pass-card`: `layoutPassCard` (the
 * phone-card print format) flattened to a 1080 × 1440 PNG by
 * `renderPassCardPng`. The sample's is the SAME two functions over the sample's
 * rows (owner 2026-11-02: "the actual page", never a drawing of it), with:
 *
 *   · the FREE look — plain white (`printLooksFor(...).free`), what a Free
 *     couple's guests get, since the sample is Free first (brief item 9);
 *   · Table and Seat ON — the sample's "seats published" override
 *     (`seatsPublished`), never a faked date;
 *   · a QR that opens the sample guest's own hub (`/sample/hub/<key>`) — no
 *     invitation token, no real event's address, nothing that signs anybody in.
 *
 * 🔒 No table is read (`app/sample/the-sample-hub-reaches-no-table.test.ts`).
 */
import { layoutPassCard, type PrintPass, type PrintSetData } from '@/lib/print-layout';
import { printLooksFor } from '@/lib/print-hub-look';
import { renderPassCardPng } from '@/lib/pass-card-render';
import { renderStyledUrlQrPng } from '@/lib/qr';
import { FREE_QR_LOOK } from '@/lib/qr-look';
import { passCardDesignFrom, type PassCardDesign } from '@/lib/pass-card';

import { sampleArriveBy, sampleDay, sampleGuestName, sampleSeat, sampleSnapshot } from './hub';
import type { SampleGuest } from './snapshot';
import { joinCoupleNames } from '@/lib/typed-names';

/** Where a sample ticket's picture is served (`app/sample/pass/[guestKey]/route.ts`). */
export function samplePassSrc(guestKey: string, design?: PassCardDesign): string {
  return `/sample/pass/${encodeURIComponent(guestKey)}${design ? `?design=${design}` : ''}`;
}

/** What the sample ticket's code opens: that guest's sample hub. */
export function samplePassQrUrl(appUrl: string, guestKey: string): string {
  return `${appUrl.replace(/\/+$/, '')}/sample/hub/${encodeURIComponent(guestKey)}`;
}

function printSetData(now: Date, design: PassCardDesign): PrintSetData {
  const s = sampleSnapshot();
  const day = sampleDay(now);
  const [ceremony, reception] = s.chapters;
  const dateLabel = day.label.replace(', ', ' · ');
  const hhmm = (v: string) => {
    const [h, m] = v.split(':').map(Number) as [number, number];
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  return {
    names: { first: s.couple.bride.first, second: s.couple.groom.first },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel,
    ceremonyTime: ceremony ? hhmm(ceremony.at) : null,
    ceremonyVenue: ceremony?.location ?? null,
    receptionTime: reception ? hhmm(reception.at) : null,
    receptionVenue: reception?.location ?? null,
    monogram: null,
    initials: joinCoupleNames(s.couple.bride.first[0], s.couple.groom.first[0]),
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], setnayanMark: true, passDesign: design },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: null,
    hasStill: false,
    hasEventQr: false,
  };
}

/** The ticket's facts for one guest — the same fields `passCardPass` fills for a real one. */
export function samplePrintPass(g: SampleGuest): PrintPass {
  const seat = sampleSeat(g);
  const bringing = g.plus_one_allowed ? g.plus_one_name : null;
  return {
    name: sampleGuestName(g),
    seat: seat?.tableLabel ?? null,
    seatNumber: seat?.seatNumber ?? null,
    qrRef: `qr-${g.guestKey}`,
    serial: null,
    arrive: sampleArriveBy(g),
    bringing,
    party: bringing ? 1 : 0,
  };
}

/** The PNG — 1080 × 1440, the shipped renderer. */
export async function renderSamplePassPng(g: SampleGuest, opts: { now: Date; appUrl: string; design?: string | null }): Promise<Uint8Array> {
  const design = passCardDesignFrom(opts.design);
  const s = sampleSnapshot();
  const look = printLooksFor(s.theme, s.rolePalette).free;
  const pass = samplePrintPass(g);
  const qr = await renderStyledUrlQrPng(samplePassQrUrl(opts.appUrl, g.guestKey), FREE_QR_LOOK, 720);
  const doc = layoutPassCard({ look, data: printSetData(opts.now, design), mode: 'screen', foil: false }, pass, design);
  return renderPassCardPng(doc, { [pass.qrRef!]: { bytes: new Uint8Array(qr), mime: 'image/png' } });
}
