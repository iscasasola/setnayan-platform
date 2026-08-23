import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, EyeOff, GripVertical, Lock, Pencil, Sparkles, Wand2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { eventNoun } from '@/lib/event-noun';
import {
  type InvitationWidgetRow,
  type WidgetType,
  WIDGET_CATALOG_BY_TYPE,
  hasContent,
  isWidgetType,
  sortWidgetsForEditor,
} from '@/lib/invitation-widgets';
import {
  SECTION_CONTENT_EVENT_COLUMNS,
  computeSectionContentMap,
  type SectionContentEvent,
} from '@/lib/website-section-content';
import {
  moveWidgetDown,
  moveWidgetUp,
  setSectionMode,
  toggleWidgetVisibility,
} from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * Widgets that auto-populate their content from another part of the couple's
 * planning work — surfaced as a light hint line under the row so the couple
 * knows WHERE to add content (rather than hunting for a per-widget editor that
 * doesn't exist). Kept factual + short.
 */
const AUTO_POPULATE_HINT: Partial<Record<WidgetType, string>> = {
  schedule: 'Fills from your Schedule.',
  our_photos: 'Fills from Our Photos.',
  venue_map: 'Fills from your venue details.',
  countdown: 'Fills from your event date.',
  our_love_story: 'Fills from your onboarding love story.',
};

export const metadata = { title: 'Customize widgets' };

/**
 * /dashboard/[eventId]/website/widgets — V1 invitation widgets editor.
 *
 * Owner directive 2026-05-22 PM: ship V1 widget editor with show/hide +
 * reorder. Per-widget field-level editors (Dress Code, Photo Moments,
 * Hero Photo, Privacy) already exist as sibling routes under /website/*
 * — this editor adds the LAYER on top: which widgets render on the
 * public landing page, and in what order.
 *
 * V1 layout:
 *   - Vertical list of widget rows, one per widget_type.
 *   - Always-on rows (Hero, Greeting, QR card, RSVP) sit at the top with
 *     a Lock icon. Their show/hide toggle is disabled (helper tooltip
 *     explains why); their Up/Down buttons are disabled. They render in
 *     fixed positions on the public landing page.
 *   - Hideable rows (the other 8) get a working Visible/Hidden toggle +
 *     Up/Down buttons.
 *   - Each row has an "Edit content" link when a per-widget field-level
 *     editor exists (Dress Code, Photo Moments, Hero Photo).
 *
 * V1 deferrals (per the prompt, push to V1.1):
 *   - Drag-and-drop reorder (Up/Down arrow buttons are mobile-friendly +
 *     keyboard-accessible AND require zero new dependencies).
 *   - 3-panel editor with live preview.
 *   - Per-widget config UI for things that don't already have a sibling
 *     editor (RSVP variant, Countdown style, etc.).
 *   - Pro tier purchase flow + tier-toggle UI.
 *   - Preview-as-guest mode.
 */
export default async function WidgetsEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(`event_id, display_name, slug, event_type, ${SECTION_CONTENT_EVENT_COLUMNS}`)
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Load every widget row for this event. RLS guarantees the user is
  // either an accepted moderator or a legacy couple — the migration
  // backfill ensures even pre-2026-06-07 events have all 12 rows after
  // the migration applies.
  //
  // ⚠ EVERY EVENT HAS TWELVE OF THESE ROWS — the migration backfill guarantees
  // ⚠ it. So an EMPTY result here is never the truth; it is a refusal. Supabase
  // ⚠ RESOLVES with { error } instead of throwing, `?? []` empties both lists,
  // ⚠ and the editor tells a couple their invitation has no sections at all
  // ⚠ ("Your optional sections will appear here") — about a page that is live
  // ⚠ and complete. Bind the error and say we could not read it.
  const { data: widgetsRaw, error: widgetsError } = await supabase
    .from('invitation_widgets')
    .select(
      'widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at, mode, audience',
    )
    .eq('event_id', eventId);
  if (widgetsError) {
    logQueryError(
      'WebsiteWidgetsPage.widgets',
      widgetsError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const widgetsMeasured = !widgetsError && widgetsRaw !== null;

  // Defensive filter: a widget_type column value that ISN'T in our
  // canonical enum would crash the editor render. The CHECK constraint
  // makes this impossible from the DB side, but the filter costs
  // nothing and guards against the V1.1+ case where the catalog grows
  // before the editor catches up.
  const widgets: InvitationWidgetRow[] = ((widgetsRaw ?? []) as Array<
    Omit<InvitationWidgetRow, 'widget_type'> & { widget_type: string }
  >)
    .filter((row): row is InvitationWidgetRow => isWidgetType(row.widget_type))
    .map((row) => row as InvitationWidgetRow);

  // Preview-as-guest data — fetch ONE guest with a valid qr_token so the
  // host can click "Preview as guest" and see their invitation render the
  // way a real guest sees it. The public /[slug] URL shows the privacy
  // gate to anonymous visitors per the 2026-05-19 row 426 design
  // (widgets only render on personalized invitation links · the public
  // URL becomes a permanent Public Event Summary 30 days post-wedding).
  //
  // Surfacing this preview path directly from the widgets editor closes
  // the verification gap the owner hit 2026-05-23 ("widgets do not apply
  // on live website") — the editor saves were succeeding; the host was
  // checking the anonymous public URL which deliberately hides widgets.
  //
  // We pick the first guest by created_at order — any guest with a
  // qr_token is a valid preview subject. When no guests exist yet, the
  // button is disabled with a tooltip pointing at the guest list.
  const { data: previewGuest, error: previewGuestError } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, display_name, qr_token')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .not('qr_token', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (previewGuestError) {
    logQueryError(
      'WebsiteWidgetsPage.previewGuest',
      previewGuestError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  const previewGuestName = previewGuest
    ? (previewGuest.display_name?.trim() ||
        `${previewGuest.first_name} ${previewGuest.last_name}`.trim() ||
        null)
    : null;
  const previewUrl = previewGuest?.qr_token && event.slug
    ? `/${event.slug}?invite=${encodeURIComponent(previewGuest.qr_token)}`
    : null;

  // Per-widget content presence — the SAME signals the guest site reads (see
  // lib/website-section-content, which mirrors site-body's openBrowseContent
  // map). Drives the "Shown disabled while empty" rule so a couple can't
  // force-on a section that would render blank to guests. Types with no clear
  // signal fail OPEN via hasContent() (treated as having content).
  const contentMap = await computeSectionContentMap(
    supabase,
    eventId,
    event as unknown as SectionContentEvent,
  );

  const sorted = sortWidgetsForEditor(widgets);
  const alwaysOnRows = sorted.filter((w) => w.is_always_on);
  const hideableRows = sorted.filter((w) => !w.is_always_on);

  const saved = search.saved === '1';
  const errorParam = search.error;
  const errorMessage =
    errorParam === 'always_on'
      ? `That widget can't be hidden — your ${eventNoun(event.event_type)}'s load-bearing surfaces stay visible.`
      : errorParam === 'empty_source'
        ? "You can't force-show a section that's still empty. Add its content first, then set it to Shown."
        : errorParam
          ? "We couldn't save that change. Try again, or contact support if this keeps happening."
          : null;

  return (
    <section className="space-y-8">
      {/* Header strip — back link + title */}
      <PageMasthead
        titleNode={<>Shape your {eventNoun(event.event_type)} page</>}
      />

      {/* Preview-as-guest banner — closes the verification confusion gap
          (owner report 2026-05-23: "widgets do not apply on live website").
          The public /[slug] URL deliberately shows a privacy gate to
          anonymous visitors and does NOT render widgets. Widgets only
          render on personalized guest invitation links carrying ?invite=
          tokens. Surfacing the preview path here in the editor — both as
          plain-English explanation AND as a one-click button — means the
          host never has to puzzle through that gating again. Per
          [[feedback_setnayan_no_dev_text_post_launch]] memory, copy stays
          in brand voice; no "this is the gate" jargon. */}
      <aside
        className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-5 sm:p-6"
        aria-label="How to preview your changes"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3">
            <Sparkles
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <div className="space-y-1.5">
              <p className="font-medium text-ink">
                Want to see how this looks to a guest?
              </p>
              <p className="max-w-prose text-sm text-ink/70">
                The public{' '}
                {event.slug ? (
                  <span className="font-mono text-xs">setnayan.com/{event.slug}</span>
                ) : (
                  `${eventNoun(event.event_type)} link`
                )}{' '}
                shows a polite &ldquo;scan your QR&rdquo; gate to anyone without an
                invitation — your widgets only appear when a guest opens their
                personalized link. Preview as a guest below to see your changes
                land.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {previewUrl && previewGuestName ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700"
              >
                <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Preview as {previewGuestName}
              </a>
            ) : (
              <div className="space-y-1.5 text-right">
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-ink/15 bg-ink/5 px-4 py-2 text-sm font-medium text-ink/40"
                  title="Add at least one guest to your list to enable preview"
                >
                  <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Preview as guest
                </button>
                <Link
                  href={`/dashboard/${eventId}/guests/new`}
                  className="block text-xs text-terracotta hover:text-terracotta-700"
                >
                  + Add your first guest to enable preview
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Saved + error banners */}
      {saved ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>Saved. Your {eventNoun(event.event_type)} page reflects this change now.</p>
        </div>
      ) : null}
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
        >
          {errorMessage}
        </div>
      ) : null}

      {!widgetsMeasured ? (
        <p
          role="alert"
          className="rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">
            We couldn&rsquo;t load your page&rsquo;s sections.
          </strong>{' '}
          This does not mean your {eventNoun(event.event_type)} page has none, and
          nothing has been hidden or removed &mdash; guests still see it exactly
          as you left it. Reload in a moment before changing anything.
        </p>
      ) : null}

      {/* Always-on section */}
      <section className="space-y-3">
        <header>
          <p className="sn-eye">
            Always visible
          </p>
          <p className="mt-1 text-sm text-ink/65">
            These four sections stay in place — they carry your {eventNoun(event.event_type)}&rsquo;s
            most important information.
          </p>
        </header>
        <ul className="space-y-2">
          {alwaysOnRows.map((row) => (
            <WidgetRow
              key={row.widget_id}
              row={row}
              eventId={eventId}
              noun={eventNoun(event.event_type)}
              hasContent={hasContent(row.widget_type, contentMap)}
              isFirstHideable={false}
              isLastHideable={false}
            />
          ))}
        </ul>
      </section>

      {/* Hideable section */}
      <section className="space-y-3">
        <header>
          <p className="sn-eye">
            Optional sections
          </p>
          <p className="mt-1 text-sm text-ink/65">
            Show, hide, and reorder these in any way that fits your {eventNoun(event.event_type)}.
            Use the Up and Down arrows to set the order; the Visible toggle to
            keep or drop each one.
          </p>
        </header>
        {hideableRows.length === 0 ? (
          <p className="sn-row border-dashed p-6 text-sm italic text-ink/55">
            {widgetsMeasured
              ? 'Your optional sections will appear here.'
              : 'We couldn’t read your sections just now — they have not gone anywhere.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {hideableRows.map((row, index) => (
              <WidgetRow
                key={row.widget_id}
                row={row}
                eventId={eventId}
                noun={eventNoun(event.event_type)}
                hasContent={hasContent(row.widget_type, contentMap)}
                isFirstHideable={index === 0}
                isLastHideable={index === hideableRows.length - 1}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Footer note */}
      <footer className="sn-tile p-5 text-sm text-ink/65">
        Changes apply right away. Guests who already opened your page may see the
        previous layout for up to a minute while their browser refreshes.
      </footer>
    </section>
  );
}

/**
 * A single widget row in the editor. Renders:
 *   - Drag handle icon (visual only · V1.1 will wire dnd-kit)
 *   - Widget label + description
 *   - Tier badge ('Free' or 'Pro' when tier='pro')
 *   - "Edit content" link when the widget has a sibling field-level editor
 *   - Visible/Hidden toggle (disabled + Lock icon when always-on)
 *   - Up/Down buttons (disabled at boundaries; hidden entirely for always-on)
 */
function WidgetRow({
  row,
  eventId,
  noun,
  hasContent: rowHasContent,
  isFirstHideable,
  isLastHideable,
}: {
  row: InvitationWidgetRow;
  eventId: string;
  noun: 'wedding' | 'event';
  hasContent: boolean;
  isFirstHideable: boolean;
  isLastHideable: boolean;
}) {
  const catalog: ReturnType<typeof getCatalogEntry> = getCatalogEntry(row.widget_type);
  const editorHref = catalog.editor_subroute
    ? `/dashboard/${eventId}/website/${catalog.editor_subroute}`
    : null;

  // Visibility toggle form — submits the OPPOSITE of the current state.
  // Form-only (no JS) so it works on the slowest 4G in PH per the
  // mobile-first commitment locked across iteration 0031.
  const nextVisible = row.is_visible ? '0' : '1';

  // Open-browse section mode (PR9). A missing value reconciles to 'auto' (the
  // migration default). The control renders for hideable rows only — always-on
  // sections are never holdable (council §1.4).
  const currentMode = row.mode ?? 'auto';
  const autoHint = AUTO_POPULATE_HINT[row.widget_type];

  return (
    <li
      className={`flex flex-col gap-3 sn-row p-4 transition-colors sm:flex-row sm:items-center sm:gap-4 ${
        row.is_visible ? '' : 'opacity-70'
      }`}
    >
      {/* Drag handle — visual cue · functional via Up/Down buttons in V1 */}
      <span
        aria-hidden
        className="hidden shrink-0 text-ink/30 sm:inline-flex sm:items-center"
      >
        <GripVertical className="h-5 w-5" strokeWidth={1.75} />
      </span>

      {/* Label + description */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{catalog.label}</p>
          {row.is_always_on ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/65"
              title={`Always visible — carries your ${noun}'s load-bearing content.`}
            >
              <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
              Always on
            </span>
          ) : null}
          {row.tier === 'pro' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-terracotta-700">
              Pro
            </span>
          ) : null}
        </div>
        <p className="text-xs text-ink/55">{catalog.description}</p>
        {editorHref ? (
          <Link
            href={editorHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:text-terracotta-700"
          >
            <Pencil aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Edit content
          </Link>
        ) : null}
        {autoHint ? (
          <p className="flex items-center gap-1 text-[11px] text-ink/45">
            <Wand2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            {autoHint}
          </p>
        ) : null}
      </div>

      {/* Controls column — the legacy visibility toggle + reorder on top,
          the open-browse three-state mode control below (hideable rows only).
          Both coexist by design: is_visible is the flag-OFF render gate; mode
          is the open-browse couple control (PR7 reader treats is_visible=false
          OR mode='hidden' as hidden). */}
      <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        {/* Visibility toggle */}
        <form action={toggleWidgetVisibility} className="flex items-center">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="widget_id" value={row.widget_id} />
          <input type="hidden" name="widget_type" value={row.widget_type} />
          <input type="hidden" name="next_visible" value={nextVisible} />
          <SubmitButton
            pendingLabel="…"
            disabled={row.is_always_on}
            className={`inline-flex h-9 min-h-[44pt] items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors sm:min-h-0 ${
              row.is_always_on
                ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/40'
                : row.is_visible
                  ? 'border-success-300/70 bg-success-50 text-success-800 hover:border-success-400 hover:bg-success-100/60'
                  : 'border-ink/15 bg-cream text-ink/60 hover:border-ink/30'
            }`}
            aria-label={
              row.is_always_on
                ? `${catalog.label} is always visible`
                : row.is_visible
                  ? `Hide ${catalog.label}`
                  : `Show ${catalog.label}`
            }
            title={
              row.is_always_on
                ? 'This section is always visible — it carries information your guests need.'
                : row.is_visible
                  ? 'Currently visible. Tap to hide.'
                  : 'Currently hidden. Tap to show.'
            }
          >
            {row.is_visible ? (
              <>
                <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Visible
              </>
            ) : (
              <>
                <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Hidden
              </>
            )}
          </SubmitButton>
        </form>

        {/* Up button — hidden for always-on rows; disabled at top boundary */}
        {!row.is_always_on ? (
          <form action={moveWidgetUp} className="flex items-center">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="widget_id" value={row.widget_id} />
            <SubmitButton
              pendingLabel="…"
              disabled={isFirstHideable}
              className={`inline-flex h-9 min-h-[44pt] w-9 items-center justify-center rounded-md border transition-colors sm:min-h-0 ${
                isFirstHideable
                  ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/30'
                  : 'border-ink/15 bg-cream text-ink/65 hover:border-ink/30 hover:text-ink'
              }`}
              aria-label={`Move ${catalog.label} up`}
              title={isFirstHideable ? 'Already at the top.' : 'Move up'}
            >
              <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </SubmitButton>
          </form>
        ) : null}

        {/* Down button — hidden for always-on rows; disabled at bottom boundary */}
        {!row.is_always_on ? (
          <form action={moveWidgetDown} className="flex items-center">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="widget_id" value={row.widget_id} />
            <SubmitButton
              pendingLabel="…"
              disabled={isLastHideable}
              className={`inline-flex h-9 min-h-[44pt] w-9 items-center justify-center rounded-md border transition-colors sm:min-h-0 ${
                isLastHideable
                  ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/30'
                  : 'border-ink/15 bg-cream text-ink/65 hover:border-ink/30 hover:text-ink'
              }`}
              aria-label={`Move ${catalog.label} down`}
              title={isLastHideable ? 'Already at the bottom.' : 'Move down'}
            >
              <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {/* Open-browse three-state section mode — hideable rows only. Always-on
          sections are never holdable (council §1.4), so they get no control.
          Form-only (no JS): each state is its own submit posting setSectionMode.
          The Shown button is disabled when the section has no content yet —
          force-on must never manufacture a blank guest-facing section. */}
      {!row.is_always_on ? (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label={`${catalog.label} — when browsing is open`}
        >
          {(['auto', 'shown', 'hidden'] as const).map((m) => {
            const selected = currentMode === m;
            const disabledShown = m === 'shown' && !rowHasContent;
            const label = m === 'auto' ? 'Auto' : m === 'shown' ? 'Shown' : 'Hidden';
            const modeTitle =
              m === 'auto'
                ? 'Auto — let your page decide based on the section’s content.'
                : m === 'shown'
                  ? disabledShown
                    ? 'Add content first — an empty section can’t be forced on.'
                    : 'Always show this section to guests.'
                  : 'Always hide this section from guests.';
            return (
              <form key={m} action={setSectionMode} className="flex">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="widget_id" value={row.widget_id} />
                <input type="hidden" name="next_mode" value={m} />
                <SubmitButton
                  pendingLabel="…"
                  overlay={false}
                  disabled={disabledShown}
                  aria-pressed={selected}
                  className={`inline-flex h-8 min-h-[36pt] items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors sm:min-h-0 ${
                    disabledShown
                      ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/35'
                      : selected
                        ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                        : 'border-ink/15 bg-cream text-ink/60 hover:border-ink/30 hover:text-ink'
                  }`}
                  aria-label={`Set ${catalog.label} to ${label}`}
                  title={modeTitle}
                >
                  {label}
                </SubmitButton>
              </form>
            );
          })}
        </div>
      ) : null}
      </div>
    </li>
  );
}

function getCatalogEntry(widgetType: WidgetType) {
  return WIDGET_CATALOG_BY_TYPE[widgetType];
}
