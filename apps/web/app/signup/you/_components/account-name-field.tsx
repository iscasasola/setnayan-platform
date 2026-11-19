'use client';

/**
 * AccountNameField — the @account name, with the truth about whether it is free
 * shown WHILE the person types, including the moment it does not know yet.
 *
 * The sibling of /open-shop's <AddressPreview>: a 450 ms pause, then ONE call to
 * the same availability answer the whole product uses. Three honest states on
 * screen — "Checking…", free, taken — and a fourth for a probe that could not
 * run, which reads as "could not check", never as "available". The server
 * re-checks on submit regardless; this only saves the round trip.
 *
 * Rendered ONLY for an account that has no @name yet (the page decides); an
 * account that has one keeps it, and renames live on the profile page behind
 * their cap and change log.
 */
import { useEffect, useState } from 'react';
import { TypedRow } from '@/app/_components/form-row';
import { checkAccountName, type AccountNameCheck } from '../actions';

export function AccountNameField({ suggested }: { suggested: string }) {
  const [value, setValue] = useState(suggested);
  const [touched, setTouched] = useState(false);
  const [check, setCheck] = useState<AccountNameCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!touched) setValue(suggested);
  }, [suggested, touched]);

  const effective = value.trim().toLowerCase();
  useEffect(() => {
    if (!effective) {
      setCheck(null);
      setChecking(false);
      return;
    }
    let live = true;
    setChecking(true);
    const t = setTimeout(() => {
      checkAccountName(effective)
        .then((r) => {
          if (live) setCheck(r);
        })
        .catch(() => {
          if (live) setCheck({ state: 'unknown', slug: effective });
        })
        .finally(() => {
          if (live) setChecking(false);
        });
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [effective]);

  const verdict = (() => {
    if (!effective) return { tone: 'hint', text: 'How people find and tag you. Optional — you can set it later.' };
    if (checking) return { tone: 'wait', text: 'Checking…' };
    if (!check) return { tone: 'hint', text: '' };
    switch (check.state) {
      case 'free':
        return { tone: 'ok', text: `setnayan.com/${check.slug} · available` };
      case 'taken':
        return { tone: 'no', text: check.message };
      case 'invalid':
        return { tone: 'no', text: 'Use 3–32 characters: lowercase letters, numbers, and hyphens only.' };
      case 'reserved':
        return { tone: 'no', text: 'That handle is reserved. Please pick another.' };
      case 'unknown':
        return { tone: 'wait', text: 'Could not check right now — we will check again when you press Done.' };
      default:
        return { tone: 'hint', text: '' };
    }
  })();

  /* ✍ THE FIELD TEMPLATE (`TypedRow`, owner 1 Nov 2026: every field follows it). It posts as `slug`, exactly as the raw
     box did; what is typed is cleaned to the handle's letters as it is kept, and checked as it is typed (`onType`). */
  const clean = (t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return (
    <TypedRow
      name="Account name"
      value={value}
      maxLength={32}
      autoCapitalize="off"
      empty="@your-handle"
      clean={clean}
      fieldName="slug"
      onType={(t) => {
        setTouched(true);
        setValue(clean(t));
      }}
      onKeep={(t) => {
        setTouched(true);
        setValue(t);
      }}
      data="you-slug"
      pillAttrs={{ 'data-you-slug': '' }}
      below={
        <span
          id="hr-you-slug-verdict"
          role={verdict.tone === 'no' ? 'alert' : 'status'}
          data-tone={verdict.tone}
          className="hr-si-hint"
          style={{
            display: 'block',
            paddingBottom: 10,
            color: verdict.tone === 'ok' ? 'rgb(var(--color-ok))' : verdict.tone === 'no' ? 'rgb(var(--color-danger))' : 'var(--hr-grey)',
          }}
        >
          {verdict.text}
        </span>
      }
    />
  );
}
