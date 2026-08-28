'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { updateEventMatchCriteria } from '../../actions';
import { REGION_OPTIONS, FEEL_OPTIONS, sanitizeName } from '@/lib/match-criteria';
import { resolveRegion } from '@/lib/region-source';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * DetailsForm — edits the governance-free basics on the Personalization page:
 * couple names + the curated match criteria (region, mood/feel, budget) the
 * Home "Personalized" block shows. CLAUDE.md 2026-06-02 "do both" step 1 +
 * Phase B (names added).
 *
 * Date / ceremony / venue / guest-count are NOT here — they carry the
 * booked-vendor change-flow governance and keep their own governed editors
 * (the parent page surfaces the CeremonyTypeChip + deep-links the date to
 * /date-selection). Everything in THIS form binds no vendor, so it's a plain
 * save; names also recompute the display label (chrome) server-side.
 *
 * Calls the result-returning `updateEventMatchCriteria` server action via
 * useTransition; shows inline saved/error states. Clean Editorial palette.
 */
export function DetailsForm({
  eventId,
  initialBrideFirst,
  initialBrideLast,
  initialGroomFirst,
  initialGroomLast,
  initialRegion,
  initialFeel,
  initialBudgetPesos,
  mayEditBudget,
  // PR-G — opt-in BaZi birth-data (Chinese weddings, flag-gated). When
  // showBaziBirthData is false the section never renders and the form is
  // byte-identical to before. Defaulted so existing/other call sites stay valid.
  showBaziBirthData = false,
  baziHasConsent = false,
  initialPartnerABirthDate = '',
  initialPartnerABirthTime = '',
  initialPartnerBBirthDate = '',
  initialPartnerBBirthTime = '',
  // The repeat. `repeatOptions` empty ⇒ this type cannot repeat and the section
  // never renders; a single option that is FORCED ⇒ a sentence, not a picker.
  repeatOptions = [],
  repeatForced = false,
  initialCadence = '',
  // Who is being celebrated, and how many of them (owner 2026-08-27). Empty
  // string = "however this kind of celebration usually goes", i.e. the type's
  // own shape — which is what every event holds today.
  showCelebrantShape = false,
  initialCelebrantShape = '',
  celebrantTypeDefaultLabel = '',
}: {
  eventId: string;
  initialBrideFirst: string;
  initialBrideLast: string;
  initialGroomFirst: string;
  initialGroomLast: string;
  initialRegion: string;
  initialFeel: string;
  initialBudgetPesos: string;
  /**
   * May THIS reader see and change the couple's budget target? False for a
   * delegate the couple has not given budget access. The field is not
   * rendered, and — critically — `budget_pesos` is then NOT posted at all,
   * because the server action treats an ABSENT key as "leave it alone" and an
   * EMPTY one as "clear it". Posting an empty box she was never shown would
   * have wiped the couple's target.
   */
  mayEditBudget: boolean;
  showBaziBirthData?: boolean;
  baziHasConsent?: boolean;
  initialPartnerABirthDate?: string;
  initialPartnerABirthTime?: string;
  initialPartnerBBirthDate?: string;
  initialPartnerBBirthTime?: string;
  repeatOptions?: readonly { value: string; label: string }[];
  /** FALSE for a type where the question cannot arise — a wedding is always a
   *  couple, and a wake has no celebrant to count. Nothing renders and the key
   *  is not posted, so the payload stays byte-identical for those types. */
  showCelebrantShape?: boolean;
  initialCelebrantShape?: string;
  /** What "usually" means for this event type, shown on the default option so
   *  the person can see what they are leaving alone. */
  celebrantTypeDefaultLabel?: string;
  repeatForced?: boolean;
  initialCadence?: string;
}) {
  const [cadence, setCadence] = useState(initialCadence);
  const [celebrantShape, setCelebrantShape] = useState(initialCelebrantShape);
  const [brideFirst, setBrideFirst] = useState(initialBrideFirst);
  const [brideLast, setBrideLast] = useState(initialBrideLast);
  const [groomFirst, setGroomFirst] = useState(initialGroomFirst);
  const [groomLast, setGroomLast] = useState(initialGroomLast);
  // Normalize the stored region to its canonical hyphen slug so the <select>
  // (whose option values are now canonical slugs via REGION_OPTIONS) preselects
  // regardless of which of the four vocabularies the row was written in
  // (onboarding hyphen slug, dashboard underscore slug, PSGC code, …). Unknown
  // / unset → '' (the "Not set" option), matching prior behavior.
  const [region, setRegion] = useState(resolveRegion(initialRegion)?.slug ?? '');
  const [feel, setFeel] = useState(initialFeel);
  const [budget, setBudget] = useState(initialBudgetPesos);
  // PR-G — BaZi birth-data opt-in (only meaningful when showBaziBirthData).
  // Consent is pre-checked when a consent timestamp already exists (the couple
  // opted in before); otherwise it starts unchecked and gates the write.
  const [baziConsent, setBaziConsent] = useState(baziHasConsent);
  const [partnerABirthDate, setPartnerABirthDate] = useState(initialPartnerABirthDate);
  const [partnerABirthTime, setPartnerABirthTime] = useState(initialPartnerABirthTime);
  const [partnerBBirthDate, setPartnerBBirthDate] = useState(initialPartnerBBirthDate);
  const [partnerBBirthTime, setPartnerBBirthTime] = useState(initialPartnerBBirthTime);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveLoader();

  const selectClass =
    'w-full rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('bride_first', brideFirst.trim());
    fd.set('bride_last', brideLast.trim());
    fd.set('groom_first', groomFirst.trim());
    fd.set('groom_last', groomLast.trim());
    fd.set('region', region);
    fd.set('mood_feel_key', feel);
    if (mayEditBudget) fd.set('budget_pesos', budget.replace(/[, ]/g, ''));
    // PR-G — only attach BaZi birth keys when the opt-in section is shown
    // (flag on + Chinese event). With the section hidden, the payload is
    // byte-identical to before, and the server action also re-guards on the
    // flag + ceremony + consent, so nothing is written. The consent flag is the
    // third gate: the server only writes the birth fields when it's '1'.
    // Only send the repeat when this type actually offers one AND the choice is
    // the person's to make. The server treats an ABSENT key as "leave it alone",
    // so somebody editing their budget can never silently switch off a repeat
    // they were never shown.
    if (repeatOptions.length > 0) {
      // A FORCED type posts its one legal cadence rather than nothing. Sending
      // nothing meant the screen could assert "this returns every year" over a
      // row that said otherwise and offer no way to make it true — the exact
      // state every birthday created from the create grid was in. The server's
      // resolveCadence ignores the posted value for a forced type anyway, so
      // this is a repair, never a new decision.
      fd.set('recur_cadence', repeatForced ? (repeatOptions[0]?.value ?? '') : cadence);
    }
    // Only posted when the section is on screen. The server treats an ABSENT
    // key as "leave it alone" and an EMPTY one as "back to the type's default",
    // so posting a box nobody was shown would silently clear a real choice.
    if (showCelebrantShape) fd.set('celebrant_shape', celebrantShape);
    if (showBaziBirthData) {
      fd.set('bazi_birthdata_consent', baziConsent ? '1' : '0');
      fd.set('partner_a_birth_date', partnerABirthDate);
      fd.set('partner_a_birth_time', partnerABirthTime);
      fd.set('partner_b_birth_date', partnerBBirthDate);
      fd.set('partner_b_birth_time', partnerBBirthTime);
    }
    startTransition(async () => {
      const res = await save.run(() => updateEventMatchCriteria(fd), {
        steps: ['Saving your details'],
        hint: 'Saving',
      });
      if (res.ok) {
        setSaved(true);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 block text-xs font-medium text-ink/70">Bride</legend>
          <div className="grid grid-cols-2 gap-2">
            <input
              id="bride_first"
              type="text"
              maxLength={80}
              value={brideFirst}
              onChange={(ev) => {
                setBrideFirst(sanitizeName(ev.target.value));
                setSaved(false);
              }}
              placeholder="First name"
              autoCapitalize="words"
              aria-label="Bride first name"
              className={selectClass}
            />
            <input
              id="bride_last"
              type="text"
              maxLength={80}
              value={brideLast}
              onChange={(ev) => {
                setBrideLast(sanitizeName(ev.target.value));
                setSaved(false);
              }}
              placeholder="Last name"
              autoCapitalize="words"
              aria-label="Bride last name"
              className={selectClass}
            />
          </div>
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 block text-xs font-medium text-ink/70">Groom</legend>
          <div className="grid grid-cols-2 gap-2">
            <input
              id="groom_first"
              type="text"
              maxLength={80}
              value={groomFirst}
              onChange={(ev) => {
                setGroomFirst(sanitizeName(ev.target.value));
                setSaved(false);
              }}
              placeholder="First name"
              autoCapitalize="words"
              aria-label="Groom first name"
              className={selectClass}
            />
            <input
              id="groom_last"
              type="text"
              maxLength={80}
              value={groomLast}
              onChange={(ev) => {
                setGroomLast(sanitizeName(ev.target.value));
                setSaved(false);
              }}
              placeholder="Last name"
              autoCapitalize="words"
              aria-label="Groom last name"
              className={selectClass}
            />
          </div>
        </fieldset>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="region" className="block text-xs font-medium text-ink/70">
          Region
        </label>
        <select
          id="region"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setSaved(false);
          }}
          className={selectClass}
        >
          <option value="">Not set</option>
          {REGION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink/50">Where your wedding is — helps us match vendors near you.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="feel" className="block text-xs font-medium text-ink/70">
          Style &amp; feel
        </label>
        <select
          id="feel"
          value={feel}
          onChange={(e) => {
            setFeel(e.target.value);
            setSaved(false);
          }}
          className={selectClass}
        >
          <option value="">Not set</option>
          {FEEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink/50">The overall look you&apos;re going for.</p>
      </div>

      {mayEditBudget ? (
        <div className="space-y-1.5">
          <label htmlFor="budget" className="block text-xs font-medium text-ink/70">
            Budget (₱)
          </label>
          <input
            id="budget"
            type="text"
            inputMode="numeric"
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value.replace(/[^0-9, ]/g, ''));
              setSaved(false);
            }}
            placeholder="e.g. 800,000"
            className={selectClass}
          />
          <p className="text-[11px] text-ink/50">A working figure — refine it anytime. Leave blank if undecided.</p>
        </div>
      ) : null}

      {/* ── DOES IT COME BACK? ───────────────────────────────────────────────
          The control the product has been PROMISING and never had: the
          onboarding wizard says "You can change this later." under the yearly
          question, and until now nothing anywhere could change it — `recurs`
          had no UPDATE path at all, so a one-tap answer at creation was
          permanent.

          Three states, decided by the type, never by taste:
            · no options       → this happens once (a wedding produces an
                                 anniversary; it does not repeat). Nothing renders.
            · forced           → a birthday and an anniversary ARE the return of
                                 one date. A sentence, not a picker — there is
                                 nothing to decide.
            · a choice         → the cadences this type may honestly use. */}
      {/* WHO IS BEING CELEBRATED — owner 2026-08-27: *"the one celebratiing is
          the celebrant that can be single, couple, or multiple people."*

          🔑 THE HOSTS ARE DELIBERATELY NOT ASKED ABOUT HERE. However many
          people run this celebration is already known — it is who holds a
          host's key to it — so asking again would be a second copy of a fact
          that can only disagree with the first. This asks the one thing
          nothing we already store can answer. */}
      {showCelebrantShape ? (
        <div className="space-y-1.5">
          <label htmlFor="celebrant_shape" className="block text-xs font-medium text-ink/70">
            Who is this for?
          </label>
          <select
            id="celebrant_shape"
            value={celebrantShape}
            onChange={(e) => {
              setCelebrantShape(e.target.value);
              setSaved(false);
            }}
            className={selectClass}
          >
            <option value="">
              {celebrantTypeDefaultLabel
                ? `However this usually goes \u2014 ${celebrantTypeDefaultLabel}`
                : 'However this usually goes'}
            </option>
            <option value="single">One person</option>
            <option value="couple">A couple</option>
            <option value="multiple">Several people</option>
          </select>
          <p className="text-[11px] text-ink/50">
            Changes how your guests are spoken to.
          </p>
        </div>
      ) : null}

      {repeatOptions.length > 0 ? (
        <div className="space-y-1.5">
          <label htmlFor="recur_cadence" className="block text-xs font-medium text-ink/70">
            Does it come back?
          </label>
          {repeatForced ? (
            <p className="sn-row px-3 py-2.5 text-sm text-ink/70">
              This one returns every year — that is what it is.
            </p>
          ) : (
            <>
              <select
                id="recur_cadence"
                value={cadence}
                onChange={(e) => {
                  setCadence(e.target.value);
                  setSaved(false);
                }}
                className={selectClass}
              >
                <option value="">Just this once</option>
                {repeatOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ink/50">
                We bring it back on your year, quietly — we never create it for you.
              </p>
            </>
          )}
        </div>
      ) : null}

      {/* PR-G — BaZi birth-data opt-in. Renders ONLY when the flag is on AND the
          event is a Chinese wedding (gate computed server-side). Consent is the
          third gate: birth fields are written only when the box is ticked. The
          app never computes a clash/compatibility verdict — these details are
          for a real date specialist. */}
      {showBaziBirthData ? (
        <fieldset className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/[0.03] p-4">
          <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Birth details for your date reading (optional)
          </legend>
          <p className="text-xs leading-relaxed text-ink/65">
            Many Tsinoy families settle the wedding day with a Four Pillars (BaZi)
            reading, which weighs each partner&apos;s birth date and time of birth.
            It&apos;s a blessing a Chinese-almanac or feng-shui specialist gives —
            we never calculate compatibility or a date &ldquo;score&rdquo; for you.
            Sharing these here is <strong>optional</strong>; we keep them only so
            you can hand them to a specialist. You can clear them anytime.
          </p>

          <label className="flex items-start gap-2.5 rounded-xl border border-ink/10 bg-paper px-3 py-2.5">
            <input
              type="checkbox"
              checked={baziConsent}
              onChange={(e) => {
                setBaziConsent(e.target.checked);
                setSaved(false);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-mulberry focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            />
            <span className="text-xs leading-relaxed text-ink/75">
              I consent to Setnayan storing our birth dates and times of birth for
              this purpose. (RA 10173 — sensitive personal data, kept only for the
              date reading and never shown on any public page.)
            </span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-ink/70">Partner A</span>
              <input
                type="date"
                value={partnerABirthDate}
                disabled={!baziConsent}
                onChange={(ev) => {
                  setPartnerABirthDate(ev.target.value);
                  setSaved(false);
                }}
                aria-label="Partner A birth date"
                className={`${selectClass} disabled:opacity-50`}
              />
              <input
                type="time"
                value={partnerABirthTime}
                disabled={!baziConsent}
                onChange={(ev) => {
                  setPartnerABirthTime(ev.target.value);
                  setSaved(false);
                }}
                aria-label="Partner A time of birth"
                className={`${selectClass} disabled:opacity-50`}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-ink/70">Partner B</span>
              <input
                type="date"
                value={partnerBBirthDate}
                disabled={!baziConsent}
                onChange={(ev) => {
                  setPartnerBBirthDate(ev.target.value);
                  setSaved(false);
                }}
                aria-label="Partner B birth date"
                className={`${selectClass} disabled:opacity-50`}
              />
              <input
                type="time"
                value={partnerBBirthTime}
                disabled={!baziConsent}
                onChange={(ev) => {
                  setPartnerBBirthTime(ev.target.value);
                  setSaved(false);
                }}
                aria-label="Partner B time of birth"
                className={`${selectClass} disabled:opacity-50`}
              />
            </div>
          </div>
          <p className="text-[11px] text-ink/50">
            Tick the box above to fill these in. Date and time of birth are both
            useful — share whatever you know.
          </p>
        </fieldset>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-xl bg-mulberry px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save basics'}
        </button>
        {saved && !pending ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
