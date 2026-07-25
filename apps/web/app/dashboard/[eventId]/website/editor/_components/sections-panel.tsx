import { ArrowDown, ArrowUp, Eye, EyeOff, Lock } from 'lucide-react';
import {
  WIDGET_CATALOG_BY_TYPE,
  type InvitationWidgetRow,
} from '@/lib/invitation-widgets';

/**
 * SectionsPanel — show / hide / reorder every section of the website, inline
 * (Unified Website Editor · PR-7).
 *
 * The most WYSIWYG-natural control in the rail: the couple rearranges their
 * page while watching it rearrange in the preview beside them, instead of
 * opening a separate manager. Server component — each control is its own tiny
 * form posting to the SAME widgets actions the sub-page uses
 * (`toggleWidgetVisibility` / `moveWidgetUp` / `moveWidgetDown` /
 * `setSectionMode`), so the write layer is untouched and the whole thing works
 * with no JavaScript (the PH slow-4G posture the widgets editor already holds).
 *
 * Three-state mode (Auto · Shown · Hidden) is the open-browse control: Auto
 * follows content, Shown forces it on, Hidden holds it back. `Shown` is
 * disabled while a section has no content — forcing on an empty section would
 * publish a blank block to guests (the rule `setSectionMode` enforces
 * server-side too).
 */

const RETURN_TO = (eventId: string) =>
  `/dashboard/${eventId}/website/editor?open=sections-order`;

export function SectionsPanel({
  eventId,
  rows,
  contentMap,
  toggleAction,
  moveUpAction,
  moveDownAction,
  setModeAction,
}: {
  eventId: string;
  /** Hideable widgets in display order (always-on rows are not listed — they
   *  can never be hidden or moved, so a control would be a lie). */
  rows: InvitationWidgetRow[];
  contentMap: Partial<Record<string, boolean>>;
  toggleAction: (formData: FormData) => void | Promise<void>;
  moveUpAction: (formData: FormData) => void | Promise<void>;
  moveDownAction: (formData: FormData) => void | Promise<void>;
  setModeAction: (formData: FormData) => void | Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
        <p className="text-[0.72rem] text-ink/55">
          Your sections will appear here once your event finishes setting up.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
      <p className="mb-2 text-[0.7rem] text-ink/50">
        Drag-free ordering — move a section up or down, hide it, or let{' '}
        <span className="font-semibold text-ink/70">Auto</span> show it as soon as it has
        content.
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => {
          const catalog = WIDGET_CATALOG_BY_TYPE[row.widget_type];
          const mode = ((row as { mode?: string }).mode ?? 'auto') as
            | 'auto'
            | 'shown'
            | 'hidden';
          const hasContent = contentMap[row.widget_type] !== false;
          return (
            <li key={row.widget_id} className="rounded-lg border border-ink/10 bg-white p-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[0.76rem] font-semibold text-ink">
                  {catalog?.label ?? row.widget_type}
                </span>

                {/* show / hide */}
                <form action={toggleAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="widget_type" value={row.widget_type} />
                  <input type="hidden" name="next_visible" value={row.is_visible ? '0' : '1'} />
                  <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                  <button
                    type="submit"
                    aria-label={row.is_visible ? `Hide ${catalog?.label}` : `Show ${catalog?.label}`}
                    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[0.65rem] font-medium ${
                      row.is_visible
                        ? 'border-success-300/70 bg-success-50 text-success-800'
                        : 'border-ink/15 bg-cream text-ink/55'
                    }`}
                  >
                    {row.is_visible ? (
                      <Eye aria-hidden className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} />
                    )}
                    {row.is_visible ? 'Visible' : 'Hidden'}
                  </button>
                </form>

                {/* reorder */}
                <form action={moveUpAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label={`Move ${catalog?.label} up`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/15 bg-cream text-ink/60 disabled:opacity-35"
                  >
                    <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </form>
                <form action={moveDownAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                  <button
                    type="submit"
                    disabled={i === rows.length - 1}
                    aria-label={`Move ${catalog?.label} down`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/15 bg-cream text-ink/60 disabled:opacity-35"
                  >
                    <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </form>
              </div>

              {/* Auto · Shown · Hidden */}
              <div className="mt-1.5 flex items-center gap-1">
                {(['auto', 'shown', 'hidden'] as const).map((m) => {
                  const active = mode === m;
                  const blocked = m === 'shown' && !hasContent;
                  return (
                    <form key={m} action={setModeAction} className="flex">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="widget_id" value={row.widget_id} />
                      <input type="hidden" name="next_mode" value={m} />
                      <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                      <button
                        type="submit"
                        disabled={active || blocked}
                        title={
                          blocked
                            ? 'Add content to this section first.'
                            : m === 'auto'
                              ? 'Show it as soon as it has content.'
                              : m === 'shown'
                                ? 'Always show it.'
                                : 'Keep it off your website.'
                        }
                        className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.62rem] font-semibold capitalize ${
                          active
                            ? 'border-ink bg-ink text-cream'
                            : blocked
                              ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/30'
                              : 'border-ink/15 bg-cream text-ink/60 hover:border-ink/30'
                        }`}
                      >
                        {blocked ? (
                          <Lock aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} />
                        ) : null}
                        {m}
                      </button>
                    </form>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
