import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Shirt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { updateDressCode, type DressCodeConfig } from './actions';
import { ListField } from './_components/list-field';
import { PaletteField } from './_components/palette-field';

export const metadata = { title: 'Edit dress code · Setnayan' };

/**
 * /dashboard/[eventId]/website/dress-code — host-curated dress code editor
 * (CLAUDE.md 2026-05-22 · sibling of hero photo + photo moments + privacy).
 *
 * Owner directive 2026-05-22 — *"how can we edit the wedding's landing
 * page/website"*. The dress-code section on /[slug] used to ship a hardcoded
 * "Look magical" demo. This editor lets hosts tell their actual guests what
 * to wear, what to avoid, and which palette to lean into. The renderer in
 * apps/web/app/[slug]/page.tsx DressCodeWidget reads events.dress_code_config
 * (migration 20260605030000_events_dress_code_config.sql) and falls back to
 * a polite brand-voice empty state when the host hasn't set anything yet.
 *
 * Layout: stacked on mobile · two-column on lg (editor left, preview right)
 * so the host can see how the section reads on the public page as they type.
 */
export default async function DressCodeEditorPage({
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
    .select('event_id, display_name, slug, dress_code_config')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Bind the server action to this event id — Next.js form actions can
  // pre-bind args like this so the page-level eventId travels with the form.
  const updateAction = updateDressCode.bind(null, eventId);

  const config = normalizeConfig(event.dress_code_config);
  const saved = search.saved === '1';
  const error = search.error;

  return (
    <section className="space-y-6">
      {/* Header strip */}
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to website
        </Link>
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Shirt aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Dress code
          </p>
          <h1 className="mt-1 font-serif text-3xl italic tracking-tight sm:text-4xl">
            Tell your guests what to wear
          </h1>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            Add a palette so guests can match the mood of your wedding. Share the look
            you&rsquo;re going for — and the few things you&rsquo;d rather they skip.
          </p>
        </div>

        {saved ? (
          <div
            role="status"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Saved — your guests will see this on the wedding website.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : null}
      </header>

      {/* Two-column layout — editor left, preview right on lg+ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Editor */}
        <form action={updateAction} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label
              htmlFor="dress-code-title"
              className="block font-mono text-xs uppercase tracking-[0.18em] text-ink/55"
            >
              Headline
            </label>
            <input
              id="dress-code-title"
              type="text"
              name="title"
              defaultValue={config.title}
              maxLength={80}
              placeholder="e.g. Look magical · Dress in Filipiniana · Garden formal"
              className="block w-full min-h-[44pt] rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            />
            <p className="text-xs text-ink/55">One short headline. Up to 80 characters.</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="dress-code-description"
              className="block font-mono text-xs uppercase tracking-[0.18em] text-ink/55"
            >
              Guidance
            </label>
            <textarea
              id="dress-code-description"
              name="description"
              defaultValue={config.description}
              maxLength={600}
              rows={4}
              placeholder="A sentence or two on what you're picturing. Formal? Garden party? Filipiniana? Lean into the palette? Tell guests in your own voice."
              className="block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            />
            <p className="text-xs text-ink/55">Up to 600 characters.</p>
          </div>

          {/* Palette */}
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
              Palette
            </p>
            <p className="text-xs text-ink/55">
              Up to six swatches. Guests use these to dress in colors that
              match your wedding&rsquo;s mood.
            </p>
            <PaletteField initial={config.palette} />
          </div>

          {/* Do */}
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Do
            </p>
            <p className="text-xs text-ink/55">What you&rsquo;d love guests to wear.</p>
            <ListField name="dos" tone="do" initial={config.dos} />
          </div>

          {/* Don't */}
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-rose-700">
              Don&rsquo;t
            </p>
            <p className="text-xs text-ink/55">
              What you&rsquo;d rather they skip. Be kind — they&rsquo;ll read this.
            </p>
            <ListField name="donts" tone="dont" initial={config.donts} />
          </div>

          {/* Submit */}
          <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
            <button
              type="submit"
              className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-terracotta px-5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Save changes
            </button>
            <Link
              href={`/dashboard/${eventId}/website`}
              className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Preview */}
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
            Live preview
          </p>
          <DressCodePreview config={config} />
          <p className="mt-2 text-xs italic text-ink/55">
            This is roughly how the dress-code section reads on{' '}
            {event.slug ? (
              <Link
                href={`/${event.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-terracotta underline-offset-2 hover:underline"
              >
                your wedding website
              </Link>
            ) : (
              'your wedding website'
            )}
            . Save changes to see them live.
          </p>
        </aside>
      </div>
    </section>
  );
}

/**
 * Read a config blob defensively — the column defaults to `{}` so brand-new
 * events have every field absent. Also tolerates a partial save (the editor
 * only writes valid hex; older rows that bypassed the editor might be in any
 * shape, so guard each field).
 */
function normalizeConfig(raw: unknown): DressCodeConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    description: typeof obj.description === 'string' ? obj.description : '',
    dos: Array.isArray(obj.dos)
      ? obj.dos.filter((v): v is string => typeof v === 'string')
      : [],
    donts: Array.isArray(obj.donts)
      ? obj.donts.filter((v): v is string => typeof v === 'string')
      : [],
    palette: Array.isArray(obj.palette)
      ? obj.palette
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const name = typeof r.name === 'string' ? r.name : '';
            const hex = typeof r.hex === 'string' ? r.hex : '';
            if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
            return { name, hex };
          })
          .filter((row): row is { name: string; hex: string } => row !== null)
      : [],
  };
}

/**
 * Server-rendered preview — intentionally a stripped-down copy of the
 * landing-page DressCodeWidget (apps/web/app/[slug]/page.tsx) so the host
 * can see how their config will read without leaving the editor.
 */
function DressCodePreview({ config }: { config: DressCodeConfig }) {
  const hasAnything =
    config.title ||
    config.description ||
    config.dos.length > 0 ||
    config.donts.length > 0 ||
    config.palette.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 bg-cream/60 p-6 text-sm italic text-ink/55">
        Your dress code section appears here as you type. Add a headline,
        guidance, palette, and do&rsquo;s and don&rsquo;ts to see it come together.
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Dress code</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">
          {config.title || 'Your headline appears here'}
        </h3>
      </header>
      {config.description ? <p className="text-sm text-ink/70">{config.description}</p> : null}
      {config.palette.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {config.palette.map((p, i) => (
            <div
              key={`${p.hex}-${i}`}
              className="flex items-center gap-2 text-xs text-ink/70"
            >
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-full ring-1 ring-ink/10"
                style={{ backgroundColor: p.hex }}
              />
              {p.name}
            </div>
          ))}
        </div>
      ) : null}
      {config.dos.length > 0 || config.donts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {config.dos.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em]">Do</p>
              <ul className="space-y-1">
                {config.dos.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {config.donts.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em]">
                Don&rsquo;t
              </p>
              <ul className="space-y-1">
                {config.donts.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
