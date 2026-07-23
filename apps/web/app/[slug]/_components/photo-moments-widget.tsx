import { Camera, CircleSlash, Sparkles } from 'lucide-react';

// Mode enum matches the server-side validator at
// /dashboard/[eventId]/website/photo-moments/actions.ts. Three values
// each get a distinct visual treatment on the landing page:
//   • camera_ok   — emerald Camera icon, "cameras welcome"
//   • phone_down  — quiet ink CircleSlash, "stay present"
//   • papic_only  — terracotta Sparkles, "our paparazzo will capture"
type PhotoMomentMode = 'camera_ok' | 'phone_down' | 'papic_only';
type PhotoMoment = {
  time_label: string;
  title: string;
  note: string;
  mode: PhotoMomentMode;
};

function parsePhotoMomentsConfig(
  raw: unknown,
): { intro_copy: string; moments: PhotoMoment[] } {
  if (!raw || typeof raw !== 'object') return { intro_copy: '', moments: [] };
  const obj = raw as Record<string, unknown>;
  const intro = typeof obj.intro_copy === 'string' ? obj.intro_copy : '';
  const momentsRaw = Array.isArray(obj.moments) ? obj.moments : [];
  const moments: PhotoMoment[] = [];
  for (const m of momentsRaw) {
    if (!m || typeof m !== 'object') continue;
    const item = m as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (title.length === 0) continue;
    const timeLabel = typeof item.time_label === 'string' ? item.time_label : '';
    const note = typeof item.note === 'string' ? item.note : '';
    const modeStr = typeof item.mode === 'string' ? item.mode : 'phone_down';
    const mode: PhotoMomentMode =
      modeStr === 'camera_ok' || modeStr === 'papic_only' ? modeStr : 'phone_down';
    moments.push({ time_label: timeLabel, title, note, mode });
    if (moments.length >= 8) break;
  }
  return { intro_copy: intro, moments };
}

export function PhotoMomentsWidget({ config }: { config: unknown }) {
  const { intro_copy, moments } = parsePhotoMomentsConfig(config);

  // No host-curated moments yet — render polite brand-voice fallback
  // instead of the prior hardcoded sample list. Per the no-dev-text rule,
  // this reads as a calm "coming soon" not a developer placeholder.
  if (moments.length === 0) {
    return (
      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Savour the moments
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">
            Photo moments
          </h3>
        </header>
        <p className="rounded-lg border border-dashed border-ink/20 bg-cream p-5 text-center text-sm italic text-ink/60">
          Your hosts will share their photo guidance closer to the wedding.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
          Savour the moments
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Photo moments</h3>
      </header>
      {intro_copy.trim().length > 0 ? (
        <p className="text-sm text-ink/70">{intro_copy}</p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {moments.map((m, i) => (
          <li
            key={`${m.title}-${i}`}
            className="space-y-2 rounded-lg border border-ink/10 bg-cream p-4 text-sm"
          >
            <PhotoMomentModeBadge mode={m.mode} />
            {m.time_label.trim().length > 0 ? (
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
                {m.time_label}
              </p>
            ) : null}
            <p className="font-medium text-ink">{m.title}</p>
            {m.note.trim().length > 0 ? (
              <p className="text-xs text-ink/60">{m.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhotoMomentModeBadge({ mode }: { mode: PhotoMomentMode }) {
  if (mode === 'camera_ok') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.15em] text-success-800">
        <Camera aria-hidden className="h-3 w-3" strokeWidth={2} />
        Cameras welcome
      </span>
    );
  }
  if (mode === 'papic_only') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.15em] text-terracotta-700">
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
        Our paparazzo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
      <CircleSlash aria-hidden className="h-3 w-3" strokeWidth={2} />
      Phone-down
    </span>
  );
}
