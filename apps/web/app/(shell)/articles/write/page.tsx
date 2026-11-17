/**
 * /articles/write — Write a post (drawing v15). Signed out → sign in, then back here. A read failure about the
 * writer says so instead of guessing whether to ask for a posting name.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { X } from 'lucide-react';
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Write a post</h1>
        <Link href="/articles" aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/[0.06]">
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </Link>
      </div>
      {writer.readFailed ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          We couldn’t check your posting name just now. Please try again in a moment.
        </p>
      ) : (
        <div className="mt-4">
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
