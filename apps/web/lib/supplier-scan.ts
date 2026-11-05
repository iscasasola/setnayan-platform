/**
 * 🎟 THE SUPPLIER CLAIM SCANNER — the pure half: its modes, its number, its words.
 *
 * Owner rulings (spec corpus DECISION_LOG): 2026-09-25 "SUPPLIERS CLAIM A GUEST'S SERVICE BY SCANNING…" · "SUPPLIER
 * SCAN SHOWS A COUNT ONLY" · "EVERY SUPPLIER SCAN GETS A SHARED SEQUENCE NUMBER" · "NFC = QR IN EVERY SUPPLIER MODE" ·
 * "THE SUPPLIER SCANNER EXPLAINS QR vs NFC ITSELF"; 2026-10-03 "SUPPLIER SCAN … APPROVED" (design of record
 * `prototypes/supplier_scan_2026-10-03_fable.html`); 2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE SET ONCE PER
 * SERVICE". The database half is migration 20271316581328 (`supplier_scan_claim`, every permission check).
 *
 * 🔢 COUNT ONLY. Nothing in here takes or returns a guest's name. A coordinator the hosts approved sees the name
 * because the scan action re-reads the guest row under that person's own access (host read parity) — never here.
 *
 * 🧱 MODES ARRIVE ONE SLICE AT A TIME. `SCAN_MODES` lists the five the owner approved; `SCAN_MODES_BUILT` is the ones
 * that really run today. The dropdown offers only the built ones, and the database CHECK accepts only those — so no
 * service can hold a mode nobody can run. 🔒 lib/supplier-scan.test.ts
 */

import { formatCount } from '@/lib/format-number';

/** The five approved modes (DECISION_LOG 2026-10-03 "ALL FIVE MODES", re-confirmed 2026-10-28). */
export type ScanMode = 'once' | 'ordered_received' | 'unlimited' | 'group_session' | 'roaming';

export const SCAN_MODES: readonly { key: ScanMode; label: string; line: string }[] = [
  { key: 'once', label: 'Once', line: 'One claim per guest — a second scan says “Already claimed”.' },
  { key: 'ordered_received', label: 'Ordered → Received', line: 'First scan orders, Ready tells the guest, second scan hands over.' },
  { key: 'unlimited', label: 'Unlimited', line: 'Every scan counts, with a new number each time.' },
  { key: 'group_session', label: 'Group session', line: 'Everyone in the shot shares one number.' },
  { key: 'roaming', label: 'Roaming', line: 'Scan the guests in frame, then shoot.' },
];

/** The modes that RUN today — the dropdown's options, and the database CHECK's list. */
export const SCAN_MODES_BUILT: readonly ScanMode[] = ['once'];

export function scanModeLabel(mode: string | null | undefined): string {
  return SCAN_MODES.find((m) => m.key === mode)?.label ?? 'Once';
}

/** The one dropdown on a service: Off, then each built mode (a choice is a dropdown — house rule). */
export const SCANNER_OFF = 'off';
export type ScannerChoice = typeof SCANNER_OFF | ScanMode;

export function scannerChoiceOptions(): { key: ScannerChoice; label: string }[] {
  return [
    { key: SCANNER_OFF, label: 'Off' },
    ...SCAN_MODES.filter((m) => SCAN_MODES_BUILT.includes(m.key)).map((m) => ({ key: m.key, label: m.label })),
  ];
}

/** What a choice saves: OFF keeps the last mode, so switching back on picks up where it was. */
export function scannerChoiceToSetting(
  choice: string,
  current: { enabled: boolean; mode: ScanMode } | null,
): { enabled: boolean; mode: ScanMode } | null {
  if (choice === SCANNER_OFF) return { enabled: false, mode: current?.mode ?? 'once' };
  const mode = SCAN_MODES_BUILT.find((m) => m === choice);
  return mode ? { enabled: true, mode } : null;
}

export function scannerChoiceOf(setting: { enabled: boolean; mode: string } | null | undefined): ScannerChoice {
  if (!setting || !setting.enabled) return SCANNER_OFF;
  return (SCAN_MODES_BUILT.find((m) => m === setting.mode) ?? SCANNER_OFF) as ScannerChoice;
}

/** "#0042" — zero-padded to four; past #9999 it simply grows. The SAME string on the supplier's and the guest's screen. */
export function scanNumberLabel(n: number): string {
  return `#${String(Math.max(0, Math.trunc(n))).padStart(4, '0')}`;
}

/**
 * The services that hand out souvenirs: the leaves under the taxonomy tile `souvenir_giveaways`, plus the tile key.
 * Their Once scan writes the couple's own souvenir record (`guest_souvenir_claims`) so the two desks are one record.
 * MIRRORS `public.supplier_scan_is_souvenir` — 🔒 lib/supplier-scan.test.ts holds the two and the taxonomy together.
 */
export const SOUVENIR_SERVICES: readonly string[] = [
  'souvenir_giveaways',
  'souvenirs_giveaways',
  'pasalubong_box',
  'sponsor_token',
  'godchild_token',
  'angpao_betrothal_supplier',
];

// ── The scan's answer ──────────────────────────────────────────────────────────

export type ScanAnswer =
  | { outcome: 'claimed'; number: number; claimed: number; total: number; name?: string | null }
  | { outcome: 'already'; number: number | null; name?: string | null }
  | { outcome: 'not_guest' }
  | { outcome: 'unreadable' }
  | { outcome: 'no_signal' }
  | { outcome: 'refused'; message: string };

export type ScanWords = { tone: 'ok' | 'warn' | 'quiet'; title: string; line: string | null };

/** "142 of 176" — or just "142" when nobody has said they are coming yet (never "of 0"). */
export function claimedOfWords(claimed: number, total: number): string {
  return total > 0 ? `${formatCount(claimed)} of ${formatCount(total)}` : formatCount(claimed);
}

/**
 * The result line under the camera (prototype frame C/C′). Counts only — a `name` is shown only when the scan action
 * read it under the scanner's own access (a coordinator the hosts approved).
 */
export function scanAnswerWords(a: ScanAnswer): ScanWords {
  switch (a.outcome) {
    case 'claimed':
      return {
        tone: 'ok',
        title: `✓ ${scanNumberLabel(a.number)} · Claimed ${claimedOfWords(a.claimed, a.total)}`,
        line: a.name ?? null,
      };
    case 'already':
      return {
        tone: 'warn',
        title: a.number != null ? `Already claimed · ${scanNumberLabel(a.number)}` : 'Already claimed',
        line: a.name ?? (a.number == null ? 'Handed out at the couple’s own desk.' : null),
      };
    case 'not_guest':
      return { tone: 'warn', title: 'Not a guest of this event', line: 'Nothing was recorded.' };
    case 'unreadable':
      return { tone: 'quiet', title: 'That code isn’t a guest’s invitation', line: 'Scan the QR on their invitation or pass.' };
    case 'no_signal':
      return { tone: 'warn', title: 'No signal', line: 'Nothing was recorded. Scan them again when the signal is back.' };
    case 'refused':
      return { tone: 'warn', title: 'Not recorded', line: a.message };
  }
}

/** The database's refusals, said as sentences (the scan action's only translation). */
export function scanRefusalWords(code: string): string {
  if (/scanner_off/.test(code)) return 'This service’s scanner is off. Switch it on under Shop › Services.';
  if (/not_your_booking/.test(code)) return 'You aren’t booked for this service at this event.';
  return 'Something stopped the scan. Try again.';
}

// ── QR vs NFC, said by the screen itself (DECISION_LOG 2026-09-25 "THE SUPPLIER SCANNER EXPLAINS QR vs NFC ITSELF") ──

export type NfcPlace = 'reads' | 'iphone-browser' | 'none';

/** Where this phone stands on NFC: it reads (the app, or Chrome on Android), it is an iPhone browser, or it cannot. */
export function nfcPlace(env: { nfcSupported: boolean; isIos: boolean }): NfcPlace {
  if (env.nfcSupported) return 'reads';
  return env.isIos ? 'iphone-browser' : 'none';
}

/** One line on the scan screen — only what works on THIS phone. */
export function nfcLine(place: NfcPlace): string {
  switch (place) {
    case 'reads':
      return 'NFC is on — a guest can tap their tag instead of showing the QR.';
    case 'iphone-browser':
      return 'iPhone browsers can’t read NFC tags. Use the QR camera here, or tap tags in the Setnayan app.';
    case 'none':
      return 'This browser can’t read NFC tags. Use the QR camera, or tap tags in the Setnayan app or Chrome on Android.';
  }
}

/** The ⓘ behind it: the device table, in words. */
export const NFC_DEVICE_TABLE =
  'A guest’s NFC tag holds the same link as their QR, so a tap and a scan count the same. ' +
  'Reads tags: the Setnayan app on iPhone and Android, and Chrome on Android. ' +
  'Cannot: Safari or Chrome on an iPhone, and computers. On those, use the QR camera.';

// ── The one server action's shape (`app/_actions/supplier-scan-actions.ts` — one export, many ops) ─────────────────

export type ScannerSaveResult = { ok: true; choice: ScannerChoice } | { ok: false; error: string };

export type SupplierScanRequest =
  | { op: 'set_scanner'; coverageId: number; choice: string }
  | { op: 'claim'; eventId: string; coverageId: number; raw: string; via: 'qr' | 'nfc' }
  | { op: 'admin_remove'; eventId: string; kind: 'scan' | 'souvenir'; claimId: string };

export type SupplierScanReply =
  | { op: 'set_scanner'; result: ScannerSaveResult }
  | { op: 'claim'; result: ScanAnswer }
  | { op: 'admin_remove'; result: { ok: boolean; error?: string } };
