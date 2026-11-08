'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, ClipboardList, Wrench, type LucideIcon } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import type { ScannerChoice } from '@/lib/supplier-scan';
import { onTheDayHref, specializedToolsFor, type SpecializedTool, type SpecializedToolKey } from '@/lib/specialized-tools';
import { toolIcon } from './specialized-tool-icon';
import { BodyPanel } from '../../_components/body-panel';
import { ServiceScannerPick } from './service-scanner-pick';

/**
 * 🛠 SHOP › MAKERS — under Badges, above Services.
 *
 * Build 2 §10 #33 (owner 8 Nov: *"should share a single row… expand like pressing an event from clients… keep the navs
 * and just take up the body part"*): the Makers are ONE ROW OF TILES; a tile opens INTO THE BODY through the shared
 * in-body panel (`BodyPanel` — between the top bar and the bottom nav, both stay; 520 ms out of the tile; × shrinks it
 * back into the tile at the exact prior scroll). Pop-ups opened from inside (the Form Maker sheet) sit above it.
 *
 *   Forms Maker → C3's Form Maker, shop-wide (`ShopFormsMaker`: your forms · suggested · ＋ New form). Its reads are the
 *                 server's, drawn only while `?maker=forms` (`shop-forms-body.tsx`) — the Shop tab pays nothing for it.
 *   Specialized tools → (Build 3 Lane E item 13, owner 9 Nov: *"its main page needs to live inside a specialized tool
 *                 carousel under makers"* · *"our scanner will live inside the specialized tools"*) a CAROUSEL of doors
 *                 (`lib/specialized-tools.ts`): Scanner FIRST — one line per service with the SHIPPED
 *                 `ServiceScannerPick` (Off · Once · Ordered → Received · Unlimited · Group session · Roaming), no sixth
 *                 mode, no service the shop does not have — then the tiles the shop's categories suggest, then the rest.
 *                 Every tile OPEN to every shop (approved v3 change: no greyed tiles). Doors to shipped pages only — no
 *                 price, no lock, no "Make your own" (the Tools Maker does not exist yet; a tile with no door is not drawn).
 * 🔒 shop/the-shop-tab-is-v113.test.ts · _components/the-body-panel-keeps-the-navs.test.ts
 */
export type ScannerLine = { coverageId: number; label: string; choice: ScannerChoice };

type MakerKey = 'forms' | 'tools';

/** One booked day the per-event tools run on (the same days the Hub picks from — `collapseToPickerDays`). */
export type BookedDay = { eventId: string; eventName: string; bookedDate: string };

export function ShopMakers({
  scanners,
  formsBody,
  formsOn = true,
  categories = [],
  services = [],
  booked = null,
}: {
  /** One line per service; null = the scanner settings could not be read (said so, never "Off"). */
  scanners: ScannerLine[] | null;
  /** The Forms Maker's body, server-drawn while `?maker=forms`; null while closed (or still on its way). */
  formsBody: ReactNode | null;
  /** The lab draws the row without the Forms tile's server body; the app always has the Forms Maker. */
  formsOn?: boolean;
  /** The shop's service labels (the one taxonomy) — they decide which tools are SUGGESTED first, never which are open. */
  categories?: readonly string[];
  /** `vendor_profiles.services` — the music rule for the Song bank. */
  services?: readonly string[];
  /** Booked days today and ahead — where the per-event tools run. null = unread (said so, never "none"). */
  booked?: readonly BookedDay[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inUrl = params.get('maker');
  const [open, setOpen] = useState<MakerKey | null>(inUrl === 'forms' ? 'forms' : null);
  const tiles = useRef<Record<MakerKey, HTMLButtonElement | null>>({ forms: null, tools: null });
  const frame = useRef<HTMLElement | null>(null);
  useEffect(() => {
    frame.current = (tiles.current.tools?.closest('[data-shop-tab],[data-shop-tab-lab]') as HTMLElement | null) ?? null;
  }, []);
  const tools = specializedToolsFor(categories, services);
  const [tool, setTool] = useState<SpecializedToolKey>('scanner');

  // Only the Forms Maker writes the address — its body is the server's (`?maker=forms`), so a reload lands on it too. The
  // Scanner's lines are already on the page: it opens with NO request (an address change would re-draw the whole Shop
  // on the server for nothing). Closing clears the address only if it carries a maker. The page never scrolls for it.
  const go = (k: MakerKey | null) => {
    setOpen(k);
    if (k !== 'forms' && !params.get('maker')) return;
    const q = new URLSearchParams(params.toString());
    if (k === 'forms') q.set('maker', k);
    else q.delete('maker');
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const on = scanners?.filter((s) => s.choice !== 'off').length ?? null;
  const scannerSub =
    scanners === null
      ? 'Couldn’t load'
      : scanners.length === 0
        ? 'Add a service first'
        : `${formatCount(on ?? 0)} of ${formatCount(scanners.length)} on`;
  const list: { k: MakerKey; title: string; sub: string; icon: LucideIcon; head: string }[] = [
    ...(formsOn ? [{ k: 'forms' as const, title: 'Forms Maker', sub: 'Sent as a chat card', icon: ClipboardList, head: 'Sent to couples as a chat card' }] : []),
    { k: 'tools', title: 'Specialized tools', sub: `Scanner · ${formatCount(tools.length - 1)} tools`, icon: Wrench, head: 'Swipe · tap one · each opens where it runs' },
  ];
  const picked = tools.find((t) => t.tool.key === tool)?.tool ?? tools[0]!.tool;
  const cur = open ? list.find((t) => t.k === open) : undefined;

  return (
    <section aria-labelledby="shop-makers-h" data-shop-makers="" id="makers" className="scroll-mt-24">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-makers-h" className="sn-eye">
          Makers
        </h2>
        <span className="text-[11.5px] text-ink/50">{list.map((t) => t.title.split(' ')[0]!.toLowerCase()).join(' · ')}</span>
      </div>
      <div className="grid gap-2 px-4" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }} data-maker-row="">
        {list.map((t) => (
          <button
            key={t.k}
            ref={(el) => {
              tiles.current[t.k] = el;
            }}
            type="button"
            onClick={() => go(t.k)}
            aria-expanded={open === t.k}
            aria-haspopup="dialog" // the Maker opens the in-body panel OVER the page (BodyPanel) — a popup surface, not an in-place fold
            className="sn-press flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-2xl border border-ink/10 bg-raised px-2 py-3 text-center" // no-card-ok: a Maker tile is a <button> (it opens the Maker into the body) — frames only on what you press
            data-maker={t.k}
          >
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
              <t.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <b className="text-[14px] font-semibold leading-tight text-ink">{t.title}</b>
            <small className="text-[12px] leading-tight text-ink/60">{t.sub}</small>
          </button>
        ))}
      </div>

      {cur ? (
        <BodyPanel
          origin={tiles.current[cur.k]}
          frame={frame.current}
          title={cur.title}
          sub={cur.head}
          lead={
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
              <cur.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
          }
          onClose={() => go(null)}
          data={`maker-${cur.k}`}
        >
          {cur.k === 'tools' ? (
            <div data-specialized-tools="">
              {/* 🎠 THE CAROUSEL — swipe · tap one. Scanner first, then suggested, then the rest; all open. */}
              <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" data-tool-carousel="">
                {tools.map(({ tool: t, suggested }) => {
                  const Icon = toolIcon(t.key);
                  const on = t.key === picked.key;
                  return (
                    <li key={t.key} className="w-[150px] flex-none snap-start">
                      <button
                        type="button"
                        onClick={() => setTool(t.key)}
                        aria-pressed={on}
                        className={`sn-press flex h-full min-h-[148px] w-full flex-col items-start gap-1 rounded-2xl border px-3 py-3 text-left ${on ? 'border-[color:var(--m-orange)] bg-raised' : 'border-ink/10 bg-raised'}`} // no-card-ok: a carousel tile is a <button>
                        data-tool-tile={t.key}
                        data-tool-suggested={suggested ? '' : undefined}
                      >
                        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </span>
                        <b className="pt-1 text-[14px] font-semibold leading-tight text-ink">{t.title}</b>
                        <small className="text-[12px] leading-snug text-ink/60">{t.line}</small>
                        <small className="mt-auto pt-1 text-[11.5px] font-semibold leading-tight text-ink/75">{toolFoot(t, suggested, scannerSub, booked)}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <ToolBody tool={picked} scanners={scanners} booked={booked} />
            </div>
          ) : (
            (formsBody ?? (
              <p role="status" className="py-4 text-[13.5px] text-ink/60" data-shop-forms-loading="">
                Opening your forms…
              </p>
            ))
          )}
        </BodyPanel>
      ) : null}
    </section>
  );
}

/** The tile's last line: the Scanner's count, the tool's own place, or how many booked events it runs on. */
function toolFoot(t: SpecializedTool, suggested: boolean, scannerSub: string, booked: readonly BookedDay[] | null): string {
  if (t.door.kind === 'scanner') return scannerSub;
  if (t.door.kind === 'page') return suggested ? 'For your services' : 'Open';
  if (booked === null) return 'Couldn’t load your events';
  if (booked.length === 0) return 'Runs on your booked events';
  return `Runs on ${formatCount(booked.length)} booked ${booked.length === 1 ? 'event' : 'events'}`;
}

/** Under the carousel: what the picked tile opens — the Scanner lines, its one page, or its booked events. */
function ToolBody({ tool, scanners, booked }: { tool: SpecializedTool; scanners: ScannerLine[] | null; booked: readonly BookedDay[] | null }) {
  if (tool.door.kind === 'scanner') {
    return (
      <div data-scanner-sheet="">
        <p className="pb-2 text-[13px] text-ink/65">Set once per service — every event booked for it starts with it. How each scan counts:</p>
        {scanners === null ? (
          <p role="status" className="py-3 text-[13.5px] text-ink/70">
            Couldn&rsquo;t load your scanners just now. Close and open this again.
          </p>
        ) : scanners.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink/70">Add a service first — each service has its own scanner.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {scanners.map((s) => (
              <li key={s.coverageId} className="py-1" data-scanner-line={s.coverageId}>
                <ServiceScannerPick coverageId={s.coverageId} serviceLabel={s.label} initial={s.choice} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (tool.door.kind === 'page') {
    return (
      <div className="space-y-3" data-tool-body={tool.key}>
        <p className="text-[13.5px] text-ink/70">{tool.line}.</p>
        <Link href={tool.door.href} className="sn-press flex min-h-[52px] items-center justify-center rounded-full bg-ink px-4 text-[14px] font-semibold text-[color:var(--m-paper)]" data-tool-open={tool.key}>
          Open {tool.title}
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-tool-body={tool.key}>
      <p className="text-[13.5px] text-ink/70">{tool.line} — it opens on the day of each booked event, from that event&rsquo;s screen.</p>
      {booked === null ? (
        <p role="status" className="py-2 text-[13.5px] text-ink/70">
          Couldn&rsquo;t load your booked events just now.
        </p>
      ) : booked.length === 0 ? (
        <p className="flex items-start gap-2 py-2 text-[13.5px] text-ink/70" data-tool-no-events="">
          <CalendarDays aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.9} />
          Runs on your booked events · it shows up here once a couple books you.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {booked.map((b) => (
            <li key={`${b.eventId}:${b.bookedDate}`}>
              <Link href={onTheDayHref(b.eventId)} className="sn-press flex min-h-[56px] items-center gap-3 py-2" data-tool-event={b.eventId}>
                <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={1.9} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{b.eventName}</span>
                  <span className="block text-[12.5px] text-ink/60">{b.bookedDate}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
