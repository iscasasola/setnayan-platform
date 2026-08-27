/**
 * onboarding-spec.ts — the PURE resolver for per-type onboarding CONTENT.
 *
 * Merges an optional admin OVERRIDE row (from `event_type_onboarding`) over the
 * code DEFAULTS (PER_TYPE_QUESTIONS / PERSONA_PACKS / GENERIC_PERSONA_REVEAL /
 * GENERIC_EXP_AXES). NO I/O — so the merge is unit-testable without a DB and
 * carries no `react`/`supabase` imports. `lib/onboarding/onboarding-db.ts` wraps
 * this with the cached Supabase read.
 *
 * SAFETY: any field that is missing/NULL/malformed in the row falls back to its
 * default, so a DB hiccup or a bad admin edit degrades to the shipped flow rather
 * than a broken screen (same contract as event-types-db.ts / taxonomy-db.ts).
 */
import {
  PER_TYPE_QUESTIONS,
  type TypeQuestion,
  type TypeQuestionOption,
} from './type-questions';
import { PERSONA_PACKS, type TypePersonaPack } from './persona-packs';
import {
  GENERIC_EXP_AXES,
  GENERIC_PERSONA_REVEAL,
  type GenericPersonaReveal,
} from './generic-content';
import type { ExpAxis } from '@/app/onboarding/wedding/_data/experience-personas';
import {
  SOLEMN_EXP_AXES,
  SOLEMN_PERSONA_REVEAL,
  type OnboardingRegister,
} from './solemn-content';

export type OnboardingIntro = { eyebrow: string; headline: string; subcopy: string };

/** The fully-resolved onboarding content for one event type (defaults + overrides). */
export type OnboardingSpec = {
  eventType: string;
  /** The pack key the TS defaults are keyed by (= profile.onboardingFlowKey). */
  packKey: string;
  /** The register the copy below is authored in — the shell reads it for the
   *  handful of screens whose words are its own (the closing screen). */
  register: OnboardingRegister;
  /** Welcome-screen copy override, or null → the shell's generic welcome copy. */
  intro: OnboardingIntro | null;
  questions: TypeQuestion[];
  personaPack: TypePersonaPack | null;
  /** GENERIC_PERSONA_REVEAL with any per-persona copy overrides merged in. */
  revealByPersona: Record<string, GenericPersonaReveal>;
  /** GENERIC_EXP_AXES with any per-axis COPY overrides merged in (keys locked). */
  axes: ExpAxis[];
};

/** The raw override row (JSONB columns arrive as `unknown` — validated below). */
export type OnboardingOverrideRow = {
  intro: unknown;
  questions: unknown;
  persona_pack: unknown;
  reveal_overrides: unknown;
  axis_overrides: unknown;
};

// ---- shape guards (a malformed stored value falls back to the default) --------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isIntro(v: unknown): v is OnboardingIntro {
  if (!v || typeof v !== 'object') return false;
  const x = v as Record<string, unknown>;
  return isString(x.eyebrow) && isString(x.headline) && isString(x.subcopy);
}

function isOption(o: unknown): o is TypeQuestionOption {
  if (!o || typeof o !== 'object') return false;
  const x = o as Record<string, unknown>;
  return (
    isString(x.key) &&
    isString(x.title) &&
    isString(x.desc) &&
    Array.isArray(x.adds) &&
    x.adds.every(isString)
  );
}

function isQuestion(q: unknown): q is TypeQuestion {
  if (!q || typeof q !== 'object') return false;
  const x = q as Record<string, unknown>;
  return (
    isString(x.id) &&
    isString(x.eyebrow) &&
    isString(x.question) &&
    Array.isArray(x.options) &&
    x.options.every(isOption)
  );
}

function isQuestionArray(v: unknown): v is TypeQuestion[] {
  return Array.isArray(v) && v.every(isQuestion);
}

function isStringRecordOfStringArrays(v: unknown): v is Record<string, string[]> {
  if (!v || typeof v !== 'object') return false;
  return Object.values(v as Record<string, unknown>).every(
    (val) => Array.isArray(val) && val.every(isString),
  );
}

function isPersonaPack(v: unknown): v is TypePersonaPack {
  if (!v || typeof v !== 'object') return false;
  const x = v as Record<string, unknown>;
  return (
    Array.isArray(x.essentials) &&
    x.essentials.every(isString) &&
    isStringRecordOfStringArrays(x.byPersona) &&
    isStringRecordOfStringArrays(x.servicesByPersona)
  );
}

// ---- merge helpers -----------------------------------------------------------

/** The register's reveal copy with per-persona overrides (known personas only).
 *  `base` is GENERIC_PERSONA_REVEAL for a celebratory type and
 *  SOLEMN_PERSONA_REVEAL for a wake — see solemn-content.ts for why the solemn
 *  copy is a code base and not an admin row. */
function mergeReveal(
  ov: unknown,
  base: Record<string, GenericPersonaReveal>,
): Record<string, GenericPersonaReveal> {
  const out: Record<string, GenericPersonaReveal> = {};
  for (const [k, v] of Object.entries(base)) out[k] = { ...v };
  if (ov && typeof ov === 'object') {
    for (const [k, v] of Object.entries(ov as Record<string, unknown>)) {
      const base = out[k];
      if (!base || !v || typeof v !== 'object') continue; // only override known personas
      const x = v as Record<string, unknown>;
      out[k] = {
        name: isString(x.name) ? x.name : base.name,
        tagline: isString(x.tagline) ? x.tagline : base.tagline,
        feel: isString(x.feel) ? x.feel : base.feel,
      };
    }
  }
  return out;
}

/** The register's axes with per-axis COPY overrides. Axis + option KEYS are
 *  locked (resolvePersona depends on them) — only eyebrow/question/title/desc
 *  change. `base` is GENERIC_EXP_AXES or SOLEMN_EXP_AXES. */
function applyAxisOverrides(ov: unknown, base: ExpAxis[]): ExpAxis[] {
  const o = ov && typeof ov === 'object' ? (ov as Record<string, unknown>) : null;
  return base.map((axis) => {
    const a = o?.[axis.id];
    const ax = a && typeof a === 'object' ? (a as Record<string, unknown>) : null;
    const optOv =
      ax?.options && typeof ax.options === 'object'
        ? (ax.options as Record<string, unknown>)
        : null;
    return {
      id: axis.id,
      eyebrow: isString(ax?.eyebrow) ? (ax!.eyebrow as string) : axis.eyebrow,
      question: isString(ax?.question) ? (ax!.question as string) : axis.question,
      options: axis.options.map((opt) => {
        const oo = optOv?.[opt.key];
        const x = oo && typeof oo === 'object' ? (oo as Record<string, unknown>) : null;
        return {
          key: opt.key,
          title: isString(x?.title) ? (x!.title as string) : opt.title,
          desc: isString(x?.desc) ? (x!.desc as string) : opt.desc,
        };
      }),
    };
  });
}

/**
 * Resolve the onboarding content for a type from its code DEFAULTS + an optional
 * override row. PURE — no I/O. The TS defaults are keyed by `packKey`
 * (= profile.onboardingFlowKey, which equals the event type for every seeded
 * non-wedding profile); the override row is keyed by the actual `eventType`.
 */
export function resolveOnboardingSpec(
  eventType: string,
  packKey: string,
  row: OnboardingOverrideRow | null,
  /**
   * The type's `terminology.register`. 'solemn' swaps the BASE quiz + reveal copy
   * for the wake wording before any admin override is layered on.
   *
   * 🔑 It defaults to 'celebratory' so every existing caller and every existing
   * type is byte-identical — and so that a caller which forgets to pass it fails
   * toward the sixteen types where the celebratory words are correct, never the
   * other way round. The ONE caller that must pass it is the generic onboarding
   * page, which already holds the resolved profile; `solemn-onboarding.test.ts`
   * pins that it does.
   */
  register: OnboardingRegister = 'celebratory',
): OnboardingSpec {
  const defaultQuestions = [...(PER_TYPE_QUESTIONS[packKey] ?? [])];
  const defaultPack = PERSONA_PACKS[packKey] ?? null;
  const solemn = register === 'solemn';

  return {
    eventType,
    packKey,
    register,
    intro: isIntro(row?.intro) ? row!.intro : null,
    questions: isQuestionArray(row?.questions) ? row!.questions : defaultQuestions,
    personaPack: isPersonaPack(row?.persona_pack) ? row!.persona_pack : defaultPack,
    revealByPersona: mergeReveal(
      row?.reveal_overrides,
      solemn ? SOLEMN_PERSONA_REVEAL : GENERIC_PERSONA_REVEAL,
    ),
    axes: applyAxisOverrides(row?.axis_overrides, solemn ? SOLEMN_EXP_AXES : GENERIC_EXP_AXES),
  };
}
