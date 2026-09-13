/**
 * chat-shared-files.ts — ONE list of every file that passed between a supplier
 * and a couple, whatever door it came through.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The supplier's customer card has a Files tab. Until now it listed contracts
 * the supplier uploaded and handover deliverables the supplier sent — and NOT
 * the files the couple actually sent them in the conversation. A supplier
 * hunting for the contract a couple attached last week could not find it there,
 * and the tab gave no hint it was looking in the wrong place; its empty state
 * cheerfully said "share other files in your chat", which is precisely where
 * the missing files already were.
 *
 * The tab's own comment explained why, and the reason had expired:
 *
 *   "(a light 'files shared' view alongside contracts, since 0019 thread
 *    attachments are deferred in V1 — there is no thread-attachments table to
 *    read)"
 *
 * Thread attachments shipped. `chat_messages` carries `attachment_name`,
 * `attachment_mime`, `attachment_size_bytes` and the stored reference. So the
 * three sources merge here, newest first, each row saying what it is and who
 * sent it.
 *
 * ── WHY IT IS A PURE MODULE AND NOT A COMPONENT ─────────────────────────────
 * No React, no I/O: it takes rows and returns rows. That makes the ordering,
 * the attribution and — most importantly — the LINK decision testable without
 * rendering anything, and it means a second surface that ever needs this list
 * cannot invent a second wording for it.
 *
 * ── 🔒 THE ONE RULE THAT MATTERS: WHERE A CHAT FILE IS FETCHED FROM ─────────
 * `chatAttachmentHref` is the ONLY place in this repo that turns a chat message
 * into a link to its file. Callers pass a row and render what comes back; no
 * caller may reach into `attachment_url` (or any future stored reference) and
 * build a URL of its own. That is not style — a raw stored key in an <img>
 * renders a broken glyph, and a stored public URL is a file handed to anyone
 * who has the string, with no check that the reader is still a party to the
 * thread.
 *
 * ✅ RESOLVED 2026-09-09. PR #5339 landed: `chat_messages.attachment_r2_key`
 * holds a PRIVATE stored ref, `attachment_url` is legacy with no writer, and
 * `/api/chat/attachment/<message_id>` re-proves thread membership on every
 * request before redirecting to a short-lived signed GET. This function now
 * returns that route, which is exactly the migration its previous note
 * promised — and because every caller goes through here, the supplier's Files
 * tab and the conversation's Files view both moved without being touched.
 *
 * ⚠ #5339 shipped the route and the column but did NOT update this function,
 * so between that merge and this change `chatAttachmentHref` returned
 * `attachment_url` — now always NULL — and every file listed as unopenable.
 */

/**
 * Which door a file came through. Drives the icon, not the ordering.
 *
 * ⚠ `gallery_link` IS ITS OWN KIND rather than a handover with a particular
 * label, because the render picks an icon from this field. Deciding "is this a
 * link?" by comparing a human-readable label string would be a proxy for the
 * real fact, and the label is the first thing anyone changes.
 */
export type SharedFileKind = 'contract' | 'handover' | 'gallery_link' | 'chat';

/** A contract row as the customer card already selects it. */
export type ContractFileInput = {
  contract_id: string;
  title: string | null;
  file_name: string | null;
  file_url: string | null;
  status: string;
  created_at: string;
};

/** A handover deliverable that carries a file or a gallery link. */
export type HandoverFileInput = {
  handover_id: string;
  kind: 'gallery_link' | 'file' | 'note' | 'signoff';
  label: string | null;
  payload: string | null;
  delivered_at: string;
};

/**
 * A `chat_messages` row that carries an attachment.
 *
 * `attachment_url` is optional because a checkout without the private-storage
 * migration and one with it disagree about which column holds the reference —
 * see the docblock. Everything else has been on the table since 2026-07-13.
 */
export type ChatFileInput = {
  message_id: string;
  sender_role: 'couple' | 'vendor' | 'coordinator' | 'system';
  created_at: string;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size_bytes: number | null;
  /**
   * The private stored-asset ref (`r2://…`), written since 2026-09-09. Optional
   * only so a checkout without migration `20271215223903` still type-checks.
   */
  attachment_r2_key?: string | null;
  /** LEGACY public URL. Nothing writes it; kept so old rows keep a reference. */
  attachment_url?: string | null;
};

/** One row of the Files tab, ready to render. */
export type SharedFileEntry = {
  /** React key. Unique across all three sources by construction. */
  key: string;
  kind: SharedFileKind;
  /** What the file is called. Never blank — falls back to a kind noun. */
  name: string;
  /** Who put it there, in the supplier's own second person: "You shared". */
  origin: string;
  /** "2.4 MB", or null when the size was never recorded. */
  sizeLabel: string | null;
  /** "PDF" · "Image" · "Gallery link", or null when nothing is known. */
  typeLabel: string | null;
  /** ISO timestamp the row is sorted and dated by. */
  at: string;
  /** Where the file opens — null when there is nothing to open. */
  href: string | null;
  isImage: boolean;
};

/**
 * 🔒 THE ONE PLACE A CHAT FILE BECOMES A LINK. See the file docblock before
 * changing this, and change it here rather than at any call site.
 */
export function chatAttachmentHref(row: ChatFileInput): string | null {
  // Nothing here is a stored reference and nothing is public. The route proves
  // the caller is still a party to this thread on EVERY request and then
  // redirects to a short-lived signed GET.
  //
  // Both columns are checked because they answer the same question — "is there
  // a file on this message?" — and only differ in era: `attachment_r2_key` is
  // what writers set since 2026-09-09, `attachment_url` is the legacy public
  // URL that nothing writes any more. A legacy row is still fetched THROUGH
  // the route, never by handing its old public URL back out.
  if (!row.attachment_r2_key && !row.attachment_url) return null;
  return `/api/chat/attachment/${row.message_id}`;
}

/**
 * Bytes as a person reads them. Mirrors the in-bubble `formatBytes` in
 * `chat-message-stream.tsx` so the same file does not get two different sizes
 * on two screens; that copy stays where it is only because PR #5339 is editing
 * the same lines and a conflict there would block both changes.
 */
export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/**
 * A short type word. Prefers the MIME (which the uploader recorded) and falls
 * back to the file extension, because a row whose MIME was never captured still
 * usually has a name ending in `.pdf`.
 */
export function describeFileType(
  mime: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const m = (mime ?? '').trim().toLowerCase();
  if (m.startsWith('image/')) return 'Image';
  if (m === 'application/pdf') return 'PDF';
  if (m.startsWith('video/')) return 'Video';
  if (m.startsWith('audio/')) return 'Audio';
  if (m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv') return 'Spreadsheet';
  if (m.includes('word') || m.includes('document')) return 'Document';
  const ext = (name ?? '').trim().toLowerCase().split('.').pop();
  if (!ext || ext === (name ?? '').trim().toLowerCase()) return null;
  return ext.slice(0, 5).toUpperCase();
}

function isImageFile(mime: string | null | undefined, name: string | null | undefined): boolean {
  if ((mime ?? '').trim().toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif|heic|heif)$/i.test((name ?? '').trim());
}

/**
 * Who sent it, said to the supplier.
 *
 * ⚠ 'coordinator' and 'system' are real values of `sender_role` and neither is
 * the couple. Collapsing them into "they" would put a message the platform sent
 * into the couple's mouth, so each keeps its own words.
 */
function chatOrigin(role: ChatFileInput['sender_role'], coupleLabel: string): string {
  if (role === 'vendor') return 'You shared';
  if (role === 'couple') return `${coupleLabel} shared`;
  if (role === 'coordinator') return 'Their coordinator shared';
  return 'Shared in the conversation';
}

/**
 * Merge the three sources into one newest-first list.
 *
 * ⚠ NEWEST FIRST ACROSS ALL THREE, not three stacked groups. The supplier is
 * looking for the thing that happened recently and does not know which door it
 * came through — that is the entire complaint this list answers.
 */
export function buildSharedFiles(input: {
  contracts: readonly ContractFileInput[];
  handovers: readonly HandoverFileInput[];
  chatFiles: readonly ChatFileInput[];
  /** How the couple is named on this card, e.g. "Ana & Leo". */
  coupleLabel: string;
}): SharedFileEntry[] {
  const { contracts, handovers, chatFiles, coupleLabel } = input;

  const rows: SharedFileEntry[] = [];

  for (const c of contracts) {
    rows.push({
      key: `contract:${c.contract_id}`,
      kind: 'contract',
      name: c.file_name ?? c.title ?? 'Contract.pdf',
      origin: `Contract · ${c.status.replace(/_/g, ' ')}`,
      sizeLabel: null,
      typeLabel: describeFileType(null, c.file_name),
      at: c.created_at,
      href: c.file_url ?? null,
      isImage: false,
    });
  }

  for (const h of handovers) {
    // Only the two kinds that actually carry something to open. A 'note' or a
    // 'signoff' is a sentence, not a file, and listing it here would make the
    // count wrong for anyone counting files.
    if (h.kind !== 'file' && h.kind !== 'gallery_link') continue;
    if (!h.payload) continue;
    rows.push({
      key: `handover:${h.handover_id}`,
      kind: h.kind === 'gallery_link' ? 'gallery_link' : 'handover',
      name: h.label ?? (h.kind === 'gallery_link' ? 'Gallery link' : 'Sample / proof'),
      origin: 'You shared',
      sizeLabel: null,
      typeLabel: h.kind === 'gallery_link' ? 'Gallery link' : null,
      at: h.delivered_at,
      href: h.payload,
      isImage: false,
    });
  }

  for (const m of chatFiles) {
    // A row reaches this loop only because it carries attachment metadata; a
    // reference we cannot resolve still gets listed, with no link, because
    // "this file exists and you cannot open it" is a truer thing to show a
    // supplier than silence.
    const name = m.attachment_name?.trim() || (isImageFile(m.attachment_mime, null) ? 'Image' : 'Attachment');
    rows.push({
      key: `chat:${m.message_id}`,
      kind: 'chat',
      name,
      origin: chatOrigin(m.sender_role, coupleLabel),
      sizeLabel: formatFileSize(m.attachment_size_bytes),
      typeLabel: describeFileType(m.attachment_mime, m.attachment_name),
      at: m.created_at,
      href: chatAttachmentHref(m),
      isImage: isImageFile(m.attachment_mime, m.attachment_name),
    });
  }

  rows.sort((a, b) => {
    const ta = Date.parse(a.at);
    const tb = Date.parse(b.at);
    // An unparseable timestamp sorts last rather than throwing the whole list
    // into an arbitrary order around it.
    const sa = Number.isNaN(ta) ? -Infinity : ta;
    const sb = Number.isNaN(tb) ? -Infinity : tb;
    if (sa !== sb) return sb - sa;
    return a.key.localeCompare(b.key);
  });

  return rows;
}
