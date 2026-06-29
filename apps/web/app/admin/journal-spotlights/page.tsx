/**
 * /admin/journal-spotlights — Setnayan HQ · Editorial & Journal Spotlights
 * console (Wave 5 vendor benefit).
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
 * Auth: the /admin layout already 404s non-admins; the server actions re-check.
 * The admin read uses the service-role client so DRAFT rows (hidden from the
 * public by RLS) are visible in the queue.
 */

import { BookOpen, Info, Megaphone, ShieldCheck } from 'lucide-react';
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
} from './actions';

export const metadata = { title: 'Journal Spotlights · Setnayan HQ' };
export const dynamic = 'force-dynamic';

type PendingApproval = { approval_id: string; target_id: string; initiated_by: string };

export default async function JournalSpotlightsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;

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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          Setnayan HQ
        </p>
        <h1 className="m-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Journal Spotlights
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          Credit a vendor inside a published Journal article. Free placements
          (Featured partner / In partnership with) publish on one admin&rsquo;s
          approval; a paid <strong>Sponsored</strong> placement needs a second
          admin and always shows a &ldquo;Sponsored&rdquo; badge.
        </p>
      </header>

      {sp.ok ? (
        <div className="mb-5 rounded-xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-800">
          {sp.ok}
        </div>
      ) : null}
      {sp.error ? (
        <div className="mb-5 rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-4 py-3 text-sm text-terracotta">
          {sp.error}
        </div>
      ) : null}

      {/* Sponsored-slot state banner — price is admin-managed in service_catalog;
          selling is gated until owner sign-off (seed ships is_active=FALSE). */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-warn-300/70 bg-warn-50 px-4 py-3">
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
      <section className="mb-8 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-base font-semibold text-ink">Credit a vendor in an article</h2>
        <p className="mt-1 text-sm text-ink/60">
          Pick a Journal article and paste the vendor&rsquo;s profile ID. The
          credit starts as a draft (hidden) until approved.
        </p>
        <form
          action={attachSpotlight}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-ink/80">Journal article</span>
            <select
              name="blog_slug"
              required
              defaultValue=""
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
            >
              <option value="" disabled>
                Choose an article…
              </option>
              {ALL_BLOG_ARTICLES.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Vendor profile ID</span>
            <input
              name="vendor_profile_id"
              required
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-terracotta"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Placement</span>
            <select
              name="placement"
              defaultValue="featured_partner"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
            >
              <option value="featured_partner">Featured partner (free)</option>
              <option value="recommended">In partnership with (free)</option>
              <option value="sponsored">Sponsored (paid · two-admin)</option>
            </select>
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
            <button
              type="submit"
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink/90"
            >
              Draft credit
            </button>
          </div>
        </form>
      </section>

      {/* Drafts queue */}
      <section className="mb-8">
        <h2 className="mb-3 m-label-mono" style={{ color: 'var(--m-slate)' }}>
          Drafts · awaiting approval ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <EmptyRow text="No drafts. Credit a vendor above to get started." />
        ) : (
          <ul className="space-y-3">
            {drafts.map((r) => (
              <SpotlightRow
                key={r.spotlight_id}
                row={r}
                pending={pendingByTarget.get(r.spotlight_id) ?? null}
                meId={meId}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Published */}
      <section>
        <h2 className="mb-3 m-label-mono" style={{ color: 'var(--m-slate)' }}>
          Published ({published.length})
        </h2>
        {published.length === 0 ? (
          <EmptyRow text="Nothing published yet." />
        ) : (
          <ul className="space-y-3">
            {published.map((r) => (
              <SpotlightRow key={r.spotlight_id} row={r} pending={null} meId={meId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/40 px-6 py-8 text-center">
      <p className="text-sm text-ink/60">{text}</p>
    </div>
  );
}

function SpotlightRow({
  row,
  pending,
  meId,
}: {
  row: JournalSpotlightAdminRow;
  pending: PendingApproval | null;
  meId: string;
}) {
  const article = findBlogArticle(row.blog_slug);
  const isPublished = row.admin_approved_at !== null;
  const initiatedByMe = pending?.initiated_by === meId;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {row.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.logo_url}
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
            {row.business_name ?? 'Unnamed vendor'}
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
            <button
              type="submit"
              className="rounded-lg bg-success-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success-700"
            >
              Approve & publish
            </button>
          </form>
        ) : null}

        {!isPublished && row.is_sponsored && !pending ? (
          <form action={initiateSponsored}>
            <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-mulberry px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-600"
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Start 2-admin approval
            </button>
          </form>
        ) : null}

        {!isPublished && row.is_sponsored && pending ? (
          <form action={confirmSponsored}>
            <input type="hidden" name="approval_id" value={pending.approval_id} />
            <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
            <button
              type="submit"
              disabled={initiatedByMe}
              title={
                initiatedByMe
                  ? 'You started this approval — a different admin must confirm.'
                  : 'Confirm and publish'
              }
              className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/40"
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Confirm & publish
            </button>
          </form>
        ) : null}

        <form action={removeSpotlight}>
          <input type="hidden" name="spotlight_id" value={row.spotlight_id} />
          <button
            type="submit"
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/[0.04]"
          >
            Remove
          </button>
        </form>
      </div>
    </li>
  );
}
