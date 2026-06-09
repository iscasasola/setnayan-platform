import Link from 'next/link';
import {
  ArrowRight,
  Music,
  Heart,
  Sparkles,
  Church,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { updateOnboardingMusic } from './actions';

export const metadata = { title: 'Onboarding · Admin' };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminOnboardingPage({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = createAdminClient();
  const settings = await fetchPlatformSettings(admin);

  // Wedding onboarding background music — resolve the stored r2:// ref so the
  // uploader shows the current track. Same columns the /onboarding/wedding read
  // path uses (relocated here from /admin/settings; read path unchanged).
  const musicRef =
    typeof settings.onboarding_bg_music_r2_key === 'string' &&
    settings.onboarding_bg_music_r2_key.startsWith('r2://')
      ? settings.onboarding_bg_music_r2_key
      : null;
  const musicUrl = musicRef ? await displayUrlForStoredAsset(musicRef) : null;
  const musicDisplay: Record<string, string> = {};
  if (musicRef && musicUrl) musicDisplay[musicRef] = musicUrl;
  const musicEnabled = settings.onboarding_bg_music_enabled === true;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan · Internal ops</p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
          Onboarding
        </h1>
        <p className="text-base text-ink/65">
          Settings that tune the new-account onboarding flows — grouped by
          onboarding type so each gets its own home. Today there is one flow
          (<strong className="text-ink">Wedding</strong>); as Setnayan opens new
          event types, each adds a section here.
        </p>
      </header>

      {sp.saved ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden /> Saved.
        </div>
      ) : null}
      {sp.error ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden /> {sp.error}
        </div>
      ) : null}

      {/* ── WEDDING ONBOARDING ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-mulberry/10 text-mulberry">
            <Heart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">Wedding</h2>
            <p className="text-xs text-ink/55">
              <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">/onboarding/wedding</code>
            </p>
          </div>
        </header>

        {/* Background music */}
        <div className="rounded-xl border border-ink/10 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <Music className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden />
            <h3 className="m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Background music
            </h3>
          </div>
          <p className="mb-3 text-sm text-ink/60">
            A soft, low-volume soundtrack while couples go through the wedding
            onboarding. It never blasts on — it starts quietly on the first tap
            and each couple can mute it. Upload an{' '}
            <strong>owned / AI-generated</strong> track only (e.g. your Suno
            instrumental) — Setnayan serves the file, so it must be music you own
            the rights to. Leave empty for no music.
          </p>

          <form action={updateOnboardingMusic} className="space-y-3">
            <FileUpload
              bucket="media"
              pathPrefix="onboarding/background-music"
              name="bg_music_url"
              multiple={false}
              maxSizeMB={40}
              acceptedTypes={['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']}
              currentValue={musicRef}
              initialDisplayUrls={musicDisplay}
              variant="wide"
              label="Music file"
              help="MP3, M4A, AAC, OGG, or WAV. Up to 40 MB (a ~30-min instrumental fits). A seamless loop also works."
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="onboarding_bg_music_enabled"
                defaultChecked={musicEnabled}
                className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
              />
              Play background music during onboarding
            </label>
            <SubmitButton className="button-primary inline-flex items-center gap-2" pendingLabel="Saving…">
              Save background music
            </SubmitButton>
          </form>
        </div>

        {/* Related content — lives in its own catalog, linked for discoverability */}
        <div className="mt-4">
          <p className="mb-2 m-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            Content the wedding onboarding pulls from
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <RelatedLink
              href="/admin/songs"
              icon={<Music className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              label="Songs"
              sub="The recommended song list in the song step"
            />
            <RelatedLink
              href="/admin/refinements"
              icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              label="Refinements"
              sub="Per-category facets + sample photos"
            />
            <RelatedLink
              href="/admin/wedding-types"
              icon={<Church className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              label="Wedding types"
              sub="Which religions the flow offers"
            />
          </div>
        </div>
      </section>

      {/* ── FUTURE TYPES ───────────────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-dashed border-ink/15 bg-cream/20 p-5 text-sm text-ink/55">
        <p className="font-semibold text-ink/70">More onboarding flows</p>
        <p className="mt-1">
          As Setnayan opens new event types (birthday, celebration, corporate,
          and more), each gets its own settings section here — same shape as
          Wedding above. When a second flow needs its own music or knobs, the
          storage moves to a per-type table; today Wedding is the only flow.
        </p>
      </section>
    </div>
  );
}

function RelatedLink({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-2 rounded-lg border border-ink/10 bg-white p-3 hover:border-terracotta/30 hover:bg-terracotta/5"
    >
      <span className="mt-0.5 text-terracotta">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-semibold text-ink">
          {label}
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 text-ink/35 transition group-hover:translate-x-0.5 group-hover:text-terracotta"
            strokeWidth={1.75}
          />
        </span>
        <span className="block text-xs text-ink/55">{sub}</span>
      </span>
    </Link>
  );
}
