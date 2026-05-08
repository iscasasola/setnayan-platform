"use client";

import { useState, useTransition } from "react";
import type { Event, Guest } from "@/lib/db/types";
import { confirmPlusOneIdentityAction, exitNotMeAction } from "../actions";

interface Props {
  event: Event;
  guest: Guest;
  host: Guest;
}

/**
 * +1 onboarding screen — shown the first time a TBA +1 scans their QR. The
 * +1 confirms their name; the server writes it back to `guests` and routes
 * them to the standard personal invitation site on next render.
 */
export function PlusOneOnboarding({ event, guest, host }: Props) {
  void event;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [exitPending, startExit] = useTransition();

  const canSubmit =
    firstName.trim().length > 0 && lastName.trim().length > 0 && !pending;

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await confirmPlusOneIdentityAction({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      if (!r.ok) setError(r.error);
      // On success the action redirects, so we never get back here.
    });
  }

  function notMe() {
    startExit(async () => {
      await exitNotMeAction();
    });
  }

  const hostFullName = `${host.first_name}${host.last_name ? ` ${host.last_name}` : ""}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg p-5 lg:p-8">
      <div className="w-full max-w-[480px] rounded-3xl border border-rule bg-surface p-7 shadow-tayo-md lg:p-10">
        <p className="meta-label mb-3" style={{ color: "var(--accent)" }}>
          You're invited!
        </p>
        <h1 className="font-serif text-[34px] italic font-medium leading-tight text-ink lg:text-[40px]">
          You are the +1 of {hostFullName}
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
          {host.first_name} didn't have your details yet when she sent in her RSVP, so let's get
          you set up. This takes 10 seconds.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <Field label="First name" required>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              autoFocus
              className="onb-input"
            />
          </Field>
          <Field label="Last name" required>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              className="onb-input"
            />
          </Field>

          <p className="lg:col-span-2 text-[12px] italic text-ink-soft">
            This name will appear on your invitation, in the couple's guest list, and on photos
            you're tagged in.
          </p>

          {error && (
            <p
              role="alert"
              className="lg:col-span-2 rounded-md bg-rsvp-declined-soft px-3 py-2 text-[13px] text-rsvp-declined-ink"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="lg:col-span-2 w-full rounded-full px-5 text-[14px] font-semibold tracking-label-tight text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--accent)",
              minHeight: 56,
            }}
          >
            {pending ? "Saving…" : "Correct — that's me"}
          </button>
        </form>

        <button
          type="button"
          onClick={notMe}
          disabled={exitPending}
          className="mt-5 block w-full text-center text-[13px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-60"
        >
          {exitPending ? "Signing out…" : "This isn't me — I scanned the wrong code"}
        </button>

        <style jsx>{`
          :global(.onb-input) {
            width: 100%;
            height: 46px;
            padding: 12px 14px;
            border: 1px solid var(--rule-strong);
            border-radius: 10px;
            background: var(--surface);
            font-size: 14px;
            color: var(--ink);
            outline: none;
            transition: border-color 0.15s;
            font-family: inherit;
            box-sizing: border-box;
          }
          :global(.onb-input:focus) {
            border-color: var(--accent);
          }
        `}</style>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="meta-label flex items-center gap-1">
        {label}
        {required && <span className="text-accent font-semibold">*</span>}
      </label>
      {children}
    </div>
  );
}
