/**
 * name-style-save.ts — 🔤 how a Maker control SAVES the event's Name style: into
 * the Event Hub DRAFT, never the live row (owner 2026-10-01, DECISION_LOG "IN
 * THE EVENT HUB MAKER, NOTHING TAKES EFFECT UNTIL APPLY — THE NAME STYLE
 * INCLUDED"). The patch is the one `hubDraftAction` (intent=save) takes: the
 * draft's `events.print_details` holds `{ name_style }` and nothing else
 * (`HUB_DRAFT_FACT_COLUMNS`); Apply merges it into the prints' settings blob
 * (`events.print_details.name_style`, lib/name-style.ts) — the ONE setting the
 * prints read, never a second.
 *
 * Details' Name style ▾ (`NameStylePicker`) and the hero names' Wording ▾
 * (`type-in-place.tsx`) both build their patch here. Pure: no I/O.
 */
import type { HubDraftPatch } from './hub-draft';
import type { NameStyle } from './name-style';

export function nameStyleDraftPatch(style: NameStyle): HubDraftPatch {
  return { events: { print_details: { name_style: style } } };
}
