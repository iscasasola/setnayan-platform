import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, MapPin, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AreaCanvas, type CanvasPin } from './_components/area-canvas';
import {
  createFloorArea,
  updateFloorArea,
  deleteFloorArea,
  createFloorObject,
  deleteFloorObject,
} from './actions';

export const metadata = { title: 'Areas & booths · Setnayan' };

/**
 * Areas & booths — the multi-area blueprint (owner-approved 2026-06-13).
 * The reception room keeps its full editor at /seating; this surface adds
 * the OTHER spaces — the cocktail garden guests fill while the reception
 * flips, the ceremony foyer — and free-placed booth/station pins, each
 * optionally linked to the booked vendor running it. A pin linked to a
 * vendor shows up on that vendor's Event Brief + seat-plan view ("your
 * booth is here") once the plan is published.
 *
 * RLS-gated end-to-end: couple + Phase 2 delegates with seat_plan edit.
 */

type AreaRow = {
  area_id: string;
  area_type: string;
  label: string;
  schedule_block_id: string | null;
  sort_order: number;
};

type ObjectRow = {
  object_id: string;
  area_id: string | null;
  object_type: string;
  label: string;
  event_vendor_id: string | null;
  x_pos: number;
  y_pos: number;
};

type BlockRow = { block_id: string; label: string; start_at: string | null };
type VendorRow = { vendor_id: string; vendor_name: string; category: string };

const AREA_TYPE_OPTIONS = [
  ['cocktail', 'Cocktail area'],
  ['garden', 'Garden'],
  ['foyer', 'Foyer / pre-function'],
  ['ceremony', 'Ceremony space'],
  ['custom', 'Custom'],
] as const;

const OBJECT_TYPE_OPTIONS = [
  ['booth', 'Booth (photo / 360 / GIF…)'],
  ['station', 'Food station / cart'],
  ['bar', 'Bar'],
  ['dessert', 'Dessert / cake table'],
  ['photo_wall', 'Photo wall / backdrop'],
  ['custom', 'Other'],
] as const;

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

type Props = { params: Promise<{ eventId: string }> };

export default async function AreasAndBoothsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS scopes every read to couple/delegate; layout already gated the shell.
  const [areasRes, objectsRes, blocksRes, vendorsRes] = await Promise.all([
    supabase
      .from('event_floor_areas')
      .select('area_id, area_type, label, schedule_block_id, sort_order')
      .eq('event_id', eventId)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('event_floor_objects')
      .select('object_id, area_id, object_type, label, event_vendor_id, x_pos, y_pos')
      .eq('event_id', eventId),
    supabase
      .from('event_schedule_blocks')
      .select('block_id, label, start_at')
      .eq('event_id', eventId)
      .order('start_at'),
    supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, category')
      .eq('event_id', eventId)
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
      .order('vendor_name'),
  ]);
  const areas = (areasRes.data ?? []) as AreaRow[];
  const objects = (objectsRes.data ?? []) as ObjectRow[];
  const blocks = (blocksRes.data ?? []) as BlockRow[];
  const vendors = (vendorsRes.data ?? []) as VendorRow[];
  const vendorName = new Map(vendors.map((v) => [v.vendor_id, v.vendor_name]));
  const blockLabel = new Map(
    blocks.map((b) => [b.block_id, `${b.label}${b.start_at ? ` · ${fmtTime(b.start_at)}` : ''}`]),
  );

  const toPins = (rows: ObjectRow[]): CanvasPin[] =>
    rows.map((o) => ({
      object_id: o.object_id,
      label: o.label,
      object_type: o.object_type,
      x_pos: o.x_pos,
      y_pos: o.y_pos,
      vendor_name: o.event_vendor_id ? vendorName.get(o.event_vendor_id) ?? null : null,
    }));

  const receptionPins = objects.filter((o) => o.area_id === null);

  const pinForm = (areaId: string | null) => (
    <details className="rounded-lg border border-ink/10 bg-white/50 p-3">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4" /> Add a booth or station
      </summary>
      <form action={createFloorObject} className="mt-3 grid max-w-md gap-2">
        <input type="hidden" name="event_id" value={eventId} />
        {areaId ? <input type="hidden" name="area_id" value={areaId} /> : null}
        <input
          type="text"
          name="label"
          required
          maxLength={80}
          placeholder='e.g. "Photo Booth" or "Halo-halo cart"'
          className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
        />
        <select name="object_type" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm">
          {OBJECT_TYPE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="event_vendor_id" defaultValue="" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm">
          <option value="">Run by — pick a booked vendor (optional)</option>
          {vendors.map((v) => (
            <option key={v.vendor_id} value={v.vendor_id}>
              {v.vendor_name}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink/50">
          Linking a vendor shows this pin on their Event Brief — &ldquo;your booth is
          here&rdquo; — once the plan is published.
        </p>
        <button type="submit" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-cream">
          Add pin
        </button>
      </form>
    </details>
  );

  const pinList = (rows: ObjectRow[]) =>
    rows.length > 0 ? (
      <ul className="flex flex-wrap gap-2">
        {rows.map((o) => (
          <li key={o.object_id} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs">
            <span className="font-medium">{o.label}</span>
            {o.event_vendor_id ? (
              <span className="text-ink/50">· {vendorName.get(o.event_vendor_id) ?? '—'}</span>
            ) : null}
            <form action={deleteFloorObject}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="object_id" value={o.object_id} />
              <button type="submit" aria-label={`Remove ${o.label}`} className="text-ink/40 hover:text-terracotta">
                <Trash2 aria-hidden className="h-3 w-3" />
              </button>
            </form>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/seating`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Seat plan editor
      </Link>

      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <MapPin aria-hidden className="h-3.5 w-3.5" />
          Areas &amp; booths
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Beyond the reception room
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Map the cocktail garden guests enjoy while the reception is being set,
          the foyer, any extra space — and drop booth pins where each station
          goes. Tie an area to a timeline block so everyone knows when it&rsquo;s
          live, and link each booth to the vendor running it.
        </p>
      </header>

      {/* Reception-room pins */}
      <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Reception room</h2>
          <p className="text-sm text-ink/55">
            Booths inside the main room (the photo wall by the dance floor, the
            dessert table). Tables live in the{' '}
            <Link href={`/dashboard/${eventId}/seating`} className="font-medium text-terracotta underline">
              seat plan editor
            </Link>
            .
          </p>
        </div>
        <AreaCanvas eventId={eventId} pins={toPins(receptionPins)} aspect={4 / 3} />
        {pinList(receptionPins)}
        {pinForm(null)}
      </div>

      {/* Additional areas */}
      {areas.map((area) => {
        const areaPins = objects.filter((o) => o.area_id === area.area_id);
        return (
          <div key={area.area_id} className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{area.label}</h2>
                <p className="text-sm text-ink/55">
                  {AREA_TYPE_OPTIONS.find(([v]) => v === area.area_type)?.[1] ?? area.area_type}
                  {area.schedule_block_id
                    ? ` · live during ${blockLabel.get(area.schedule_block_id) ?? 'its timeline block'}`
                    : ''}
                </p>
              </div>
              <form action={deleteFloorArea}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="area_id" value={area.area_id} />
                <button type="submit" className="text-xs text-ink/50 underline hover:text-terracotta">
                  Remove area
                </button>
              </form>
            </div>

            <AreaCanvas eventId={eventId} pins={toPins(areaPins)} aspect={4 / 3} />
            {pinList(areaPins)}
            {pinForm(area.area_id)}

            <details className="rounded-lg border border-ink/10 bg-white/50 p-3">
              <summary className="cursor-pointer text-sm font-medium">Area settings</summary>
              <form action={updateFloorArea} className="mt-3 grid max-w-md gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="area_id" value={area.area_id} />
                <input
                  type="text"
                  name="label"
                  defaultValue={area.label}
                  maxLength={80}
                  className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                />
                <select
                  name="schedule_block_id"
                  defaultValue={area.schedule_block_id ?? ''}
                  className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="">No timeline window</option>
                  {blocks.map((b) => (
                    <option key={b.block_id} value={b.block_id}>
                      {blockLabel.get(b.block_id)}
                    </option>
                  ))}
                </select>
                <button type="submit" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-cream">
                  Save
                </button>
              </form>
            </details>
          </div>
        );
      })}

      {/* Add area */}
      <div className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 p-4 sm:p-6">
        <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold">
          <Plus aria-hidden className="h-5 w-5 text-terracotta" /> Add an area
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          The classic: a cocktail area for the hour your guests wait while the
          reception room is finished.
        </p>
        <form action={createFloorArea} className="mt-3 grid max-w-md gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="text"
            name="label"
            required
            maxLength={80}
            placeholder='e.g. "Cocktail garden"'
            className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          />
          <select name="area_type" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm">
            {AREA_TYPE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select name="schedule_block_id" defaultValue="" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm">
            <option value="">Tie to a timeline block (optional)</option>
            {blocks.map((b) => (
              <option key={b.block_id} value={b.block_id}>
                {blockLabel.get(b.block_id)}
              </option>
            ))}
          </select>
          <button type="submit" className="justify-self-start rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-cream">
            Create area
          </button>
        </form>
      </div>
    </section>
  );
}
