/**
 * ☁️ "COPY THIS EVENT TO GOOGLE DRIVE" — A SUPPLIER, PER EVENT. THE PURE HALF.
 *
 * Owner, 22 Nov 2026 (corpus DECISION_LOG "COPY THIS EVENT TO GOOGLE DRIVE", SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC § H+):
 * *"they can also sync their events to Google Drive accounts per event."* REUSE of the shipped Drive copy layer
 * (`lib/drive-copy.ts` · tables `drive_copy_folders` / `drive_copy_artifacts` · `/api/oauth/drive/*` ·
 * `DriveConnectCard`), widened by ONE dimension — the shop that owns the copy (migration
 * `20271359577754_supplier_drive_copy_per_event`).
 *
 *   · WHAT ONE EVENT'S COPY HOLDS (`supplierEventCopyFiles`) — exactly what the shop stores for THAT event, and only its
 *     own rows: the files it filed (`event_supplier_files` → `supplier_media`, plus portfolio photos MAPPED here) into
 *     "Files", and its private event album (`vendor_papic_portfolio_photos`, screened, not taken down) into "Album".
 *     Links are not files and are never copied. A row of another event or another shop is dropped even if a caller
 *     handed it in — the scope is held here, not trusted to the query.
 *   · NO DUPLICATES — one Drive copy per stored object per event: the same object filed twice is ONE file
 *     (`supplierEventCopyFiles` folds it) and the shipped ledger's UNIQUE (event_id, r2_object_key) skips anything
 *     already recorded (`newCopyFiles`, the same rule `enqueueDriveCopy` applies).
 *   · NEVER COUNTED, NEVER A GATE — nothing here reads or writes a storage allowance or a plan.
 *   · HONEST — a refused read is "couldn't read", never "nothing to copy"; a copy with failures never reads as done
 *     (`copyResultWords`).
 *
 * PURE: no I/O. 🔒 lib/supplier-drive-copy.test.ts
 */
import { routes } from './routes';
/** The grant / folder provider a shop's own Drive uses (oauth_grants.provider, drive_copy_folders.drive_provider). */
export const SUPPLIER_DRIVE_PROVIDER = 'drive_supplier' as const;

export const SUPPLIER_DRIVE_ARTIFACT_TYPES = ['supplier_files', 'supplier_album'] as const;
export type SupplierDriveArtifactType = (typeof SUPPLIER_DRIVE_ARTIFACT_TYPES)[number];

/** The two subfolders under the event's folder in the shop's Drive. */
export const SUPPLIER_SUBFOLDER_NAME: Record<SupplierDriveArtifactType, string> = {
  supplier_files: 'Files',
  supplier_album: 'Album',
};

/** Where the copy action sends a press that should continue after Google's consent (`?drive_copy=start`). */
export const DRIVE_COPY_START_PARAM = 'drive_copy';

// ── What one event's copy holds ────────────────────────────────────────────────────────────────────────────────────

/** One `event_supplier_files` row as read for a copy (its stored copy joined). */
export type ShopEventFileRow = {
  file_id: string;
  event_id: string;
  vendor_profile_id: string;
  grp: string;
  file_name: string;
  mime: string | null;
  size_bytes: number | null;
  portfolio_ref: string | null;
  supplier_media: { r2_ref: string | null; mime: string | null; size_bytes: number | null } | { r2_ref: string | null; mime: string | null; size_bytes: number | null }[] | null;
};

/** One `vendor_papic_portfolio_photos` row (the shop's private album for the event). */
export type ShopAlbumRow = {
  photo_id: string;
  event_id: string;
  vendor_profile_id: string;
  r2_object_key: string;
  hidden_at: string | null;
  nsfw_checked: boolean | null;
  created_at: string;
};

export type SupplierCopyFile = {
  /** The stored object, exactly as the shop's row holds it — the ledger's dedupe key. */
  r2ObjectKey: string;
  fileName: string;
  mimeType?: string;
  sizeBytes: number | null;
  sourceTable: 'event_supplier_files' | 'vendor_papic_portfolio_photos';
  sourceRef: string;
  artifactType: SupplierDriveArtifactType;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** The last path segment of a key, for a file name when the row has none of its own. */
function baseName(key: string): string {
  const tail = key.split('/').pop() ?? '';
  return tail.trim() || 'file';
}

/**
 * The files one shop's copy of ONE event holds, de-duplicated by stored object. Rows of any other event or shop are
 * dropped (the per-event scope), links and rows with no stored object are skipped, an album photo still unscreened or
 * taken down is never copied.
 */
export function supplierEventCopyFiles(input: {
  shopId: string;
  eventId: string;
  files: readonly ShopEventFileRow[];
  album: readonly ShopAlbumRow[];
}): SupplierCopyFile[] {
  const out: SupplierCopyFile[] = [];
  const seen = new Set<string>();
  const push = (f: SupplierCopyFile) => {
    if (seen.has(f.r2ObjectKey)) return;
    seen.add(f.r2ObjectKey);
    out.push(f);
  };
  for (const r of input.files) {
    if (r.event_id !== input.eventId || r.vendor_profile_id !== input.shopId) continue;
    if (r.grp === 'links') continue;
    const media = one(r.supplier_media);
    const ref = media?.r2_ref ?? r.portfolio_ref ?? null;
    if (!ref) continue;
    push({
      r2ObjectKey: ref,
      fileName: r.file_name?.trim() || baseName(ref),
      mimeType: media?.mime ?? r.mime ?? undefined,
      sizeBytes: media?.size_bytes ?? r.size_bytes ?? null,
      sourceTable: 'event_supplier_files',
      sourceRef: r.file_id,
      artifactType: 'supplier_files',
    });
  }
  for (const a of input.album) {
    if (a.event_id !== input.eventId || a.vendor_profile_id !== input.shopId) continue;
    if (a.hidden_at || a.nsfw_checked !== true) continue;
    push({
      r2ObjectKey: a.r2_object_key,
      fileName: baseName(a.r2_object_key),
      mimeType: a.r2_object_key.toLowerCase().endsWith('.mp4') ? 'video/mp4' : a.r2_object_key.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'image/jpeg',
      sizeBytes: null,
      sourceTable: 'vendor_papic_portfolio_photos',
      sourceRef: a.photo_id,
      artifactType: 'supplier_album',
    });
  }
  return out;
}

/** The no-duplicate rule: only files the ledger has not recorded for this event yet (same key = same Drive copy). */
export function newCopyFiles<F extends { r2ObjectKey: string }>(files: readonly F[], recordedKeys: ReadonlySet<string>): F[] {
  return files.filter((f) => !recordedKeys.has(f.r2ObjectKey));
}

/**
 * Which bucket a shop's stored object is read from. An `r2://<bucket>/<path>` ref names its bucket (a shop's filed
 * files live in thread-files); a bare key is the media bucket (the album). A ref naming a bucket that is not ours is
 * refused (null) — never read from a guessed place. The bucket list is handed in (`R2_BUCKETS`, lib/r2.ts) so this
 * file stays free of the storage client.
 */
export function bucketOfStoredRef(ref: string, ours: { all: readonly string[]; media: string }): string | null {
  const m = /^r2:\/\/([^/]+)\//.exec(ref);
  if (!m) return ours.media;
  return ours.all.includes(m[1]!) ? m[1]! : null;
}

// ── The shop's Drive and one press of "Copy to Google Drive" ──────────────────────────────────────────────────────

export type ShopDriveState =
  | { status: 'unread' }
  /** Setnayan's Google app is not set up yet — the shipped "Drive setup pending" card says so. */
  | { status: 'not_configured' }
  | { status: 'not_connected' }
  | { status: 'needs_reconnect'; account: string | null }
  | { status: 'connected'; account: string | null };

export type CopyRunResult =
  | { ok: true; status: 'nothing_to_copy' }
  | {
      ok: true;
      /** `copying` = this press ran out of time with files still to go; the caller presses on. */
      status: 'copying' | 'done' | 'some_failed';
      /** The start of this copy (server clock) — the next press sends it back, so a failed file is not retried. */
      since: string;
      total: number;
      copied: number;
      failed: number;
      remaining: number;
    }
  | { ok: false; reason: 'unread' | 'not_connected' | 'needs_reconnect' | 'not_configured' | 'error' };

/** Turn one press's counts into its status — a failure is never "done", files still to go are never "done". */
export function copyStatusOf(c: { total: number; copied: number; failed: number; remaining: number }): 'copying' | 'done' | 'some_failed' {
  if (c.remaining > 0) return 'copying';
  if (c.failed > 0 || c.copied < c.total) return 'some_failed';
  return 'done';
}

const n = (x: number, one: string, many: string) => `${x.toLocaleString('en-PH')} ${x === 1 ? one : many}`;
const num = (x: number) => x.toLocaleString('en-PH');

/**
 * The tone of a line, which is also its mark: `ok` = CloudCheck in --color-ok · `warn` = TriangleAlert in --color-warn
 * · `bad` = TriangleAlert in --color-danger · `note` = quiet slate, no mark (colour never carries the meaning alone —
 * the words do). Design: Fable, `drive_copy_design_2026-11-22_fable.html`.
 */
export type LineTone = 'ok' | 'warn' | 'bad' | 'note';

/** The one line a supplier reads for a press. Never "done" with failures; never "nothing to copy" on a refused read. */
export function copyResultWords(r: CopyRunResult): { tone: LineTone; words: string } {
  if (!r.ok) {
    switch (r.reason) {
      case 'unread':
        return { tone: 'bad', words: 'Couldn’t read this event’s files. Nothing was copied.' };
      case 'not_connected':
        return { tone: 'note', words: 'Not connected' };
      case 'needs_reconnect':
        return { tone: 'warn', words: 'Paused by Google. Reconnect to go on.' };
      case 'not_configured':
        return { tone: 'note', words: 'Being set up by Setnayan. Your files are safe here.' };
      default:
        return { tone: 'bad', words: 'The copy stopped. Nothing is lost.' };
    }
  }
  if (r.status === 'nothing_to_copy') return { tone: 'note', words: 'No files of yours on this event yet.' };
  if (r.status === 'copying') return { tone: 'note', words: `Copying… ${num(r.copied)} of ${n(r.total, 'file', 'files')}` };
  if (r.status === 'some_failed') {
    return {
      tone: 'bad',
      words: `${num(r.copied)} of ${num(r.total)} copied · ${num(Math.max(r.failed, r.total - r.copied))} couldn’t be copied`,
    };
  }
  return { tone: 'ok', words: `All ${n(r.total, 'file', 'files')} copied` };
}

/** The toast for a copy that finished with every file in the Drive. */
export function copyDoneToast(total: number): string {
  return `${n(total, 'file', 'files')} copied to Google Drive`;
}

/**
 * The quiet line before a press: how much of this event the shop's Drive holds (from the copy ledger, which only knows
 * an event's files once it has been copied once). Null = the ledger read was refused — said, never drawn as "none".
 */
export function copiedSoFarLine(p: { total: number; copied: number } | null): { tone: LineTone; words: string } {
  if (!p) return { tone: 'note', words: 'Couldn’t read what’s copied' };
  if (p.total === 0) return { tone: 'note', words: 'Not copied yet' };
  if (p.copied >= p.total) return { tone: 'ok', words: `All ${n(p.copied, 'file', 'files')} copied` };
  return { tone: 'note', words: `${num(p.copied)} of ${n(p.total, 'file', 'files')} copied` };
}

// ── The OAuth round trip (`/api/oauth/drive/{start,callback,disconnect}?for=shop`) ────────────────────────────────

/** The short-lived cookie that carries the page to come back to across Google's consent screen. */
export const SHOP_DRIVE_BACK_COOKIE = 'sn_shop_drive_back';

/**
 * Where a supplier comes back to after connecting or disconnecting: a path inside the supplier console only (never
 * another site, never a protocol-relative `//host`), else the event's client page on Files.
 */
export function shopDriveBackPath(raw: string | null | undefined, eventId: string | null): string {
  const home = routes.vendorDashboard.index();
  const fallback = eventId ? `${routes.vendorDashboard.clients.detail(eventId)}?tab=files` : home;
  if (typeof raw !== 'string') return fallback;
  const v = raw.trim();
  if (!(v === home || v.startsWith(`${home}/`) || v.startsWith(`${home}?`)) || v.startsWith('//') || v.includes('\\') || /[\r\n]/.test(v)) return fallback;
  if (v.length > 300) return fallback;
  return v;
}

/** Add one query parameter to a same-site path, keeping its hash at the end. */
export function withParam(path: string, key: string, value: string): string {
  const [beforeHash, hash] = path.split('#', 2) as [string, string | undefined];
  const sep = beforeHash.includes('?') ? '&' : '?';
  return `${beforeHash}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash !== undefined ? `#${hash}` : ''}`;
}
