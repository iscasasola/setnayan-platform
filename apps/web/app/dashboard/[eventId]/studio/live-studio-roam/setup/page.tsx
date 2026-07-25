import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Trash2,
  MapPin,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Lock,
  Radio,
  MonitorPlay,
  Scissors,
  PowerOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { eventSkuActive } from '@/lib/entitlements';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { MAX_ROAM_ZONES, canAddZone } from '@/lib/live-studio-roam-zones';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  addRoamZone,
  deleteRoamZone,
  setFeaturedRoamZone,
  cutToMainStage,
  clearMainStage,
} from './actions';

export const metadata = { title: 'Live Studio controller · Setnayan' };

// Unified Live Studio SKU (2026-07-25) — the controller-ownership gate keys on the
// merged LIVE_STUDIO SKU, not the retired LIVE_STUDIO_ROAM.
const LIVE_STUDIO_SKU = 'LIVE_STUDIO';

type ZoneRow = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  is_featured: boolean;
  is_main_stage: boolean;
  status: string;
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    zone_added?: string;
    zone_deleted?: string;
    featured_set?: string;
    main_stage_cut?: string;
    main_stage_cleared?: string;
    zone_error?: string;
  }>;
};

export default async function LiveStudioRoamSetupPage({ params, searchParams }: Props) {
  // Flag-dark: the whole Roam surface is gated. notFound() (not redirect) so a
  // direct hit while the flag is off behaves as if the route doesn't exist.
  if (!liveStudioRoamEnabled()) notFound();

  const { eventId } = await params;
  const {
    zone_added,
    zone_deleted,
    featured_set,
    main_stage_cut,
    main_stage_cleared,
    zone_error,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // Roam is a paid capability end-to-end (no free tier, unlike Cast single-cam). The
  // controller assumes ownership; a non-owner is bounced to the detail page to buy.
  const owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  if (!owned) redirect(`/dashboard/${eventId}/studio/live-studio-roam`);

  // Current channels/zones (control-plane; RLS scopes to the host's own event).
  const { data: zoneRows } = await supabase
    .from('live_studio_roam_zones')
    .select('id, zone_index, label, venue_label, is_featured, is_main_stage, status')
    .eq('event_id', eventId)
    .order('zone_index', { ascending: true });
  const zones = (zoneRows ?? []) as ZoneRow[];
  const atCap = !canAddZone(zones.length);
  const mainStageZone = zones.find((z) => z.is_main_stage) ?? null;

  // Live-streaming readiness: the pool-channel OAuth path (G1/G3/G4). Reuses the
  // Cast OAuth config probe — until the owner's Setnayan channel + OAuth are ready,
  // configured channels can't actually go live (they define the picker only).
  const oauthReady = (await getYoutubeOAuthConfig()).ready;

  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/studio/live-studio-roam`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Live Studio
      </Link>

      <PageMasthead
        title="Live Studio controller"
        lede="One directed Main Stage plus your guest cameras. Name each camera — one per angle, room, or venue — then cut whichever one you want onto the Main Stage with a tap. Guests watch your directed Main Stage by default, and can switch to any camera themselves."
      />

      {zone_added ? (
        <Banner tone="success" Icon={CheckCircle2}>Camera added to your picker.</Banner>
      ) : null}
      {zone_deleted ? (
        <Banner tone="muted" Icon={Trash2}>Camera removed.</Banner>
      ) : null}
      {featured_set ? (
        <Banner tone="success" Icon={Star}>Default camera updated.</Banner>
      ) : null}
      {main_stage_cut ? (
        <Banner tone="success" Icon={Scissors}>Cut to Main Stage.</Banner>
      ) : null}
      {main_stage_cleared ? (
        <Banner tone="muted" Icon={PowerOff}>Main Stage is off air.</Banner>
      ) : null}
      {zone_error === 'label' ? (
        <Banner tone="error" Icon={AlertCircle}>Give the camera a name before adding it.</Banner>
      ) : null}
      {zone_error === 'cap' ? (
        <Banner tone="error" Icon={AlertCircle}>
          You’ve reached the limit of {MAX_ROAM_ZONES} cameras for one event.
        </Banner>
      ) : null}
      {zone_error === 'save' ? (
        <Banner tone="error" Icon={AlertCircle}>Couldn’t save that camera — please try again.</Banner>
      ) : null}

      {/* ── Main Stage (the directed channel · switcher) ─────────────────── */}
      <section aria-labelledby="roam-mainstage-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="sn-eye">Main Stage</p>
            <h2
              id="roam-mainstage-heading"
              className="flex items-center gap-2 text-xl font-semibold tracking-tight"
            >
              <MonitorPlay aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Your directed feed
            </h2>
          </div>
          {mainStageZone ? (
            <form action={clearMainStage}>
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton
                pendingLabel="Ending…"
                className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
              >
                <PowerOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Take off air
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {/* Live monitor — the camera currently cut to the Main Stage. Real video
            arrives with the streaming rollout (OAuth-gated below); today this shows
            which source is on air so the director can cut confidently. */}
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-ink/10 bg-ink text-center">
          {mainStageZone ? (
            <p className="inline-flex flex-col items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-cream">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
                On air
              </span>
              <span className="text-sm font-semibold tracking-normal normal-case text-cream">
                {mainStageZone.label}
              </span>
            </p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
              Main Stage off air — cut a camera below
            </p>
          )}
        </div>

        {zones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 p-4 text-sm text-ink/60">
            Add cameras below, then cut one onto the Main Stage.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Cut a camera to Main Stage
            </p>
            <div className="flex flex-wrap gap-2">
              {zones.map((z) => (
                <form key={z.id} action={cutToMainStage}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="zone_id" value={z.id} />
                  <SubmitButton
                    pendingLabel="Cutting…"
                    disabled={z.is_main_stage}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      z.is_main_stage
                        ? 'cursor-default bg-terracotta text-cream'
                        : 'border border-ink/15 bg-white text-ink/70 hover:border-terracotta/40 hover:text-terracotta',
                    ].join(' ')}
                  >
                    {z.is_main_stage ? (
                      <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <Scissors aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                    <span>
                      <span className="font-mono text-[10px] text-current/60">#{z.zone_index}</span>{' '}
                      {z.label}
                    </span>
                    {z.is_main_stage ? (
                      <span className="font-mono text-[0.6rem] uppercase tracking-wider">on air</span>
                    ) : null}
                  </SubmitButton>
                </form>
              ))}
            </div>
            <p className="text-xs text-ink/55">
              One tap cuts that camera onto the Main Stage — the directed feed every guest sees by
              default. No compositing or picture-in-picture in this version; it&rsquo;s a clean cut
              between whole cameras.
            </p>
          </div>
        )}
      </section>

      {/* ── Channel list ─────────────────────────────────────────────────── */}
      <section aria-labelledby="roam-channels-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="sn-eye">Your cameras</p>
            <h2 id="roam-channels-heading" className="text-xl font-semibold tracking-tight">
              {zones.length} of {MAX_ROAM_ZONES} channels
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 text-xs font-medium text-success-900">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Live Studio active on this event
          </span>
        </div>

        {zones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 p-4 text-sm text-ink/60">
            No cameras yet. Add your first one below — for example “Ceremony”, “Reception
            Floor”, or “Photo Booth”.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 bg-cream/60">
            {zones.map((z) => (
              <li key={z.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="font-mono text-xs text-ink/45">#{z.zone_index}</span>
                    {z.label}
                    {z.is_featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                        <Star aria-hidden className="h-3 w-3" strokeWidth={2} />
                        Default
                      </span>
                    ) : null}
                  </p>
                  {z.venue_label ? (
                    <p className="flex items-center gap-1 text-xs text-ink/55">
                      <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                      {z.venue_label}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {!z.is_featured ? (
                    <form action={setFeaturedRoamZone}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="zone_id" value={z.id} />
                      <SubmitButton
                        pendingLabel="Setting…"
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta"
                      >
                        <Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Make default
                      </SubmitButton>
                    </form>
                  ) : null}
                  <form action={deleteRoamZone}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="zone_id" value={z.id} />
                    <SubmitButton
                      pendingLabel="Removing…"
                      className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Remove
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Add channel ──────────────────────────────────────────────────── */}
      <section aria-labelledby="roam-add-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="sn-eye">Add a camera</p>
          <h2 id="roam-add-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Plus aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            New channel
          </h2>
          <p className="max-w-prose text-sm text-ink/65">
            Each camera is a phone your paparazzi join by scanning the event QR — no install.
            Group cameras by venue to help guests find them (optional).
          </p>
        </div>

        {atCap ? (
          <p className="rounded-lg border border-ink/15 bg-ink/5 p-4 text-sm text-ink/60">
            You’ve reached the {MAX_ROAM_ZONES}-camera limit. Remove one to add another.
          </p>
        ) : (
          <form action={addRoamZone} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="event_id" value={eventId} />
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                Camera name
              </span>
              <input
                type="text"
                name="label"
                required
                maxLength={60}
                placeholder="Ceremony, Reception Floor, Photo Booth…"
                className="min-h-[44px] w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                Venue <span className="text-ink/40">(optional)</span>
              </span>
              <input
                type="text"
                name="venue_label"
                maxLength={60}
                placeholder="Church, Grand Ballroom…"
                className="min-h-[44px] w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/75 sm:col-span-2">
              <input
                type="checkbox"
                name="is_featured"
                className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
              />
              Open the picker on this camera by default
            </label>
            <div className="sm:col-span-2">
              <SubmitButton
                pendingLabel="Adding…"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
              >
                <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                Add camera
              </SubmitButton>
            </div>
          </form>
        )}
      </section>

      {/* ── Going live (owner-OAuth gated) ───────────────────────────────── */}
      <section aria-labelledby="roam-golive-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="sn-eye">Going live</p>
          <h2 id="roam-golive-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            On the day
          </h2>
        </div>
        <div className="sn-row p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/55"
            >
              {oauthReady ? (
                <Clock3 className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Lock className="h-4 w-4" strokeWidth={1.75} />
              )}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink/85">
                Live camera feeds arrive with the streaming rollout
              </p>
              <p className="max-w-prose text-xs text-ink/60">
                Your cameras above define the picker your guests see. On broadcast day each
                one goes live on a Setnayan channel, and the picker on your event page lights
                up so guests can choose their view. That live streaming step is being wired
                now — we’ll email you the moment it’s ready. Nothing here needs redoing; your
                channel layout is saved.
              </p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function Banner({
  tone,
  Icon,
  children,
}: {
  tone: 'success' | 'muted' | 'error';
  Icon: typeof CheckCircle2;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'success'
      ? 'border-success-300/70 bg-success-50 text-success-900'
      : tone === 'error'
        ? 'border-danger-300/70 bg-danger-50 text-danger-900'
        : 'border-ink/15 bg-cream text-ink/75';
  return (
    <p role="status" className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      {children}
    </p>
  );
}
