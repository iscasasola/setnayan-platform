import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Aperture,
  Scan,
  BatteryWarning,
  Hand,
  Share2,
  Sparkles,
  Tag,
  Info,
  ChevronUp,
  ChevronRight,
  HardDrive,
  Smartphone,
  ImageIcon,
  Film,
  CircleHelp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';

// Iteration 0012 — Papic (scaffold)
//
// Couple-facing admin view of the Papic crew. Surfaces the seat status,
// the DSLR Pro Camera Bridge upgrade, the gesture-shutter teaching card,
// a mock gallery preview, and the V1 settings. Native capture flow itself
// lives in a separate iOS / Android app per spec (deferred to V1.5+ per
// the 2026-05-16 architecture lock); this page is the couple's admin
// surface inside the dashboard.
//
// SPEC: ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md
//   · ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic_compatible_cameras.md
//   · ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic_sdk_notes.md
//
// Every integration seam is marked with TODO(0012): — these stubs are
// deliberately left unwired until the native app and pairing pipeline
// are built. Web V1 here is a couple-admin surface only; no capture.
//
// Prices below come from the spec's "Pricing alignment" section (charm
// pricing locked 2026-05-12). DO NOT invent new prices.

export const metadata = { title: 'Papic · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

// V1 prices, sourced from the spec ("Pricing alignment" table). Charm-priced
// to PHP per the 2026-05-12 decision log; do NOT invent new numbers here.
const PAPIC_3_SEATS_PRICE = 1499;
const PAPIC_5_SEATS_PRICE = 2499;
const PRO_CAMERA_BRIDGE_PRICE = 1499;

// Mock data only. Real seat + bridge state moves to Supabase once the
// native pairing pipeline is built (TODO(0012)).
const MOCK_SEAT_PACK: 'paparazzi_5_seats' | 'paparazzi_3_seats' = 'paparazzi_5_seats';

type MockSeat = {
  id: string;
  label: string;
  claimedBy: string | null;
  proBridge: { brand: string; model: string } | null;
};

const MOCK_SEATS: ReadonlyArray<MockSeat> = [
  { id: 'seat-1', label: 'Seat 1', claimedBy: 'Tita Marites', proBridge: { brand: 'Canon', model: 'EOS R6 Mark II' } },
  { id: 'seat-2', label: 'Seat 2', claimedBy: 'Kuya Paolo', proBridge: null },
  { id: 'seat-3', label: 'Seat 3', claimedBy: 'Ate Joy', proBridge: null },
  { id: 'seat-4', label: 'Seat 4', claimedBy: null, proBridge: null },
  { id: 'seat-5', label: 'Seat 5', claimedBy: null, proBridge: null },
];

type Gesture = {
  id: string;
  title: string;
  body: string;
  Icon: typeof Camera;
};

const GESTURES: ReadonlyArray<Gesture> = [
  {
    id: 'tap',
    title: 'Tap',
    body: 'Photo, no flash. Snappy — fires on touch-up.',
    Icon: Camera,
  },
  {
    id: 'drag-up',
    title: 'Drag up',
    body: 'Photo with flash. Single pop synced to the shutter.',
    Icon: ChevronUp,
  },
  {
    id: 'drag-right',
    title: 'Drag right',
    body: '5-second clip on release. Runs the full 5 seconds — cannot be cut short.',
    Icon: ChevronRight,
  },
  {
    id: 'chord',
    title: 'Drag right → drag up',
    body: '5-second clip with flash. Torch stays on for the full clip.',
    Icon: Sparkles,
  },
];

// Mock gallery items. Tag source matches the spec's three tag-source
// taxonomy (auto_face | qr_scan | untagged) so the chips and counts
// line up with what the native app will actually surface.
type MockPhoto = {
  id: string;
  kind: 'photo' | 'video';
  tagSource: 'auto_face' | 'qr_scan' | 'untagged';
  hue: number;
};

const MOCK_PHOTOS: ReadonlyArray<MockPhoto> = [
  { id: 'p-01', kind: 'photo', tagSource: 'auto_face', hue: 12 },
  { id: 'p-02', kind: 'photo', tagSource: 'qr_scan', hue: 38 },
  { id: 'p-03', kind: 'video', tagSource: 'auto_face', hue: 152 },
  { id: 'p-04', kind: 'photo', tagSource: 'untagged', hue: 200 },
  { id: 'p-05', kind: 'photo', tagSource: 'auto_face', hue: 24 },
  { id: 'p-06', kind: 'photo', tagSource: 'qr_scan', hue: 280 },
  { id: 'p-07', kind: 'video', tagSource: 'qr_scan', hue: 340 },
  { id: 'p-08', kind: 'photo', tagSource: 'auto_face', hue: 56 },
  { id: 'p-09', kind: 'photo', tagSource: 'auto_face', hue: 90 },
  { id: 'p-10', kind: 'photo', tagSource: 'untagged', hue: 220 },
  { id: 'p-11', kind: 'video', tagSource: 'auto_face', hue: 4 },
  { id: 'p-12', kind: 'photo', tagSource: 'qr_scan', hue: 168 },
];

// V1 essential filter chips — exactly the four the spec calls out.
// Sort/filter beyond these four is deferred to V1.1.
const FILTERS = [
  { id: 'chronological', label: 'Chronological' },
  { id: 'photos-of-us', label: 'Photos of us' },
  { id: 'untagged', label: 'Untagged' },
  { id: 'type', label: 'Photo · Video' },
] as const;

// Pro Camera Bridge SDK matrix — Canon · Nikon · Sony · Fujifilm.
// Body counts match the spec's compatible camera list as of 2026-05-11.
const SDK_MATRIX = [
  { brand: 'Canon', sdk: 'EOS Camera Connect SDK', bodies: '11 V1 bodies (R-series mirrorless)' },
  { brand: 'Nikon', sdk: 'SnapBridge SDK + MTP-WiFi', bodies: '9 Z-series + 5 D-series' },
  { brand: 'Sony', sdk: 'Camera Remote SDK', bodies: '16 α / ZV / FX bodies' },
  { brand: 'Fujifilm', sdk: 'Camera Remote SDK', bodies: '14 X / GFX bodies' },
];

function seatPackLabel(pack: 'paparazzi_5_seats' | 'paparazzi_3_seats'): string {
  return pack === 'paparazzi_5_seats' ? 'Papic 5-seat pack' : 'Papic 3-seat pack';
}

function seatPackPrice(pack: 'paparazzi_5_seats' | 'paparazzi_3_seats'): number {
  return pack === 'paparazzi_5_seats' ? PAPIC_5_SEATS_PRICE : PAPIC_3_SEATS_PRICE;
}

export default async function PapicAddonPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // TODO(0012): fetch real Papic seat allocation, seat claims, and
  // bridge purchases from Supabase once the schema is added. For now,
  // surface mock data so the couple can see the admin surface shape
  // and the team can iterate on copy + layout.

  const totalSeats = MOCK_SEATS.length;
  const claimedSeats = MOCK_SEATS.filter((s) => s.claimedBy !== null).length;
  const unclaimedSeats = totalSeats - claimedSeats;
  const bridgeSeats = MOCK_SEATS.filter((s) => s.proBridge !== null).length;

  return (
    <section className="space-y-8 pb-12">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Papic · candid capture crew
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your Papic setup
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Papic turns friends and family into your candid-capture crew. Each
          paparazzo claims a seat from their own phone, shoots through the
          Papic app, and every photo or 5-second clip lands tagged in your
          gallery in real time. The capture experience itself lives in the
          native iOS &amp; Android app — this page is where you manage the
          crew, the camera bridges, and what shows up in your gallery.
        </p>
        <p className="text-xs text-ink/55">
          Native iOS &amp; Android capture flow is on the V1.5+ build path.
          The setup surface below works today so you can plan your crew and
          decide on DSLR upgrades before the capture app ships.
        </p>
      </header>

      <SeatStatusCard
        eventId={eventId}
        pack={MOCK_SEAT_PACK}
        seats={MOCK_SEATS}
        claimed={claimedSeats}
        unclaimed={unclaimedSeats}
        total={totalSeats}
      />

      <ProCameraBridgeCard
        seats={MOCK_SEATS}
        bridgeSeats={bridgeSeats}
        totalSeats={totalSeats}
      />

      <GestureReferenceCard />

      <GalleryPreviewCard />

      <SettingsCard />
    </section>
  );
}

function SeatStatusCard({
  eventId,
  pack,
  seats,
  claimed,
  unclaimed,
  total,
}: {
  eventId: string;
  pack: 'paparazzi_5_seats' | 'paparazzi_3_seats';
  seats: ReadonlyArray<MockSeat>;
  claimed: number;
  unclaimed: number;
  total: number;
}) {
  // TODO(0012): wire the "Send setup QR to crew" CTA to the personal-QR
  // delivery pipeline (0002). For V1.5+ scaffold this is mock copy-link
  // only — no real QR is generated.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Section 1 · seat status
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {seatPackLabel(pack)} ·{' '}
            <span className="font-mono text-base text-terracotta">
              {formatPhp(seatPackPrice(pack))}
            </span>
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {claimed}/{total} claimed
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total seats" value={total.toString()} />
        <Stat label="Claimed by crew" value={claimed.toString()} />
        <Stat label="Still open" value={unclaimed.toString()} accent={unclaimed > 0} />
      </div>

      <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-cream/60">
        {seats.map((seat) => (
          <li
            key={seat.id}
            className="flex items-center justify-between gap-3 p-3 sm:p-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                <Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {seat.label}
                </p>
                <p className="text-xs text-ink/60 truncate">
                  {seat.claimedBy ?? 'Unclaimed — waiting for crew member'}
                </p>
              </div>
            </div>
            {seat.proBridge ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                <Aperture aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                {seat.proBridge.brand}
              </span>
            ) : seat.claimedBy ? (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Phone only
              </span>
            ) : (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                Pending
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-ink">Invite the rest of your crew</p>
          <p className="text-xs text-ink/60">
            Each unclaimed seat gets a wedding-scoped setup link — your
            paparazzo opens it on their phone and the seat token claims to
            their device.
          </p>
        </div>
        {/* TODO(0012): replace with a server action that generates a
            wedding-scoped setup QR via 0002's QR system. For now this is
            a mock copy-link affordance. */}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-600 disabled:opacity-70"
          disabled
          aria-label="Send setup QR to crew (preview — coming with native app)"
          title={`Setup link · setnayan.com/papic/setup/${eventId} — full flow ships with native app`}
        >
          <Share2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Send setup QR to crew
        </button>
      </div>
    </article>
  );
}

function ProCameraBridgeCard({
  seats,
  bridgeSeats,
  totalSeats,
}: {
  seats: ReadonlyArray<MockSeat>;
  bridgeSeats: number;
  totalSeats: number;
}) {
  // TODO(0012): wire DSLR bridge purchase into apply-then-pay (0034)
  // service_orders flow. Each bridge purchase is per device-pair,
  // multi-purchase, shared SKU between 0011 Panood and 0012 Papic.
  // TODO(0012): wire vendor SDK pairing handshakes (Canon EOS Camera
  // Connect / Nikon SnapBridge / Sony Camera Remote / Fujifilm Camera
  // Remote) into the native app — web V1 cannot speak these SDKs.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Section 2 · DSLR Pro Camera Bridge
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Pair a real camera body for{' '}
            <span className="font-mono text-base text-terracotta">
              {formatPhp(PRO_CAMERA_BRIDGE_PRICE)}
            </span>{' '}
            per seat
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          <Aperture aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {bridgeSeats} of {totalSeats} bridged
        </div>
      </div>

      <p className="text-sm text-ink/70 max-w-prose">
        Turn one phone seat into a phone + DSLR pair. The phone keeps doing
        all of the work — gesture shutter, QR tagging, face detection,
        EXIF stamping, adaptive compression, upload — and the camera body
        provides the optical glass. Multi-purchase: one bridge per phone-
        camera pair.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SDK_MATRIX.map((row) => (
          <div
            key={row.brand}
            className="rounded-xl border border-ink/10 bg-cream/60 p-3"
          >
            <p className="text-sm font-semibold text-ink">{row.brand}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              {row.sdk}
            </p>
            <p className="mt-1 text-xs text-ink/65">{row.bodies}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Active bridges
        </p>
        {bridgeSeats === 0 ? (
          <p className="text-sm text-ink/65">
            No seats are bridged yet. Each bridge unlocks per device-pair,
            so you can mix phone-only and phone + DSLR seats however your
            crew is rigged.
          </p>
        ) : (
          <ul className="space-y-2">
            {seats
              .filter((s) => s.proBridge !== null)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-cream px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {s.label} · {s.claimedBy}
                    </p>
                    <p className="text-xs text-ink/60 truncate">
                      Paired with {s.proBridge?.brand} {s.proBridge?.model}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-900">
                    Active
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink/55 max-w-prose">
          One purchase counts toward whichever surface the paired phone
          is running (Papic or Panood live stream).
        </p>
        {/* TODO(0012): wire this CTA into the 0034 apply-then-pay
            service_orders flow once the schema is in place. */}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-terracotta px-4 py-2 text-sm font-medium text-terracotta hover:bg-terracotta/5 disabled:opacity-70"
          disabled
          aria-label="Add Pro Camera Bridge to a seat (coming with native app)"
        >
          <Aperture aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Add bridge to a seat
        </button>
      </div>
    </article>
  );
}

function GestureReferenceCard() {
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 3 · gesture shutter
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Teach your crew the four shutter gestures
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Papic&rsquo;s shutter handles photo, photo + flash, 5-second clip,
          and 5-second clip + flash — all from one button. Front camera is
          disabled by design (rear-only, locked 2026-05-09) so the optical
          quality stays high.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GESTURES.map((g) => (
          <li
            key={g.id}
            className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream/60 p-3 sm:p-4"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
              <g.Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{g.title}</p>
              <p className="mt-0.5 text-xs text-ink/65">{g.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
        <p className="text-xs text-ink/65">
          Every clip is exactly 5 seconds — no shorter. Once your
          paparazzo drags right, the recording runs the full 5 seconds and
          uploads in the background. They can walk away, tag a guest,
          or shoot again — nothing is lost.
        </p>
      </div>
    </article>
  );
}

function GalleryPreviewCard() {
  // TODO(0012): wire to real Photo / Clip rows once R2 upload + tag
  // fan-out land. Mock photos here so couples can see the gallery
  // shape and four-filter chip set before captures exist.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 4 · gallery preview
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          What your gallery looks like
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Auto-face tags fire at ≥ 0.85 cosine confidence. Guests who
          scan a personal or table QR are tagged on the spot. Anything
          still untagged stays in your gallery — Papic never drops a
          photo because of a missing tag.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2" role="list" aria-label="Gallery filters (preview)">
        {FILTERS.map((f, idx) => (
          <li key={f.id}>
            {/* TODO(0012): wire chip filters once gallery is real.
                idx === 0 visually anchored as the default for now. */}
            <span
              className={
                idx === 0
                  ? 'inline-flex items-center gap-1 rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-cream'
                  : 'inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60'
              }
              aria-current={idx === 0 ? 'true' : undefined}
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      <ul
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
        aria-label="Gallery preview (mock photos)"
      >
        {MOCK_PHOTOS.map((photo) => (
          <li key={photo.id}>
            <PhotoTile photo={photo} />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink/65">
        <LegendDot color="bg-emerald-500" label="Auto-face tag" />
        <LegendDot color="bg-terracotta" label="QR-scanned tag" />
        <LegendDot color="bg-ink/30" label="Untagged" />
      </div>
    </article>
  );
}

function PhotoTile({ photo }: { photo: MockPhoto }) {
  // Mock-only tile — solid hue + tag indicator + media-type chip.
  // Real thumbnails will load from R2 once the upload pipeline ships.
  const tagDot =
    photo.tagSource === 'auto_face'
      ? 'bg-emerald-500'
      : photo.tagSource === 'qr_scan'
        ? 'bg-terracotta'
        : 'bg-ink/30';
  const tagLabel =
    photo.tagSource === 'auto_face'
      ? 'Auto-tagged via face match'
      : photo.tagSource === 'qr_scan'
        ? 'Tagged via QR scan'
        : 'Untagged';

  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-lg border border-ink/10"
      style={{ backgroundColor: `hsl(${photo.hue} 55% 80%)` }}
      aria-label={`${photo.kind === 'video' ? '5-second clip' : 'Photo'} · ${tagLabel}`}
    >
      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-cream/85 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-ink">
        {photo.kind === 'video' ? (
          <>
            <Film aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
            5s
          </>
        ) : (
          <>
            <ImageIcon aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
            Photo
          </>
        )}
      </span>
      <span
        className={`absolute right-1.5 top-1.5 inline-flex h-2.5 w-2.5 rounded-full ${tagDot}`}
        title={tagLabel}
      />
      {photo.tagSource === 'qr_scan' ? (
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center justify-center rounded-full bg-cream/85 p-1 text-ink">
          <Scan aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        </span>
      ) : photo.tagSource === 'auto_face' ? (
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center justify-center rounded-full bg-cream/85 p-1 text-ink">
          <Tag aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        </span>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

function SettingsCard() {
  // TODO(0012): wire these toggles to per-event settings in Supabase
  // once the schema lands. For now they render as disabled previews
  // showing the V1 defaults from the spec.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 5 · settings
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Capture defaults</h2>
        <p className="max-w-prose text-sm text-ink/65">
          V1 settings ship locked-down — your paparazzi never have to
          configure the app. Battery + storage warnings are the only
          surfaces that flip during a real event.
        </p>
      </div>

      <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-cream/60">
        <SettingsRow
          Icon={BatteryWarning}
          title="Battery warning at 20%"
          body="When a seat phone drops below 20%, the Papic app surfaces a manual-handoff QR so the next person on standby can claim the seat without losing any queued uploads."
          status="V1 default"
        />
        <SettingsRow
          Icon={HardDrive}
          title="Storage — app sandbox only"
          body="Captures live in the Papic app's private storage with a 24-hour purge after successful upload to R2. Photos never leak into your paparazzo's camera roll."
          status="V1 default"
        />
        <SettingsRow
          Icon={Camera}
          title="Save copies to camera roll"
          body="Opt-in only. Defaults off — if your paparazzo wants their own copy they can flip this on inside the Papic app."
          status="Off by default"
        />
        <SettingsRow
          Icon={CircleHelp}
          title="Front camera"
          body="Front camera is disabled — Papic is rear-only so the photo quality stays high. Locked 2026-05-09."
          status="Rear only"
        />
        <SettingsRow
          Icon={Hand}
          title="Manual handoff QR"
          body="At 20% battery the upload chip flips to a handoff pill. The backup paparazzo scans the QR, the seat token transfers, and queued uploads keep draining from the old device."
          status="V1 default"
        />
      </ul>
    </article>
  );
}

function SettingsRow({
  Icon,
  title,
  body,
  status,
}: {
  Icon: typeof Camera;
  title: string;
  body: string;
  status: string;
}) {
  return (
    <li className="flex items-start gap-3 p-3 sm:p-4">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink/65">{body}</p>
      </div>
      <span className="ml-auto shrink-0 self-start rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
        {status}
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-xl border border-terracotta/30 bg-terracotta/5 p-3'
          : 'rounded-xl border border-ink/10 bg-cream/60 p-3'
      }
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {label}
      </p>
      <p
        className={
          accent
            ? 'mt-1 text-2xl font-semibold tracking-tight text-terracotta'
            : 'mt-1 text-2xl font-semibold tracking-tight text-ink'
        }
      >
        {value}
      </p>
    </div>
  );
}
