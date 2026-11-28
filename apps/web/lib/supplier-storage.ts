/**
 * lib/supplier-storage.ts — THE PLAN HOLDS STORAGE, THE PURE HALF.
 *
 * Owner 2026-11-22 "FINAL LADDER" (specs SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC § ★ B), sizes re-cut the same day ("SUPPLIER SIZES
 * RE-CUT" + "PLUS CUT TO 128 GB"): the plans ARE storage sizes — Free 256 MB · Verified 2 GB · Plus 128 GB · Pro 500 GB · Ultra 1 TB. Every plan has an allowance now (was: Plus 5 · Pro 10 · Ultra 20 GB,
 * Free and Verified none).
 *
 *   · the number   — `TIER_CAPS[plan].storageBytes` (lib/vendor-tier-caps.ts), twin `vendor_tier_limit(…,'storage_mb')` (whole MB).
 *   · what counts  — each stored copy a filed event file still points at, once (`vendor_storage_used_bytes`, read by
 *                    `readStoredBytes` in lib/downgrade-limits.server.ts). Removing a file from its events makes room;
 *                    nothing is ever deleted by the allowance.
 *   · shown        — the Plan's "Storage" row: "1.2 GB of 5 GB used" (`storageRowLine`); a read that failed SAYS so and
 *                    never shows 0 (`STORAGE_UNREAD`).
 *   · refused      — `/api/upload` before any bytes move, and the database (`enforce_supplier_storage_allowance`) for
 *                    every other path; both say `storageFullMessage` with the way up (`STORAGE_UPGRADE_HREF`).
 *
 * The paid packs `vendor_storage_5/10/15gb` stay inactive: nothing here offers or prices them.
 *
 * PURE: no I/O, no env. 🔒 lib/supplier-storage.test.ts
 */
import { storageWords } from './downgrade-limits';
import { TIER_CAPS, VENDOR_TIERS, asVendorTier, isPaidSize, tierCaps, tierRank, type VendorTier } from './vendor-tier-caps';
import { formatCount } from './format-number';
import { planWord } from './vendor-plan-change-words';
import { SPECIALIZED_TOOLS_PUBLIC_TIERS } from './specialized-tools-access';

/** The machine-readable half of a refusal (the sentence is `storageFullMessage`). */
export const STORAGE_FULL_CODE = 'supplier_storage_full';

/** Where "move to a plan that holds more" goes — the shop's Plan. */
export const STORAGE_UPGRADE_HREF = '/vendor-dashboard/subscription';

/** The Plan row's line when what the shop stores could not be read — said, never a 0. */
export const STORAGE_UNREAD = 'Couldn’t read what you store just now — nothing is lost';

/** The refusal when the allowance could not be checked — fail CLOSED, plain reason + try again. */
export const STORAGE_CHECK_FAILED = 'We couldn’t check your storage just now. Nothing was uploaded — try again in a moment.';

/**
 * The storage a plan holds, in bytes — READ FROM `TIER_CAPS`. Every plan has one since 2026-11-22; null is kept only
 * as the "no allowance known" answer the callers already handle.
 * (Re-exported by lib/downgrade-limits.server.ts, where the limits sheet has always asked for it.)
 */
export function storageAllowanceBytes(plan: string | null | undefined): number | null {
  return tierCaps(plan).storageBytes;
}

/** Bytes in the words a supplier reads — "0 MB" for nothing (storageWords floors at 1 MB). */
function words(bytes: number): string {
  return bytes <= 0 ? '0 MB' : storageWords(bytes);
}

/**
 * 📋 A PLAN IN ONE LINE — its account features WITH its size, never the size alone (owner 2026-11-22: "supplier plans is
 * not just Memory Space. but features for their account as well"; build-sessions/SUPPLIER-PLANS-EXPLAINED-2026-11-22.md).
 * Read from `TIER_CAPS`, so a cap change moves every surface that says it:
 *   Free      "run your own clients, 1 live service, just you, main shop only, and 256 MB"
 *   Verified  "on the marketplace with the basics, 3 live services, just you, main shop only, and 2 GB"
 *   Plus      "every business tool, 15 live services, you and 2 more, main shop only, and 128 GB"
 *   Pro/Ultra "every business tool, no limit on services, people or branches, and 500 GB" / "… and 1 TB"
 * The /for-suppliers plan cards, the Plans page taglines and the storage-full way up all say it. ⚖ Owner 28 Nov
 * (superseding 27 Nov L9 P3): the specialized tools are paid, each with a free 30-day trial, so no plan says it includes
 * them (`SPECIALIZED_TOOLS_PUBLIC_TIERS` is empty), and never "every tool".
 */
export function planSummaryWords(plan: string | null | undefined): string {
  const t = asVendorTier(plan);
  const c = TIER_CAPS[t];
  const tools = isPaidSize(t)
    ? SPECIALIZED_TOOLS_PUBLIC_TIERS.includes(t)
      ? 'every business tool and the specialized tools'
      : 'every business tool'
    : t === 'verified'
      ? 'on the marketplace with the basics'
      : 'run your own clients';
  const open = [c.serviceCardsTotal, c.agentAccounts, c.branchesIncluded].every((v) => !Number.isFinite(v));
  const parts = [tools];
  if (open) parts.push('no limit on services, people or branches');
  else {
    const n = c.serviceCardsTotal;
    parts.push(Number.isFinite(n) ? `${formatCount(n)} live ${n === 1 ? 'service' : 'services'}` : 'no limit on services');
    parts.push(!Number.isFinite(c.agentAccounts) ? 'no limit on people' : c.agentAccounts > 0 ? `you and ${formatCount(c.agentAccounts)} more` : 'just you');
    parts.push(!Number.isFinite(c.branchesIncluded) ? 'no limit on branches' : c.branchesIncluded > 0 ? `${formatCount(c.branchesIncluded)} ${c.branchesIncluded === 1 ? 'branch' : 'branches'}` : 'main shop only');
  }
  if (c.storageBytes !== null) parts.push(storageWords(c.storageBytes));
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * A paid size's role in the plan-page copy (SUPPLIER-PLANS-EXPLAINED): the first one with limits is the starter business,
 * the top size the big studio, the size between them the growing business. Free and Verified have no role line.
 */
export function planRole(plan: string | null | undefined): string {
  const t = asVendorTier(plan);
  if (!isPaidSize(t)) return t === 'verified' ? 'Verified' : 'Free';
  if (Number.isFinite(TIER_CAPS[t].serviceCardsTotal)) return 'The starter business';
  return t === VENDOR_TIERS[VENDOR_TIERS.length - 1] ? 'The big studio' : 'The growing business';
}

/**
 * The next PAID plan up that holds more than this one, or null (Ultra — nothing is above it, and there are no packs).
 * Verified is never "moved to": it is earned by verifying, not bought — so Free and Verified both point at Plus. The
 * words of the way up are `storageWayUp`: a full Free is offered Get verified first.
 */
export function nextStoragePlan(plan: string | null | undefined): VendorTier | null {
  const current = asVendorTier(plan);
  const have = TIER_CAPS[current].storageBytes;
  if (have === null) return null; // no allowance to outgrow
  for (const t of VENDOR_TIERS) {
    if (t === 'verified' || tierRank(t) <= tierRank(current)) continue;
    const s = TIER_CAPS[t].storageBytes;
    if (s !== null && s > have) return t;
  }
  return null;
}

/**
 * The way up at the end of a storage refusal, after "Remove files … to make room". A full FREE shop is offered Get
 * verified, not a paid plan (owner via the controller, DECISION_LOG "SUPPLIER SIZES FIXED (FINAL)": "Full Free → Get
 * verified" — Free is a trial, not a plan to stay on). Every other plan names the next paid size with its account
 * features (owner 2026-11-22: never the size alone). Ultra: nothing — never an invented offer.
 */
export function storageWayUp(plan: string | null | undefined): string {
  if (asVendorTier(plan) === 'free') return ` or get verified, free: ${planSummaryWords('verified')}`;
  const next = nextStoragePlan(plan);
  return next ? ` or move to ${planWord(next)}: ${planSummaryWords(next)}` : '';
}

/**
 * The Plan's "Storage" row. Null = the row is not drawn (a plan with no allowance — the screen stays as it was).
 *   ok      "1.2 GB of 5 GB used" · "5 GB of 5 GB used · full" · "6.1 GB of 5 GB used · over — new files wait for room"
 *   unread  `STORAGE_UNREAD` — never "0 MB of 5 GB used".
 */
export function storageRowLine(
  plan: string | null | undefined,
  read: { status: 'ok'; bytes: number } | { status: 'unread' },
): string | null {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null) return null;
  if (read.status !== 'ok') return STORAGE_UNREAD;
  const base = `${words(read.bytes)} of ${storageWords(allowance)} used`;
  if (read.bytes > allowance) return `${base} · over — new files wait for room`;
  if (read.bytes === allowance) return `${base} · full`;
  return base;
}

/**
 * The plain reason an upload is refused, with the way up. Names THIS plan's number; the next plan's number when there
 * is one. Nothing already stored is touched, and the sentence never says otherwise.
 */
export function storageFullMessage(plan: string | null | undefined, usedBytes: number, incomingBytes: number): string {
  const allowance = storageAllowanceBytes(plan) ?? 0;
  const name = planWord(asVendorTier(plan));
  const left = Math.max(0, allowance - Math.max(0, usedBytes));
  const up = storageWayUp(plan);
  const reason =
    left < 1e6
      ? `Your ${name} plan’s ${storageWords(allowance)} of storage is full.`
      : `This file is ${words(incomingBytes)}, and your ${name} plan has ${words(left)} of its ${storageWords(allowance)} left.`;
  return `${reason} Remove files from an event to make room${up}. Nothing you stored was changed.`;
}

/** Does `incomingBytes` more fit? `null` allowance = no limit on this plan. */
export function storageFits(plan: string | null | undefined, usedBytes: number, incomingBytes: number): boolean {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null) return true;
  return Math.max(0, usedBytes) + Math.max(0, incomingBytes) <= allowance;
}

/** True for the database's refusal (`enforce_supplier_storage_allowance` raises 'storage_allowance: …'). */
export function isStorageRefusal(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes('storage_allowance');
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 📏 THE METER COUNTS EVERYTHING THE SHOP OWNS (owner 2026-11-23, DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS
 * EVERYTHING THE SHOP OWNS — FILES AND DATA" + "THE METER SHOWS REAL USAGE ONLY"; spec § ★ A · H · K):
 *   "we want them to achieve limits asap" · "their calendars schedule, website and every data compiled to them is
 *   computed" · "No, real usage only".
 *
 *   · read     — `vendor_storage_breakdown` (migration 20271360925434), ONE batched read: every stored file, live, and
 *                the shop's data as last measured (a nightly job; a new shop is measured on its first look).
 *   · shown    — three kinds: Photos & video · Files · Records, against ONE number per plan. No reserve, no "System"
 *                block, no separate room: a new shop reads its true few KB.
 *   · refused  — only new photos and video past the plan (owner 23 Nov, "let us not set Room anymore?" → "Yes, drop
 *                it"). Documents, chat words and EVIDENCE (contracts, receipts, payment proofs, verification papers) are
 *                counted but NEVER refused.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Is this content type MEDIA (photos, video, audio, archives — zip can hide photos), or a document (everything else)?
 * Spec § ★ K: "Media (photos incl. RAW, video, audio/voice notes, zip/archives) counts in the rest … classify by
 * content type, never the file name". An unknown type is media: only media waits when the plan is full, so nothing
 * unknown may slip past the limit as a document. SQL twin: `supplier_storage_is_media` — parity held by
 * tests/db/the-meter-counts-every-shop-table.db.test.ts.
 */
export function isMediaContentType(mime: string | null | undefined): boolean {
  const t = (mime ?? '').split(';')[0]!.trim().toLowerCase();
  if (!t) return true;
  if (t.startsWith('image/') || t.startsWith('video/') || t.startsWith('audio/')) return true;
  return MEDIA_ARCHIVE_TYPES.has(t);
}
const MEDIA_ARCHIVE_TYPES: ReadonlySet<string> = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/octet-stream',
]);

/** What the shop stores, split as the meter shows it. Every number is bytes. */
export type StorageBreakdown = {
  /** Photos, video, audio and archives — every copy kept. */
  photosVideo: number;
  /** Every other file: PDFs, spreadsheets, contracts, papers. */
  files: number;
  /** The shop's data: calendar, cards, quotes, bookings, clients, chat messages… as last measured. */
  records: number;
  /** Contracts and other kept papers — counted, never refused. Inside `files`. */
  evidence: number;
  /** When the records were last measured (ISO); null = never. */
  recordsMeasuredAt: string | null;
};

export type StorageBreakdownRead = { status: 'ok'; breakdown: StorageBreakdown } | { status: 'unread' };

/* ── THE NIGHTLY RECORDS MEASURE — no scheduler, a claimed window ───────────────────────────────────────────────────
 * The repo has no scheduler (cron.job stays empty): `supplier_storage_measure_records(NULL)` runs as a claimed periodic
 * job on request traffic (lib/supplier-storage-measure.server.ts). Its window is one Manila night: it opens at 03:00
 * Manila and lasts until the next 03:00. The first request after it opens runs the measure, so a quiet night catches
 * up on the next request; the claim's gap is "since this window opened", so it never runs twice in one window. */

/** The Manila hour the nightly records window opens (Asia/Manila is UTC+8, no daylight saving). */
export const RECORDS_MEASURE_HOUR_MANILA = 3;
const MANILA_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

/** When the current nightly window opened: the latest 03:00 Manila at or before `nowMs` (epoch ms). */
export function recordsMeasureWindowOpenedMs(nowMs: number): number {
  const local = nowMs + MANILA_OFFSET_MS;
  let open = Math.floor(local / DAY_MS) * DAY_MS + RECORDS_MEASURE_HOUR_MANILA * 3_600_000;
  if (local < open) open -= DAY_MS;
  return open - MANILA_OFFSET_MS;
}

/**
 * The claim's gap: the time since this window opened, in whole seconds plus one (at least a minute). The claim
 * (`claim_periodic_job`: last_run_at < now() − gap, the gap sent in whole seconds) succeeds only when the last run was
 * before this window opened. So one run per window, and the first request after 03:00 runs it however late it comes.
 */
export function recordsMeasureClaimGapMs(nowMs: number): number {
  return Math.max(60_000, Math.ceil((nowMs - recordsMeasureWindowOpenedMs(nowMs)) / 1000) * 1000 + 1000);
}

/** A measure older than this missed at least one night: the meter says so instead of passing it off as current. */
export const RECORDS_STALE_AFTER_MS = 36 * 3_600_000;

export type RecordsMeasure =
  /** Never measured: the Records size is not known, so the meter shows no number for it. */
  | { state: 'never'; words: string }
  | { state: 'fresh' | 'stale'; words: string; ageMs: number };

/** "Measured 5 hours ago" · "Last measured 3 days ago" · "Not measured yet" — how current the Records size is. */
export function recordsMeasure(measuredAt: string | null | undefined, nowMs: number): RecordsMeasure {
  const at = measuredAt ? Date.parse(measuredAt) : NaN;
  if (!Number.isFinite(at)) return { state: 'never', words: 'Not measured yet' };
  const ageMs = Math.max(0, nowMs - at);
  const ago =
    ageMs < 60_000
      ? 'just now'
      : ageMs < 3_600_000
        ? plural(Math.floor(ageMs / 60_000), 'minute')
        : ageMs < DAY_MS
          ? plural(Math.floor(ageMs / 3_600_000), 'hour')
          : plural(Math.floor(ageMs / DAY_MS), 'day');
  const stale = ageMs > RECORDS_STALE_AFTER_MS;
  return { state: stale ? 'stale' : 'fresh', words: `${stale ? 'Last measured' : 'Measured'} ${ago}`, ageMs };
}
const plural = (n: number, unit: string) => `${formatCount(n)} ${unit}${n === 1 ? '' : 's'} ago`;

/** The whole: the three kinds added. Evidence is inside Files, never added twice. */
export function storageTotal(b: StorageBreakdown): number {
  return b.photosVideo + b.files + b.records;
}

/** The three kinds the meter shows, in the drawing's order (Photos & video first, the biggest by far for most shops). */
export const STORAGE_KINDS = [
  { key: 'photosVideo', name: 'Photos & video', line: 'Albums, cards, portfolio, logo, cover and posters' },
  { key: 'files', name: 'Files', line: 'Contracts, quotes, receipts and every other paper' },
  { key: 'records', name: 'Records', line: 'Calendar, cards, quotes, bookings, clients and chats' },
] as const satisfies readonly { key: keyof StorageBreakdown; name: string; line: string }[];

/**
 * Bytes in the words the METER reads — real usage, so a new shop's few KB say KB, never "1 MB" and never "0 MB"
 * (owner 23 Nov, "No, real usage only"). 1 MB and up read as everywhere else (`storageWords`).
 */
export function meterWords(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1e6) return `${formatCount(Math.max(1, Math.round(bytes / 1e3)))} KB`;
  return storageWords(bytes);
}

/** Whole percent of the plan used, floored (99.6% is not "100%" — uploads still go in). Null = no allowance. */
export function storagePercent(plan: string | null | undefined, usedBytes: number): number | null {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null || allowance <= 0) return null;
  return Math.floor((Math.max(0, usedBytes) / allowance) * 100);
}

/** The meter's state: below 80% calm · 80% suggest moving up · 100% new uploads wait (spec § ★ F). */
export function storageLevel(percent: number | null): 'ok' | 'near' | 'full' {
  if (percent === null) return 'ok';
  if (percent >= 100) return 'full';
  if (percent >= 80) return 'near';
  return 'ok';
}

/** "1.2 GB of 128 GB used · 126.8 GB free" — or "… · no room left", or "… stored · 12 MB above your 256 MB". */
export function storageUsedLine(plan: string | null | undefined, usedBytes: number): string | null {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null) return null;
  const used = Math.max(0, usedBytes);
  if (used > allowance) return `${meterWords(used)} stored · ${meterWords(used - allowance)} above your ${storageWords(allowance)}`;
  if (used === allowance) return `${meterWords(used)} of ${storageWords(allowance)} used · no room left`;
  return `${meterWords(used)} of ${storageWords(allowance)} used · ${meterWords(allowance - used)} free`;
}

/** What a new upload is, for the gate: media or a document, and whether it is evidence (never refused). */
export type UploadKind = { media: boolean; evidence: boolean };

/**
 * May `incomingBytes` more go in? ONE number per plan (owner 23 Nov: "let us not set Room anymore?" → "Yes, drop it"):
 *   · photos and video   — everything already stored + this file must fit the plan.
 *   · a document, evidence — always fits (it still counts): chat files, quotes, contracts, receipts and payment proofs
 *                          never stop.
 * No allowance on the plan = fits.
 */
export function storageFitsUpload(
  plan: string | null | undefined,
  b: StorageBreakdown,
  incomingBytes: number,
  kind: UploadKind,
): boolean {
  if (kind.evidence || !kind.media) return true;
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null) return true;
  return storageTotal(b) + Math.max(0, incomingBytes) <= allowance;
}

/**
 * The plain reason a photo or video is refused, with the way up: what is left of the plan, and that documents and
 * messages still go through. Nothing already stored is touched.
 */
export function mediaFullMessage(plan: string | null | undefined, b: StorageBreakdown, incomingBytes: number): string {
  const allowance = storageAllowanceBytes(plan) ?? 0;
  const name = planWord(asVendorTier(plan));
  const left = Math.max(0, allowance - storageTotal(b));
  const up = storageWayUp(plan);
  const reason =
    left < 1e6
      ? `Your ${name} plan’s ${storageWords(allowance)} is full, so new photos and videos wait for room.`
      : `This file is ${meterWords(incomingBytes)}, and your ${name} plan has ${meterWords(left)} left.`;
  return `${reason} Your messages, documents, contracts and receipts still go through. Remove files to make room${up}. Nothing you stored was changed.`;
}

/**
 * 🗂 WHERE A SHOP'S UPLOADS LIVE, AND HOW EACH IS COUNTED. Every root an upload can be written under is named here or
 * in `NOT_SHOP_UPLOAD_ROOTS` with its reason — lib/the-meter-counts-every-upload-root.test.ts scans the repo and fails
 * on a root in neither, so a new shop upload path cannot ship uncounted.
 *   · `stored-copy`  — the size is on the stored copy (`supplier_media.size_bytes`), counted while an event file points
 *                      at it. Not written to the ledger (it would count twice).
 *   · `ledger`       — no other table records the size: `/api/upload` writes `supplier_stored_files` when it signs.
 *   · `chat-message` — `chat_messages.attachment_size_bytes`, counted for the shop when the shop sent it.
 *   · `contract`     — `vendor_contracts.file_size_bytes` (evidence).
 *   · `portfolio`    — `vendor_papic_portfolio_photos.size_bytes` / `vendor_papic_captures.*_bytes`.
 *   · `server-ledger`— written by the server action that stores it (handovers, mood-board suggestions, the marked
 *                      public copy of a shop photo), through `recordShopUpload`.
 */
export const SHOP_UPLOAD_ROOTS = {
  'supplier-files': 'stored-copy',
  vendors: 'ledger',
  'vendor-payment-qr': 'ledger',
  'vendor-originals': 'ledger',
  chat: 'chat-message',
  'vendor-contracts': 'contract',
  'papic-portfolio': 'portfolio',
  handovers: 'server-ledger',
  'inspiration-suggestions': 'server-ledger',
  'supplier-photo-public': 'server-ledger',
} as const;
export type ShopUploadRoot = keyof typeof SHOP_UPLOAD_ROOTS;

/**
 * Roots that are never a shop's own storage, each with its reason. A root here is uploaded by a couple, a guest, the
 * admin or Setnayan itself — it counts for whoever owns it (couples have their own meter), never for a shop.
 */
export const NOT_SHOP_UPLOAD_ROOTS: Readonly<Record<string, string>> = {
  events: 'the couple’s event (the couple’s own media meter)',
  inspiration: 'the couple’s mood board (a shop’s suggestion is its own root, counted)',
  payments: 'a buyer’s payment screenshot for an order',
  'deposit-proof': 'the couple’s proof of a first payment',
  'force-majeure': 'the couple’s dispute papers',
  'profile-photo': 'a person’s own profile photo',
  samahan: 'a group’s photo',
  papic: 'guest cameras at an event (the event’s Papic pool)',
  'merchant-qr': 'Setnayan’s own receiving QR (admin)',
  onboarding: 'Setnayan’s own background music (admin)',
  'hub-music': 'Setnayan’s own Event Hub music (admin)',
  'locked-qr-proof': 'a buyer’s proof for a locked QR order',
  taxonomy: 'Setnayan’s category art (admin)',
  refinements: 'Setnayan’s category art (admin)',
  editorial: 'the couple’s event story',
  'editorial-vendor': 'Setnayan’s editorial feature about a shop (admin)',
  'pabuya-qr': 'the couple’s gift QR',
  paperwork: 'the couple’s event paperwork',
  'payment-proof': 'the couple’s proof of a payment to a supplier',
  'payment-screenshots': 'the couple’s checkout screenshot',
  'zone-walkthroughs': 'the couple’s venue walkthrough',
};

/** The evidence buckets: verification papers and contracts are counted, never refused (spec § ★ K). */
export function isEvidenceUpload(bucketKey: string): boolean {
  return bucketKey === 'vendorVerification' || bucketKey === 'vendorContracts';
}

/** Does `/api/upload` write this vendor-root upload to the ledger? Only where no other table records its size. */
export function uploadIsLedgered(pathPrefix: string): boolean {
  const root = pathPrefix.split('/')[0] ?? '';
  return (SHOP_UPLOAD_ROOTS as Record<string, string>)[root] === 'ledger';
}

/** May this object key have a ledger row (so a delete must release it)? The `ledger` roots and the server-stored ones. */
export function keyMayBeLedgered(key: string): boolean {
  const k = key.replace(/^\/+/, '');
  const root = k.split('/')[0] ?? '';
  if ((SHOP_UPLOAD_ROOTS as Record<string, string>)[root] === 'ledger') return true;
  return root === 'handovers' || /^inspiration\/[^/]+\/suggestions\//.test(k);
}

/**
 * The meter's state in one place (the Plans page block and its tests read it): the plan's percent and its level. One
 * number per plan — no separate room for chat and documents (owner 23 Nov, "Yes, drop it").
 */
export function storageMeterState(
  plan: string | null | undefined,
  b: StorageBreakdown,
): { pct: number; level: 'ok' | 'near' | 'full' } | null {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null || allowance <= 0) return null;
  const pct = Math.floor((storageTotal(b) / allowance) * 100);
  return { pct, level: storageLevel(pct) };
}

/**
 * The plain words under the meter at 80% and 100% (spec § ★ F · K): what stops (new photos and videos only), what never
 * stops, the way up. Null = nothing to say.
 */
export function storageNotice(state: NonNullable<ReturnType<typeof storageMeterState>>): { tone: 'warn' | 'danger'; words: string } | null {
  const never = 'your messages, documents, quotes, contracts, receipts and proofs still go through';
  if (state.level === 'full') {
    return { tone: 'danger', words: `New photos and videos wait for room. Nothing has been removed, and ${never}. Move up a plan below, or remove files.` };
  }
  if (state.level === 'near') {
    return { tone: 'warn', words: `You’ve used ${state.pct}%. Move up a plan below before new photos and videos pause.` };
  }
  return null;
}
