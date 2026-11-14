/**
 * catalogue-home-view.tsx — the Catalogue Home's markup, from plain facts (no reads), so the page and the
 * `/dev/admin-catalogue-lab` draw the SAME thing. The reads live in `../page.tsx`.
 */
import {
  Calendar,
  Camera,
  Eye,
  FileText,
  Flag,
  Gauge,
  Image as ImageIcon,
  Layers,
  Link2,
  List,
  Newspaper,
  Palette,
  Sparkles,
  Star,
  Tag,
  Wallet,
} from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { CataloguePage, Nums, Rows, Sec, ViewRow } from './catalogue-rows';

/** What the Home shows. `null` everywhere means "could not be read" — never 0. */
export type CatalogueHomeFacts = {
  /** Any list failed to read → the Next card says so instead of naming work. */
  anyFailed: boolean;
  categories: number | null;
  services: number | null;
  /** Pending supplier requests for a service we lack. */
  asking: number | null;
  /** The oldest pending request — the Next card. */
  next: { requestId: string; label: string; supplier: string } | null;
  categoriesLine: string;
  typesLine: string;
  religionsLine: string;
  pricesLine: string;
};

const n = (v: number) => formatCount(v);

export function CatalogueHomeView({ facts }: { facts: CatalogueHomeFacts }) {
  const { anyFailed, next, asking, categoriesLine, typesLine, religionsLine, pricesLine } = facts;
  return (
    <CataloguePage>
      <PageMasthead title="Catalogue" />

      {anyFailed ? (
        <section aria-label="Couldn't load" role="alert" className="sn-tile mb-4 p-4" data-catalogue-next="fail">
          <p className="sn-eye">Couldn’t load</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Some lists didn’t read</h2>
          <p className="mt-0.5 text-sm text-ink/70">Anything that reads “—” is unknown, not zero. Refresh to try again.</p>
        </section>
      ) : next ? (
        <section aria-label="Next" className="sn-tile mb-4 p-4" data-catalogue-next="request">
          <p className="sn-eye flex flex-wrap items-baseline justify-between gap-x-3">
            <span>Next · {asking === 1 ? '1 shop asking' : `${n(asking ?? 0)} shops asking`}</span>
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">“{next.label}”</h2>
          <p className="mt-0.5 text-sm text-ink/70">From {next.supplier}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              tone="brand"
              icon={<Eye />}
              label="Open"
              name={`Open “${next.label}”`}
              main
              href={`/admin/categories/requests/${encodeURIComponent(next.requestId)}`}
            />
            <ActionButton tone="neutral" icon={<List />} label="All requests" href="/admin/categories/requests" />
          </div>
        </section>
      ) : (
        <section aria-label="Nothing waits on you" className="sn-tile mb-4 p-4" data-catalogue-next="clear">
          <p className="sn-eye">Nothing waits on you</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">All clear</h2>
          <p className="mt-0.5 text-sm text-ink/70">No service requests waiting</p>
        </section>
      )}

      <Nums
        nums={[
          { value: facts.categories, label: 'categories', href: '/admin/categories' },
          { value: facts.services, label: 'services', href: '/admin/categories' },
          {
            value: asking,
            label: 'asking',
            href: '/admin/categories/requests',
            tone: asking && asking > 0 ? 'warn' : undefined,
          },
        ]}
      />

      <Sec label="Categories & event types" />
      <Rows label="Categories & event types">
        <ViewRow href="/admin/categories" icon={Layers} title="Categories" line={categoriesLine} />
        <ViewRow href="/admin/categories?list=event-types" icon={Calendar} title="Event types" line={typesLine} />
        <ViewRow href="/admin/categories?list=religions" icon={Star} title="Religions" line={religionsLine} />
        <ViewRow href="/admin/categories?list=hub-tools" icon={List} title="Hub tools" line="Suggested per category" />
        <ViewRow
          href="/admin/categories/requests"
          icon={Flag}
          title="Service requests"
          line="Shops asking for a service we lack"
          waiting={asking}
        />
      </Rows>

      <Sec label="Prices" tip="Every price is admin-managed in the price list and read from it — never typed into a page." />
      <Rows label="Prices">
        <ViewRow href="/admin/pricing" icon={Tag} title="Prices" line={pricesLine} />
        <ViewRow href="/admin/pricing?tab=plan-contents" icon={Layers} title="Plan contents" line="What each supplier and event plan includes" />
        <ViewRow href="/admin/pricing?tab=setnayan-ai" icon={Sparkles} title="Setnayan AI prices" line="Every kind of event has a price" />
        <ViewRow href="/admin/pricing?tab=papic-shots" icon={Camera} title="Papic shot prices" line="The ladder · per-type sizing" />
        <ViewRow href="/admin/pricing?tab=price-bands" icon={Gauge} title="Market price bands" line="Computed, never hand-set" />
        <ViewRow href="/admin/budget-planner" icon={Wallet} title="Budget benchmarks" line="Bands · seeded prices · engine" />
        <ViewRow href="/admin/vendor-recommendations" icon={Link2} title="Supplier recommendations" line="Service → product map" />
      </Rows>

      <Sec label="Templates & media" />
      <Rows label="Templates & media">
        <ViewRow href="/admin/catalogue/templates" icon={FileText} title="Templates" line="Reveal Studio · Patiktok · Website · Event Hub music" />
        <ViewRow href="/admin/catalogue/media" icon={ImageIcon} title="Media" line="Songs · mood-board library · videos · website media" />
        <ViewRow href="/admin/catalogue/design-kit" icon={Palette} title="Design kit" line="Colours" />
      </Rows>

      <Sec label="Content" />
      <Rows label="Content">
        <ViewRow
          href="/admin/studio?tab=real-stories"
          icon={Newspaper}
          title="Stories & front page"
          line="Real Stories · storytellers · recaps · awards · social"
        />
      </Rows>
    </CataloguePage>
  );
}
