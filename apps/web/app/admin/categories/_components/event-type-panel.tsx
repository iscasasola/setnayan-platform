/**
 * event-type-panel.tsx — the right-hand panel for one event type.
 *
 * Folds three per-type pages into one panel (2026-10-02): Scope categories
 * (/admin/event-types/<type>/categories) → "Categories it shows"; Onboarding
 * profile (…/profile) → "Words" · "Parts switched on" · "Engine"; Onboarding
 * content (…/onboarding) → "Onboarding content". The roster row's own edits —
 * name, emoji, the merged Status ▾, order, the picker card — sit at the top.
 *
 * 🔑 THE LINK TO CATEGORIES IS EDITED HERE AND ONLY HERE; the category panel
 * shows it read-only. The link to religions ("Religions asked") is edited on
 * the religion and shown read-only here.
 *
 * 🚨 A REFUSED READ NEVER ARMS A SAVE (admin audit 2026-09-30, row 34). A
 * refused profile read used to prefill the built-in defaults and arm Save, so
 * one press wrote the defaults over the real terminology; a refused onboarding
 * read showed the defaults in an armed editor. Both are carried over below.
 */
import { formatCount } from '@/lib/format-number';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { defaultHostNoun, isCelebrantShape, resolveProfile } from '@/lib/event-type-profile';
import { resolveOnboardingSpec, type OnboardingOverrideRow } from '@/lib/onboarding/onboarding-spec';
import { getOnboardingTiles } from '@/lib/onboarding-refinements';
import { INAPP_TO_SERVICE_CODE } from '@/app/onboarding/wedding/_components/onboarding-pricing';
import { SubmitButton } from '@/app/_components/submit-button';
import { reorderEventTypeVocab, setEventTypeStatus, updateEventTypePresentation } from '../actions';
import { setFolderEventTypeOffered, setTileEventTypeOffered, upsertEventTypeProfile } from '../event-type-actions';
import type { BackState } from './back';
import {
  EVENT_TYPE_STATUS_LABEL,
  categoryServes,
  eventTypeStatusWord,
  offeredCount,
  religionsAskedOn,
  type Category,
  type EventType,
  type Group,
  type Religion,
} from './model';
import { OnboardingEditor } from './onboarding-editor';
import { FieldPick, SavePick, TogglePick } from './pickers';
import { BackFields, INPUT, KeyRow, ReadOnly, SAVE, Section, backRecord } from './ui';

const SURFACES: { key: string; label: string }[] = [
  { key: 'website', label: 'Website' },
  { key: 'save_the_date', label: 'Save the Date' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'seating', label: 'Seating' },
  { key: 'budget', label: 'Budget' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'monogram', label: 'Monogram' },
  { key: 'day_of', label: 'Day-of' },
  { key: 'gallery', label: 'Gallery' },
];

// Prefill for a type with no saved profile row yet. 'website' is REQUIRED here,
// not a taste call: day_of + gallery are pages OF the public event site and
// 'website' carries the only "go live" control, so a default without it is a
// combination the save path refuses.
const GENERIC_SURFACES = new Set([
  'website',
  'seating',
  'budget',
  'schedule',
  'day_of',
  'gallery',
]);

const SHAPES = [
  { key: 'single', label: 'single — one person' },
  { key: 'couple', label: 'couple — two people' },
  { key: 'multiple', label: 'multiple — several people' },
];

/**
 * Labels for in-app service keys whose STRING no longer describes the product
 * (stable identifiers in live saved drafts, never renamed).
 */
const SERVICE_KEY_LABELS: Record<string, string> = {
  papic_seats: 'Papic — a camera with its own shots',
  papic_guest: 'Papic — add credits',
};

function humanize(key: string): string {
  return (
    SERVICE_KEY_LABELS[key] ??
    key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

type ProfileRow = {
  terminology: Record<string, unknown> | null;
  enabled_surfaces: string[] | null;
  onboarding_flow_key: string | null;
  role_set_key: string | null;
  marketplace_enabled: boolean | null;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export async function EventTypePanel({
  vocab,
  eventTypes,
  groups,
  categories,
  religions,
  state,
}: {
  vocab: EventType;
  eventTypes: readonly EventType[];
  groups: readonly Group[];
  categories: readonly Category[];
  religions: readonly Religion[];
  state: BackState;
}) {
  const eventType = vocab.key;
  const isWedding = eventType === 'wedding';
  const admin = createAdminClient();
  const back = backRecord(state);
  const formId = `profile-${eventType}`;

  const { data: profileData, error: profileError } = await admin
    .from('event_type_profiles')
    .select('terminology, enabled_surfaces, onboarding_flow_key, role_set_key, marketplace_enabled')
    .eq('event_type', eventType)
    .maybeSingle<ProfileRow>();
  const profileReadFailed = Boolean(profileError);
  if (profileError) {
    logQueryError('EventTypePanel (profile)', profileError, { eventType }, 'graceful_degrade');
  }

  const t = (profileData?.terminology ?? {}) as Record<string, unknown>;
  const term = {
    organizer_noun: str(t.organizer_noun) || (isWedding ? 'couple' : 'host'),
    person_a: str(t.person_a),
    person_b: str(t.person_b),
    seat_word: str(t.seat_word) || 'table',
    event_word: str(t.event_word) || vocab.label.toLowerCase(),
    vip_tier_label: str(t.vip_tier_label) || 'Guests of honor',
    host_noun: str(t.host_noun) || defaultHostNoun(str(t.organizer_noun) || (isWedding ? 'couple' : 'host')),
    celebrant_noun: str(t.celebrant_noun) || str(t.organizer_noun) || (isWedding ? 'couple' : 'host'),
    celebrant_shape: isCelebrantShape(t.celebrant_shape) ? t.celebrant_shape : isWedding ? 'couple' : 'single',
  };
  const enabled = new Set(
    profileData?.enabled_surfaces ?? (isWedding ? SURFACES.map((s) => s.key) : [...GENERIC_SURFACES]),
  );
  const onboardingFlowKey = profileData?.onboarding_flow_key ?? (isWedding ? 'wedding' : eventType);
  const roleSetKey = profileData?.role_set_key ?? (isWedding ? 'wedding' : 'generic');
  const marketplaceOn = profileData?.marketplace_enabled ?? true;

  const word = eventTypeStatusWord(vocab);
  const counts = offeredCount(categories, eventType);
  const asked = religionsAskedOn(religions, eventType);
  const siblingOrder = eventTypes.filter((e) => e.status === 'active');
  const presentationHidden = (except: string[]) =>
    (
      [
        ['label_en', vocab.label],
        ['emoji', vocab.emoji],
        ['description', vocab.description ?? ''],
        ['onboarding_href', vocab.onboardingHref ?? ''],
        ['hero_photo_url', vocab.heroPhotoUrl ?? ''],
      ] as const
    )
      .filter(([k]) => !except.includes(k))
      .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <article data-panel="event-type">
      <header className="pb-3">
        <p className="text-xs font-medium text-ink/70">Event type</p>
        <h2 className="text-xl font-semibold text-ink">
          <span aria-hidden>{vocab.emoji}</span> {vocab.label}
        </h2>
        <p className="text-xs text-ink/70">key {eventType}</p>
      </header>

      {/* The profile form spans four sections (Suppliers can serve it · Words ·
          Parts switched on · Engine); its inputs join it with form={formId}. */}
      <form id={formId} action={upsertEventTypeProfile}>
        <BackFields state={state} />
        <input type="hidden" name="event_type" value={eventType} />
        <input type="hidden" name="marketplace_enabled_shown" value="1" />
      </form>

      <Section title="Name & status">
        <form action={updateEventTypePresentation} className="flex flex-wrap items-center gap-2">
          <BackFields state={state} />
          <input type="hidden" name="event_type" value={eventType} />
          {presentationHidden(['label_en', 'emoji'])}
          <input name="emoji" defaultValue={vocab.emoji} maxLength={16} aria-label="Emoji" className={`${INPUT} w-16`} />
          <input name="label_en" defaultValue={vocab.label} minLength={2} maxLength={80} aria-label="Name" className={`${INPUT} flex-1`} />
          <SubmitButton className={SAVE} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
        <KeyRow label="Status">
          <SavePick
            label="Status"
            value={word}
            choices={(['picker', 'hidden', 'retired'] as const).map((k) => ({
              key: k,
              label: EVENT_TYPE_STATUS_LABEL[k],
              disabledNote: isWedding && k !== 'picker' ? 'wedding stays in the picker' : undefined,
            }))}
            action={setEventTypeStatus}
            field="status"
            hidden={{ ...back, event_type: eventType }}
          />
        </KeyRow>
        {vocab.status === 'active' && siblingOrder.length > 1 ? (
          <KeyRow label="Order">
            <SavePick
              label="Order"
              value=""
              buttonText="Move"
              choices={[
                { key: 'up', label: 'Move up' },
                { key: 'down', label: 'Move down' },
              ]}
              action={reorderEventTypeVocab}
              field="dir"
              hidden={{ ...back, event_type: eventType }}
            />
          </KeyRow>
        ) : null}
      </Section>

      <Section title="Categories it shows">
        <ReadOnly>
          {counts.tailored === 0
            ? `All ${formatCount(counts.total)} categories (none tailored yet)`
            : `${formatCount(counts.offered)} of ${formatCount(counts.total)} · ${formatCount(counts.tailored)} tailored, the rest for every event`}
        </ReadOnly>
        <ul className="space-y-2" data-categories-it-shows="">
          {groups.map((g) => {
            const cats = categories.filter((c) => c.groupId === g.id);
            if (cats.length === 0) return null;
            const on = cats.filter((c) => categoryServes(c.eventTypes, eventType)).map((c) => c.id);
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-2">
                <span className="w-48 shrink-0 text-sm text-ink">
                  {g.label} <span className="text-xs text-ink/70">· {formatCount(on.length)} of {formatCount(cats.length)} offered</span>
                </span>
                <TogglePick
                  label={`${g.label} for ${vocab.label}`}
                  picked={on}
                  choices={cats.map((c) => ({ key: c.id, label: c.label }))}
                  action={setTileEventTypeOffered}
                  keyField="tile_id"
                  onField="offered"
                  hidden={{ ...back, event_type: eventType }}
                  buttonText="Choose"
                />
                <SavePick
                  label={`Offer all in ${g.label}`}
                  value=""
                  buttonText="Offer all"
                  choices={[
                    { key: '1', label: 'Offer all' },
                    { key: '0', label: 'Hide all' },
                  ]}
                  action={setFolderEventTypeOffered}
                  field="offered"
                  hidden={{ ...back, event_type: eventType, folder_id: g.id }}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Religions asked">
        <ReadOnly>{asked.length === 0 ? 'None — this type never asks' : asked.map((r) => r.label).join(' · ')}</ReadOnly>
      </Section>

      {profileReadFailed ? (
        <div role="alert" className="my-2 rounded-xl bg-[var(--sn-warning-soft)] p-3 text-sm text-ink">
          Couldn’t load this type’s profile — refresh to try again. Saving is off until it loads, so the defaults below
          can’t overwrite it.
        </div>
      ) : null}

      <Section title="Suppliers can serve it">
        <label className="flex items-center justify-between gap-3 text-sm text-ink">
          Suppliers can serve it
          <input
            type="checkbox"
            name="marketplace_enabled"
            form={formId}
            defaultChecked={marketplaceOn}
            className="h-5 w-5 accent-terracotta"
          />
        </label>
        <SubmitButton disabled={profileReadFailed} form={formId} className={SAVE} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </Section>

      <Section title="Words">
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['organizer_noun', 'Organizer', term.organizer_noun],
              ['host_noun', 'Host (who runs it)', term.host_noun],
              ['celebrant_noun', 'Celebrant (who it’s for)', term.celebrant_noun],
              ['event_word', 'Event word', term.event_word],
              ['vip_tier_label', 'VIP tier', term.vip_tier_label],
              ['seat_word', 'Seat word', term.seat_word],
              ['person_a', 'Person A', term.person_a],
              ['person_b', 'Person B', term.person_b],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="text-xs font-medium text-ink/70">
              {label}
              <input name={name} form={formId} defaultValue={value} className={`mt-1 block w-full ${INPUT}`} />
            </label>
          ))}
        </div>
        <KeyRow label="Celebrant shape">
          <FieldPick label="Celebrant shape" name="celebrant_shape" defaultValue={term.celebrant_shape} choices={SHAPES} form={formId} />
        </KeyRow>
        <SubmitButton disabled={profileReadFailed} form={formId} className={SAVE} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </Section>

      <Section title="Parts switched on">
        <div className="grid gap-2 sm:grid-cols-3">
          {SURFACES.map((s) => (
            <label key={s.key} className="flex min-h-10 items-center gap-2 text-sm text-ink">
              <input type="checkbox" name={`surface_${s.key}`} form={formId} defaultChecked={enabled.has(s.key)} className="h-4 w-4 accent-terracotta" />
              {s.label}
            </label>
          ))}
        </div>
        <ReadOnly>Day-of and Gallery need Website on — the save refuses otherwise.</ReadOnly>
        <SubmitButton disabled={profileReadFailed} form={formId} className={SAVE} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </Section>

      <Section title="Picker card">
        <form action={updateEventTypePresentation} className="space-y-2">
          <BackFields state={state} />
          <input type="hidden" name="event_type" value={eventType} />
          {presentationHidden(['description', 'onboarding_href', 'hero_photo_url'])}
          <KeyRow label="Tagline">
            <input name="description" defaultValue={vocab.description ?? ''} maxLength={300} className={`${INPUT} flex-1`} />
          </KeyRow>
          <KeyRow label="Hero photo">
            <input name="hero_photo_url" defaultValue={vocab.heroPhotoUrl ?? ''} placeholder="/path or https://" className={`${INPUT} flex-1`} />
          </KeyRow>
          <KeyRow label="Onboarding link">
            <input name="onboarding_href" defaultValue={vocab.onboardingHref ?? ''} placeholder="/onboarding/…" className={`${INPUT} flex-1`} />
          </KeyRow>
          <SubmitButton className={SAVE} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section title="Onboarding content" closed>
        <OnboardingContent vocab={vocab} />
      </Section>

      <Section title="Engine" closed>
        <KeyRow label="Onboarding flow key">
          <input name="onboarding_flow_key" form={formId} defaultValue={onboardingFlowKey} className={`${INPUT} flex-1`} />
        </KeyRow>
        <KeyRow label="Role set key">
          <input name="role_set_key" form={formId} defaultValue={roleSetKey} className={`${INPUT} flex-1`} />
        </KeyRow>
        <SubmitButton disabled={profileReadFailed} form={formId} className={SAVE} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </Section>
    </article>
  );
}

/** The onboarding CONTENT editor, as it was on /admin/event-types/<type>/onboarding. */
async function OnboardingContent({ vocab }: { vocab: EventType }) {
  const eventType = vocab.key;
  if (eventType === 'wedding') {
    return <ReadOnly>Wedding runs its own guided wizard — its words live under Words above.</ReadOnly>;
  }
  const admin = createAdminClient();
  const profile = await resolveProfile(eventType);
  const packKey = profile.onboardingFlowKey ?? eventType;
  const [{ data: rowData, error: rowError }, tiles] = await Promise.all([
    admin
      .from('event_type_onboarding')
      .select('intro, questions, persona_pack, reveal_overrides, axis_overrides')
      .eq('event_type', eventType)
      .maybeSingle<OnboardingOverrideRow>(),
    getOnboardingTiles(eventType),
  ]);
  if (rowError) {
    logQueryError('EventTypePanel (onboarding override)', rowError, { eventType }, 'graceful_degrade');
    return <OnboardingReadFailed />;
  }
  const spec = resolveOnboardingSpec(eventType, packKey, rowData ?? null, profile.terminology.register);
  const categoryOptions =
    profile.marketplaceEnabled === false
      ? []
      : tiles.map((t) => ({ value: t.cat, label: t.label }));
  const serviceOptions = Object.keys(INAPP_TO_SERVICE_CODE).map((k) => ({ value: k, label: humanize(k) }));
  return (
    <div>
      <a
        href={vocab.onboardingHref || `/onboarding/${eventType}`}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-ink underline"
      >
        Preview the flow
      </a>
      <OnboardingEditor
        eventType={eventType}
        spec={spec}
        hasOverride={!!rowData}
        categoryOptions={categoryOptions}
        serviceOptions={serviceOptions}
      />
    </div>
  );
}

function OnboardingReadFailed() {
  return (
    <div role="alert" className="rounded-xl bg-[var(--sn-warning-soft)] p-3 text-sm text-ink">
      Couldn’t load this — refresh to try again. Editing is off until the saved content loads, so the defaults can’t
      overwrite it.
    </div>
  );
}
