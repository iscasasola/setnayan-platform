import { redirect } from 'next/navigation';
import { loadLiveScreen } from './_lib/load-screen';
import { pairLiveScreen } from './actions';

/**
 * setnayan.com/live — where a venue screen pairs (DAY-12).
 *
 * The word was chosen by the owner on 2026-08-17 and reserved ahead of this
 * route (lib/reserved-slugs.ts). A TV opens this page, types the 6-character
 * code the couple's Live Studio controller shows, and from then on shows
 * whatever that controller chooses.
 *
 * Built for a TV remote: one field, huge type, no account, no chrome.
 */

export const metadata = { title: 'Connect a screen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  code: 'That code didn’t work. Check it on the controller — codes are used once and last a day.',
  slow: 'Too many tries from this screen. Wait a few minutes, then try again.',
  down: 'We couldn’t reach Setnayan just now. Try again in a moment.',
  // Owner ruling 2026-09-20: screens come WITH the paid Live Studio unlock.
  locked: 'This event hasn’t unlocked Live Studio, so its screens aren’t active yet. Ask the couple to unlock it first.',
};

type Props = { searchParams: Promise<{ code?: string; error?: string }> };

export default async function LivePairPage({ searchParams }: Props) {
  // Already paired? Go straight to the picture — a TV that reloads this page
  // must not strand the room on a code prompt. `locked` goes there too: the
  // neutral "isn't active" card lives once, on the screen, and keeps polling
  // so the TV recovers on its own the moment the event unlocks.
  const loaded = await loadLiveScreen();
  if (loaded.state === 'ready' || loaded.state === 'locked') redirect('/live/screen');

  const { code, error } = await searchParams;
  const message = error ? ERRORS[error] ?? ERRORS.code : null;
  const prefill = typeof code === 'string' ? code.toUpperCase().slice(0, 12) : '';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#17160F] px-6 py-16 text-center text-[#F5EFE6]">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#E5794E]">Setnayan · Live Studio</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Connect this screen</h1>
      <p className="mt-4 max-w-xl text-lg text-[#F5EFE6]/75 sm:text-xl">
        Type the code shown under <strong className="text-[#F5EFE6]">Venue screens</strong> in the couple&rsquo;s Live
        Studio controller.
      </p>

      <form action={pairLiveScreen} className="mt-10 flex w-full max-w-md flex-col items-stretch gap-4">
        <label htmlFor="code" className="sr-only">
          Screen code
        </label>
        <input
          id="code"
          name="code"
          defaultValue={prefill}
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={12}
          placeholder="ABC123"
          className="h-20 rounded-2xl border-2 border-[#F5EFE6]/25 bg-black/30 text-center font-mono text-5xl uppercase tracking-[0.35em] text-[#F5EFE6] placeholder:text-[#F5EFE6]/20 focus:border-[#E5794E] focus:outline-none"
        />
        <button
          type="submit"
          className="h-16 rounded-2xl bg-[#E5794E] text-2xl font-semibold text-[#17160F] transition-opacity hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-[#E5794E]/40"
        >
          Connect
        </button>
      </form>

      {message ? (
        <p role="alert" className="mt-6 max-w-md text-lg text-[#F5A98A]">
          {message}
        </p>
      ) : null}

      {loaded.state === 'revoked' ? (
        <p className="mt-6 max-w-md text-base text-[#F5EFE6]/65">
          This screen was disconnected from the controller. Ask for a new code to connect it again.
        </p>
      ) : null}
    </main>
  );
}
