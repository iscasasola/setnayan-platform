import { createClient } from '@/lib/supabase/server';
import { readDietaryList, readHubToolEntries } from '@/lib/hub-tool-entries.server';
import { entryTemplateOf } from '@/lib/hub-tool-entries';
import { getModule, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { readVendorSongs } from '@/lib/songs';
import { fetchPlaylistPicks, groupPicksBySlot } from '@/lib/playlist';
import { buildVendorSets, fetchVendorEventSets } from '@/lib/vendor-sets';
import { HubToolPanelsView, type SetListRead } from './hub-tool-panels-view';

/**
 * THE HUB TOOLS ON THE DAY — the second five (DECISION_LOG 2026-11-23 "THE TEN MOST-SHARED UNBUILT HUB TOOLS"; free):
 * Tech rider · Personalisation list · Dietary & allergies · Quantity vs guests · Set list. This file READS; the drawing
 * is `hub-tool-panels-view.tsx`.
 *
 * WHICH tools: the supplier's own day-of modules for this booking (`resolveModules` — the Hub's per-event switches);
 * only the ones carrying a `hubTool` are drawn here. Reads: ONE batch (`Promise.all`), each scoped to the event and the
 * shop handed in, under the caller's own RLS (the frame mounting a tool is not authorisation).
 */

/** The hub tools among this booking's enabled modules, in the registry's order. */
export function hubToolModules(enabled: readonly DayOfModuleId[]): DayOfModuleId[] {
  return enabled.filter((id) => getModule(id).hubTool != null);
}

export async function HubToolPanels({
  eventId,
  vendorProfileId,
  modules,
  attending,
}: {
  eventId: string;
  vendorProfileId: string;
  /** Enabled day-of modules carrying a hub tool (`hubToolModules`). */
  modules: readonly DayOfModuleId[];
  /** The coming guests — the page's brief read (`pax.attending`); null = the brief could not be read. */
  attending: number | null;
}) {
  if (modules.length === 0) return null;
  const supabase = await createClient();
  const keys = modules.map((id) => getModule(id).hubTool!);
  const entryKeys = keys.filter((k) => entryTemplateOf(k) != null);
  const wantSets = keys.includes('set_list');

  const [entries, dietary, setData, repertoire, picks] = await Promise.all([
    readHubToolEntries(supabase, eventId, vendorProfileId, entryKeys),
    keys.includes('dietary_and_allergies') ? readDietaryList(supabase, eventId) : Promise.resolve(null),
    wantSets ? fetchVendorEventSets(supabase, eventId, vendorProfileId) : Promise.resolve(null),
    wantSets ? readVendorSongs(supabase, vendorProfileId) : Promise.resolve(null),
    wantSets ? fetchPlaylistPicks(supabase, eventId) : Promise.resolve(null),
  ]);

  let setList: SetListRead | null = null;
  if (setData && repertoire && picks) {
    setList =
      setData.failed || repertoire.failed
        ? { state: 'unread' }
        : {
            state: 'ok',
            // A refused picks read only loses the "they asked for …" line, never the sets themselves.
            sets: buildVendorSets({
              sets: setData.sets,
              setSongs: setData.songs,
              hostPicksBySlot: groupPicksBySlot(picks.failed ? [] : picks.rows),
            }),
            repertoire: repertoire.rows,
          };
  }

  return <HubToolPanelsView eventId={eventId} modules={modules} attending={attending} reads={{ entries, dietary, setList }} />;
}
