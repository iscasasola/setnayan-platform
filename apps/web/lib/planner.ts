import type { SupabaseClient } from '@supabase/supabase-js';

export type PlannerMode = 'guided' | 'diy';

export type StepKey =
  | 'set_date'
  | 'pick_venue'
  | 'build_guests'
  | 'customize_invite'
  | 'set_slug'
  | 'send_invites'
  | 'book_vendors'
  | 'finalize_seating'
  | 'after_event';

export type StepDefinition = {
  key: StepKey;
  label: string;
  hint: string;
  href: (eventId: string) => string;
  /**
   * `auto` steps derive completion from existing event/guest state; the
   * checkbox is read-only. `manual` steps are toggled by the couple and
   * persisted in event_journey_steps.
   */
  source: 'auto' | 'manual';
};

export const STEPS: ReadonlyArray<StepDefinition> = [
  {
    key: 'set_date',
    label: 'Set the wedding date',
    hint: 'Lock in event_date so the countdown and stage strip line up.',
    href: (id) => `/dashboard/${id}/invitation`,
    source: 'auto',
  },
  {
    key: 'pick_venue',
    label: 'Pick the venue',
    hint: 'Add venue_name and address so guests know where to go.',
    href: (id) => `/dashboard/${id}/invitation`,
    source: 'auto',
  },
  {
    key: 'build_guests',
    label: 'Build the guest list',
    hint: 'Start with the wedding party and your immediate family.',
    href: (id) => `/dashboard/${id}/guests`,
    source: 'auto',
  },
  {
    key: 'customize_invite',
    label: 'Customize the invitation',
    hint: 'Branded monogram on the QR, palette finalized.',
    href: (id) => `/dashboard/${id}/invitation`,
    source: 'auto',
  },
  {
    key: 'set_slug',
    label: 'Pick the invitation URL',
    hint: 'Choose a slug like maria-and-juan.',
    href: (id) => `/dashboard/${id}/invitation`,
    source: 'auto',
  },
  {
    key: 'send_invites',
    label: 'Send the invites',
    hint: 'Print the QR sheet or share individual links.',
    href: (id) => `/dashboard/${id}/invitation/print`,
    source: 'manual',
  },
  {
    key: 'book_vendors',
    label: 'Book core vendors',
    hint: 'Photographer, caterer, officiant — at minimum.',
    href: (id) => `/dashboard/${id}/vendors`,
    source: 'manual',
  },
  {
    key: 'finalize_seating',
    label: 'Finalize the seating plan',
    hint: 'Lock in tables so vendors get clean counts.',
    href: (id) => `/dashboard/${id}/seating`,
    source: 'manual',
  },
  {
    key: 'after_event',
    label: 'Send thank-yous',
    hint: 'Photo delivery and thank-you messages.',
    href: (id) => `/dashboard/${id}/add-ons`,
    source: 'manual',
  },
];

export type StepStatus = {
  key: StepKey;
  completed: boolean;
};

export type EventStateForPlanner = {
  event_date: string | null;
  venue_name: string | null;
  slug: string | null;
  monogram_text: string | null;
  palette_finalized_at: string | null;
  guest_count: number;
};

export function deriveAutoStatuses(state: EventStateForPlanner): Record<StepKey, boolean | null> {
  return {
    set_date: state.event_date !== null,
    pick_venue: Boolean(state.venue_name && state.venue_name.trim().length > 0),
    build_guests: state.guest_count > 0,
    customize_invite:
      Boolean(state.monogram_text && state.monogram_text.trim().length > 0) ||
      state.palette_finalized_at !== null,
    set_slug: Boolean(state.slug && state.slug.trim().length > 0),
    send_invites: null,
    book_vendors: null,
    finalize_seating: null,
    after_event: null,
  };
}

export async function fetchManualStepCompletions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Set<StepKey>> {
  const { data, error } = await supabase
    .from('event_journey_steps')
    .select('step_key')
    .eq('event_id', eventId);
  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.step_key as StepKey));
}

export function resolveStepStatuses(
  state: EventStateForPlanner,
  manualSet: Set<StepKey>,
): StepStatus[] {
  const auto = deriveAutoStatuses(state);
  return STEPS.map((step) => ({
    key: step.key,
    completed: step.source === 'auto' ? auto[step.key] === true : manualSet.has(step.key),
  }));
}

export function plannerProgress(statuses: StepStatus[]): {
  done: number;
  total: number;
  pct: number;
} {
  const done = statuses.filter((s) => s.completed).length;
  const total = statuses.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
