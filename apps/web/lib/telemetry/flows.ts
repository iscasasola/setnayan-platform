/**
 * Problems · DROP-OFF — the few guided flows whose steps are COUNTED, so the
 * list can say where people stop (owner 2026-10-02: "record which step a person
 * reached and whether they finished, as counts per step … show the step where
 * most people stop").
 *
 * ONE registry, read by the one browser observer (fault-observer.ts). Steps are
 * recognised from the page, never from per-screen code:
 *   • view   — reached when `selector` is on the page (and `path`/`query` match);
 *   • change — reached when a field inside `selector` changes;
 *   • submit — reached when a form matching `selector` is submitted;
 *   • tap    — reached when an element inside `selector` is tapped.
 *
 * A step is counted ONCE per run of the flow in a tab. A run starts at step 0;
 * later steps count only inside a live run (30 min since its last step), so a
 * guest re-opening an old reply is not counted as reaching "ticket" again. The
 * last step is "finished". Counts go to `app_action_daily_counts` under
 * `flow:<flow>:<step>` — numbers, never a row per person.
 *
 * Every selector names markup that exists today; `every-failure-is-recorded.test.ts`
 * fails if one of those anchors disappears from its component, because a
 * renamed class would otherwise silently stop a funnel at zero.
 *
 * Pure module — no imports.
 */

export type FlowStepOn = 'view' | 'change' | 'submit' | 'tap';

export type FlowStep = {
  step: string;
  on: FlowStepOn;
  selector?: string;
  path?: RegExp;
  query?: RegExp;
};

export type FlowDef = {
  flow: string;
  /** Plain words for the Problems list. */
  label: string;
  steps: readonly FlowStep[];
};

/**
 * The wedding onboarding's screens, in order — mirrored from FLOW_IDS in
 * app/onboarding/wedding/_components/onboarding-shell.tsx (the test compares
 * them). The shell stamps the active one on its root as `data-flow-screen`.
 */
export const WEDDING_SCREENS = [
  'welcome', 'role', 'kind', 'faith', 'name', 'date', 'love_intro', 'love_spark',
  'love_almost', 'love_proposal', 'love_milestones', 'love_tone', 'love_preview',
  'alaala_promise', 'region', 'pax', 'budget', 'exp_for_whom', 'exp_feel',
  'exp_energy', 'exp_roots', 'exp_effort', 'exp_help', 'exp_source', 'exp_reveal',
  'team_intro', 'reception_setting', 'find', 'team_payoff', 'aigate', 'team_basics',
  'refine_basic', 'team_extras', 'refine_extras', 'songs', 'mood', 'account',
  'setup_where', 'setup_photo', 'setup_look', 'setup_entry', 'setup_guests',
  'setup_more', 'w_names', 'w_kind', 'w_area', 'w_pax', 'w_budget', 'w_colours',
  'services_step', 'congrats', 'plan', 'services', 'summary',
] as const;

/** An event's own dashboard — where every create-an-event flow lands when it worked. */
const EVENT_DASHBOARD =
  /^\/dashboard\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|S89[A-Z]{1,4}-[0-9A-Z]{6,})(?:\/|$)/i;

export const FLOWS: readonly FlowDef[] = [
  {
    flow: 'guest_reply',
    label: 'Guest reply',
    steps: [
      { step: 'open', on: 'view', selector: 'form.rsvp-form' },
      { step: 'choose', on: 'change', selector: 'input[name="rsvp_status"]' },
      { step: 'send', on: 'submit', selector: 'form.rsvp-form' },
      // submitRsvp redirects with ?rsvp=ok | details on a saved reply.
      { step: 'ticket', on: 'view', query: /[?&]rsvp=(?:ok|details)(?:&|$)/ },
    ],
  },
  {
    flow: 'create_event',
    label: 'Create an event',
    steps: [
      { step: 'start', on: 'view', path: /^\/onboarding(?:\/|$)/ },
      ...WEDDING_SCREENS.map(
        (id): FlowStep => ({ step: id, on: 'view', selector: `[data-flow-screen="${id}"]` }),
      ),
      { step: 'created', on: 'view', path: EVENT_DASHBOARD },
    ],
  },
  {
    flow: 'supplier_quote',
    label: 'Supplier quote',
    steps: [
      { step: 'open', on: 'view', selector: 'form[data-flow="supplier-quote"]' },
      { step: 'edit', on: 'change', selector: 'form[data-flow="supplier-quote"]' },
      { step: 'send', on: 'submit', selector: 'form[data-flow="supplier-quote"]' },
      // sendCustomProposalFromChat redirects with ?notice=proposal_sent[_no_card].
      { step: 'sent', on: 'view', query: /[?&]notice=proposal_sent/ },
    ],
  },
  {
    flow: 'checkout',
    label: 'Checkout and pay',
    steps: [
      { step: 'open', on: 'view', selector: '[aria-labelledby="inline-checkout-title"]' },
      { step: 'details', on: 'change', selector: '[aria-labelledby="inline-checkout-title"]' },
      { step: 'submit', on: 'submit', selector: '[aria-labelledby="inline-checkout-title"] form' },
      { step: 'paid', on: 'view', selector: '[data-flow-mark="checkout-submitted"]' },
    ],
  },
];

const KNOWN = new Map(FLOWS.map((f) => [f.flow, new Set(f.steps.map((s) => s.step))]));

export function isKnownFlowStep(flow: string, step: string): boolean {
  return KNOWN.get(flow)?.has(step) ?? false;
}

export type FlowRun = { at: number; done: string[]; finished: boolean };
export type FlowRuns = Record<string, FlowRun>;

/** A run that has not moved for this long is over; the next step-0 starts a new one. */
export const FLOW_RUN_TTL_MS = 30 * 60 * 1000;

/**
 * Advance the runs by one reached step. Returns the step to COUNT (or null
 * when it must not count: already counted in this run, or no live run).
 * Pure — the observer persists `runs` itself.
 */
export function reachStep(runs: FlowRuns, flow: FlowDef, step: string, now: number): string | null {
  const idx = flow.steps.findIndex((s) => s.step === step);
  if (idx < 0) return null;
  const run = runs[flow.flow];
  const live = run && !run.finished && now - run.at < FLOW_RUN_TTL_MS;
  if (idx === 0) {
    if (live && run.done.includes(step)) {
      run.at = now;
      return null;
    }
    runs[flow.flow] = { at: now, done: [step], finished: false };
    return step;
  }
  if (!live) return null;
  if (run.done.includes(step)) return null;
  run.done.push(step);
  run.at = now;
  if (idx === flow.steps.length - 1) run.finished = true;
  return step;
}

export type FunnelStep = { step: string; reached: number; stoppedHere: number };

/**
 * From per-step reach counts, how many people stopped AFTER each step. A step's
 * "stopped here" is its reach minus the most anyone reached LATER — so a step
 * only some people see (the faith screen, skipped for a civil wedding) does
 * not read as a cliff. The last step is "finished", never a stop.
 */
export function funnelOf(flow: FlowDef, reached: Record<string, number>): {
  steps: FunnelStep[];
  worst: FunnelStep | null;
} {
  const counts = flow.steps.map((s) => reached[s.step] ?? 0);
  const steps: FunnelStep[] = flow.steps.map((s, i) => {
    const later = i === counts.length - 1 ? counts[i]! : Math.max(0, ...counts.slice(i + 1));
    return { step: s.step, reached: counts[i]!, stoppedHere: Math.max(0, counts[i]! - later) };
  });
  let worst: FunnelStep | null = null;
  for (const s of steps.slice(0, -1)) {
    if (s.stoppedHere > 0 && (!worst || s.stoppedHere > worst.stoppedHere)) worst = s;
  }
  return { steps, worst };
}
