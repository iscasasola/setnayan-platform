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
import { StepField, StepGroup, StepInput, StepPick } from '@/app/onboarding/_shared/step-field';
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
  WEDDING_EVENT_NAME_MAX,
  WEDDING_SELF_SIDES,
  weddingEventName,
  ceremonyChoiceOf,
  ceremonyChoiceToState,
  budgetRows,
  snapEstimate,
  stepEstimate,
  weddingSelfSide,
  type CeremonyChoice,
  type WeddingCardId,
  type WeddingSelfSide,
} from '@/lib/onboarding/wedding-cards';
import { CITIES, TOP30, cityByKey, resolvePick } from '../_data/wedding-cities';
import { LocationStep } from './location-step';
import { WeddingVenues, type VenueSearch } from './wedding-venues';
import { EMPTY_VENUES } from '@/lib/onboarding/venue-picks';
import type { OnboardingState } from '../types';
import { slugify } from '@/lib/slugs';

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
  /** "Which one is you?" — the shell's `selectRole`: sets `role` and moves the account name to that row. */
  pickSelf: (side: WeddingSelfSide) => void;
  n: number;
  total: number;
  /** Faiths the admin has switched on (`wedding_type_launch_status`); null = read failed. */
  activeFaiths: string[] | null;
  budgetBands: readonly BudgetBand[];
  /** The wedding's venue search, handed in by the shell (a server action stays out of this module). */
  searchVenues: VenueSearch;
};

export function WeddingCard({ card, state, patch, pickSelf, n, total, activeFaiths, budgetBands, searchVenues }: Props) {
  const frame = { skin: 'wedding' as const, n, total, dataCard: card };

  if (card === 'w_names') {
    // "Which one is you?" comes FIRST (owner 2026-11-08: "they need to be one of the 2") — exactly the two
    // of the couple, as ONE PickMenu (this card had no shipped two-choice control). The pick is the wizard's
    // existing `role`; the shell's `selectRole` seats YOUR row from your account name (`moveSelf`), never
    // the partner's, and never over anything typed. The rows open once the pick is made.
    const side = weddingSelfSide(state.role);
    const sideWord = (k: WeddingSelfSide) => WEDDING_SELF_SIDES.find((o) => o.key === k)!.label;
    // 📐 THE SHARED STEP PARTS (Lane P, owner 10 Nov: "inconsistent design template on the onboarding.
    // Like the text of the names"): each name is a labelled field (label above, "optional" muted), the
    // shared 48 px input with its inner padding — never a bespoke box whose text sits on the border.
    const field = (rowSide: WeddingSelfSide, label: string, value: string, key: keyof OnboardingState, req: boolean, token: string) => (
      <StepField label={label} small={req ? undefined : 'optional'} htmlFor={`w-names-${rowSide}-${token}`}>
        <StepInput
          id={`w-names-${rowSide}-${token}`}
          aria-label={`${sideWord(rowSide)} — ${label}`}
          placeholder={label}
          // Your own row offers the phone's saved name; the partner's is another person's — autofill off.
          autoComplete={rowSide === side ? token : 'off'}
          autoCapitalize="words"
          enterKeyHint="next"
          required={req}
          value={value}
          data-wedding-name-row={rowSide}
          data-wedding-own-row={rowSide === side ? '' : undefined}
          onChange={(e) => patch({ [key]: nameOnly(e.target.value), monogramFinalized: true } as Partial<OnboardingState>)}
        />
      </StepField>
    );
    const rows = (rowSide: WeddingSelfSide) => (
      <>
        <StepGroup>
          {sideWord(rowSide)}
          {rowSide === side ? ' · you' : ''}
        </StepGroup>
        {rowSide === 'bride' ? (
          <>
            {field('bride', 'First name', state.brideFirstName, 'brideFirstName', true, 'given-name')}
            {field('bride', 'Last name', state.brideLastName, 'brideLastName', false, 'family-name')}
          </>
        ) : (
          <>
            {field('groom', 'First name', state.groomFirstName, 'groomFirstName', true, 'given-name')}
            {field('groom', 'Last name', state.groomLastName, 'groomLastName', false, 'family-name')}
          </>
        )}
      </>
    );
    return (
      <SetupFrame
        {...frame}
        title="Who’s getting married?"
        line="Your names, the way you want them written."
        info="They go on your invitation, your Event Hub and your guest list. Last names are optional. Your own side is filled from your account — change it here if you want it written differently."
      >
        <div className="flex flex-col gap-3" data-wedding-names>
          <StepField label="Which one is you?">
            <StepPick
              label="Which one is you?"
              value={side}
              options={WEDDING_SELF_SIDES.map((o) => ({ key: o.key, label: o.label, hint: o.hint }))}
              onPick={(key) => {
                const next = weddingSelfSide(key);
                if (next) pickSelf(next);
              }}
              dataAttr="data-wedding-self"
            />
          </StepField>
          {/* Your side first, the partner's under it — one column, equal widths (the template). */}
          {side ? (
            <>
              {rows(side)}
              {rows(side === 'bride' ? 'groom' : 'bride')}
            </>
          ) : null}
        </div>
      </SetupFrame>
    );
  }

  if (card === 'w_eventname') {
    // ✍ "NAME YOUR WEDDING" (Lane P, owner 10 Nov: "we want the event name to be set on the onboarding") —
    // prefilled from the names (the first person first), editable; the Event Hub address is seeded from it.
    const name = weddingEventName(state);
    const address = slugify(name);
    return (
      <SetupFrame
        {...frame}
        title="Name your wedding"
        line="It is the title of your Event Hub and its address."
        info="We wrote it from your names. Change it to anything — “The Casasola Wedding”, “Claire & Ice”. The address under it is taken from the name."
      >
        <div className="flex flex-col gap-3" data-wedding-event-name>
          <StepField
            label="Event name"
            htmlFor="w-event-name"
            hint={
              address ? (
                <>
                  Your Event Hub · <code className="font-mono text-ink/70">setnayan.com/{address}</code>
                </>
              ) : null
            }
          >
            <StepInput
              id="w-event-name"
              aria-label="Event name"
              placeholder="e.g. Claire & Indalecio"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={WEDDING_EVENT_NAME_MAX}
              required
              value={name}
              data-wedding-event-name-input
              onChange={(e) => patch({ eventName: e.target.value.slice(0, WEDDING_EVENT_NAME_MAX) })}
            />
          </StepField>
        </div>
      </SetupFrame>
    );
  }

  if (card === 'w_kind') {
    const choice = ceremonyChoiceOf(state);
    const churchLabel = (k: FaithKey) => FAITH_REGISTRY.find((e) => e.key === k)?.label ?? k;
    const offered = CHURCH_FAITHS.filter((k) => (activeFaiths ? activeFaiths.includes(k) : !FAITH_REGISTRY.find((e) => e.key === k)?.defaultSoon));
    // 📐 One labelled field each, both dropdowns the full width of the column (owner 10 Nov on this step:
    // "bare text pills of different widths"); "Not decided yet" is a choice INSIDE the Ceremony list
    // (`CEREMONY_CHOICES`), never a third control beside it — the quick pill is gone.
    return (
      <SetupFrame
        {...frame}
        title="What kind of wedding?"
        line="It shapes the paperwork and the programme."
        info="Pick the closest. You can change it from your Event Hub Maker."
      >
        <div className="flex flex-col gap-3">
          <StepField label="Ceremony">
            <StepPick
              label="Ceremony"
              value={choice}
              options={CEREMONY_CHOICES.map((c) => ({ key: c, label: CEREMONY_COPY[c].label, hint: CEREMONY_COPY[c].hint }))}
              onPick={(key) => patch(ceremonyChoiceToState(key as CeremonyChoice, state.faith[0] as FaithKey | undefined))}
              dataAttr="data-wedding-kind"
            />
          </StepField>
          {choice === 'church' && offered.length > 1 ? (
            <StepField label="Church">
              <StepPick
                label="Church"
                value={state.faith[0] ?? 'catholic'}
                options={offered.map((k) => ({ key: k, label: churchLabel(k) }))}
                onPick={(key) => patch(ceremonyChoiceToState('church', key as FaithKey))}
                dataAttr="data-wedding-church"
              />
            </StepField>
          ) : null}
        </div>
      </SetupFrame>
    );
  }

  if (card === 'w_area') return <AreaCard frame={frame} state={state} patch={patch} searchVenues={searchVenues} />;
  if (card === 'w_pax') return <PaxCard frame={frame} state={state} patch={patch} />;
  if (card === 'w_budget') return <BudgetCard frame={frame} state={state} patch={patch} budgetBands={budgetBands} />;
  return <ColoursCard frame={frame} state={state} patch={patch} />;
}

type FrameProps = { skin: 'wedding'; n: number; total: number; dataCard: string };
type SubProps = { frame: FrameProps; state: OnboardingState; patch: (p: Partial<OnboardingState>) => void };

function AreaCard({ frame, state, patch, searchVenues }: SubProps & { searchVenues: VenueSearch }) {
  const [more, setMore] = useState(false);
  const top = TOP30.map((k) => cityByKey(k)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const rest = CITIES.filter((c) => !TOP30.includes(c.k)).sort((a, b) => a.n.localeCompare(b.n));
  const picked = state.places[0] ?? null;
  const haveVenue = state.venues.open;
  // 📍 A couple who already has a venue is not asked the area — it comes from the venue they pick
  // (DECISION_LOG 2026-10-01). Until a pick gives one, the Area ▾ stays so nobody is stuck.
  const askArea = !(haveVenue && state.places.length > 0);
  return (
    <SetupFrame
      {...frame}
      title="Where will it be?"
      line="The area is enough — it finds you nearby suppliers."
      info="You’ll find your parish and reception with Setnayan. Not booked yet? That’s normal."
    >
      {askArea ? (
        <>
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
        </>
      ) : (
        <p className="text-sm text-ink/60" data-wedding-area-from-venue>
          Your area comes from your venue.
        </p>
      )}
      <button
        type="button"
        className="mt-4 block text-sm text-ink/60 underline"
        aria-expanded={haveVenue}
        data-wedding-have-venue
        onClick={() => patch({ venues: haveVenue ? EMPTY_VENUES : { ...EMPTY_VENUES, open: true } })}
      >
        {haveVenue ? 'Just the area for now' : 'We already have our venue ›'}
      </button>
      {haveVenue ? <WeddingVenues state={state} patch={patch} search={searchVenues} /> : null}
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
