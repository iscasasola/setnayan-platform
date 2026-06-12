import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FilePlus2, FileText, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import {
  PROPOSAL_TOKENS,
  TOKEN_HINTS,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  formatCentavos,
  type ProposalStatus,
} from '@/lib/vendor-proposals';
import { createProposal, deleteTemplate, saveTemplate } from './actions';

export const metadata = { title: 'Proposals · Vendor' };

/**
 * Vendor Proposals — data-link program ③ (corpus
 * 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 3).
 *
 * Save a proposal template once; the system merges the couple's live event
 * details (name, date, venue, guest count, meal mix, your slot) into a
 * printable proposal for any BOOKED client. Tokens resolve from the same
 * aggregates the Event Brief shows — counts only, no guest PII, no
 * estimation. Free on every tier.
 */

type TemplateRow = {
  template_id: string;
  template_name: string;
  body: string;
  terms: string;
  default_package_id: string | null;
  created_at: string;
};

type ProposalRow = {
  proposal_id: string;
  public_id: string;
  title: string;
  status: ProposalStatus;
  total_centavos: number;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
  event_id: string;
};

type PackageRow = { package_id: string; package_name: string; total_price_centavos: number };

const NOTICES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  template_saved: { tone: 'ok', text: 'Template saved — use it on any booked client below.' },
  template_needs_name: { tone: 'warn', text: 'The template needs a name.' },
  pick_event_and_template: { tone: 'warn', text: 'Pick a booked client and a template first.' },
  not_booked: { tone: 'warn', text: 'Proposals work for booked clients only.' },
  save_failed: { tone: 'warn', text: 'That didn’t save — try again.' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Props = { searchParams: Promise<{ notice?: string }> };

export default async function VendorProposalsPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const [{ data: templateRows }, { data: proposalRows }, { data: packageRows }, bookings] =
    await Promise.all([
      supabase
        .from('vendor_proposal_templates')
        .select('template_id, template_name, body, terms, default_package_id, created_at')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('vendor_proposals')
        .select(
          'proposal_id, public_id, title, status, total_centavos, valid_until, sent_at, created_at, event_id',
        )
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('vendor_packages')
        .select('package_id, package_name, total_price_centavos')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .eq('is_active', true)
        .order('package_name', { ascending: true }),
      fetchVendorPoolBookings(supabase, profile.vendor_profile_id),
    ]);

  const templates = (templateRows ?? []) as TemplateRow[];
  const proposals = (proposalRows ?? []) as ProposalRow[];
  const packages = (packageRows ?? []) as PackageRow[];

  // One picker entry per booked event (a client can hold several dates).
  const bookedEvents = [...new Map(bookings.map((b) => [b.eventId, b])).values()];

  const notice = search.notice ? NOTICES[search.notice] : null;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <FileText aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Proposals</h1>
        <p className="max-w-prose text-sm text-ink/65">
          Save your standard packages as templates once — the system fills in the
          couple&rsquo;s name, date, venue, and live guest counts for any booked client, ready
          to print. Numbers freeze when you send, so a proposal never shifts under the
          couple.
        </p>
      </header>

      {notice ? (
        <p
          role={notice.tone === 'warn' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {/* New proposal */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FilePlus2 aria-hidden className="h-5 w-5 text-terracotta" /> New proposal
        </h2>
        {bookedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">
            No booked clients yet — proposals fill from a booked event&rsquo;s live details.
            Once a couple books you, they&rsquo;ll appear here.
          </p>
        ) : templates.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">
            Save your first template below, then generate a proposal from it.
          </p>
        ) : (
          <form action={createProposal} className="mt-3 grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="event_id" required className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" defaultValue="">
                <option value="" disabled>
                  Booked client…
                </option>
                {bookedEvents.map((b) => (
                  <option key={b.eventId} value={b.eventId}>
                    {b.eventName} · {fmtDate(b.bookedDate)}
                  </option>
                ))}
              </select>
              <select name="template_id" required className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" defaultValue="">
                <option value="" disabled>
                  Template…
                </option>
                {templates.map((t) => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.template_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select name="package_id" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" defaultValue="">
                <option value="">Attach a package (optional)</option>
                {packages.map((p) => (
                  <option key={p.package_id} value={p.package_id}>
                    {p.package_name} · {formatCentavos(p.total_price_centavos)}
                  </option>
                ))}
              </select>
              <input type="text" name="title" maxLength={160} placeholder="Title (optional — auto-filled)" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink/70">
              <label className="inline-flex items-center gap-1.5">
                No package? Total ₱
                <input type="number" name="total_php" min="0" step="any" placeholder="0" className="w-28 rounded-lg border border-ink/20 bg-white px-2 py-1.5" />
              </label>
              <label className="inline-flex items-center gap-1.5">
                Valid until
                <input type="date" name="valid_until" className="rounded-lg border border-ink/20 bg-white px-2 py-1.5" />
              </label>
            </div>
            <button type="submit" className="justify-self-start rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream">
              Generate draft
            </button>
          </form>
        )}
      </div>

      {/* Proposals list */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Your proposals</h2>
        {proposals.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">Nothing generated yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10">
            {proposals.map((p) => (
              <li key={p.proposal_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/proposals/${p.public_id}`}
                    className="block truncate text-sm font-medium hover:text-terracotta"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-ink/50">
                    {p.public_id} · created {fmtDate(p.created_at)}
                    {p.valid_until ? ` · valid until ${fmtDate(p.valid_until)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {p.total_centavos > 0 ? (
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCentavos(p.total_centavos)}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PROPOSAL_STATUS_TONE[p.status]}`}
                  >
                    {PROPOSAL_STATUS_LABEL[p.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Templates */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Templates</h2>
        <p className="mt-1 text-xs text-ink/50">
          Write once with merge tokens; reuse on every client.
        </p>

        {templates.length > 0 ? (
          <ul className="mt-3 divide-y divide-ink/10">
            {templates.map((t) => (
              <li key={t.template_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.template_name}</p>
                  <p className="truncate text-xs text-ink/50">{t.body.slice(0, 90) || 'No body yet'}</p>
                </div>
                <form action={deleteTemplate}>
                  <input type="hidden" name="template_id" value={t.template_id} />
                  <button type="submit" aria-label={`Delete ${t.template_name}`} className="text-ink/40 hover:text-red-700">
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="mt-4 rounded-xl border border-ink/10 bg-white/50 p-3" open={templates.length === 0}>
          <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold">
            <Plus aria-hidden className="h-4 w-4" /> New template
          </summary>
          <form action={saveTemplate} className="mt-3 grid gap-2">
            <input type="text" name="template_name" required maxLength={120} placeholder="Template name, e.g. Full wedding catering" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
            <textarea
              name="body"
              rows={6}
              maxLength={20000}
              placeholder={`Dear {{couple_name}},\n\nThank you for booking ${'{{business_name}}'} for {{event_date}} at {{venue_name}}. This proposal covers {{guest_count}} confirmed guests ({{guest_count_ceiling}} maximum)…`}
              className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 font-mono text-xs"
            />
            <textarea name="terms" rows={3} maxLength={20000} placeholder="Terms — payment schedule, inclusions, cancellation policy…" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 font-mono text-xs" />
            {packages.length > 0 ? (
              <select name="default_package_id" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" defaultValue="">
                <option value="">Default package (optional)</option>
                {packages.map((p) => (
                  <option key={p.package_id} value={p.package_id}>
                    {p.package_name}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="submit" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
              Save template
            </button>
          </form>
          <div className="mt-3 rounded-lg bg-white/70 p-3">
            <p className="text-xs font-semibold text-ink/70">Merge tokens</p>
            <ul className="mt-1 grid gap-x-6 gap-y-0.5 text-xs text-ink/60 sm:grid-cols-2">
              {PROPOSAL_TOKENS.map((t) => (
                <li key={t}>
                  <code className="rounded bg-ink/5 px-1 py-0.5">{`{{${t}}}`}</code> — {TOKEN_HINTS[t]}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink/45">
              Anything the couple hasn&rsquo;t shared yet renders as
              &ldquo;⟨not yet shared by couple⟩&rdquo; — nothing is ever guessed.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
