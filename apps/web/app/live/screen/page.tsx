import { redirect } from 'next/navigation';
import { loadLiveScreen } from '../_lib/load-screen';
import { forgetLiveScreen } from '../actions';
import { ScreenStage } from './screen-stage';

/**
 * The picture a paired venue screen shows (DAY-12). The controller chooses the
 * mode; `ScreenStage` re-asks every few seconds, so a tap in the controller
 * reaches the TV without anyone touching it.
 */

export const metadata = { title: 'Live screen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LiveScreenPage() {
  const loaded = await loadLiveScreen();
  if (loaded.state === 'unpaired') redirect('/live');

  if (loaded.state === 'revoked') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#17160F] px-6 text-center text-[#F5EFE6]">
        <h1 className="text-4xl font-semibold tracking-tight">This screen was disconnected</h1>
        <p className="mt-4 max-w-xl text-lg text-[#F5EFE6]/70">
          It was removed from the Live Studio controller, or given a new code. Ask for the new code to connect it
          again.
        </p>
        <form action={forgetLiveScreen} className="mt-8">
          <button
            type="submit"
            className="h-14 rounded-2xl bg-[#E5794E] px-8 text-xl font-semibold text-[#17160F] focus:outline-none focus:ring-4 focus:ring-[#E5794E]/40"
          >
            Enter a new code
          </button>
        </form>
      </main>
    );
  }

  return <ScreenStage loaded={loaded} />;
}
