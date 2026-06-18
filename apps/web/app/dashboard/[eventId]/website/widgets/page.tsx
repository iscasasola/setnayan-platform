import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Lock,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  type InvitationWidgetRow,
  type WidgetType,
  WIDGET_CATALOG_BY_TYPE,
  isWidgetType,
  sortWidgetsForEditor,
} from '@/lib/invitation-widgets';
import {
  moveWidgetDown,
  moveWidgetUp,
  toggleWidgetVisibility,
} from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Customize widgets · Setnayan' };

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
    .select('event_id, display_name, slug')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Load every widget row for this event. RLS guarantees the user is
  // either an accepted moderator or a legacy couple — the migration
  // backfill ensures even pre-2026-06-07 events have all 12 rows after
  // the migration applies.
  const { data: widgetsRaw } = await supabase
    .from('invitation_widgets')
    .select(
      'widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at',
    )
    .eq('event_id', eventId);

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
  const { data: previewGuest } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, display_name, qr_token')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .not('qr_token', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const previewGuestName = previewGuest
    ? (previewGuest.display_name?.trim() ||
        `${previewGuest.first_name} ${previewGuest.last_name}`.trim() ||
        null)
    : null;
  const previewUrl = previewGuest?.qr_token && event.slug
    ? `/${event.slug}?invite=${encodeURIComponent(previewGuest.qr_token)}`
    : null;

  const sorted = sortWidgetsForEditor(widgets);
  const alwaysOnRows = sorted.filter((w) => w.is_always_on);
  const hideableRows = sorted.filter((w) => !w.is_always_on);

  const saved = search.saved === '1';
  const errorParam = search.error;
  const errorMessage =
    errorParam === 'always_on'
      ? "That widget can't be hidden — your wedding's load-bearing surfaces stay visible."
      : errorParam
        ? "We couldn't save that change. Try again, or contact support if this keeps happening."
        : null;

  return (
    <section className="space-y-8">
      {/* Header strip — back link + title */}
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Back to your wedding website
        </Link>
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <LayoutGrid aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Customize widgets
          </p>
          <h1 className="font-serif text-3xl italic tracking-tight sm:text-4xl">
            Shape your wedding page
          </h1>
          <p className="max-w-prose text-base text-ink/70">
            Choose which sections appear on{' '}
            {event.slug ? (
              <span className="font-mono text-sm">setnayan.com/{event.slug}</span>
            ) : (
              'your wedding website'
            )}
            , and the order they show up in. Hero, Greeting, QR card, and RSVP
            stay pinned in their canonical spots — every guest needs them.
          </p>
        </div>
      </header>

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
                  'wedding link'
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
          className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>Saved. Your wedding page reflects this change now.</p>
        </div>
      ) : null}
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {errorMessage}
        </div>
      ) : null}

      {/* Always-on section */}
      <section className="space-y-3">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Always visible
          </p>
          <p className="mt-1 text-sm text-ink/65">
            These four sections stay in place — they carry your wedding&rsquo;s
            most important information.
          </p>
        </header>
        <ul className="space-y-2">
          {alwaysOnRows.map((row) => (
            <WidgetRow
              key={row.widget_id}
              row={row}
              eventId={eventId}
              isFirstHideable={false}
              isLastHideable={false}
            />
          ))}
        </ul>
      </section>

      {/* Hideable section */}
      <section className="space-y-3">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Optional sections
          </p>
          <p className="mt-1 text-sm text-ink/65">
            Show, hide, and reorder these in any way that fits your wedding.
            Use the Up and Down arrows to set the order; the Visible toggle to
            keep or drop each one.
          </p>
        </header>
        {hideableRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 p-6 text-sm italic text-ink/55">
            Your optional sections will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {hideableRows.map((row, index) => (
              <WidgetRow
                key={row.widget_id}
                row={row}
                eventId={eventId}
                isFirstHideable={index === 0}
                isLastHideable={index === hideableRows.length - 1}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Footer note */}
      <footer className="rounded-xl border border-ink/10 bg-cream/60 p-5 text-sm text-ink/65">
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
  isFirstHideable,
  isLastHideable,
}: {
  row: InvitationWidgetRow;
  eventId: string;
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

  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border bg-cream p-4 transition-colors sm:flex-row sm:items-center sm:gap-4 ${
        row.is_visible
          ? 'border-ink/10'
          : 'border-ink/10 bg-cream/60 opacity-70'
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
              title="Always visible — carries your wedding's load-bearing content."
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
      </div>

      {/* Controls — visibility toggle + Up / Down */}
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
                  ? 'border-emerald-300/70 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100/60'
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
    </li>
  );
}

function getCatalogEntry(widgetType: WidgetType) {
  return WIDGET_CATALOG_BY_TYPE[widgetType];
}
