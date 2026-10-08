'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import type { HubFontKey } from '@/lib/hub-fonts';
import type { InviteThemeId } from '@/lib/invite-themes';
import { MAIN_COLOUR_SLOTS as MOOD_COLOUR_NAMES } from '@/lib/colour-access';
import { contrastRatio } from '@/lib/hub-legibility';
import { SITE_ROLES, withSiteRole, type SiteRole, type SiteRoles } from '@/lib/site-roles';
import {
  SITE_ROLE_AA,
  SITE_ROLE_LABEL,
  fontPairingOf,
  fontPairingWrite,
  fontPairings,
  siteRoleContrast,
  siteRoleFaceStack,
  type ElementsWears,
} from '@/lib/site-role-look';
import { STUDIO_ROW_PICK } from '@/lib/studio-skin';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { BgRow } from '../../website/editor/_components/background-cards';
import { FontPick } from '../../website/editor/_components/font-pick';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { StudioColourField } from './studio-colour-field';
import { useMaker } from './maker-context';

/**
 * 🔤 STUDIO › LOOK › ELEMENTS — BY ROLE, NOT BY PROPERTY (owner 2026-10-08, the
 * Look restudy; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2 and § 6
 * row 3; prototype frames 09–12). Verbatim: *"colors here is not color of the
 * background but the colors of the different fonts, and buttons and
 * highlights"* · *"fonts will be multiple fonts like, details, button font,
 * header font, etc."*
 *
 *   Pairing ▾   — the shipped theme pairings, applied as a set (no new data);
 *   Headings    — Font ▾ · Colour
 *   Details     — Font ▾ · Colour
 *   Buttons     — Font ▾ · then the shipped Buttons control (shape · fill · colour)
 *   Highlights  — Eyebrows font ▾ · Colour
 *
 * Each row's head shows the role in its own font and colour, its swatch, and a
 * quiet AA badge measured against the page colour — amber when it does not
 * read. One row is open at a time, in place.
 *
 * 🔑 EVERY PICK GOES TO THE DRAFT, THROUGH THE ONE DRAFT DOOR (`hubDraftAction`
 * intent=save) — counted on ✓, named on the Apply sheet ("Look · Elements"),
 * seen by guests at Apply. No Save button.
 *
 * 🔑 NOTHING IS A SECOND CONTROL. The Headings font is the shipped typeface
 * control (`events.site_font_key`) and the Buttons shape · fill · colour are
 * the shipped Buttons control — the same nodes Look always drew, placed in
 * their role. Only what had no home is new: `events.site_roles`.
 */

function draftEvents(eventId: string, events: Record<string, unknown>, draft: typeof hubDraftAction) {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ events }));
  return draft(eventId, fd);
}

const SAMPLE: Readonly<Record<SiteRole, string>> = { heading: 'Your names', body: 'The day, the place', button: 'RSVP', highlight: 'Read on' };

export function StudioElements({
  eventId,
  roles,
  headingFont,
  themeId,
  five,
  wears,
  names = null,
  draftAction = hubDraftAction,
}: {
  /** The draft door — `hubDraftAction` (the default); the dev Maker lab hands its own stand-in so no write leaves it. */
  draftAction?: typeof hubDraftAction;
  eventId: string;
  /** `events.site_roles`, drafted over live — sanitised. */
  roles: SiteRoles | null;
  /** `events.site_font_key`, drafted over live — the Headings font. */
  headingFont: HubFontKey | null;
  /** The theme the page wears — its pairing is "nothing overridden". */
  themeId: InviteThemeId;
  /** The Mood Board's five — the colour picker's first row. */
  five: readonly string[];
  wears: ElementsWears;
  /** The event's own names, for the Headings sample. */
  names?: string | null;
}) {
  const maker = useMaker();
  const look = maker?.lookPages?.look ?? null;
  const [now, setNow] = useState<SiteRoles | null>(roles);
  const [font, setFont] = useState<HubFontKey | null>(headingFont);
  useEffect(() => setNow(roles), [roles]);
  useEffect(() => setFont(headingFont), [headingFont]);
  const [open, setOpen] = useState<SiteRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  /** ONE draft save; the pick is drawn first, and put back if the save is refused. */
  const save = (events: Record<string, unknown>, next: { roles: SiteRoles | null; font?: HubFontKey | null }) => {
    const before = { now, font };
    setNow(next.roles);
    if ('font' in next) setFont(next.font ?? null);
    setError(null);
    start(async () => {
      let ok = false;
      try {
        ok = (await makerSave(() => draftEvents(eventId, events, draftAction), requestMakerRefresh)).ok;
      } catch {
        ok = false;
      }
      if (!ok) {
        setNow(before.now);
        setFont(before.font);
        setError('That did not save, so it is back as it was. Please try again.');
      }
    });
  };
  const setRole = (role: SiteRole, field: 'font' | 'color', value: string | null) => {
    const next = withSiteRole(now, role, field, value);
    save({ site_roles: next }, { roles: next });
  };

  /* What each role wears NOW: its own pick, else what the page gives it. */
  const colourOf: Record<SiteRole, string> = {
    heading: now?.heading?.color ?? wears.ink,
    body: now?.body?.color ?? wears.ink,
    button: wears.button.fg,
    highlight: now?.highlight?.color ?? wears.accent,
  };
  const fontOf: Record<SiteRole, HubFontKey | null> = {
    heading: font ?? wears.faces.heading,
    body: now?.body?.font ?? wears.faces.body,
    button: now?.button?.font ?? now?.body?.font ?? wears.faces.body,
    highlight: now?.highlight?.font ?? wears.faces.labels,
  };
  const reads = (role: SiteRole) =>
    role === 'button'
      ? (() => {
          const ratio = contrastRatio(wears.button.fg, wears.button.bg);
          return { ratio, passes: ratio >= SITE_ROLE_AA.button };
        })()
      : siteRoleContrast(role, colourOf[role], wears.paper);
  const nameOf = (hex: string, own: boolean) => {
    const slot = five.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
    return slot >= 0 ? (MOOD_COLOUR_NAMES[slot] ?? 'Your Mood Board') : own ? 'Your own' : 'The page’s own';
  };

  const pairings = fontPairings(themeId);
  const pairing = fontPairingOf(themeId, { heading: font, roles: now });

  const colourRow = (role: 'heading' | 'body' | 'highlight') => {
    const own = now?.[role]?.color ?? null;
    const r = reads(role);
    return (
      <>
        <BgRow label="Colour" data={`${role}-colour`}>
          <span className="min-w-0 flex-1 [&>button]:mb-0">
            <StudioColourField
              data={`role-${role}`}
              name={nameOf(colourOf[role], Boolean(own))}
              job={SITE_ROLE_LABEL[role]}
              value={colourOf[role]}
              palette={five}
              onPick={(hex) => setRole(role, 'color', hex.toLowerCase())}
              {...(own ? { reset: { label: 'Use the page’s own', onReset: () => setRole(role, 'color', null) } } : {})}
            />
          </span>
        </BgRow>
        {r.passes ? null : (
          <p role="status" data-role-hard-to-read={role} className="text-[12.5px] font-medium text-amber-800">
            Hard to read on your background — {r.ratio.toFixed(1)}:1. Pick a deeper colour.
          </p>
        )}
      </>
    );
  };
  const fontRow = (role: 'body' | 'button' | 'highlight', label: string) => (
    <BgRow label={label} data={`${role}-font`}>
      <FontPick
        eventId={eventId}
        label={`${SITE_ROLE_LABEL[role]} font`}
        dataAttr={`data-role-font-${role}`}
        value={now?.[role]?.font ?? null}
        lead="Event Hub font"
        className={STUDIO_ROW_PICK}
        onPick={(key) => setRole(role, 'font', key)}
      />
    </BgRow>
  );
  const bodyOf: Record<SiteRole, ReactNode> = {
    /* The Headings font IS the shipped typeface control (`site_font_key`) — placed here, never a second one. */
    heading: (
      <>
        {look?.font ?? null}
        {colourRow('heading')}
      </>
    ),
    body: (
      <>
        {fontRow('body', 'Font')}
        {colourRow('body')}
      </>
    ),
    /* …and the Buttons' shape · fill · colour are the shipped Buttons control (`site_button_style` · `site_button_color`). */
    button: (
      <>
        {fontRow('button', 'Font')}
        {look?.buttons ?? null}
      </>
    ),
    highlight: (
      <>
        {fontRow('highlight', 'Eyebrows')}
        {colourRow('highlight')}
      </>
    ),
  };

  return (
    <div data-studio-elements="" className="flex flex-col gap-2">
      <BgRow label="Pairing" data="pairing" info="Sets every role at once — fonts from the theme, colours from your Mood Board. Change any role after; a pairing never locks anything.">
        <PickMenu
          label="Pairing"
          dataAttr="data-role-pairing-pick"
          className={STUDIO_ROW_PICK}
          value={pairing}
          {...(pairing ? {} : { buttonText: 'Your own mix' })}
          options={pairings.map((p) => ({
            key: p.id,
            label: p.name,
            hint: p.faces,
            ...(p.heading ? { fontFamily: siteRoleFaceStack(p.heading) } : {}),
          }))}
          onPick={(k) => {
            const p = pairings.find((x) => x.id === k);
            if (!p || p.id === pairing) return;
            const w = fontPairingWrite(p);
            save({ site_font_key: w.site_font_key, site_roles: w.site_roles }, { roles: w.site_roles, font: w.site_font_key });
          }}
        />
      </BgRow>
      {SITE_ROLES.map((role) => {
        const on = open === role;
        const r = reads(role);
        const face = fontOf[role];
        return (
          <div key={role} data-role-row={role} data-role-open={on ? '' : undefined} className="flex flex-col gap-2 border-t border-ink/10 pt-1">
            <button
              type="button"
              aria-expanded={on}
              data-role-head={role}
              onClick={() => setOpen(on ? null : role)}
              className="sn-press flex min-h-11 w-full items-center gap-2 text-left"
            >
              <span className="w-[84px] shrink-0 text-[14px] text-ink">{SITE_ROLE_LABEL[role]}</span>
              <span
                data-role-sample={role}
                className="min-w-0 flex-1 truncate rounded-md px-2 py-[3px] text-[15px] leading-tight"
                style={{
                  ...(face ? { fontFamily: siteRoleFaceStack(face) } : {}),
                  /* Drawn on the page colour, so the sample is the pair the badge measures. */
                  color: role === 'button' ? wears.button.fg : colourOf[role],
                  backgroundColor: role === 'button' ? wears.button.bg : wears.paper,
                }}
              >
                {role === 'heading' ? names || SAMPLE.heading : SAMPLE[role]}
              </span>
              <span
                data-role-aa={r.passes ? 'pass' : 'fail'}
                title={`Contrast ${r.ratio.toFixed(1)}:1`}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${r.passes ? 'bg-success-50 text-success-800' : 'bg-amber-100 text-amber-900'}`}
              >
                {r.passes ? 'AA' : 'AA ✗'}
              </span>
              <span aria-hidden className="h-[22px] w-[22px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundColor: role === 'button' ? wears.button.bg : colourOf[role] }} />
              <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-ink/45 transition-transform ${on ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            {on ? (
              <div data-role-body={role} className="flex flex-col gap-2 pb-2">
                {bodyOf[role]}
              </div>
            ) : null}
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
