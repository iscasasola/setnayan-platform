/* THROWAWAY MEASUREMENT HARNESS — delete before pushing. Renders door 01's real
   component tree (JoinShell + the signed-out JoinFlow body) with each skin, with
   no database and no session, so the fold can be measured in a browser. */
import { SubmitButton } from '@/app/_components/submit-button';
import { JoinShell } from '@/app/join/[eventId]/_components/join-shell';
import { arrivalSteps } from '@/lib/invite-arrival';
import { inviteSkin } from '@/app/[slug]/invite/_components/themes/invite-skin';
import type { InviteThemeId } from '@/lib/invite-themes';

export const dynamic = 'force-dynamic';

export default async function MeasureDoor({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; name?: string; photo?: string; venue?: string }>;
}) {
  const sp = await searchParams;
  const theme = (sp.theme ?? 'house') as InviteThemeId;
  const name = sp.name ?? 'Cale & Ice';
  const photo = sp.photo === '0' ? null : '/std/backgrounds/golden-hour.webp';
  const skin =
    theme === 'house'
      ? undefined
      : inviteSkin(theme, { photo, accent: '#7A2E3B', monogram: 'C & I' });

  return (
    <JoinShell
      event={{
        display_name: name,
        event_date: '2026-12-18',
        event_date_precision: 'day',
        venue_name: sp.venue === '0' ? null : (sp.venue ?? 'Manila Cathedral'),
      }}
      steps={arrivalSteps('name')}
      skin={skin}
    >
      <p className="text-base text-ink/70">
        Tell us your name so the couple can find you on their guest list — no account
        needed.
      </p>
      <form className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Your full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Maria Santos"
            autoComplete="name"
            className="input-field"
          />
          <p className="text-sm text-ink/70">
            Use the name the couple would have on their list.
          </p>
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Finding you…">
          Continue
        </SubmitButton>
      </form>
    </JoinShell>
  );
}
