/**
 * 🎟 THE SUPPLIER CLAIM SCANNER — the pure half: its modes, its number, its words.
 *
 * Owner rulings (spec corpus DECISION_LOG): 2026-09-25 "SUPPLIERS CLAIM A GUEST'S SERVICE BY SCANNING…" · "SUPPLIER
 * SCAN SHOWS A COUNT ONLY" · "EVERY SUPPLIER SCAN GETS A SHARED SEQUENCE NUMBER" · "NFC = QR IN EVERY SUPPLIER MODE" ·
 * "THE SUPPLIER SCANNER EXPLAINS QR vs NFC ITSELF"; 2026-10-03 "SUPPLIER SCAN … APPROVED" (design of record
 * `prototypes/supplier_scan_2026-10-03_fable.html`); 2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE SET ONCE PER
 * SERVICE". The database half is migration 20271320327933 (`supplier_scan_claim`, every permission check).
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
export const SCAN_MODES_BUILT: readonly ScanMode[] = ['once', 'ordered_received', 'unlimited', 'group_session'];

/** The modes whose number belongs to a SHOT (one number, many guests): Group session, and Roaming (slice 4). */
export function isSessionMode(mode: ScanMode): boolean {
  return mode === 'group_session' || mode === 'roaming';
}

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
  // Ordered → Received (slice 2): the first scan orders, the second (after Ready) hands over.
  | { outcome: 'ordered'; number: number; name?: string | null }
  | { outcome: 'not_ready'; number: number; name?: string | null }
  | { outcome: 'received'; number: number; claimed: number; total: number; name?: string | null }
  // Unlimited (slice 3): every scan counts, a new number each time.
  | { outcome: 'served'; number: number; served: number; unique: number; name?: string | null }
  // Group session (slice 3): everyone in the shot shares one number; pickups read "k of n".
  | { outcome: 'added'; number: number; guests: number; name?: string | null }
  | { outcome: 'in_session'; number: number; guests: number; name?: string | null }
  | { outcome: 'picked_up'; number: number; claimed: number; of: number; name?: string | null }
  | { outcome: 'no_session' }
  | { outcome: 'already'; number: number | null; name?: string | null; mode?: ScanMode }
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
    case 'ordered':
      return { tone: 'ok', title: `✓ Ordered · ${scanNumberLabel(a.number)}`, line: a.name ?? 'Tap Ready on the number when it’s done — the guest is told.' };
    case 'not_ready':
      return { tone: 'warn', title: `Not ready yet · ${scanNumberLabel(a.number)}`, line: a.name ?? 'Tap Ready on the number first, then scan again to hand it over.' };
    case 'received':
      return {
        tone: 'ok',
        title: `✓ Received · ${scanNumberLabel(a.number)}`,
        line: a.name ?? `Received ${claimedOfWords(a.claimed, a.total)}`,
      };
    case 'served':
      return {
        tone: 'ok',
        title: `✓ ${scanNumberLabel(a.number)} · Served ${formatCount(a.served)}`,
        line: a.name ?? `${formatCount(a.unique)} ${a.unique === 1 ? 'guest' : 'guests'} so far`,
      };
    case 'added':
      return { tone: 'ok', title: `${scanNumberLabel(a.number)} · ${formatCount(a.guests)} ${a.guests === 1 ? 'guest' : 'guests'}`, line: a.name ?? 'Scan everyone in the shot, then Done.' };
    case 'in_session':
      return { tone: 'quiet', title: `Already in ${scanNumberLabel(a.number)} · ${formatCount(a.guests)} ${a.guests === 1 ? 'guest' : 'guests'}`, line: a.name ?? null };
    case 'picked_up':
      return { tone: 'ok', title: `✓ ${scanNumberLabel(a.number)} · ${formatCount(a.claimed)} of ${formatCount(a.of)} claimed`, line: a.name ?? null };
    case 'no_session':
      return { tone: 'quiet', title: 'No shot open', line: 'Tap New shot before the photo, or wait until their number is Ready.' };
    case 'already':
      return {
        tone: 'warn',
        title: a.number != null ? `Already ${a.mode === 'ordered_received' ? 'received' : 'claimed'} · ${scanNumberLabel(a.number)}` : 'Already claimed',
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
  if (/session_open/.test(code)) return 'That shot is still open — tap Done first, then Ready.';
  if (/bad_prints/.test(code)) return 'Prints must be between 1 and 99.';
  if (/scanner_off/.test(code)) return 'This service’s scanner is off. Switch it on under Shop › Services.';
  if (/not_your_booking/.test(code)) return 'You aren’t booked for this service at this event.';
  return 'Something stopped the scan. Try again.';
}

/** The count under the scanner: "Claimed 142 of 176", or "Ordered 12 · Ready 3 · Received 20 of 176" (slice 2). */
export function tallyWords(
  mode: ScanMode,
  t: { claimed: number; total: number; ordered?: number; ready?: number; served?: number; unique?: number; sessions?: number },
): string {
  if (mode === 'unlimited') return `Served ${formatCount(t.served ?? 0)} · ${formatCount(t.unique ?? 0)} ${t.unique === 1 ? 'guest' : 'guests'}`;
  if (isSessionMode(mode)) {
    return `Shots ${formatCount(t.sessions ?? 0)} · Ready ${formatCount(t.ready ?? 0)} · Claimed ${formatCount(t.claimed)}`;
  }
  if (mode === 'ordered_received') {
    return `Ordered ${formatCount(t.ordered ?? 0)} · Ready ${formatCount(t.ready ?? 0)} · Received ${claimedOfWords(t.claimed, t.total)}`;
  }
  return `Claimed ${claimedOfWords(t.claimed, t.total)}`;
}

/** One number on "Your numbers" (prototype frame F) — counts only. */
export type ScanNumberRow = {
  number: number;
  guests: number;
  ordered: number;
  ready: number;
  received: number;
  firstAt: string;
  readyAt: string | null;
  receivedAt: string | null;
  /** A shot's prints (Group session) — null for a one-guest number. */
  prints: number | null;
  /** The shot is still open (being scanned into) — Ready waits for Done. */
  open: boolean;
};

export type NumberState = 'ordered' | 'ready' | 'received' | 'part';

/** A number's state: all ordered · all ready · all received · or a mix (a shared number part-collected). */
export function numberState(r: Pick<ScanNumberRow, 'guests' | 'ordered' | 'ready' | 'received'>): NumberState {
  if (r.received === r.guests) return 'received';
  if (r.ready === r.guests) return 'ready';
  if (r.ordered === r.guests) return 'ordered';
  return 'part';
}

export function numberStateWords(r: Pick<ScanNumberRow, 'guests' | 'ordered' | 'ready' | 'received'> & { open?: boolean }): string {
  if (r.open) return 'Open · scanning the shot';
  switch (numberState(r)) {
    case 'received':
      return 'Received';
    case 'ready':
      return 'Ready · waiting';
    case 'ordered':
      return 'Ordered';
    case 'part':
      return `${formatCount(r.received)} of ${formatCount(r.guests)} received`;
  }
}

/** The guest's own card line for a number in Ordered → Received (null for a claim that is simply done). */
export function guestNumberStateWords(state: 'ordered' | 'ready' | 'received' | null | undefined): string | null {
  if (state === 'ordered') return 'Being prepared';
  if (state === 'ready') return 'Ready — claim it now';
  return null;
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
  | { op: 'ready'; eventId: string; coverageId: number; number: number }
  | { op: 'numbers'; eventId: string; coverageId: number }
  | { op: 'session_open'; eventId: string; coverageId: number }
  | { op: 'session_done'; eventId: string; coverageId: number; prints: number | null }
  | { op: 'claim'; eventId: string; coverageId: number; raw: string; via: 'qr' | 'nfc' }
  | { op: 'admin_remove'; eventId: string; kind: 'scan' | 'souvenir'; claimId: string };

export type SupplierScanReply =
  | { op: 'set_scanner'; result: ScannerSaveResult }
  | { op: 'ready'; result: { ok: true; told: number } | { ok: false; error: string } }
  | { op: 'numbers'; result: ScanNumberRow[] | null }
  | { op: 'session_open'; result: { ok: true; number: number; guests: number } | { ok: false; error: string } }
  | {
      op: 'session_done';
      result:
        | { ok: true; outcome: 'done'; number: number; guests: number; prints: number }
        | { ok: true; outcome: 'cancelled'; number: number }
        | { ok: true; outcome: 'none_open' }
        | { ok: false; error: string };
    }
  | { op: 'claim'; result: ScanAnswer }
  | { op: 'admin_remove'; result: { ok: boolean; error?: string } };

/** A shot's prints: one per guest by default, the operator's –/+ kept within 1–99. */
export function clampPrints(n: number): number {
  return Math.min(99, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
}
