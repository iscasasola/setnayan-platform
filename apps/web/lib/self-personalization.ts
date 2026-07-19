import 'server-only';
import { cache } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  isCivilStatus,
  isReligion,
  isSex,
  type CivilStatus,
  type Religion,
  type Sex,
} from '@/lib/profile-personalization';

/**
 * The four self-consented profile facts that onboarding can PREFILL from —
 * religion, civil status, birthdate, gender — read straight off `public.users`
 * for the *current* user. RLS (`user_owns_row`) already scopes this to the
 * caller, so no extra guard is needed.
 *
 * Why this exists: onboarding must "read what the profile already knows and
 * only ask what's missing" (owner, 2026-07-13). Today the wedding flow inlines
 * a one-column `users` select for `religion` (onboarding/wedding/page.tsx) and
 * nothing reuses it. This is the single shared reader so every onboarding
 * surface prefills the SAME way instead of duplicating selects.
 *
 * Scope: SELF facts only. Dependent-subject facts (a debutante's gender/
 * birthdate, a child's christening age) live in the flag-gated People layer
 * (`NEXT_PUBLIC_DEPENDENT_PEOPLE`, counsel-gated) and are deliberately NOT read
 * here. Values are all opt-in; anything unset / malformed normalizes to null.
 */
export type SelfPersonalization = {
  religion: Religion | null;
  civilStatus: CivilStatus | null;
  /** ISO `YYYY-MM-DD`, or null. Age is derived, never stored. */
  birthdate: string | null;
  gender: Sex | null;
};

export const EMPTY_SELF_PERSONALIZATION: SelfPersonalization = {
  religion: null,
  civilStatus: null,
  birthdate: null,
  gender: null,
};

/**
 * Read {religion, civilStatus, birthdate, gender} for the signed-in user.
 * Returns all-null for an anonymous/absent user or during the brief
 * `auth.users`→`public.users` signup race (`.maybeSingle()` yields null). Never
 * throws for a missing profile row. React-`cache`d per request.
 */
export const getSelfPersonalization = cache(
  async (): Promise<SelfPersonalization> => {
    const user = await getCurrentUser();
    if (!user) return EMPTY_SELF_PERSONALIZATION;

    const supabase = await createClient();
    const { data } = await supabase
      .from('users')
      .select('religion, civil_status, birth_date, sex')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) return EMPTY_SELF_PERSONALIZATION;

    return {
      religion: isReligion(data.religion) ? data.religion : null,
      civilStatus: isCivilStatus(data.civil_status) ? data.civil_status : null,
      birthdate:
        typeof data.birth_date === 'string' && data.birth_date
          ? data.birth_date
          : null,
      gender: isSex(data.sex) ? data.sex : null,
    };
  },
);
