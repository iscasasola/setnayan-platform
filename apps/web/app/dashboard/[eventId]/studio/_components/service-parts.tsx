import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ADD_ONS, appStoreDetailHref } from '@/lib/add-ons-catalog';
import { addOnOfferedForEvent } from '@/lib/add-on-event-scope';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { getIapGate } from '@/lib/request-platform';
import { isStoreShellHiddenAddon, isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { OUR_SERVICE_PARTS } from '@/lib/our-services';

/**
 * 🧩 A SERVICE'S OWN PARTS, ON ITS OWN PAGE (owner 2026-10-02, tracker d1).
 *
 * The full-page More Services drew each service as a card with its parts
 * under it — Thank-You Video under Papic, Playlist under Music Maker (owner
 * "yes to all 4", 2026-09-29). The page is gone ("the More menu is the one
 * place"), and the More menu lists the five services only — so the parts now
 * sit where the owner put them: under their service, on the service's page.
 *
 * The parts and their words are `OUR_SERVICE_PARTS` (lib/our-services.ts), the
 * same list the cards used. A part shows only where its catalogue entry is
 * live, offered for this event type, and not refused by the store shell — the
 * rules the card's part obeyed.
 */
export type ServicePartDoor = { key: string; name: string; line: string; href: string };

/**
 * Whether the part is offered here, and where its door goes — split out (2026-10-31, the Memories keepsake row) so
 * the row's Thank You button and the door in its sheet answer from ONE read. `null` = the part shows NOTHING here
 * (not live, not offered for this event type, or refused by the store shell) — the row draws no button then.
 */
export async function readServicePart(eventId: string, service: 'papic' | 'music-maker'): Promise<ServicePartDoor | null> {
  const part = OUR_SERVICE_PARTS[service];
  if (!part) return null;
  const entry = ADD_ONS.find((a) => a.key === part.key);
  if (!entry || entry.status === 'coming_soon') return null;
  const [profile, { storeShell, iap }] = await Promise.all([resolveProfileByEvent(eventId), getIapGate()]);
  if (!addOnOfferedForEvent(entry, profile)) return null;
  const href = appStoreDetailHref(entry.key, eventId);
  // 🍎 Where Apple sells the part in this app (`iap`), its door stays — its page's one pay step is Apple's sheet.
  if (storeShell && (isStoreShellHiddenAddon(entry.key, iap) || isStoreShellWebOnlyPath(href.split('?')[0]!, iap))) return null;
  return { key: entry.key, name: part.name, line: part.line, href };
}

export async function ServiceParts({
  eventId,
  service,
  door: given,
}: {
  eventId: string;
  service: 'papic' | 'music-maker';
  /** The answer the page already read (the Memories keepsake row) — so it is read once. Absent = read here. */
  door?: ServicePartDoor | null;
}) {
  const door = given === undefined ? await readServicePart(eventId, service) : given;
  if (!door) return null;
  return (
    <Link
      href={door.href}
      data-service-part={door.key}
      className="sn-tile flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink/[0.03]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{door.name}</span>
        <span className="block text-[13px] text-ink/60">{door.line}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
    </Link>
  );
}
