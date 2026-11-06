import { ATTIRE_ROWS, attireRow, wearSaid } from '@/lib/attire-rows';
import { RoleAttireField } from './role-attire-field';
import { GroupAttireField } from './group-attire-field';
import { ROLE_GROUPS_IN_ORDER } from '@/lib/role-group-dress-code';
import { roleGroupLabel, roleGroupOf, type RoleGroup } from '@/lib/role-groups';
import type { RoleNames } from '@/lib/role-names';
import type { GuestRole } from '@/lib/guests';
import { ListField } from './list-field';
import { InfoTip } from '@/app/_components/info-tip';
import type { DressCodeConfig } from '../dress-code-actions';
/* The plain readers live in `dress-code-config.ts` (no client import) — re-exported for every existing caller. */
export { foldEventRoles, normalizeDressCodeConfig } from './dress-code-config';

/**
 * The dress-code form BODY, shared by its own editor page and the unified
 * editor's inline panel (Unified Website Editor · PR-8).
 *
 * ⚠ Why shared rather than re-typed: `updateDressCode` reads **every** field on
 * each save (title, description, palette, dos, donts) — a partial form would
 * silently WIPE the lists and palette it didn't post. Extracting the fields once
 * and rendering them in both places makes that class of bug impossible, and
 * keeps the two surfaces from drifting apart.
 *
 * Caller supplies the surrounding `<form action=…>` and its submit button, so
 * each surface keeps its own chrome (full page vs. compact rail panel).
 */
export function DressCodeFields({
  config,
  eventNoun,
  eventRoles = [],
  compact = false,
  roleNames = {},
}: {
  config: DressCodeConfig;
  /** e.g. "wedding" — used in the palette hint copy. */
  eventNoun: string;
  /** Roles present on this event's guest list (owner 2026-09-20). */
  eventRoles?: { role: GuestRole; label: string; count: number }[];
  /** Rail-panel density: tighter spacing + smaller labels. */
  compact?: boolean;
  /** The couple's own words for roles (owner 2026-09-30) — group rows say them. */
  roleNames?: RoleNames;
}) {
  const gap = compact ? 'space-y-4' : 'space-y-6';
  const label = compact
    ? 'block text-[0.7rem] font-semibold text-ink/60'
    : 'sn-eye block';
  const input = compact
    ? 'block w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline-none'
    : 'block w-full min-h-[44pt] rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';
  const hint = compact ? 'text-[0.7rem] text-ink/45' : 'text-xs text-ink/55';

  /*
     THE GROUPS ARE DERIVED FROM `eventRoles`, NEVER PASSED IN.
     A new prop is a new thing every call site has to remember, and the one that
     forgets renders an empty panel that looks exactly like an event with no
     sponsors. `roleGroupOf` is pure, so the client can fold the same list the
     server already resolved — and the two tiers can never disagree about which
     groups this event has, because there is only one list.

     Ordered by `ROLE_GROUPS_IN_ORDER` (the exhaustive Record's key order) rather
     than by headcount, so the groups read down the page the way a programme
     does and do not reshuffle when one more ninong is added.
  */
  const groupTally = new Map<RoleGroup, { roleCount: number; people: number }>();
  for (const { role, count } of eventRoles) {
    const g = roleGroupOf(role);
    if (g === 'guest') continue;
    const cur = groupTally.get(g) ?? { roleCount: 0, people: 0 };
    cur.roleCount += 1;
    cur.people += count;
    groupTally.set(g, cur);
  }
  const eventGroups = ROLE_GROUPS_IN_ORDER.filter((g) => groupTally.has(g)).map((group) => ({
    group,
    label: roleGroupLabel(group, roleNames),
    roleCount: groupTally.get(group)!.roleCount,
    people: groupTally.get(group)!.people,
  }));

  /* 👗 THE WEAR IS THE STUDIO'S (2026-10-17, "ONE FACT"). Studio › Mood Board & Dress Code picks each row's Wear, per
     person, from that person's own designs; this form shows it as the Studio says it and keeps only the call time and
     the note. Its old Wear ▾ listed one global list for a whole group (a "Formal" for parents, a "Long gown" for a
     father) — a second way to write the same fact that the Studio and the guest page then read as "Not said yet". */
  /* A plain map (`tier:key` → words), never a function: the fields are client components (2026-10-17). */
  const wearOf: Record<string, string> = Object.fromEntries(
    ATTIRE_ROWS.map((row) => [`${row.tier}:${row.key}`, wearSaid(config as unknown as Record<string, unknown>, row)]),
  );
  /* Only the people the Studio dresses by their OWN row (the celebrant, the bride, the groom) are listed by role. */
  const ownRowRoles = eventRoles.filter((r) => attireRow('roles', r.role) !== null);

  return (
    <div className={gap}>
      <div className="space-y-1.5">
        <label htmlFor="dress-code-title" className={label}>
          Headline
        </label>
        <input
          id="dress-code-title"
          type="text"
          name="title"
          defaultValue={config.title}
          maxLength={80}
          placeholder="e.g. Look magical · Dress in Filipiniana · Garden formal"
          className={input}
        />
        <p className={hint}>One short headline. Up to 80 characters.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dress-code-description" className={label}>
          Guidance
        </label>
        <textarea
          id="dress-code-description"
          name="description"
          defaultValue={config.description}
          maxLength={600}
          rows={compact ? 3 : 4}
          placeholder="A sentence or two on what you're picturing. Formal? Garden party? Filipiniana? Tell guests in your own voice."
          className={input}
        />
        <p className={hint}>Up to 600 characters.</p>
      </div>

      {/* 🎨 NO PALETTE HERE (2026-10-17). The colours are the Mood Board's five main colours — one palette (DECISION_LOG
          2026-10-06) — set in Studio › Mood Board & Dress Code; a second list typed here was added after them on the
          guest page (eleven against five). `updateDressCode` carries the stored list untouched. */}
      {/* 👗 THE OUTFIT FIGURE SWITCH (owner 2026-09-30: "they can opt not to
          add this"). The hidden 'off' always posts; the box adds 'on' after it
          when ticked, so `updateDressCode` reads the answer either way. A
          native checkbox, so it costs the Maker no script. */}
      <div className="flex items-center justify-between gap-3" data-dress-code-figure-switch="">
        <InfoTip label="Show the outfit figure" labelClassName={label} align="start">
          A small drawing of a person in each role&rsquo;s colours, above the colour chips. Turn it
          off to show the colours only.
        </InfoTip>
        <input type="hidden" name="show_figure" value="off" />
        {/* The label is the 44px tap target around the switch — the app's one look, as a real checkbox (`input.sn-switch`, globals.css). */}
        <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-end">
          <input
            type="checkbox"
            role="switch"
            name="show_figure"
            value="on"
            defaultChecked={config.show_figure}
            aria-label="Show the outfit figure"
            className="sn-switch"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className={label}>What each group wears</p>
        <p className="text-xs text-ink/55">
          What each group wears, and when they arrive, are set in Studio › Palette + Dress Code. Here: a note.
        </p>
        <GroupAttireField
          groups={eventGroups}
          saved={config.groups}
          roles={config.roles}
          roleNames={roleNames}
          compact={compact}
          wear={wearOf}
        />
        {/* 🛟 NOT SHOWN HERE ≠ ERASED. Where this form cannot list the groups
            (the Maker's panel is not handed the guest list; a helper without
            guest-list access sees none), the saved answers ride along
            unchanged — `updateDressCode` rebuilds `groups` from what is
            posted, so a Save that posted none wiped every group's outfit. */}
        {eventGroups.length === 0 ? <CarriedAttire prefix="group" saved={config.groups} /> : null}
      </div>

      <div className="space-y-2">
        <p className={label}>What each role wears</p>
        <p className="text-xs text-ink/55">
          Their outfit and call time are set in Studio › Palette + Dress Code. Here: a note.
        </p>
        <RoleAttireField roles={ownRowRoles} saved={config.roles} compact={compact} wear={wearOf} />
        {/* 🛟 Every other role's stored line rides along unchanged — the Studio dresses those people by their group's
            row (`resolveAttireFor`, 2026-10-17), and this form no longer lists them; a Save never wipes them. */}
        <CarriedAttire prefix="role" saved={Object.fromEntries(Object.entries(config.roles).filter(([k]) => !ownRowRoles.some((r) => r.role === k)))} />
      </div>

      {/* ✅ Each list sits under its own heading. The two role sections above
          were once nested inside the Do block, between "Do" and its rows. */}
      <div className="space-y-1.5" data-dress-code-list="dos">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-success-700">Do</p>
        <p className={hint}>What you&rsquo;d love guests to wear.</p>
        <ListField key={config.dos.join('\u0001')} name="dos" tone="do" initial={config.dos} />
      </div>

      <div className="space-y-1.5" data-dress-code-list="donts">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-danger-700">
          Don&rsquo;t
        </p>
        <p className={hint}>
          What you&rsquo;d rather they skip. Be kind — they&rsquo;ll read this.
        </p>
        <ListField key={config.donts.join('\u0001')} name="donts" tone="dont" initial={config.donts} />
      </div>
    </div>
  );
}

/**
 * The saved outfits this form is not showing, posted back exactly as stored —
 * the same parallel arrays the visible rows post (`<prefix>_key`, `_style`,
 * `_note`, zipped BY INDEX in `actions.ts`), so they pass through the one
 * validator on the way back in. ⏰ No `_call_time` (owner 2026-10-18): this form
 * posts no call time anywhere, and `updateDressCode` keeps every stored one.
 */
function CarriedAttire({
  prefix,
  saved,
}: {
  prefix: 'role' | 'group';
  saved: Partial<Record<string, { style: string; note?: string; callTime?: string }>>;
}) {
  return (
    <>
      {Object.entries(saved).map(([key, rule]) =>
        rule ? (
          <span key={key} hidden data-carried-attire={`${prefix}:${key}`}>
            <input type="hidden" name={`${prefix}_key`} value={key} />
            <input type="hidden" name={`${prefix}_style`} value={rule.style} />
            <input type="hidden" name={`${prefix}_note`} value={rule.note ?? ''} />
          </span>
        ) : null,
      )}
    </>
  );
}
