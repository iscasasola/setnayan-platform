/**
 * /dev/service-requests-lab — the service-request screens (owner rulings 2026-11-13) on fixture data. No sign-in, no
 * database. DEV-ONLY: production builds 404 this route first thing. It mounts the REAL views the pages render
 * (`YourRequestsView`, `TellUsWhatYouDoView`, `RequestDetailView`, `ServiceRequestsListView`,
 * `ServiceRequestAdminView`) and, for "Now", the shipped admin request row (`RequestRow`). Its forms post to the real
 * actions, which refuse here (no session); press nothing but the dropdowns.
 *
 * Names are the approved prototype's (prototypes/service_requests_2026-11-13_fable.html — "Lola Nena's Bilao").
 *
 *   ?f=group | category | name          Supplier › Tell us what you do, steps 1–3
 *   ?f=requests                         Supplier › Your requests (with the decision notice)
 *   ?f=request                          Supplier › one waiting request, just sent (?requested=1)
 *   ?f=request-no                       Supplier › a "Not added" request (Pick the service that fits)
 *   ?f=admin | admin-empty | admin-failed   Admin › Service requests — loaded / empty / couldn't load
 *   ?f=admin-request                    Admin › one request, 3 shops, the Decision dropdown
 *   ?f=admin-now                        Admin › Categories › Requests as it ships today (the shipped RequestRow)
 */
import { notFound } from 'next/navigation';

import type { MyRequest, RequestTree } from '@/lib/service-requests.server';
import { YourRequestsView } from '@/app/vendor-dashboard/services/requests/_components/your-requests-view';
import { TellUsWhatYouDoView } from '@/app/vendor-dashboard/services/requests/_components/tell-us-view';
import { RequestDetailView } from '@/app/vendor-dashboard/services/requests/_components/request-detail-view';
import { ServiceRequestsListView, type AdminRequestRow } from '@/app/admin/categories/requests/_components/list-view';
import { ServiceRequestAdminView } from '@/app/admin/categories/requests/_components/request-view';
import { RequestRow } from '@/app/admin/categories/_components/request-row';

const GROUPS: Array<{ id: string; label: string; categories: Array<{ id: string; label: string; services: string[] }> }> = [
  { id: 'venues', label: 'Venues & Simbahan', categories: [{ id: 'reception_venues', label: 'Reception Venues', services: ['Garden venue'] }] },
  {
    id: 'catering_cakes',
    label: 'Catering & Cakes',
    categories: [
      { id: 'catering', label: 'Catering', services: ['Catering', 'Chinese lauriat', 'Lechon'] },
      { id: 'cakes', label: 'Cakes & Desserts', services: ['Wedding cake', 'Dessert table'] },
    ],
  },
  {
    id: 'booths',
    label: 'Booths, Food Carts & Bars',
    categories: [
      { id: 'photobooths', label: 'Photobooths', services: ['Photobooth', '360 booth'] },
      { id: 'food_carts', label: 'Food Carts', services: ['Food cart', 'Sorbetes', 'Halo-halo', 'Taho', 'Kakanin'] },
      { id: 'make_take', label: 'Make & Take', services: ['Leather imprinting', 'Live embroidery', 'Candle making'] },
      { id: 'pampering', label: 'Pampering', services: ['Massage station', 'Mini nail bar'] },
    ],
  },
  { id: 'photo_video', label: 'Photo & Video', categories: [{ id: 'photo_video_t', label: 'Photo & Video', services: ['Photo & video'] }] },
];

const key = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const TREE: RequestTree = (() => {
  const categoryLabel = new Map<string, string>();
  const groupOf = new Map<string, string>();
  const service = new Map<string, { label: string; tileId: string; categoryLabel: string }>();
  const groups = GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    categories: g.categories.map((c) => {
      categoryLabel.set(c.id, c.label);
      groupOf.set(c.id, g.label);
      const services = c.services.map((s) => ({ key: key(s), label: s }));
      for (const s of services) service.set(s.key, { label: s.label, tileId: c.id, categoryLabel: c.label });
      return { tileId: c.id, label: c.label, group: g.label, services };
    }),
  }));
  return { groups, categoryLabel, groupOf, service };
})();

const MINE: MyRequest[] = [
  {
    request_id: 'r1',
    proposed_label: 'Kakanin bilao',
    proposed_note: 'Bilao trays of suman, puto, kutsinta, sapin-sapin. Made fresh the night before, laid out at the venue.',
    tile_id: 'make_take',
    status: 'pending',
    mapped_to_canonical: null,
    resolution_note: null,
    created_at: '2026-11-13T08:12:00+08:00',
    reviewed_at: null,
    supplier_seen_at: null,
    cards: 2,
  },
  {
    request_id: 'r4',
    proposed_label: 'Live embroidery of napkins',
    proposed_note: null,
    tile_id: 'make_take',
    status: 'mapped',
    mapped_to_canonical: 'live_embroidery',
    resolution_note: 'Live embroidery already covers napkins — your card is listed there now.',
    created_at: '2026-11-09T10:00:00+08:00',
    reviewed_at: '2026-11-12T15:00:00+08:00',
    supplier_seen_at: null,
    cards: 1,
  },
  {
    request_id: 'r6',
    proposed_label: 'Bilao catering',
    proposed_note: null,
    tile_id: 'catering',
    status: 'kept_private',
    mapped_to_canonical: null,
    resolution_note: 'Catering covers it for couples searching; your shop keeps the name "Bilao catering" on the card.',
    created_at: '2026-11-04T10:00:00+08:00',
    reviewed_at: '2026-11-06T10:00:00+08:00',
    supplier_seen_at: '2026-11-06T12:00:00+08:00',
    cards: 1,
  },
  {
    request_id: 'r7',
    proposed_label: 'Tarot reading booth',
    proposed_note: null,
    tile_id: 'pampering',
    status: 'rejected',
    mapped_to_canonical: null,
    resolution_note: 'Tarot and palmistry are not listed on Setnayan.',
    created_at: '2026-11-03T10:00:00+08:00',
    reviewed_at: '2026-11-05T10:00:00+08:00',
    supplier_seen_at: '2026-11-05T12:00:00+08:00',
    cards: 1,
  },
];

const CARDS = [
  { vendor_service_id: 'c1', title: 'Suman & kutsinta bilao', category: 'misc', category_request_id: 'r1', is_active: true },
  { vendor_service_id: 'c2', title: 'Sapin-sapin tower', category: 'misc', category_request_id: 'r1', is_active: true },
  { vendor_service_id: 'c5', title: 'Puto pandan tray', category: 'misc', category_request_id: null, is_active: false },
  { vendor_service_id: 'c7', title: 'Tarot corner', category: 'misc', category_request_id: 'r7', is_active: true },
];

const SHOPS = new Map([
  ['v1', "Lola Nena's Bilao"],
  ['v2', "Tita Baby's Kakanin"],
  ['v3', 'Bilao ni Mang Tomas'],
  ['v4', 'Craftbox PH'],
  ['v5', 'Hilot Haus'],
  ['v6', 'SkyPixel Events'],
  ['v7', 'Mystic Manila'],
]);

const ADMIN_ROWS: AdminRequestRow[] = [
  { request_id: 'r1', proposed_label: 'Kakanin bilao', proposed_by_vendor_id: 'v1', tile_id: 'make_take', status: 'pending', created_at: '2026-11-13T08:12:00+08:00', reviewed_at: null },
  { request_id: 'r1b', proposed_label: 'kakanin bilao', proposed_by_vendor_id: 'v2', tile_id: 'food_carts', status: 'pending', created_at: '2026-11-13T08:40:00+08:00', reviewed_at: null },
  { request_id: 'r1c', proposed_label: 'Kakanin  Bilao', proposed_by_vendor_id: 'v3', tile_id: 'make_take', status: 'pending', created_at: '2026-11-13T09:02:00+08:00', reviewed_at: null },
  { request_id: 'r2', proposed_label: 'Resin keychain making', proposed_by_vendor_id: 'v4', tile_id: 'make_take', status: 'pending', created_at: '2026-11-13T07:40:00+08:00', reviewed_at: null },
  { request_id: 'r3', proposed_label: 'Mobile sauna', proposed_by_vendor_id: 'v5', tile_id: 'pampering', status: 'pending', created_at: '2026-11-12T07:40:00+08:00', reviewed_at: null },
  { request_id: 'r5', proposed_label: 'Drone light show', proposed_by_vendor_id: 'v6', tile_id: 'make_take', status: 'promoted', created_at: '2026-11-08T07:40:00+08:00', reviewed_at: '2026-11-09T07:40:00+08:00' },
  { request_id: 'r7', proposed_label: 'Tarot reading booth', proposed_by_vendor_id: 'v7', tile_id: 'pampering', status: 'rejected', created_at: '2026-11-03T07:40:00+08:00', reviewed_at: '2026-11-05T07:40:00+08:00' },
];

export default async function ServiceRequestsLabPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { f = 'requests' } = await searchParams;

  const frame = (() => {
    switch (f) {
      case 'group':
        return <TellUsWhatYouDoView tree={TREE} sp={{}} />;
      case 'category':
        return <TellUsWhatYouDoView tree={TREE} sp={{ group: 'booths' }} />;
      case 'name':
        return <TellUsWhatYouDoView tree={TREE} sp={{ tile: 'make_take' }} />;
      case 'request':
        return (
          <RequestDetailView requestId="r1" one={{ ok: true, value: MINE[0]! }} tree={TREE} cards={{ ok: true, value: CARDS }} sp={{ requested: '1' }} sameNameOthers={2} />
        );
      case 'request-no':
        return <RequestDetailView requestId="r7" one={{ ok: true, value: MINE[3]! }} tree={TREE} cards={{ ok: true, value: CARDS }} sp={{}} sameNameOthers={null} />;
      case 'admin':
        return <ServiceRequestsListView rows={ADMIN_ROWS} shopName={SHOPS} tree={TREE} ok={null} />;
      case 'admin-empty':
        return <ServiceRequestsListView rows={[]} shopName={SHOPS} tree={TREE} ok={null} />;
      case 'admin-failed':
        return <ServiceRequestsListView rows={null} shopName={SHOPS} tree={TREE} ok={null} />;
      case 'admin-request':
        return (
          <ServiceRequestAdminView
            r={{
              request_id: 'r1',
              proposed_label: 'Kakanin bilao',
              proposed_note: MINE[0]!.proposed_note,
              proposed_by_vendor_id: 'v1',
              tile_id: 'make_take',
              status: 'pending',
              mapped_to_canonical: null,
              resolution_note: null,
              created_at: '2026-11-13T08:12:00+08:00',
            }}
            tree={TREE}
            error={null}
            shops={3}
            names={["Lola Nena's Bilao", "Tita Baby's Kakanin", 'Bilao ni Mang Tomas']}
            myShop="Lola Nena's Bilao"
            cards={4}
            draft={null}
          />
        );
      case 'admin-now':
        return (
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            <h2 className="pb-3 text-xl font-semibold text-ink">Requests (3)</h2>
            <ul className="space-y-2">
              {ADMIN_ROWS.filter((r) => r.status === 'pending').slice(0, 3).map((r) => (
                <RequestRow
                  key={r.request_id}
                  request={{ requestId: r.request_id, proposedLabel: r.proposed_label, proposedNote: null, supplierName: SHOPS.get(r.proposed_by_vendor_id) ?? 'a supplier', draft: null }}
                  targets={[...TREE.service.entries()].slice(0, 6).map(([k, v]) => ({ canonical: k, label: v.label, closest: false }))}
                  categories={TREE.groups.flatMap((g) => g.categories.map((c) => ({ key: c.tileId, label: c.label, group: g.label })))}
                  back={{}}
                />
              ))}
            </ul>
          </div>
        );
      default:
        return <YourRequestsView mine={{ ok: true, value: MINE }} tree={TREE} />;
    }
  })();

  return <div data-service-requests-lab={f}>{frame}</div>;
}
