import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { upsertEventTypeProfile } from '../../actions';
import { SubmitButton } from '@/app/_components/submit-button';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Onboarding profile · Event Types · Admin' };
// Admin-client DB read → keep dynamic (same rationale as the roster page).
export const dynamic = 'force-dynamic';

/**
 * Setnayan HQ · Event Types · Onboarding profile (iteration 0053 Phase 3 · PR4).
 * View + edit one event type's `event_type_profiles` row — the per-type
 * terminology (drives copy across the dashboard + the generic onboarding flow),
 * the enabled couple-facing surfaces, and the engine wiring (onboarding_flow_key
 * + role_set_key). Writes via the is_admin()-gated upsertEventTypeProfile action.
 * Reached from the roster row's "Onboarding profile →" link.
 */

const SURFACES: { key: string; label: string; hint: string }[] = [
  { key: 'website', label: 'Website', hint: 'public /[slug] event page' },
  { key: 'save_the_date', label: 'Save the Date', hint: 'STD beacon + reveal' },
  { key: 'rsvp', label: 'RSVP', hint: 'guest RSVP capture' },
  { key: 'seating', label: 'Seating', hint: 'seat plan editor' },
  { key: 'budget', label: 'Budget', hint: 'budget ledger' },
  { key: 'schedule', label: 'Schedule', hint: 'timeline / agenda' },
  { key: 'monogram', label: 'Monogram', hint: 'animated monogram studio' },
  { key: 'day_of', label: 'Day-of', hint: 'live-event guest mode' },
  { key: 'gallery', label: 'Gallery', hint: 'Papic photo gallery' },
];

const GENERIC_SURFACES = new Set(['seating', 'budget', 'schedule', 'day_of', 'gallery']);

type Params = Promise<{ eventType: string }>;
type SearchParams = Promise<{ ok?: string; error?: string }>;

type ProfileRow = {
  terminology: Record<string, unknown> | null;
  enabled_surfaces: string[] | null;
  onboarding_flow_key: string | null;
  role_set_key: string | null;
};

const FIELD =
  'mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mulberry';
const LABEL = 'block text-xs font-medium uppercase tracking-[0.12em] text-ink/55';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export default async function EventTypeProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { eventType } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();

  const { data: vocab } = await admin
    .from('event_type_vocab')
    .select('event_type, label_en, emoji, enabled, status')
    .eq('event_type', eventType)
    .maybeSingle();
  if (!vocab) notFound();

  const { data: profileData } = await admin
    .from('event_type_profiles')
    .select('terminology, enabled_surfaces, onboarding_flow_key, role_set_key')
    .eq('event_type', eventType)
    .maybeSingle<ProfileRow>();

  const t = (profileData?.terminology ?? {}) as Record<string, unknown>;
  const isWedding = eventType === 'wedding';
  // Prefill: the saved row, else sensible defaults (generic for a fresh type).
  const term = {
    organizer_noun: str(t.organizer_noun) || (isWedding ? 'couple' : 'host'),
    person_a: str(t.person_a),
    person_b: str(t.person_b),
    seat_word: str(t.seat_word) || 'table',
    event_word: str(t.event_word) || vocab.label_en.toLowerCase(),
    vip_tier_label: str(t.vip_tier_label) || 'Guests of honor',
  };
  const enabled = new Set(
    profileData?.enabled_surfaces ??
      (isWedding ? SURFACES.map((s) => s.key) : [...GENERIC_SURFACES]),
  );
  const onboardingFlowKey = profileData?.onboarding_flow_key ?? (isWedding ? 'wedding' : eventType);
  const roleSetKey = profileData?.role_set_key ?? (isWedding ? 'wedding' : 'generic');

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/admin/taxonomy?view=vocab-event" className="text-sm text-ink/55 hover:text-mulberry">
        ← Event types
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-ink">
        {vocab.emoji} {vocab.label_en} · Onboarding profile
      </h1>
      <p className="mt-1 text-sm text-ink/55">
        Per-type terminology + which surfaces apply. Drives the dashboard copy and the
        generic onboarding flow.{' '}
        {!profileData ? 'No profile row yet — saving creates one.' : null}
      </p>

      {sp.ok ? (
        <div role="status" className="mt-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          {decodeURIComponent(sp.ok)}
        </div>
      ) : null}
      {sp.error ? (
        <div role="alert" className="mt-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {decodeURIComponent(sp.error)}
        </div>
      ) : null}

      {isWedding ? (
        <p className="mt-4 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-700">
          This is the <strong>wedding</strong> profile — its values back the live wedding
          experience. Edit with care.
        </p>
      ) : null}

      <form action={upsertEventTypeProfile} className="mt-6 space-y-6">
        <input type="hidden" name="event_type" value={eventType} />

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Terminology</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Organizer noun</span>
              <input name="organizer_noun" defaultValue={term.organizer_noun} className={FIELD} placeholder="host" />
            </label>
            <label>
              <span className={LABEL}>Event word</span>
              <input name="event_word" defaultValue={term.event_word} className={FIELD} placeholder="celebration" />
            </label>
            <label>
              <span className={LABEL}>VIP tier label</span>
              <input name="vip_tier_label" defaultValue={term.vip_tier_label} className={FIELD} placeholder="Guests of honor" />
            </label>
            <label>
              <span className={LABEL}>Seat word</span>
              <input name="seat_word" defaultValue={term.seat_word} className={FIELD} placeholder="table" />
            </label>
            <label>
              <span className={LABEL}>Person A <span className="normal-case text-ink/40">(optional)</span></span>
              <input name="person_a" defaultValue={term.person_a} className={FIELD} placeholder="bride" />
            </label>
            <label>
              <span className={LABEL}>Person B <span className="normal-case text-ink/40">(optional)</span></span>
              <input name="person_b" defaultValue={term.person_b} className={FIELD} placeholder="groom" />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Enabled surfaces</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SURFACES.map((s) => (
              <label key={s.key} className="flex items-start gap-2 rounded-md border border-ink/10 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  name={`surface_${s.key}`}
                  defaultChecked={enabled.has(s.key)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{s.label}</span>
                  <span className="block text-xs text-ink/50">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Engine wiring</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Onboarding flow key</span>
              <input name="onboarding_flow_key" defaultValue={onboardingFlowKey} className={FIELD} />
            </label>
            <label>
              <span className={LABEL}>Role set key</span>
              <input name="role_set_key" defaultValue={roleSetKey} className={FIELD} placeholder="generic" />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/45">
            Other pack keys (template / monogram / reveal / budget / schedule / statutory) are
            preserved as-is — not edited here.
          </p>
        </section>

        <SubmitButton className="rounded-full bg-mulberry px-6 py-2.5 text-sm font-semibold text-paper hover:opacity-90">
          Save profile
        </SubmitButton>
      </form>
    </main>
  );
}
