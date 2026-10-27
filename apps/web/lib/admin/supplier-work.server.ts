import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { R2_BUCKETS, r2SignedGet } from '@/lib/r2';
import { contentDispositionAttachment } from '@/lib/content-disposition';
import { resolveDocumentLocation } from '@/lib/verification-checks';
import { buildVerificationChecksForVendors, r2KeysInSlot } from '@/lib/verification-checks-server';
import { DOC_SLOTS, type DocUpload } from '@/lib/vendor-verification';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { formatCount } from '@/lib/format-number';
import {
  coverageByGroup,
  matchPercent,
  orderSupplierWork,
  shopAddress,
  type SupplierWorkItem,
  type SupplierWorkKind,
  type SupplierWorkRead,
} from './supplier-work';

/**
 * supplier-work.server.ts — the READ behind Admin › Work's supplier section (rules in `./supplier-work.ts`).
 *
 * Called ONLY after requireAdmin(): every read here is the service client. Each kind is its own read, and a refused
 * read lands in `failed` — the section then SAYS "couldn't read" for that kind instead of drawing it as empty (the
 * repo's one disease: a failure that renders identically to emptiness). A store that is not in this database yet
 * (`event_type_requests` before PR #7001 merges) lands in `absent`, which is said differently again.
 *
 * Same filters as the queues the old rows counted (`verify` = pending_review/in_review; corrections = open), so the
 * supplier section and the queue rows below it can never disagree about what is waiting.
 */

const LIMIT = 40;
const IMAGE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

type Admin = ReturnType<typeof createAdminClient>;

/** PostgREST / Postgres "that table is not here" — the store has not shipped to this database. */
function isMissingTable(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function shopNames(admin: Admin, ids: readonly string[]): Promise<Map<string, { name: string; slug: string | null; verified: boolean }>> {
  const out = new Map<string, { name: string; slug: string | null; verified: boolean }>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return out;
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug, public_visibility')
    .in('vendor_profile_id', uniq);
  if (error) logQueryError('supplierWork.shopNames', error, {}, 'graceful_degrade');
  for (const r of (data ?? []) as Array<{
    vendor_profile_id: string;
    business_name: string | null;
    business_slug: string | null;
    public_visibility: string | null;
  }>) {
    out.set(r.vendor_profile_id, {
      name: r.business_name?.trim() || 'A supplier',
      slug: r.business_slug,
      verified: r.public_visibility === 'verified',
    });
  }
  return out;
}

/**
 * A short-lived look at one verification paper — same two refusals as `openApplicationDocument`: the bucket comes out
 * of the stored ref (never a constant), and a file filed under ANOTHER shop is never handed over. Images only; a PDF
 * is opened with the verify desk's own Open button.
 */
async function previewUrl(ref: string, vendorProfileId: string): Promise<string | null> {
  const where = resolveDocumentLocation(ref, Object.values(R2_BUCKETS), R2_BUCKETS.vendorVerification);
  if (where.kind !== 'r2' || !IMAGE.test(where.key)) return null;
  const owner = /^vendors\/([^/]+)\//.exec(where.key)?.[1] ?? null;
  if (owner !== null && owner !== vendorProfileId) return null;
  try {
    return await r2SignedGet({
      bucket: where.bucket as (typeof R2_BUCKETS)[keyof typeof R2_BUCKETS],
      key: where.key,
      expiresIn: 600,
      responseContentDisposition: contentDispositionAttachment(where.key.split('/').pop() || 'document'),
    });
  } catch {
    return null;
  }
}

async function readDocs(admin: Admin): Promise<SupplierWorkItem[] | 'failed'> {
  const { data, error } = await admin
    .from('vendor_verification_applications')
    .select('application_id, vendor_profile_id, status, decision, doc_uploads, submitted_at, created_at, updated_at')
    .in('status', ['pending_review', 'in_review'])
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(LIMIT);
  if (error) {
    logQueryError('supplierWork.docs', error, {}, 'graceful_degrade');
    return 'failed';
  }
  const rows = (data ?? []) as Array<{
    application_id: string;
    vendor_profile_id: string;
    status: string;
    decision: string | null;
    doc_uploads: Record<string, DocUpload> | null;
    submitted_at: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  const shops = await shopNames(admin, rows.map((r) => r.vendor_profile_id));
  const checks = await buildVerificationChecksForVendors(rows.map((r) => r.vendor_profile_id)).catch(() => ({}) as Record<string, never>);
  return Promise.all(
    rows.map(async (r): Promise<SupplierWorkItem> => {
      const uploads = r.doc_uploads ?? {};
      const papers = await Promise.all(
        DOC_SLOTS.filter((s) => s.kind === 'upload').map(async (s) => {
          const keys = r2KeysInSlot(uploads[s.key] ?? null);
          const first = keys[0] ?? null;
          return {
            slot: s.key,
            label: s.label,
            present: keys.length > 0,
            r2Key: first,
            previewUrl: first ? await previewUrl(first, r.vendor_profile_id) : null,
          };
        }),
      );
      const report = (checks as Record<string, { results: Array<{ label: string; outcome: 'pass' | 'mismatch' | 'manual'; detail: string }> }>)[
        r.vendor_profile_id
      ];
      const shop = shops.get(r.vendor_profile_id)?.name ?? 'A supplier';
      const inCount = papers.filter((p) => p.present).length;
      return {
        key: `docs:${r.application_id}`,
        kind: 'docs',
        title: `Documents · ${shop}`,
        line: `${formatCount(inCount)} of ${formatCount(papers.length)} papers in${r.status === 'in_review' ? ' · being checked' : ' · new'}`,
        at: r.submitted_at ?? r.created_at,
        applicationId: r.application_id,
        shopName: shop,
        papers,
        checks: (report?.results ?? []).slice(0, 6).map((c) => ({ label: c.label, outcome: c.outcome, detail: c.detail ?? null })),
      };
    }),
  );
}

async function readNames(admin: Admin): Promise<SupplierWorkItem[] | 'failed'> {
  const { data, error } = await admin
    .from('vendor_correction_requests')
    .select('id, vendor_profile_id, field_key, current_value, requested_value, note, created_at')
    .eq('status', 'open')
    .in('field_key', ['business_name', 'business_slug'])
    .order('created_at', { ascending: true })
    .limit(LIMIT);
  if (error) {
    logQueryError('supplierWork.names', error, {}, 'graceful_degrade');
    return 'failed';
  }
  const rows = (data ?? []) as Array<{
    id: number;
    vendor_profile_id: string;
    field_key: 'business_name' | 'business_slug';
    current_value: string | null;
    requested_value: string | null;
    note: string | null;
    created_at: string;
  }>;
  const shops = await shopNames(admin, rows.map((r) => r.vendor_profile_id));
  return rows.map((r) => {
    const shop = shops.get(r.vendor_profile_id)?.name ?? 'A supplier';
    const isSlug = r.field_key === 'business_slug';
    return {
      key: `names:${r.id}`,
      kind: 'names' as const,
      title: `${isSlug ? 'Address change' : 'Name change'} · ${shop}`,
      line: isSlug
        ? `${shopAddress(r.current_value)} → /${r.requested_value ?? ''}`
        : `→ “${r.requested_value ?? ''}”${r.note ? ` · “${r.note}”` : ''}`,
      at: r.created_at,
      requestId: String(r.id),
      field: r.field_key,
      shopName: shop,
      current: r.current_value,
      requested: r.requested_value,
      note: r.note,
    };
  });
}

async function readCards(admin: Admin): Promise<SupplierWorkItem[] | 'failed'> {
  const { data, error } = await admin
    .from('vendor_image_flags')
    .select('id, flagged_vendor_id, flagged_r2_ref, flagged_surface, source_vendor_id, source_r2_ref, hamming_distance, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(LIMIT);
  if (error) {
    logQueryError('supplierWork.cards', error, {}, 'graceful_degrade');
    return 'failed';
  }
  const rows = (data ?? []) as Array<{
    id: number;
    flagged_vendor_id: string;
    flagged_r2_ref: string;
    flagged_surface: string;
    source_vendor_id: string;
    source_r2_ref: string;
    hamming_distance: number;
    created_at: string;
  }>;
  const shops = await shopNames(admin, rows.flatMap((r) => [r.flagged_vendor_id, r.source_vendor_id]));
  return Promise.all(
    rows.map(async (r) => {
      const shop = shops.get(r.flagged_vendor_id);
      const pct = matchPercent(r.hamming_distance);
      return {
        key: `cards:${r.id}`,
        kind: 'cards' as const,
        title: `Flagged card · ${shop?.name ?? 'A supplier'}`,
        line: `Photo matches another shop’s ${r.flagged_surface === 'portfolio' ? 'portfolio' : 'service card'} (repost watch · ${pct}%)`,
        at: r.created_at,
        flagId: String(r.id),
        shopName: shop?.name ?? 'A supplier',
        matchShopName: shops.get(r.source_vendor_id)?.name ?? 'another shop',
        flaggedUrl: await displayUrlForStoredAsset(r.flagged_r2_ref).catch(() => null),
        sourceUrl: await displayUrlForStoredAsset(r.source_r2_ref).catch(() => null),
        matchPct: pct,
        unverifiedShop: shop ? !shop.verified : false,
      };
    }),
  );
}

async function readTypes(admin: Admin): Promise<SupplierWorkItem[] | 'failed' | 'absent'> {
  // ⚠ Built against PR #7001's schema (migration 20271294233183 · `event_type_requests`). Before it merges this
  // table is not in the database and the kind reads as `absent` — said, never drawn as "no asks".
  const { data, error } = await admin
    .from('event_type_requests')
    .select('request_id, requested_by, label, status, event_type, created_at')
    .in('status', ['pending', 'linked'])
    .order('created_at', { ascending: true })
    .limit(LIMIT);
  if (error) {
    if (isMissingTable(error)) return 'absent';
    logQueryError('supplierWork.types', error, {}, 'graceful_degrade');
    return 'failed';
  }
  const rows = (data ?? []) as Array<{
    request_id: string;
    requested_by: string;
    label: string;
    status: 'pending' | 'linked';
    event_type: string | null;
    created_at: string;
  }>;
  // The coverage of every type an ask is linked to — one read of groups + categories, only when one is linked.
  let groups: Array<{ id: string; label: string }> | null = null;
  let tiles: Array<{ parent_id: string | null; applicable_event_types: string[] | null }> | null = null;
  if (rows.some((r) => r.status === 'linked' && r.event_type)) {
    const [g, t] = await Promise.all([
      admin.from('service_categories').select('id, label_en, sort_order').eq('tier', 1).eq('status', 'active').order('sort_order'),
      admin.from('service_categories').select('parent_id, applicable_event_types').eq('tier', 2).eq('status', 'active'),
    ]);
    if (g.error || t.error) logQueryError('supplierWork.types.coverage', (g.error ?? t.error)!, {}, 'graceful_degrade');
    else {
      groups = ((g.data ?? []) as Array<{ id: string; label_en: string }>).map((x) => ({ id: x.id, label: x.label_en }));
      tiles = (t.data ?? []) as Array<{ parent_id: string | null; applicable_event_types: string[] | null }>;
    }
  }
  const names = new Map<string, string>();
  const ids = [...new Set(rows.map((r) => r.requested_by))];
  if (ids.length > 0) {
    const { data: people, error: pErr } = await admin.from('users').select('user_id, display_name').in('user_id', ids);
    if (pErr) logQueryError('supplierWork.types.names', pErr, {}, 'graceful_degrade');
    for (const p of (people ?? []) as Array<{ user_id: string; display_name: string | null }>) {
      if (p.display_name?.trim()) names.set(p.user_id, p.display_name.trim());
    }
  }
  return rows.map((r) => ({
    key: `types:${r.request_id}`,
    kind: 'types' as const,
    title: `Event type request · “${r.label}”`,
    line: `From ${names.get(r.requested_by) ?? 'a host'}${r.status === 'linked' ? ' · added, not in the picker yet' : ''}`,
    at: r.created_at,
    requestId: r.request_id,
    label: r.label,
    status: r.status,
    eventType: r.event_type,
    askedBy: names.get(r.requested_by) ?? 'a host',
    coverage: r.status === 'linked' && r.event_type && groups && tiles ? coverageByGroup(r.event_type, groups, tiles) : null,
  }));
}

async function readMsgs(admin: Admin): Promise<SupplierWorkItem[] | 'failed'> {
  const { data, error } = await admin
    .from('help_messages')
    .select('message_id, user_id, sender_name, subject, body, admin_notes, created_at')
    .in('status', ['new', 'in_progress'])
    // A supplier's message: the tier is stamped at submission for shop owners only.
    .not('submitter_vendor_tier', 'is', null)
    .order('created_at', { ascending: true })
    .limit(LIMIT);
  if (error) {
    logQueryError('supplierWork.msgs', error, {}, 'graceful_degrade');
    return 'failed';
  }
  const rows = (data ?? []) as Array<{
    message_id: string;
    user_id: string | null;
    sender_name: string | null;
    subject: string;
    body: string;
    admin_notes: string | null;
    created_at: string;
  }>;
  const owners = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)))];
  const shopByOwner = new Map<string, string>();
  if (owners.length > 0) {
    const { data: shops, error: sErr } = await admin.from('vendor_profiles').select('user_id, business_name').in('user_id', owners);
    if (sErr) logQueryError('supplierWork.msgs.shops', sErr, {}, 'graceful_degrade');
    for (const s of (shops ?? []) as Array<{ user_id: string; business_name: string | null }>) {
      if (s.business_name?.trim() && !shopByOwner.has(s.user_id)) shopByOwner.set(s.user_id, s.business_name.trim());
    }
  }
  return rows.map((r) => {
    const shop = (r.user_id && shopByOwner.get(r.user_id)) || r.sender_name?.trim() || 'A supplier';
    return {
      key: `msgs:${r.message_id}`,
      kind: 'msgs' as const,
      title: `Message from ${shop}`,
      line: `“${(r.body || r.subject).replace(/\s+/g, ' ').slice(0, 90)}”`,
      at: r.created_at,
      messageId: r.message_id,
      shopName: shop,
      subject: r.subject,
      body: r.body,
      reply: r.admin_notes,
    };
  });
}

/** Everything a supplier sent that waits on us, oldest first, with each kind's read honestly accounted for. */
export async function loadSupplierWork(): Promise<SupplierWorkRead> {
  const admin = createAdminClient();
  const failed: SupplierWorkKind[] = [];
  const absent: SupplierWorkKind[] = [];
  const settle = async (kind: SupplierWorkKind, run: () => Promise<SupplierWorkItem[] | 'failed' | 'absent'>) => {
    try {
      const r = await run();
      if (r === 'failed') failed.push(kind);
      else if (r === 'absent') absent.push(kind);
      else return r;
    } catch (e) {
      logQueryError(`supplierWork.${kind}`, e as { message: string }, {}, 'graceful_degrade');
      failed.push(kind);
    }
    return [] as SupplierWorkItem[];
  };
  const parts = await Promise.all([
    settle('docs', () => readDocs(admin)),
    settle('names', () => readNames(admin)),
    settle('cards', () => readCards(admin)),
    settle('types', () => readTypes(admin)),
    settle('msgs', () => readMsgs(admin)),
  ]);
  return { items: orderSupplierWork(parts.flat()), failed, absent };
}
