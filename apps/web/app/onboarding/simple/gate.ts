import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCreatableEventTypes } from '@/lib/event-types-db';

/**
 * The two answers this form gives that are not the form — sign in, and "this type isn't live, back to the picker" —
 * decided by `./layout.tsx` BEFORE `./loading.tsx` streams, so both stay a 307 instead of a 200, a skeleton and a
 * client hop. `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateSimpleOnboarding = cache(async () => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/onboarding/simple');

  // If the type isn't live in the create-roster, send them back to the picker.
  const creatable = await getCreatableEventTypes();
  const typeRow = creatable.find((t) => t.key === 'simple_event');
  if (!typeRow) {
    redirect('/dashboard/create-event');
  }
  return { supabase, user, typeRow };
});
