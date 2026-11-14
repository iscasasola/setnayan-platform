import { FieldPick } from '@/app/admin/_components/field-pick';
import { ActionButton } from '@/components/action-button';
/**
 * JournalSpotlightsSurface — the Editorial & Journal Spotlights body, re-homed
 * byte-identical from app/admin/journal-spotlights/page.tsx into the tabbed
 * /admin/studio studio (Studio Studio slice 3 · Marketing lane).
 *
 * Attaches a vendor to a FILE-BASED Journal article (apps/web/lib/blog.ts) via a
 * DB overlay row (public.journal_vendor_spotlights, joined by blog_slug). The
 * Journal itself is NOT migrated to a CMS — this only manages the vendor-credit
 * overlay.
 *
 * Three placements:
 *   • featured_partner / recommended — FREE. Single-admin publish.
 *   • sponsored — PAID. Two-admin ("four-eyes") approval (0023 §9.1) AND an
 *     unambiguous "Sponsored" badge on the public page (0038 rule). The slot
 *     price is admin-managed in service_catalog (never hardcoded); the seed
 *     ships is_active=FALSE, so selling sponsored placements awaits owner
 *     sign-off — surfaced as a banner here.
 *
 * Two mechanical changes vs the legacy page:
 *   1. It accepts the surface's own searchParams (ok, error) as props from the
 *      /admin/studio shell instead of awaiting them itself.
 *   2. The outer max-w-5xl container is dropped (the studio shell provides
 *      layout). The attachSpotlight / approveFreeSpotlight / initiateSponsored /
 *      confirmSponsored / removeSpotlight server actions still redirect back to
 *      /admin/journal-spotlights?ok=… / ?error= (which now redirects in) so their
 *      banners surface on the Journal Spotlights tab — no action rewrite needed.
 *
 * Auth: the /admin layout already 404s non-admins; the server actions re-check.
 * The admin read uses the service-role client so DRAFT rows (hidden from the
 * public by RLS) are visible in the queue.
 */

import { BookOpen, Check, FilePlus, Info, Megaphone, ShieldCheck, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ALL_BLOG_ARTICLES, findBlogArticle } from '@/lib/blog';
import {
  fetchAllSpotlightsForAdmin,
  fetchSponsoredSlotPrice,
  formatCentavos,
  PLACEMENT_LABELS,
  type JournalSpotlightAdminRow,
} from '@/lib/journal-spotlights';
import {
  attachSpotlight,
  approveFreeSpotlight,
  initiateSponsored,
  confirmSponsored,
  removeSpotlight,
} from '@/app/admin/journal-spotlights/actions';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { PageMasthead } from '@/app/_components/page-masthead';

type PendingApproval = { approval_id: string; target_id: string; initiated_by: string | null };

/**
 * `vendor_profiles.logo_url` holds an `r2://bucket/key` REFERENCE, not a URL —
 * handing it to an <img src> renders a broken-image glyph with no error thrown
 * anywhere. Resolve it to a presigned display URL first. Mirrors the shipped
 * pattern in app/v/[slug]/page.tsx: the try/catch is deliberate, because a
 * missing logo already falls back to the book glyph below and a failed R2
 * signing must never take the admin queue down.
 */
async function resolveDisplayUrl(value: string | null | undefined): Promise<string | null> {
  try {
    return await displayUrlForStoredAsset(value);
  } catch {
    return null;
  }
}

export async function JournalSpotlightsSurface({
  ok,
  error,
}: {
  ok?: string;
  error?: string;
}) {
  // Reads. The service-role admin client sees DRAFT rows (RLS hides unapproved
  // rows from the session client); pending approvals + the slot price come from
  // the same client.
  const admin = createAdminClient();
  const [rows, price, pendingRes] = await Promise.all([
    fetchAllSpotlightsForAdmin(admin),
    fetchSponsoredSlotPrice(admin),
    admin
      .from('admin_approval_requests')
      .select('approval_id, target_id, initiated_by')
      .eq('action_type', 'approve_journal_spotlight')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString()),
  ]);

  // Identify the current admin so the UI can disable "Confirm" on a request the
  // viewer initiated (the action also enforces this; the UI is courtesy).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user?.id ?? '';

  const pendingByTarget = new Map<string, PendingApproval>();
  for (const p of (pendingRes.data ?? []) as PendingApproval[]) {
    pendingByTarget.set(p.target_id, p);
  }

  const drafts = rows.filter((r) => r.admin_approved_at === null);
  const published = rows.filter((r) => r.admin_approved_at !== null);

  // Resolved ONCE for the whole render, in a single batch — each call is its own
  // R2 signing round trip, and SpotlightRow is a plain (non-async) component so
  // it cannot await. Keyed by spotlight_id because the rows are split into two
  // lists below.
  const logoUrlEntries = await Promise.all(
    rows.map(async (r) => [r.spotlight_id, await resolveDisplayUrl(r.logo_url)] as const),
  );
  const logoUrlById = new Map<string, string | null>(logoUrlEntries);

  return (
    <div>
      <PageMasthead
        title="Journal Spotlights"
      />

      {ok ? (
        <div className="mb-5 border-success-300/70 bg-success-50 py-3 text-sm text-success-800 border-t border-ink/10">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 bg-terracotta/[0.06] py-3 text-sm text-mulberry border-t border-ink/10">
          {error}
        </div>
      ) : null}

      {/* Sponsored-slot state banner — price is admin-managed in service_catalog;
          selling is gated until owner sign-off (seed ships is_active=FALSE). */}
      <div className="mb-6 flex items-start gap-3 border-warn-300/70 bg-warn-50 py-3 border-t border-ink/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn-700" strokeWidth={1.75} aria-hidden />
        <p className="text-sm text-ink/80">
          {price && price.isActive ? (
            <>
              Sponsored slots are <strong>live</strong> at{' '}
              <strong>{formatCentavos(price.priceCentavos)}</strong> per placement
              (set in the pricing catalog). Every sponsored credit still needs
              two-admin approval and shows a &ldquo;Sponsored&rdquo; badge.
            </>
          ) : (
            <>
              Paid <strong>Sponsored</strong> placements are <strong>not yet
              enabled for sale</strong> — the{' '}
              <code className="rounded bg-ink/[0.06] px-1">journal_sponsored_spotlight</code>{' '}
              SKU is inactive in the pricing catalog (awaiting owner sign-off).
              You can still draft sponsored credits and run the two-admin
              approval flow; the price is set in the pricing catalog, never here.
            </>
          )}
        </p>
      </div>

      {/* Attach form */}
      <section className="mb-8 py-5 border-t border-ink/10">
        <h2 className="text-base font-semibold text-ink">Credit a supplier in an article</h2>
        <p className="mt-1 text-sm text-ink/60">
          Pick a Journal article and paste the supplier&rsquo;s profile ID. The
          credit starts as a draft (hidden) until approved.
        </p>
        <form
          action={attachSpotlight}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-ink/80">Journal article</span>
            <FieldPick name="blog_slug" label="Journal article" placeholder="Choose an article…" required className="min-h-11 w-full" options={ALL_BLOG_ARTICLES.map((a) => ({ key: a.slug, label: a.title }))} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Supplier profile ID</span>
            <input
              name="vendor_profile_id"
              required
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs text-ink outline-none focus:border-terracotta tabular-nums"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Placement</span>
            <FieldPick
              name="placement"
              label="Placement"
              defaultValue="featured_partner"
              className="min-h-11 w-full"
              options={[
                { key: 'featured_partner', label: 'Featured partner (free)' },
                { key: 'recommended', label: 'In partnership with (free)' },
                { key: 'sponsored', label: 'Sponsored (paid · two-admin)' },
              ]}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Sort order</span>
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
            />
          </label>
          <div className="sm:col-span-2">
            <ActionButton tone="brand" main icon={<FilePlus aria-hidden />} label="Draft credit" type="submit" />
          </div>
        </form>
      </section>

      {/* Drafts queue */}
      <section className="mb-8">
        <h2 className="mb-3 sn-eye" style={{ color: 'var(--m-slate)' }}>
          Drafts · awaiting approval ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <EmptyRow text="No drafts. Credit a supplier above to get started." />
        ) : (
          <ul className="space-y-3">
            {drafts.map((r) => (
              <SpotlightRow
                key={r.spotlight_id}
                row={r}
                logoUrl={logoUrlById.get(r.spotlight_id) ?? null}
                pending={pendingByTarget.get(r.spotlight_id) ?? null}
                meId={meId}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Published */}
      <section>
        <h2 className="mb-3 sn-eye" style={{ color: 'var(--m-slate)' }}>
          Published ({published.length})
        </h2>
        {published.length === 0 ? (
          <EmptyRow text="Nothing published yet." />
        ) : (
          <ul className="space-y-3">
            {published.map((r) => (
              <SpotlightRow
                key={r.spotlight_id}
                row={r}
                logoUrl={logoUrlById.get(r.spotlight_id) ?? null}
                pending={null}
                meId={meId}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="border-dashed py-8 text-center border-t border-ink/10">
      <p className="text-sm text-ink/60">{text}</p>
    </div>
  );
}

function SpotlightRow({
  row,
  logoUrl,
  pending,
  meId,
}: {
  row: JournalSpotlightAdminRow;
  /** Already resolved by the server parent — never `row.logo_url` itself. */
  logoUrl: string | null;
  pending: PendingApproval | null;
  meId: string;
}) {
  const article = findBlogArticle(row.blog_slug);
  const isPublished = row.admin_approved_at !== null;
  const initiatedByMe = pending?.initiated_by === meId;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between border-t border-ink/10">
      <div className="flex min-w-0 items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-ink/10"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/[0.06] text-ink/40">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">
            {row.business_name ?? 'Unnamed supplier'}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink/55">
            in “{article?.title ?? row.blog_slug}”
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center rounded-full bg-ink/[0.05] px-2 py-0.5 text-ink/70">
              {PLACEMENT_LABELS[row.placement]}
            </span>
            {row.is_sponsored ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.07] px-2 py-0.5 font-medium text-ink/70">
                <Megaphone className="h-3 w-3" strokeWidth={2} aria-hidden />
                Sponsored
              </span>
            ) : null}
            {isPublished ? (
              <span className="inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 font-medium text-success-700">
                Published
              </span>
            ) : pending ? (
              <span className="inline-flex items-center rounded-full bg-warn-100 px-2 py-0.5 font-medium text-warn-800">
                Pending 2nd admin
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ink/[0.05] px-2 py-0.5 text-ink/60">
                Draft
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!isPublished && !row.is_sponsored ? (
          <form action={approveFreeSpotlight}>
            <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
            <ActionButton tone="ok" icon={<Check aria-hidden />} label="Approve & publish" type="submit" />
          </form>
        ) : null}

        {!isPublished && row.is_sponsored && !pending ? (
          <form action={initiateSponsored}>
            <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
            <ActionButton tone="brand" main icon={<ShieldCheck aria-hidden />} label="Start 2-admin approval" type="submit" />
          </form>
        ) : null}

        {!isPublished && row.is_sponsored && pending ? (
          <form action={confirmSponsored}>
            <input type="hidden" name="approval_id" value={pending.approval_id} />
            <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
            <ActionButton tone="ok" icon={<ShieldCheck aria-hidden />} label="Confirm & publish" type="submit" disabled={initiatedByMe} title={ initiatedByMe ? 'You started this approval — a different admin must confirm.' : 'Confirm and publish' } />
          </form>
        ) : null}

        <form action={removeSpotlight}>
          <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
          <ActionButton tone="neutral" icon={<Trash2 aria-hidden />} label="Remove" type="submit" />
        </form>
      </div>
    </li>
  );
}
