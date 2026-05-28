import { AlertCircle, BookOpen, Sparkles } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

// V1 MVP catalog over `public.concierge_brain_chunks` (locked 2026-05-18 via
// migration 20260518500000_iteration_0016_wizard_architecture_schema.sql).
//
// Brand-layer rename 2026-05-28 V2 cutover — surface labels read as "Today's
// Focus brain" since the ₱2,499 Setnayan Concierge SKU was supplanted by the
// ₱1,499 TODAYS_FOCUS one-time SKU. Route path + DB table + column names
// (concierge_brain_chunks, concierge_unanswered_questions, paid_tier_only)
// stay as-is so the schema layer doesn't ripple through every consumer.
//
// WHY this surface ships now while the AI Today's Focus chat is OFF for pilot:
//   Per CLAUDE.md 2026-05-22 row 3, the wizard's AI chat layer is hidden
//   behind a feature flag during the pilot cohort. But brain content
//   authoring is the long-pole content workstream (~30+ Filipino-wedding
//   chunks × 8 topic files) and runs in parallel with engineering. A
//   read-only catalog lets admins audit chunk inventory + spot gaps in
//   coverage AHEAD of the post-pilot AI unlock, so the chat doesn't launch
//   into a half-stocked knowledge base.
//
// Scope of this V1: list page only. No edit form. No re-embed action. No
// Cowork sync UI. No unanswered-questions queue UI (the tab reads "Coming
// soon"). Edit + re-embed + sync + queue all ship in a later PR alongside
// the AI Today's Focus feature unlock.
//
// Auth: handled at /admin/layout.tsx — non-admins 404 before this page runs.
//
// Cross-references:
//   • Iteration 0023 § 3.13 — canonical spec for /admin/brain
//   • CLAUDE.md 2026-05-18 row 6 — AI brain architecture lock
//   • 02_Specifications/18_Concierge_Brain/README.md — canonical 8 topic
//     files + governance rules (source citations required on cultural/legal)

export const metadata = { title: "Today's Focus brain · Admin" };

type ChunkRow = {
  id: string;
  topic_file: string;
  chunk_title: string;
  body: string;
  tags: string[];
  applies_to: string;
  cross_refs: string[];
  source_citation: string | null;
  paid_tier_only: boolean;
  tier_visible_to: string[];
  embedding_generated_at: string | null;
  is_stale: boolean;
  cowork_authored_by: string | null;
  cowork_pending_review: boolean;
  last_verified_at: string;
  hit_count_30d: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// The canonical 8 topic files from
// `02_Specifications/18_Concierge_Brain/README.md` § Folder contents.
// Ordering here drives the section order on the page. We define this
// list explicitly (instead of derive-from-DB) so a missing-from-DB
// topic still renders as a section with a polite empty state — that's
// the gap-audit signal the admin needs to spot coverage holes.
const TOPIC_FILES: Array<{ filename: string; label: string; tagline: string }> = [
  {
    filename: '01_Filipino_Cultural_Reference.md',
    label: '01 · Filipino Cultural Reference',
    tagline: 'Pamamanhikan · ninang/ninong · despedida · ceremony tracks',
  },
  {
    filename: '02_Regional_Pricing_Benchmarks.md',
    label: '02 · Regional Pricing Benchmarks',
    tagline: 'NCR · Cebu · Davao · Tagaytay · Boracay tiers',
  },
  {
    filename: '03_Seasonal_Weather_Reference.md',
    label: '03 · Seasonal Weather Reference',
    tagline: 'Dry vs wet · peak-month pressure · rain risk by region',
  },
  {
    filename: '04_Planning_Timelines.md',
    label: '04 · Planning Timelines',
    tagline: '12-month · 6-month · 90-day · 30-day · day-of checklists',
  },
  {
    filename: '05_Legal_BIR_Reference.md',
    label: '05 · Legal & BIR Reference',
    tagline: 'Marriage license · prenup customs · BIR / EWT cross-refs',
  },
  {
    filename: '06_Setnayan_Feature_Reference.md',
    label: '06 · Setnayan Feature Reference',
    tagline: 'Panood · Papic · LED · Pakanta — what they do and how to access',
  },
  {
    filename: '07_Vendor_Decision_Logic.md',
    label: '07 · Vendor Decision Logic',
    tagline: 'Book-first order · category dependencies · price-vs-tier guidance',
  },
  {
    filename: '08_Budget_Allocation_Reference.md',
    label: '08 · Budget Allocation Reference',
    tagline: 'Working-budget tiers · category allocation tables',
  },
];

// Per spec: cards 01, 02, 04, 06 open by default — the heaviest content
// surfaces. The other four collapse so the page stays scannable on a
// laptop viewport.
const DEFAULT_OPEN: ReadonlySet<string> = new Set([
  '01_Filipino_Cultural_Reference.md',
  '02_Regional_Pricing_Benchmarks.md',
  '04_Planning_Timelines.md',
  '06_Setnayan_Feature_Reference.md',
]);

// First ~120 chars of body, trimmed at a word boundary so the truncation
// doesn't split a Filipino term mid-syllable.
function previewBody(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= 140) return flat;
  const slice = flat.slice(0, 140);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 80 ? lastSpace : 140;
  return flat.slice(0, cut).trim() + '…';
}

export default async function AdminBrainPage() {
  const admin = createAdminClient();

  // Pull every chunk in one query, regardless of `is_active` — the catalog
  // is the place to see inactive chunks too (they read with a muted badge
  // so admins can decide whether to reactivate or hard-delete later).
  const { data: rows, error } = await admin
    .from('concierge_brain_chunks')
    .select(
      'id, topic_file, chunk_title, body, tags, applies_to, cross_refs, ' +
        'source_citation, paid_tier_only, tier_visible_to, ' +
        'embedding_generated_at, is_stale, cowork_authored_by, ' +
        'cowork_pending_review, last_verified_at, hit_count_30d, is_active, ' +
        'created_at, updated_at',
    )
    .order('topic_file', { ascending: true })
    .order('chunk_title', { ascending: true });

  // Supabase-js infers a union including a generic error row for this
  // table (no generated DB type), so cast via `unknown` per the TS hint.
  // The SELECT column list is the contract — keep it aligned with the
  // ChunkRow shape above on any future column add.
  const chunks = ((rows ?? []) as unknown) as ChunkRow[];

  // Bucket each chunk into its declared topic_file. Any row whose
  // `topic_file` doesn't match the canonical 8 lands in `unknown` so
  // admins can spot drift between authoring tools and the spec corpus.
  const bucket = new Map<string, ChunkRow[]>();
  for (const t of TOPIC_FILES) bucket.set(t.filename, []);
  const unknown: ChunkRow[] = [];
  for (const c of chunks) {
    const slot = bucket.get(c.topic_file);
    if (slot) slot.push(c);
    else unknown.push(c);
  }

  const total = chunks.length;
  const paidOnly = chunks.filter((c) => c.paid_tier_only).length;
  const stale = chunks.filter((c) => c.is_stale).length;
  const active = chunks.filter((c) => c.is_active).length;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Iteration 0023 § 3.13 · Today&apos;s Focus brain
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Today&apos;s Focus brain
        </h1>
        <p className="text-base text-ink/65">
          Curated Filipino-wedding knowledge feeding the AI Today&apos;s Focus
          chat.
        </p>
      </header>

      {/*
        Pilot-state banner — load-bearing per the senior-dev brief.
        The wording is calm + factual + future-tense: this is not an error
        state, it's the intentional posture for the pilot cohort. Admins
        authoring chunks here are building inventory for the post-pilot
        unlock, not sitting idle.
      */}
      <section
        role="status"
        className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-5"
      >
        <AlertCircle
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
          strokeWidth={1.75}
        />
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900">
            Pilot posture
          </p>
          <p className="text-sm text-amber-900">
            The AI Today&apos;s Focus chat is currently OFF for pilot. Content
            authoring here lands ahead of the post-pilot launch.
          </p>
        </div>
      </section>

      <section
        className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Brain inventory at a glance"
      >
        <Stat label="Total chunks" value={total} />
        <Stat label="Paid-tier only" value={paidOnly} />
        <Stat label="Stale · needs re-embed" value={stale} />
        <Stat label="Active" value={active} />
      </section>

      {/*
        Tabs strip — the two non-default tabs render as visually disabled
        chips with "Coming soon" labels. They're not links: V1 is read-only
        catalog, so giving them href targets would 404. Disabled chips keep
        the surface shape correct for the next PR that lights them up.
      */}
      <nav aria-label="Today's Focus brain tabs" className="mb-6 flex flex-wrap gap-2">
        <span
          aria-current="page"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm text-cream"
        >
          <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Brain editor
        </span>
        <ComingSoonTab label="Unanswered questions" />
        <ComingSoonTab label="Cost Watch" />
      </nav>

      {error ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Couldn&apos;t load brain chunks — {error.message}
        </p>
      ) : null}

      {TOPIC_FILES.map((topic) => {
        const rowsForTopic = bucket.get(topic.filename) ?? [];
        const paidCount = rowsForTopic.filter((r) => r.paid_tier_only).length;
        const isOpen = DEFAULT_OPEN.has(topic.filename);
        return (
          <details
            key={topic.filename}
            open={isOpen}
            className="mb-4 overflow-hidden rounded-2xl border border-ink/10 bg-cream"
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-terracotta/[0.04]">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-ink">
                  {topic.label}
                </h2>
                <p className="text-xs text-ink/55">{topic.tagline}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink/55">
                  {rowsForTopic.length === 1
                    ? '1 chunk'
                    : `${rowsForTopic.length} chunks`}
                </span>
                {paidCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-violet-800">
                    {paidCount} paid-tier
                  </span>
                ) : null}
              </div>
            </summary>
            <div className="border-t border-ink/10">
              {rowsForTopic.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink/55">
                  No chunks authored yet — content authoring is a parallel
                  workstream.
                </p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {rowsForTopic.map((row) => (
                    <ChunkRowView key={row.id} row={row} />
                  ))}
                </ul>
              )}
            </div>
          </details>
        );
      })}

      {/*
        Drift bucket. Any chunk whose topic_file isn't in the canonical 8
        means either (a) someone seeded the wrong filename or (b) the brain
        README expanded but this admin surface wasn't updated. Either way
        admins should see it and decide.
      */}
      {unknown.length > 0 ? (
        <section className="mt-8 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50">
          <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight text-rose-800">
              Unmapped topic files
            </h2>
            <span className="font-mono text-xs text-rose-700">
              {unknown.length} chunk{unknown.length === 1 ? '' : 's'}
            </span>
          </header>
          <ul className="divide-y divide-rose-200 border-t border-rose-200">
            {unknown.map((row) => (
              <ChunkRowView key={row.id} row={row} unmappedFilename={row.topic_file} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function ComingSoonTab({ label }: { label: string }) {
  return (
    <span
      aria-disabled="true"
      className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/40"
      title="Coming soon"
    >
      <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      {label}
      <span className="rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
        Coming soon
      </span>
    </span>
  );
}

function ChunkRowView({
  row,
  unmappedFilename,
}: {
  row: ChunkRow;
  unmappedFilename?: string;
}) {
  const visibleTags = row.tags.slice(0, 5);
  const overflow = row.tags.length - visibleTags.length;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{row.chunk_title}</p>
            {row.paid_tier_only ? (
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-violet-800">
                Paid tier
              </span>
            ) : null}
            {row.is_stale ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-900">
                Needs re-embed
              </span>
            ) : null}
            {!row.is_active ? (
              <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
                Inactive
              </span>
            ) : null}
            {row.cowork_pending_review ? (
              <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-sky-800">
                Cowork pending review
              </span>
            ) : null}
          </div>
          <p className="text-sm text-ink/70">{previewBody(row.body)}</p>
          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] text-ink/65"
                >
                  {tag}
                </span>
              ))}
              {overflow > 0 ? (
                <span className="font-mono text-[10px] text-ink/45">
                  +{overflow} more
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/55">
            {row.source_citation ? (
              <span className="truncate">
                <span className="font-mono uppercase tracking-[0.1em] text-ink/45">
                  Source ·
                </span>{' '}
                {row.source_citation}
              </span>
            ) : (
              <span className="text-rose-700">
                <span className="font-mono uppercase tracking-[0.1em]">
                  No source citation
                </span>
              </span>
            )}
            <span>
              <span className="font-mono uppercase tracking-[0.1em] text-ink/45">
                Hits 30d ·
              </span>{' '}
              {row.hit_count_30d}
            </span>
            {unmappedFilename ? (
              <span className="font-mono text-rose-700">
                topic_file: {unmappedFilename}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          {/*
            V1 placeholder. The Edit form is the next PR (server action +
            re-embed trigger + audit-log write). Disabled here so the
            surface shape is right, the affordance is visible, and admins
            don't expect a working edit flow yet.
          */}
          {/* Per CLAUDE.md 2026-05-23 5-sweep audit (Sweep 5) — match the
              "next refresh" pattern from /admin/disputes + /admin/pricing
              instead of leaking engineering process into the admin tooltip. */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Edit coming with the next refresh."
            className="rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/40"
          >
            Edit
          </button>
        </div>
      </div>
    </li>
  );
}
