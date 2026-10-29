'use client';

/**
 * 📱 "NO ACCOUNT: FIRST SCAN ASKS A NAME" (owner 2026-10-29, controller call 3). The crew phone types its name and asks
 * to join; it is never allowed by this — it waits for the shop's Allow.
 *
 * 🔑 NOT A SERVER ACTION, ON PURPOSE (the route budget, `lint-server-action-budget.mjs`): a phone with no session gets an
 * ANONYMOUS one from Supabase Auth in the browser (behind its own switch, `crewPassAnonEnabled` — OFF until the owner
 * turns it on; then the page sends the phone to sign in instead and back here), and asks `crew_pass_request` on its own
 * session. That function is the whole boundary: SECURITY DEFINER, a live QR, a booked shop, a name, at most thirty
 * phones waiting, nobody let in.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { createClient } from '@/lib/supabase/client';
import { captchaOptions, isCaptchaRefusal } from '@/lib/turnstile';

export function CrewJoinForm({ token, anonymous }: { token: string; anonymous: boolean }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ask = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim().slice(0, 60);
    if (!name) return setProblem('Type your name so the shop knows who is asking.');
    setProblem(null);
    start(async () => {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        if (!anonymous) return router.push(`/login?next=${encodeURIComponent(`/join/crew/${token}`)}`);
        const { error } = await supabase.auth.signInAnonymously({
          options: captchaOptions(String(data.get('captcha_token') ?? '')),
        });
        if (error) return setProblem(isCaptchaRefusal(error) ? 'The quick check did not finish — tap Ask to join again.' : 'Something went wrong — try once more.');
      }
      const { error } = await supabase.rpc('crew_pass_request', { p_token: token, p_name: name });
      if (error) return setProblem('Something went wrong — try once more.');
      router.refresh();
    });
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        ask(e.currentTarget);
      }}
    >
      {problem ? (
        <p role="alert" className="text-[13.5px] font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
      <label className="block">
        <span className="block pb-1 text-[13px] text-ink/65">Your name</span>
        <input
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-[16px] text-ink dark:bg-raised"
          name="name"
          required
          maxLength={60}
          autoComplete="name"
          placeholder="Kuya Ben"
        />
      </label>
      {anonymous ? <TurnstileField action="crew_join" /> : null}
      <ActionButton tone="brand" main type="submit" icon={Send} label={pending ? 'Asking…' : 'Ask to join'} disabled={pending} />
    </form>
  );
}
