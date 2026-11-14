import { FieldPick } from '@/app/admin/_components/field-pick';
import { ArrowUpRight } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SITE_WIDGET_PAGES,
  fetchWidgetsForPage,
  type SiteWidgetPage,
} from '@/lib/site-widgets';
import { WidgetList } from '@/app/admin/website/widget-list';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * WebsiteSurface — the Website editor body, re-homed byte-identical from
 * app/admin/website/page.tsx into the tabbed /admin/studio studio (Studio
 * Studio slice 1). Behaviour is unchanged: the per-page widget list, the
 * is_enabled / display_order edits (via the WidgetList client component,
 * imported from its unchanged @/app/admin/website location). Only two things
 * differ, both mechanical:
 *   1. It accepts the surface's own searchParams (page) as a prop from the
 *      /admin/studio shell instead of awaiting them itself.
 *   2. The PageSelector form posts to /admin/studio with a hidden tab=website
 *      input so switching page stays on the Website tab.
 */
export async function WebsiteSurface({ page: pageRaw }: { page?: string }) {
  const page = parsePage(pageRaw);

  const admin = createAdminClient();
  const widgets = await fetchWidgetsForPage(admin, page);
  const pageEntry =
    SITE_WIDGET_PAGES.find((p) => p.key === page) ?? SITE_WIDGET_PAGES[0]!;

  return (
    <div>
      <PageMasthead
        title="Website editor"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink/75">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">
            Page
          </span>
          <PageSelector currentPage={page} />
        </label>
        <Link
          href={pageEntry.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-mulberry hover:underline"
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
      action="/admin/studio"
      // Inline submit on change for a single dropdown.
    >
      <input type="hidden" name="tab" value="website" />
      <FieldPick name="page" label="Page" defaultValue={currentPage} className="min-h-11 min-w-[10rem]" options={SITE_WIDGET_PAGES.map((p) => ({ key: p.key, label: p.label }))} />
      <ActionButton tone="neutral" icon={<ArrowUpRight aria-hidden />} label="Open" type="submit" />
    </form>
  );
}

function EmptyPage({ page }: { page: SiteWidgetPage }) {
  return (
    <div className="border-dashed py-10 text-center border-t border-ink/10">
      <p className="text-base font-medium text-ink/75">
        No widgets seeded for <code>{page}</code> yet.
      </p>
      <p className="mt-1 text-sm text-ink/55">
        Only the home page can be edited here for now.
      </p>
    </div>
  );
}
