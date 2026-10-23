'use client';

/**
 * booth-template-pick.tsx — THE BOOTH'S TWO TEMPLATES ON HOME'S VIDEO BOOTH CARD (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 8: "Primary template ▾ · Backup template ▾ (one dropdown each,
 * the catalogue's names)"). A pick posts the booth's OWN action (`savePatiktokBoothTemplates`) — the same per-device pick
 * the booth page reads — and lands back on Home (`return_to=home`). Never a second store of the choice.
 */

import { useRef } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { savePatiktokBoothTemplates } from '../../studio/patiktok/actions';
import { HomeCardRow } from '../home-service-card';

export function BoothTemplatePick({
  eventId,
  primary,
  backup,
  templates,
}: {
  eventId: string;
  primary: string;
  backup: string;
  templates: ReadonlyArray<{ slug: string; name: string }>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const primaryIn = useRef<HTMLInputElement>(null);
  const backupIn = useRef<HTMLInputElement>(null);
  const pick = (which: 'primary' | 'backup', slug: string) => {
    const box = which === 'primary' ? primaryIn.current : backupIn.current;
    if (!box || !form.current || box.value === slug) return;
    box.value = slug;
    form.current.requestSubmit();
  };
  const options = (not: string) => templates.filter((t) => t.slug !== not).map((t) => ({ key: t.slug, label: t.name }));
  return (
    <form ref={form} action={savePatiktokBoothTemplates} className="contents" data-home-booth-templates="">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="return_to" value="home" />
      <input ref={primaryIn} type="hidden" name="primary" defaultValue={primary} />
      <input ref={backupIn} type="hidden" name="backup" defaultValue={backup} />
      <HomeCardRow
        label="Primary template"
        marker="booth-primary"
        control={<PickMenu label="Primary template" value={primary} options={options(backup)} onPick={(k) => pick('primary', k)} dataAttr="data-home-booth-primary" compact />}
      />
      <HomeCardRow
        label="Backup template"
        marker="booth-backup"
        control={<PickMenu label="Backup template" value={backup} options={options(primary)} onPick={(k) => pick('backup', k)} dataAttr="data-home-booth-backup" compact />}
      />
    </form>
  );
}
