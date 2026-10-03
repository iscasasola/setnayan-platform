import 'server-only';

import type { ReactNode } from 'react';
import type { createAdminClient } from '@/lib/supabase/admin';
import { HUB_DRAFT_LOOK_COLUMNS, overlayHubDraftEvent, overlayHubDraftWidgets } from '@/lib/hub-draft';
import { sanitizeHubCanvas } from '@/lib/hub-canvas';
import { hubElementHidden } from '@/lib/element-style';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { resolveHubTheme } from '../../_lib/hub-look';
import { mainGroundLayerFor } from '../../_lib/main-ground-layer';
import {
  guestLookFrom,
  loadEventShell,
  loadGuestLook,
  loadWidgets,
  type EventShellRow,
  type GuestLook,
  type loadHostPreviewDraft,
} from '../../_lib/loaders';

/**
 * THE EVENT HUB'S LOOK AND MAIN BACKGROUND, for the guest's own pages under
 * `/invite` — the RSVP (`/invite/reply`) AND the personal landing / thank-you
 * (`/invite/enter`).
 *
 * 🔴 WHY THIS LEFT `reply/page.tsx` (owner's live iPhone test, 2026-10-02, on
 * cale-ice — Classic theme, a mood-board palette): the personal landing a
 * guest's link opens rendered WHITE with a terracotta edge and a sans body,
 * while the Event Hub behind it wore the couple's ivory and gold. The guest-tree
 * layout deliberately leaves the `invite` segment undressed
 * (`SEGMENTS_THAT_DRESS_THEMSELVES`), so a page under it wears the look only if
 * it asks — and only the RSVP asked. The landing called the DOOR's resolver
 * (`loadInviteLook`), which returns NO skin for Classic (`house`) and never
 * reads the palette at all, so Classic + a palette came out as the bare door.
 * Owner, DECISION_LOG 2026-09-30 "THE PERSONAL LINK OPENS THE GUEST'S OWN
 * LANDING PAGE": *"ONE page in the couple's theme (background, fonts, colours,
 * Logo, ticket style)"*. One function, both pages, so they cannot drift.
 *
 *   · the look — for a guest, `loadGuestLook(slug)`: the very value the
 *     guest-tree layout wears on every Event Hub page (`cache()`d — the layout
 *     already asked, so it costs nothing). On the Maker's canvas, when the
 *     couple's DRAFT holds a Colors-panel column, it is re-resolved from the
 *     drafted row exactly as the Event Hub canvas does (`guestLookFrom(…, true)`,
 *     app/[slug]/page.tsx), so a colour tried in the Maker shows before Apply.
 *   · the ground — `mainGroundLayerFor`, the helper the Event Hub body itself
 *     calls, over the (draft-overlaid) hero row. Pro themes only, by the one
 *     page-ground rule.
 *   · the hero row's config — handed back so the landing can say the couple's
 *     own invitation line (`heroLineWord`) without a second read.
 *
 * ⚖ BEST-EFFORT, LIKE THE LAYOUT'S LOOK. A background that cannot be read
 * renders the page in the house look — never takes the page down.
 */
export async function wearTheHub(
  slug: string,
  admin: ReturnType<typeof createAdminClient>,
  hostDraft: Awaited<ReturnType<typeof loadHostPreviewDraft>>,
  viewerIsHost: boolean,
): Promise<{ look: GuestLook | null; ground: ReactNode; heroConfig: unknown }> {
  try {
    const shell = await loadEventShell(slug);
    if (!shell?.event_id) return { look: null, ground: null, heroConfig: null };
    const row = overlayHubDraftEvent(shell as Record<string, unknown>, hostDraft) as EventShellRow;
    const draftsLook = Boolean(hostDraft && HUB_DRAFT_LOOK_COLUMNS.some((c) => c in hostDraft.events));
    const look = draftsLook
      ? guestLookFrom(row, await resolveHubTheme(row), true)
      : await loadGuestLook(slug);
    const widgets = overlayHubDraftWidgets(await loadWidgets(admin, shell.event_id), hostDraft);
    const heroConfig = heroConfigOf(widgets);
    if (!look?.theme) return { look, ground: null, heroConfig };
    const ground = await mainGroundLayerFor({
      theme: look.theme,
      heroConfig,
      event: row,
      viewerIsHost,
    });
    return { look, ground, heroConfig };
  } catch {
    return { look: null, ground: null, heroConfig: null };
  }
}

function heroConfigOf(widgets: readonly Pick<InvitationWidgetRow, 'widget_type' | 'config_json'>[]): unknown {
  return widgets.find((w) => w.widget_type === 'hero')?.config_json ?? null;
}

/**
 * ✍ THE COUPLE'S OWN INVITATION LINE — the words they typed over the hero card's
 * "invite you to celebrate their wedding" in the Maker (`elements.line.word`,
 * the SAME field `PahinaMasthead` prints), read through the one sanitiser
 * (`sanitizeHubCanvas` → `sanitizeHubElementWord`). Null when they typed none:
 * the landing then shows exactly what it showed before — no default sentence is
 * invented for it (the approved landing prototype draws the names alone).
 *
 * 🙈 IT FOLLOWS THE EVENT HUB (owner 2026-10-04, "YES TO ALL" (2): *"the
 * couple's line under the names follows the Event Hub everywhere — hidden there
 * = hidden on the invitation page too"*). When the couple hid the line on the
 * hero (Arrange → Show: Hidden), the landing shows no line either — asked
 * through `hubElementHidden`, the SAME predicate the Event Hub's hero draws
 * with, so the two pages cannot disagree. (Until 2026-10-04 the landing showed
 * the words whatever the hero did — #6301's flagged owner call, now answered.)
 */
export function heroLineWord(heroConfig: unknown): string | null {
  const line = sanitizeHubCanvas(heroConfig).elements?.line;
  if (hubElementHidden(line)) return null;
  const word = line?.word;
  return typeof word === 'string' && word.trim() ? word.trim() : null;
}
