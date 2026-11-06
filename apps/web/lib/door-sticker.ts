import { SUPPLIER_QR_MODE_LABEL, type SupplierQrMode } from '@/lib/supplier-qr-codes';

/**
 * 🚪 "WE ARE PART OF SETNAYAN" — THE DOOR STICKER, the pure half (owner 2026-11-05, DECISION_LOG "🚪📶 THE NFC TAP AND
 * THE DOOR STICKER ARE SUPPLIER MARKETING TOOLS": *"add them to the marketing tools"*).
 *
 * A print piece next to the shop's QR codes (Customers › QR codes): the Setnayan mark · "We are part of SETNAYAN" ·
 * the shop's name · ONE of the shop's own codes · the badges it wears today. Two sizes; download only — Setnayan
 * neither orders nor prints it.
 *
 *   · The code is the SAME one the QR card shows, never a new public page: My page (`/v/<slug>`) or Check a date
 *     (`/v/<slug>/dates`), picked in ONE dropdown. Their labels are the QR dropdown's own words.
 *   · The badges are read AT PRINT TIME (`/api/vendor/door-sticker` → `badgesForPrint`), like the badges file.
 *
 * PURE — a client component reads the choices and labels from here. The drawing is `lib/door-sticker-print.ts`.
 * 🔒 lib/door-sticker.test.ts
 */

/** The codes a sticker can carry: the shop's page, or its Check a date. Both are permanent; neither needs a login. */
export const DOOR_STICKER_CODES = ['page', 'dates'] as const satisfies readonly SupplierQrMode[];
export type DoorStickerCode = (typeof DOOR_STICKER_CODES)[number];

export const DOOR_STICKER_SIZES = ['door', 'window'] as const;
export type DoorStickerSize = (typeof DOOR_STICKER_SIZES)[number];

export const DOOR_STICKER_FORMATS = ['svg', 'pdf'] as const;
export type DoorStickerFormat = (typeof DOOR_STICKER_FORMATS)[number];

/** The side of each size, in centimetres — a square. */
export const DOOR_STICKER_CM: Readonly<Record<DoorStickerSize, number>> = { door: 20, window: 40 };

export const DOOR_STICKER_SIZE_LABEL: Readonly<Record<DoorStickerSize, string>> = {
  door: 'Door · 20 cm',
  window: 'Window · 40 cm',
};

/** The code's name in the dropdown — the QR codes dropdown's own words, so a code is called one thing. */
export const DOOR_STICKER_CODE_LABEL: Readonly<Record<DoorStickerCode, string>> = {
  page: SUPPLIER_QR_MODE_LABEL.page,
  dates: SUPPLIER_QR_MODE_LABEL.dates,
};

/** The line printed under the code — what a scan opens. */
export const DOOR_STICKER_SCAN_LINE: Readonly<Record<DoorStickerCode, string>> = {
  page: 'Scan to see our page',
  dates: 'Scan to check your date',
};

/** The sticker's two lines, as printed (the owner's words, set in the badge's tracked capitals). */
export const DOOR_STICKER_WORDS = { lead: 'WE ARE PART OF', brand: 'SETNAYAN' } as const;

/** The sticker's code on the QR page: the page being shown when it is one of the two, else My page. */
export function doorStickerCodeFor(mode: SupplierQrMode): DoorStickerCode {
  return mode === 'dates' ? 'dates' : 'page';
}

export function doorStickerCodeOf(raw: unknown): DoorStickerCode {
  return raw === 'dates' ? 'dates' : 'page';
}
export function doorStickerSizeOf(raw: unknown): DoorStickerSize {
  return raw === 'window' ? 'window' : 'door';
}
export function doorStickerFormatOf(raw: unknown): DoorStickerFormat {
  return raw === 'pdf' ? 'pdf' : 'svg';
}

/** Where the file is made — the signed-in supplier's own shop, read now. */
export function doorStickerHref(code: DoorStickerCode, size: DoorStickerSize, format: DoorStickerFormat): string {
  return `/api/vendor/door-sticker?code=${code}&size=${size}&format=${format}`;
}

/** `setnayan-door-sticker-<code>-20cm.svg` — what the saved file is called. */
export function doorStickerFileName(code: DoorStickerCode, size: DoorStickerSize, format: DoorStickerFormat): string {
  return `setnayan-door-sticker-${code === 'dates' ? 'check-a-date' : 'my-page'}-${DOOR_STICKER_CM[size]}cm.${format}`;
}

/** The lab's / a fixture's key for one file: `<code>-<size>-<format>`. */
export function doorStickerKey(code: DoorStickerCode, size: DoorStickerSize, format: DoorStickerFormat): string {
  return `${code}-${size}-${format}`;
}
