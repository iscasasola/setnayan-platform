import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SITE_WIDGET_PAGES,
  fetchWidgetsForPage,
  type SiteWidgetPage,
} from '@/lib/site-widgets';
import { WidgetList } from './widget-list';

export const metadata = { title: 'Website editor · Admin' };

type Props = {
  searchParams: Promise<{ page?: string }>;
};

/**
 * Admin Website editor — iteration 0023 § 3.10, the eighth admin surface
 * (locked 2026-05-15). Lists every widget in `site_widgets` for the
 * selected page; admin can:
 *   • Toggle on/off (is_enabled) — PATCH /api/v1/admin/site-widgets/[id]
 *   • Drag-drop reorder (display_order) — POST /api/v1/admin/site-widgets/reorder
 *
 * V1 admin-editable fields: is_enabled + display_order ONLY. Per-widget
 * config (stats thresholds, store URLs, copy, A/B variants) stays
 * code-locked per spec; admin editing of `config` JSONB ships V1.1.
 *
 * Page selector dropdown supports home / for_vendors / features / about
 * but only the Home seed lands in V1. Selecting an unseeded page shows
 * an empty-state CTA.
 */
export default async function AdminWebsiteEditorPage({ searchParams }: Props) {
  const search = await searchParams;
  const page = parsePage(search.page);

  const admin = createAdminClient();
  const widgets = await fetchWidgetsForPage(admin, page);
  const pageEntry =
    SITE_WIDGET_PAGES.find((p) => p.key === page) ?? SITE_WIDGET_PAGES[0]!;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0023 · § 3.10
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Website editor</h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Toggle and reorder marketing-site widgets per page. Each change is
          audit-logged; the public site picks up edits on its next render
          (cache TTL 60s). Per-widget config (thresholds · copy · variants)
          stays code-locked in V1.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink/75">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Page
          </span>
          <PageSelector currentPage={page} />
        </label>
        <Link
          href={pageEntry.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-terracotta hover:underline"
        >
          View live →
        </Link>
      </div>

      {widgets.length === 0 ? (
        <EmptyPage page={page} />
      ) : (
        <WidgetList widgets={widgets} page={page} />
      )}
    </div>
  );
}

function parsePage(raw: string | undefined): SiteWidgetPage {
  const valid: ReadonlyArray<SiteWidgetPage> = ['home', 'for_vendors', 'features', 'about'];
  if (raw && (valid as readonly string[]).includes(raw)) {
    return raw as SiteWidgetPage;
  }
  return 'home';
}

function PageSelector({ currentPage }: { currentPage: SiteWidgetPage }) {
  return (
    <form
      method="get"
      action="/admin/website"
      // Inline submit on change for a single dropdown.
    >
      <select
        name="page"
        defaultValue={currentPage}
        className="input-field min-w-[10rem]"
        // SSR-only — no `onChange` (client form would require 'use client').
        // Admin can hit Enter or use the Apply button.
      >
        {SITE_WIDGET_PAGES.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="ml-2 inline-flex h-11 items-center rounded-md border border-ink/20 bg-cream px-3 text-xs text-ink/75 hover:bg-ink/5"
      >
        Open
      </button>
    </form>
  );
}

function EmptyPage({ page }: { page: SiteWidgetPage }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-10 text-center">
      <p className="text-base font-medium text-ink/75">
        No widgets seeded for <code>{page}</code> yet.
      </p>
      <p className="mt-1 text-sm text-ink/55">
        V1 ships the home page only. Subsequent pages land in follow-on iterations.
      </p>
    </div>
  );
}
