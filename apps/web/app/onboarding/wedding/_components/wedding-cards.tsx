'use client';

/**
 * wedding-cards.tsx — the wedding's OWN setup cards (Lane 1, design A).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "APPROVED — WEDDING ONBOARDING (clickable)…",
 * prototypes/wedding_onboarding_interactive_2026-10-01_fable): one question per
 * card, in the SAME frame every setup card wears (`SetupFrame`,
 * `app/onboarding/_shared/setup-card.tsx`) — never a second card component.
 * The engine's own cards (entry · photo · look) are drawn by `SetupCard`; the
 * date is the shipped hot-date calendar screen. This file draws only what the
 * generic engine has no card for.
 *
 * Every answer is written to the wizard's own state (`OnboardingState`), which
 * the shipped commit (`commitOnboardingWedding`) writes to the columns the
 * Maker already reads — see `lib/onboarding/wedding-cards.ts` for the mapping.
 * Nothing here has a store of its own.
 *
 * INTERACTION_RULES: two options → buttons; three or more → ONE PickMenu; no
 * confirm dialogs; title ≤ 5 words + one line ≤ 12 words, the rest behind ⓘ.
 */

import { useEffect, useState } from 'react';
import { SetupFrame } from '@/app/onboarding/_shared/setup-card';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FAITH_REGISTRY, type FaithKey } from '@/lib/faith-registry';
import { FEEL_PALETTES } from '@/lib/feel-palettes';
import { formatCount } from '@/lib/format-number';
import type { BudgetBand } from '@/lib/budget-bands-shared';
import {
  BUDGET_DEFAULT_BAND,
  CEREMONY_CHOICES,
  CHURCH_FAITHS,
  ESTIMATE_MAX,
  ESTIMATE_MIN,
  ceremonyChoiceOf,
  ceremonyChoiceToState,
  budgetRows,
  snapEstimate,
  stepEstimate,
  type CeremonyChoice,
  type WeddingCardId,
} from '@/lib/onboarding/wedding-cards';
import { CITIES, TOP30, cityByKey, resolvePick } from '../_data/wedding-cities';
import { LocationStep } from './location-step';
import type { OnboardingState } from '../types';

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const nameOnly = (raw: string) => (raw || '').replace(/[^\p{L}\s'-]/gu, '');

const CEREMONY_COPY: Record<CeremonyChoice, { label: string; hint?: string }> = {
  church: { label: 'Church wedding', hint: 'Catholic · Christian · INC' },
  civil: { label: 'Civil wedding' },
  nikah: { label: 'Nikah' },
  garden: { label: 'Garden or other' },
  undecided: { label: 'Not decided yet' },
};

const FEEL_LABEL: Record<string, string> = {
  timeless: 'Timeless',
  modern: 'Modern',
  boho: 'Boho',
  rustic: 'Rustic',
  glam: 'Glam',
  royalty: 'Royalty',
  filipiniana: 'Filipiniana',
};

type Props = {
  card: WeddingCardId;
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
  n: number;
  total: number;
  /** Faiths the admin has switched on (`wedding_type_launch_status`); null = read failed. */
  activeFaiths: string[] | null;
  budgetBands: readonly BudgetBand[];
};

export function WeddingCard({ card, state, patch, n, total, activeFaiths, budgetBands }: Props) {
  const frame = { skin: 'wedding' as const, n, total, dataCard: card };

  if (card === 'w_names') {
    const field = (label: string, value: string, key: keyof OnboardingState, req: boolean) => (
      <input
        aria-label={label}
        placeholder={label}
        autoComplete="off"
        autoCapitalize="words"
        required={req}
        value={value}
        onChange={(e) => patch({ [key]: nameOnly(e.target.value), monogramFinalized: true } as Partial<OnboardingState>)}
        className="w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none"
      />
    );
    return (
      <SetupFrame
        {...frame}
        title="Who’s getting married?"
        line="Your names, the way you want them written."
        info="They go on your invitation, your Event Hub and your guest list. Last names are optional."
      >
        <div className="flex flex-col gap-3" data-wedding-names>
          {field('First name', state.brideFirstName, 'brideFirstName', true)}
          {field('Last name (optional)', state.brideLastName, 'brideLastName', false)}
          <p className="text-center font-serif text-xl italic text-ink/50" aria-hidden>
            &amp;
          </p>
          {field('First name', state.groomFirstName, 'groomFirstName', true)}
          {field('Last name (optional)', state.groomLastName, 'groomLastName', false)}
        </div>
      </SetupFrame>
    );
  }

  if (card === 'w_kind') {
    const choice = ceremonyChoiceOf(state);
    const churchLabel = (k: FaithKey) => FAITH_REGISTRY.find((e) => e.key === k)?.label ?? k;
    const offered = CHURCH_FAITHS.filter((k) => (activeFaiths ? activeFaiths.includes(k) : !FAITH_REGISTRY.find((e) => e.key === k)?.defaultSoon));
    return (
      <SetupFrame
        {...frame}
        title="What kind of wedding?"
        line="It shapes the paperwork and the programme."
        info="Pick the closest. You can change it from your Event Hub Maker."
        quick={['Not decided yet']}
        onQuick={() => patch(ceremonyChoiceToState('undecided'))}
      >
        <PickMenu
          label="Ceremony"
          value={choice}
          buttonText={choice ? undefined : 'Pick one'}
          options={CEREMONY_CHOICES.map((c) => ({ key: c, label: CEREMONY_COPY[c].label, hint: CEREMONY_COPY[c].hint }))}
          onPick={(key) => patch(ceremonyChoiceToState(key as CeremonyChoice, state.faith[0] as FaithKey | undefined))}
          dataAttr="data-wedding-kind"
        />
        {choice === 'church' && offered.length > 1 ? (
          <div className="mt-3">
            <PickMenu
              label="Church"
              value={state.faith[0] ?? 'catholic'}
              options={offered.map((k) => ({ key: k, label: churchLabel(k) }))}
              onPick={(key) => patch(ceremonyChoiceToState('church', key as FaithKey))}
              dataAttr="data-wedding-church"
            />
          </div>
        ) : null}
      </SetupFrame>
    );
  }

  if (card === 'w_area') return <AreaCard frame={frame} state={state} patch={patch} />;
  if (card === 'w_pax') return <PaxCard frame={frame} state={state} patch={patch} />;
  if (card === 'w_budget') return <BudgetCard frame={frame} state={state} patch={patch} budgetBands={budgetBands} />;
  return <ColoursCard frame={frame} state={state} patch={patch} />;
}

type FrameProps = { skin: 'wedding'; n: number; total: number; dataCard: string };
type SubProps = { frame: FrameProps; state: OnboardingState; patch: (p: Partial<OnboardingState>) => void };

function AreaCard({ frame, state, patch }: SubProps) {
  const [more, setMore] = useState(false);
  const top = TOP30.map((k) => cityByKey(k)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const rest = CITIES.filter((c) => !TOP30.includes(c.k)).sort((a, b) => a.n.localeCompare(b.n));
  const picked = state.places[0] ?? null;
  return (
    <SetupFrame
      {...frame}
      title="Where will it be?"
      line="The area is enough — it finds you nearby suppliers."
      info="You’ll find your parish and reception with Setnayan. Not booked yet? That’s normal."
    >
      <PickMenu
        label="Area"
        value={picked && cityByKey(picked) ? picked : null}
        buttonText={picked && !cityByKey(picked) ? 'Another place' : picked ? undefined : 'Pick an area'}
        options={[
          ...top.map((c) => ({ key: c.k, label: c.n, hint: c.r, group: 'Most chosen' })),
          ...rest.map((c) => ({ key: c.k, label: c.n, hint: c.r, group: 'All places A–Z' })),
        ]}
        onPick={(key) => patch({ places: [key], region: resolvePick(key).rk })}
        dataAttr="data-wedding-area"
        stickyGroups
      />
      <button type="button" className="mt-3 text-sm text-ink/60 underline" onClick={() => setMore((v) => !v)}>
        {more ? 'Hide more places' : 'More places ›'}
      </button>
      {more ? (
        <div className="mt-3">
          <LocationStep
            value={state.places}
            onChange={(places) => patch({ places, region: places[0] ? resolvePick(places[0]).rk : null })}
          />
        </div>
      ) : null}
    </SetupFrame>
  );
}

function PaxCard({ frame, state, patch }: SubProps) {
  const value = snapEstimate(state.pax);
  // The card opens on the drawn start; the estimate is real once the card has been seen.
  useEffect(() => {
    if (state.pax !== value) patch({ pax: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const btn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink/15 text-2xl leading-none text-ink/70 disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <SetupFrame
      {...frame}
      title="About how many guests?"
      line="A rough number is fine — it sizes your seat plan and quotes."
      info="It sizes your seat plan, your suppliers’ quotes and Papic. You’ll list their names later — or now, if you like."
      footer="Steps of 10. You can change this anytime."
    >
      <div className="flex items-center justify-between gap-3" data-wedding-estimate>
        <button type="button" aria-label="Fewer guests" className={btn} disabled={value <= ESTIMATE_MIN} onClick={() => patch({ pax: stepEstimate(value, -1) })}>
          −
        </button>
        <span className="min-w-0 flex-1 text-center">
          <span className="block font-mono text-3xl font-semibold tabular-nums text-ink">{formatCount(value)}</span>
          <span className="mt-0.5 block text-xs text-ink/55">About {formatCount(value)} guests</span>
        </span>
        <button type="button" aria-label="More guests" className={btn} disabled={value >= ESTIMATE_MAX} onClick={() => patch({ pax: stepEstimate(value, 1) })}>
          +
        </button>
      </div>
    </SetupFrame>
  );
}

function BudgetCard({ frame, state, patch, budgetBands }: SubProps & { budgetBands: readonly BudgetBand[] }) {
  const guests = snapEstimate(state.pax);
  const rows = budgetRows(budgetBands, guests);
  const band = state.budgetBand ?? BUDGET_DEFAULT_BAND;
  const row = rows.find((r) => r.value === band) ?? rows.find((r) => r.value === BUDGET_DEFAULT_BAND) ?? rows[0];
  // Classic is pre-selected; the amount always follows the estimate (per-head median × guests).
  useEffect(() => {
    if (!row) return;
    if (state.budgetBand !== row.value || state.budgetAmount !== row.pesos) {
      patch({ budgetBand: row.value, budgetAmount: row.pesos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests]);
  return (
    <SetupFrame
      {...frame}
      title="About how much is your budget?"
      line="Rough is fine — you can change it anytime."
      info="It is only for tracking. It never hides or limits a choice."
    >
      <PickMenu
        label="Budget"
        value={row?.value ?? null}
        options={rows.map((r) => ({
          key: r.value,
          label: `${r.label} · ${r.tag}`,
          hint: r.pesos == null ? 'No ceiling — whatever it takes' : `about ${peso(r.pesos)} for your ${formatCount(guests)} guests`,
        }))}
        onPick={(key) => {
          const r = rows.find((x) => x.value === key);
          if (r) patch({ budgetBand: r.value, budgetAmount: r.pesos });
        }}
        dataAttr="data-wedding-budget"
      />
    </SetupFrame>
  );
}

function ColoursCard({ frame, state, patch }: SubProps) {
  // w_colours — the palette "feel" the Mood Board already seeds itself from (`events.mood_feel_key`).
  const feel = state.prefs.feel && FEEL_LABEL[state.prefs.feel] ? state.prefs.feel : 'theme';
  return (
    <SetupFrame
      {...frame}
      title="Your colours"
      line="Your motif — on cards, the QR code and what suppliers see."
      info="Your Mood Board starts from this. A stylist or coordinator can fill it in later."
      quick={['My supplier will fill this in']}
      onQuick={() => patch({ prefs: { ...state.prefs, feel: null } })}
    >
      <PickMenu
        label="Palette"
        value={feel}
        options={[
          { key: 'theme', label: 'Theme’s own' },
          ...Object.keys(FEEL_LABEL).map((k) => ({
            key: k,
            label: FEEL_LABEL[k]!,
            preview: (
              <span className="flex gap-0.5" aria-hidden>
                {(FEEL_PALETTES[k] ?? []).map((hex) => (
                  <span key={hex} className="h-4 w-4 rounded-full border border-ink/10" style={{ background: hex }} />
                ))}
              </span>
            ),
          })),
        ]}
        onPick={(key) => patch({ prefs: { ...state.prefs, feel: key === 'theme' ? null : key } })}
        dataAttr="data-wedding-colours"
      />
    </SetupFrame>
  );
}
