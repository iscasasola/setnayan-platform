/**
 * /dev/find-lab — the couple's Event › Suppliers › Find list (the Find page, `vendors/categories`) on fixture data,
 * with no sign-in and no database, inside the REAL One Shell (`LabShell`). DEV-ONLY: production builds 404 this route
 * (`the-lab-never-ships.test.ts`), the same kill-switch as every lab.
 *
 * Why it exists (owner 2026-11-09, the photo group headers): the headers PIN and push each other up, and no unit test
 * scrolls. This draws the REAL `FindCategoryList` with the real `buildFindList` and the real `pickFindHeaderPhotos`.
 *
 * 🖼 THE PHOTOS ARE THE SEED'S. With no database there is no Admin › Categories to read, so the lab's `categoryPhotos`
 * is what the migrations write into `service_categories.sample_photo_r2_key` (`seed-photos.ts`, measured by replay).
 * The Farewell group has none in the seed, so a wake (`?type=wake`) shows the plain text row.
 *
 *   ?nophotos=1   no category has a photo — every header is the plain text row
 *   &type=wake    a wake's list (its own groups' words, The service first)
 *   &findfail=1   the booked read was refused
 */
import { notFound } from 'next/navigation';
import { Search } from 'lucide-react';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { FindCategoryList } from '@/app/dashboard/[eventId]/vendors/_components/find-category-list';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { buildFindList, FIND_GROUP_OF_TILE, pickFindHeaderPhotos } from '@/lib/supplier-find';
import { LAB_EVENT, LAB_FIND_COUNTS } from '@/app/dev/suppliers-lab/fixtures';
import { LAB_SEED_CATEGORY_PHOTOS } from './seed-photos';

export const dynamic = 'force-dynamic';

export default async function FindLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);

  const wake = one('type') === 'wake';
  const eventType = wake ? 'wake' : 'wedding';
  const booked = one('findfail') === '1' ? null : new Set(['reception', 'photo_video']);
  const list = buildFindList({
    // No database: no Admin › Scope categories — drop a wake's own services the way a wedding's scope does.
    folders: buildShortlistFolders({ vendorRows: [], eventType, faithSet: new Set(), eventId: LAB_EVENT }).map((f) => ({
      ...f,
      tiles: wake ? f.tiles : f.tiles.filter((t) => (FIND_GROUP_OF_TILE as Record<string, string>)[t.tile] !== 'farewell'),
    })),
    eventType,
    solemn: wake,
    booked,
    counts: LAB_FIND_COUNTS,
  });
  // /public paths are used verbatim by the read's resolver, so the refs ARE the URLs here.
  const refs = pickFindHeaderPhotos(list, one('nophotos') === '1' ? {} : LAB_SEED_CATEGORY_PHOTOS);
  const withPhotos = {
    ...list,
    popularPhotoUrl: refs.popular,
    groups: list.groups.map((g) => ({ ...g, photoUrl: refs.groups[g.id] ?? null })),
  };

  return (
    <LabShell eventId={LAB_EVENT}>
      {/* The Find page's own wrapper and head (`vendors/categories/page.tsx`), copied for the lab. */}
      <div className="mx-auto w-full max-w-2xl pb-24 pt-5 sm:px-4" data-find-lab="">
        <header className="mb-4 mt-3">
          <h2 className="font-serif text-3xl text-ink">Find a supplier</h2>
          <p className="mt-1 text-[15px] text-ink/65">Only what your event needs.</p>
        </header>
        <label className="flex items-center gap-2 rounded-md border border-ink/15 bg-paper px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-ink/45" aria-hidden />
          <input name="q" placeholder="Search suppliers or a service" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40" />
        </label>
        <FindCategoryList eventId={LAB_EVENT} list={withPhotos} bookedMeasured={booked !== null} eventType={eventType} solemn={wake} />
      </div>
    </LabShell>
  );
}
