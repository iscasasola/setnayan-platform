import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Tv,
  Star,
  Cast,
  Radio,
  Mic,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Panood broadcaster · Setnayan' };

// Iteration 0011 — Panood broadcaster admin preview.
//
// This is the broadcaster's tactile surface during the wedding: the camera
// grid (read-only mock for the scaffold), the highlight-marker button, the
// cast-to-projector toggle, and a stripped-down audio rail. The whole page
// is a static preview — none of the controls dispatch real actions in
// V1.5+. The integration seams are surfaced as `// TODO(0011):` markers so
// a follow-up iteration can drop the live wiring into clear hooks.
//
// Why a static preview is useful even without wiring: the couple can rehearse
// the layout with the camera operators before broadcast day, screenshot it
// for vendor briefings, and verify their camera count matches what the
// orders system says they bought.

type CameraTile = {
  id: number;
  label: string;
  status: 'paused' | 'live' | 'offline';
};

// Mock camera roster — 3 base cams + 1 add-on. The add-on count is sourced
// from the parent setup mock; the broadcaster grid renders the active
// cameras as they'd appear if all operators had joined.
const CAMERAS: ReadonlyArray<CameraTile> = [
  { id: 1, label: 'Camera 1 · wide / aisle', status: 'paused' },
  { id: 2, label: 'Camera 2 · groom side', status: 'paused' },
  { id: 3, label: 'Camera 3 · bride side', status: 'paused' },
  { id: 4, label: 'Camera 4 · couple close-up', status: 'paused' },
];

type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodBroadcasterPreview({ params }: Props) {
  const { eventId } = await params;
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

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons/panood`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Panood setup
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Broadcaster preview
        </p>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Tv aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          {event.display_name} &middot; broadcast preview
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          This is what the broadcaster admin looks like on the day. The grid below is a
          preview &mdash; the camera feeds light up once operators join via their setup
          links. Highlight marker, cast-to-projector, and audio mute are all included in
          the base SKU.
        </p>
      </header>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={2} />
          Preview mode
        </span>
        <p className="mt-1">
          Buttons on this page don&rsquo;t dispatch real actions yet. The Cloudflare
          Stream Live SFU, YouTube RTMP relay, and projector cast all wire up in a
          follow-up iteration &mdash; the surface is here so couples can rehearse the
          layout.
        </p>
      </div>

      <section
        aria-label="Camera grid"
        className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Cameras</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {CAMERAS.length} cameras
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAMERAS.map((cam) => (
            <li key={cam.id}>
              <CameraCard cam={cam} />
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Broadcaster controls"
        className="grid gap-3 sm:grid-cols-3"
      >
        <ControlButton
          Icon={Star}
          label="Mark highlight"
          sub="Tap during a meaningful moment (vows, first kiss, first dance). AI Highlight reels pull these moments first."
        />
        <ControlButton
          Icon={Cast}
          label="Cast to projector"
          sub="Routes the active feed to the venue projector via HDMI from the broadcaster device. Latency ~500ms."
        />
        <ControlButton
          Icon={Radio}
          label="Go live · hold 1.5s"
          sub="Hold to confirm. Once live, the broadcast pushes to YouTube and the landing-page IFrame Player lights up."
          tone="primary"
        />
      </section>

      <section
        aria-label="Audio rail"
        className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Mic aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            Audio rail
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            3 channels
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <AudioChannel label="CAM 1 MIC" level={0.45} />
          <AudioChannel label="CAM 3 PGM" level={0.7} />
          <AudioChannel label="MUSIC BED" level={0.3} />
        </div>
        <p className="text-xs text-ink/55">
          Real-time level meters land in the follow-up iteration &mdash; this preview
          renders the layout with mock levels so operators can rehearse the cut.
        </p>
      </section>
    </section>
  );
}

function CameraCard({ cam }: { cam: CameraTile }) {
  const statusLabel =
    cam.status === 'live'
      ? 'LIVE'
      : cam.status === 'offline'
        ? 'OFFLINE'
        : 'PAUSED';
  const statusTone =
    cam.status === 'live'
      ? 'bg-emerald-100 text-emerald-900'
      : cam.status === 'offline'
        ? 'bg-rose-100 text-rose-900'
        : 'bg-ink/10 text-ink/65';

  return (
    <article className="overflow-hidden rounded-xl border border-ink/10 bg-cream">
      {/* TODO(0011): replace this placeholder with the real WebRTC <video>
          element once the SFU subscription wires up. */}
      <div
        aria-hidden
        className="relative flex aspect-video items-center justify-center bg-ink/85 text-cream/80"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)]"
        />
        <span className="font-mono text-xs uppercase tracking-[0.25em]">
          Cam {cam.id} feed
        </span>
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="text-sm font-medium text-ink">{cam.label}</p>
        <p className="text-xs text-ink/55">Tap to set as program · health check pending</p>
      </div>
    </article>
  );
}

function ControlButton({
  Icon,
  label,
  sub,
  tone,
}: {
  Icon: typeof Star;
  label: string;
  sub: string;
  tone?: 'primary';
}) {
  const buttonClass =
    tone === 'primary'
      ? 'flex h-full flex-col gap-2 rounded-xl border border-terracotta/30 bg-terracotta/10 p-4 text-left text-terracotta-700'
      : 'flex h-full flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-4 text-left text-ink hover:border-terracotta/40';
  return (
    // The button is non-functional in V1.5+ scaffold; keep type=button so it
    // doesn't accidentally submit a parent form (it has none, but defensive).
    // TODO(0011): wire to broadcaster server actions once the orchestrator
    // ships.
    <button type="button" className={buttonClass}>
      <span className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {label}
      </span>
      <span className="text-xs text-ink/65">{sub}</span>
    </button>
  );
}

function AudioChannel({ label, level }: { label: string; level: number }) {
  const widthPct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  // Tailwind can't do arbitrary class names for percent widths in JIT mode
  // unless we use the inline style. Keep the percentage inline; everything
  // else stays in the class string.
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/70 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          {label}
        </span>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          M · mute
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
        <div
          aria-hidden
          className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
