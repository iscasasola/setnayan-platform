import Link from 'next/link';
import { CalendarDays, Layers, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import { ToolChip, ToolRow } from '@/app/vendor-dashboard/_components/tool-page';
import { NO_ONLINE_CARD_WORDS, type StoreTemplateRow } from '@/lib/supplier-store';
import { avStyleLine, partsLine, type TemplateKind } from '@/lib/toolkit-templates';
import { KindWord, PlanBar } from './template-bar';
import { OnPage, StoreTile, TagChips } from './store-views';
import { StoreOp } from './store-client';

/**
 * 🧩 THE TEMPLATE TILES AND ROWS (Toolkit templates drawing, specs 24dcf90c, frames 1 · 1b · 3): server-drawn. Each line
 * starts with ONE coloured kind word (owner 23 Nov "use colors to help identify which is what"; Payment plan green,
 * Availability amber); icons stay plain; a payment plan's art is its parts, drawn in ink inside a hairline frame.
 * Get installs (op=template), and lands on the item page where the plan opens filled in. Tokens only.
 */

const store = routes.vendorDashboard.shop.store;
const SHELF_OF: Readonly<Record<TemplateKind, 'payment_plans' | 'availability'>> = { pay: 'payment_plans', av: 'availability' };

export const templateHref = (of: TemplateKind, key: string) => store.item(SHELF_OF[of], key);

function TemplateArt({ row, small }: { row: StoreTemplateRow; small?: boolean }) {
  if (row.of === 'pay') return <PlanBar parts={row.t.parts} small={small} />;
  return <CalendarDays aria-hidden className="h-6 w-6 text-ink" strokeWidth={1.75} />;
}

/** "Payment plan · 2 parts · 20 · 80" · "Availability · One booking a day · AV-DAY". */
export function templateLine(row: StoreTemplateRow): string {
  return row.of === 'pay' ? partsLine(row.t) : avStyleLine(row.t);
}

function GetPill() {
  return (
    <span className="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-[color-mix(in_srgb,rgb(var(--color-link))_12%,transparent)] px-3 text-sn-md font-semibold text-[rgb(var(--color-link))]">
      Get
    </span>
  );
}

const showTags = (row: StoreTemplateRow) => ['k-template', row.forYou ? 'for-you' : '', row.installed ? 'installed' : ''].filter(Boolean).join(' ');

/** A template on the Toolkit front's sideways shelf row (frame 1). The whole tile opens the template. */
export function TemplateTile({ row }: { row: StoreTemplateRow }) {
  return (
    <StoreTile
      href={templateHref(row.of, row.t.key)}
      art={<TemplateArt row={row} small />}
      title={row.t.name}
      line={templateLine(row)}
      tags={
        <span className="text-sn-sm leading-tight">
          <KindWord of={row.of} />
        </span>
      }
      foot={row.greyed ? NO_ONLINE_CARD_WORDS : ''}
      pill={row.installed ? <OnPage /> : row.installed === null ? <ToolChip tone="wait">Couldn’t load</ToolChip> : <GetPill />}
      data={`template:${row.of}:${row.t.key}`}
      show={showTags(row)}
    />
  );
}

/** A template on its shelf page (frames 1 · 1b · 3): art · name · kind word + line · its "For first" tags · Get / ✓ Installed. */
export function TemplateShelfRow({ row }: { row: StoreTemplateRow }) {
  const href = templateHref(row.of, row.t.key);
  const right = row.installed ? (
    <OnPage />
  ) : row.installed === null ? (
    <ToolChip tone="wait">Couldn’t load</ToolChip>
  ) : row.greyed ? (
    <ActionButton tone="info" icon={<Layers aria-hidden strokeWidth={1.8} />} label="Your services" href={routes.vendorDashboard.services()} />
  ) : (
    <StoreOp op="template" fields={{ of: row.of, key: row.t.key, act: 'install' }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label="Get" landTo={href} />
  );
  return (
    <ToolRow
      attrs={{ 'data-store-row': '', 'data-store-name': row.t.name, 'data-store-show': showTags(row), 'data-store-template': `${row.of}:${row.t.key}` }}
      lead={
        row.of === 'pay' ? (
          <span className="block w-16 flex-none">
            <TemplateArt row={row} small />
          </span>
        ) : (
          <TemplateArt row={row} />
        )
      }
      title={
        <Link href={href} className="hover:underline">
          {row.t.name}
        </Link>
      }
      lines={[
        <span key="line">
          <KindWord of={row.of} /> · {row.of === 'pay' ? row.t.line : avStyleLine(row.t)}
        </span>,
        row.greyed ? NO_ONLINE_CARD_WORDS : null,
        <TagChips key="tags" tags={row.t.forCategories.map((label) => ({ label, group: null }))} />,
      ]}
      right={right}
    />
  );
}
