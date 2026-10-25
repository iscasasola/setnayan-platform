/**
 * lib/widget-config-write.ts — A LIVE SECTION'S `config_json`, WRITTEN ONE AT A TIME (owner 2026-10-18, round 3 of "two
 * hosts never overwrite each other"; the pattern is `lib/merge-from-base.ts` + `lib/update-json-column.ts`).
 *
 * `config_json` is a shared bag — the canvas, the stage order, the shown/hidden choices, a scene's own words, the venue
 * cards. The live writers (`website/widgets/actions.ts`: motion, background, crop, a scene of their own, a move within a
 * stage; the Save the Date's venue card) read it, built the next bag, and wrote the WHOLE bag back: a write by another
 * screen in between (a Pro check and a photo check sit in that window) was gone. Now each writes through here: the bag
 * it built (`next`) is merged three ways from the bag it READ (`base`) onto the bag as it is NOW — what this write did not
 * change keeps the other screen's value, a canvas merges key by key — and the write lands only if the row is still that
 * version (`updated_at`, which the row's own trigger moves on every UPDATE). A lost round reads again and merges again.
 *
 * Why the version and not the value (as `updateJsonColumn` compares): a section's canvas is often over the 3,000
 * characters a compare may carry in a URL. Gives up after `JSON_COLUMN_WRITE_ATTEMPTS` lost rounds with the same error
 * the callers already turn into words — never a silent overwrite.
 */
import { mergeFromBase } from './merge-from-base';
import { JSON_COLUMN_WRITE_ATTEMPTS, JsonColumnMovedError, JsonColumnWriteError } from './update-json-column';

type Q = {
  eq(column: string, value: unknown): Q;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string; code?: string } | null }>;
};
type W = {
  eq(column: string, value: unknown): W;
  select(columns: string): PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>;
};
export type WidgetConfigClient = {
  from(table: 'invitation_widgets'): { select(columns: string): Q; update(values: Record<string, unknown>): W };
};

export type WidgetConfigWritten = { config: Record<string, unknown>; moved: boolean };

const asBag = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function writeWidgetConfig(
  client: WidgetConfigClient,
  row: { eventId: string; widgetId: string },
  base: unknown,
  next: Record<string, unknown>,
): Promise<WidgetConfigWritten> {
  for (let attempt = 1; ; attempt += 1) {
    const got = await client.from('invitation_widgets').select('config_json, updated_at').eq('widget_id', row.widgetId).eq('event_id', row.eventId).maybeSingle();
    if (got.error) throw new JsonColumnWriteError(got.error);
    if (!got.data) throw new Error('Section not found on this event.');
    const m = mergeFromBase(asBag(base), next, asBag(got.data.config_json));
    const config = asBag(m.value);
    const done = await client
      .from('invitation_widgets')
      .update({ config_json: config })
      .eq('widget_id', row.widgetId)
      .eq('event_id', row.eventId)
      .eq('updated_at', got.data.updated_at)
      .select('widget_id');
    if (done.error) throw new JsonColumnWriteError(done.error);
    if (Array.isArray(done.data) && done.data.length > 0) return { config, moved: m.moved };
    // 👥 Another screen wrote the section between the read and the write — merge again onto the newer bag.
    if (attempt >= JSON_COLUMN_WRITE_ATTEMPTS) throw new JsonColumnMovedError('This section');
  }
}
