/**
 * /articles/write — Write a post (drawing v15). Signed out → sign in, then back here. A read failure about the
 * writer says so instead of guessing whether to ask for a posting name.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { writerState } from '@/lib/articles.server';
import { WriteSheet } from '../_components/write-sheet';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Write a post',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ error?: string }> };

export default async function WritePage({ searchParams }: Props) {
  const writer = await writerState();
  if (!writer.signedIn) redirect('/login?next=/articles/write');
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
      {writer.readFailed ? (
        <p role="alert" className="text-sm font-medium text-danger-700">
          We couldn’t check your posting name just now. Please try again in a moment.
        </p>
      ) : (
        <div>
          <WriteSheet
            shopName={writer.shopName}
            postingName={writer.postingName}
            error={typeof error === 'string' ? error.slice(0, 200) : null}
          />
        </div>
      )}
    </main>
  );
}
