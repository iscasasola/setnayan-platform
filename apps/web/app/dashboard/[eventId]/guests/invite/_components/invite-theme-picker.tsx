import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { pickableInviteThemes, type InviteThemeId } from '@/lib/invite-themes';
import { setInviteTheme } from '../actions';

/**
 * How your invite looks — the couple's theme picker (lib/invite-themes.ts).
 *
 * House is free and always available. The Pro themes come with Event Hub Pro
 * (COUPLE_WEBSITE_PRO); without it they are shown, named and disabled, with the
 * one place to get it — never hidden, so a couple knows what they would get.
 * Only shipped skins are listed (`pickableInviteThemes`).
 *
 * The pre-selection is `suggestedInviteTheme` — their saved choice, else the
 * theme their onboarding feel points at. Nothing changes for guests until they
 * press Save.
 */
export function InviteThemePicker({
  eventId,
  selected,
  ownsPro,
  saved,
}: {
  eventId: string;
  selected: InviteThemeId;
  ownsPro: boolean;
  saved: boolean;
}) {
  const themes = pickableInviteThemes();
  const action = setInviteTheme.bind(null, eventId);
  return (
    <section className="mt-6 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6" aria-labelledby="invite-theme-heading">
      <h2 id="invite-theme-heading" className="text-base font-semibold text-ink">
        How your invite looks
      </h2>
      <p className="mt-1 text-sm text-ink/70">
        What guests see when they open your link. It opens on your reveal background, in your
        colour.
      </p>
      {saved ? (
        <p role="status" className="mt-3 rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 text-sm text-ink/80">
          Saved — your invite link now opens in this look.
        </p>
      ) : null}
      <form action={action} className="mt-4 space-y-3">
        {themes.map((t) => {
          const locked = t.tier === 'pro' && !ownsPro;
          return (
            <label
              key={t.id}
              className={[
                'flex items-start gap-3 rounded-xl border px-4 py-3',
                locked
                  ? 'cursor-not-allowed border-ink/10 bg-ink/[0.02]'
                  : 'cursor-pointer border-ink/15 has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink',
              ].join(' ')}
            >
              <input
                type="radio"
                name="invite_theme"
                value={t.id}
                defaultChecked={t.id === selected}
                disabled={locked}
                className="mt-1 h-4 w-4 shrink-0 accent-ink"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{t.name}</span>
                  <span className="rounded-full border border-ink/15 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-ink/70">
                    {t.tier === 'pro' ? 'Event Hub Pro' : 'Free'}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-ink/70">{t.blurb}</span>
              </span>
            </label>
          );
        })}
        {ownsPro ? null : (
          <p className="text-sm text-ink/70">
            The Pro themes come with{' '}
            <Link className="font-medium text-link underline-offset-2 hover:underline" href={`/dashboard/${eventId}/studio/website-pro`}>
              Event Hub Pro
            </Link>
            , together with your cinematic reveal and your site colours.
          </p>
        )}
        <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>
    </section>
  );
}
