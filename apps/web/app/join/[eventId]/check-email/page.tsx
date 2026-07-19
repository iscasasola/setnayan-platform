import { MailCheck } from 'lucide-react';

export const metadata = { title: 'Check your email' };

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: Props) {
  const email = (await searchParams).email ?? '';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-terracotta/10">
        <MailCheck className="h-7 w-7 text-terracotta" />
      </div>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-ink/70">
          We sent a sign-in link{email ? (
            <>
              {' '}to <span className="font-medium text-ink">{email}</span>
            </>
          ) : null}
          . Tap it to finish setting up your Setnayan account — your event will be waiting
          there, on any device.
        </p>
      </header>
      <p className="text-sm text-ink/55">
        You&rsquo;re already on the guest list — the link just lets you sign in later. You can
        close this tab.
      </p>
    </main>
  );
}
