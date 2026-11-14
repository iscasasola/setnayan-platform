/**
 * hub-views.tsx — the Templates, Media and Design kit hubs (approved drawing `catalogue.html`, screens `templates` ·
 * `media` · `design-kit`), as plain markup so the pages and `/dev/admin-catalogue-lab` draw the same thing.
 *
 * Each row rises to the SHIPPED page (T4); nothing is moved or edited here, and every old address still answers and
 * lights its hub's view (`lib/admin/admin-tabs.ts`). Rows the drawing marks NEW (Cards & themes · Fonts · Icons ·
 * Backgrounds · Palettes · Card motifs — no admin page exists yet) and GONE (Mood-board renders, retired 2026-10-26)
 * are not drawn: a row that opens nothing is a fake door.
 */
import { Clapperboard, Globe, HardDrive, Image as ImageIcon, Music, Palette, Play, Sparkles } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { CataloguePage, Rows, Sec, ViewRow } from './catalogue-rows';

export function TemplatesView() {
  return (
    <CataloguePage>
      <PageMasthead title="Templates" />
      <Sec label="Templates" tip="The things couples’ pages are built from. Each row opens its own page." />
      <Rows label="Templates">
        <ViewRow href="/admin/studio?tab=reveal-studio" icon={Sparkles} title="Reveal Studio" line="Templates and the videos they play" />
        <ViewRow href="/admin/studio?tab=patiktok" icon={Play} title="Patiktok renders" line="The latest renders and any that failed" />
        <ViewRow href="/admin/studio?tab=website" icon={Globe} title="Website editor" line="The front page and its widgets" />
        <ViewRow href="/admin/hub-music" icon={Music} title="Event Hub music" line="The tracks couples pick from" />
      </Rows>
    </CataloguePage>
  );
}

export function MediaView() {
  return (
    <CataloguePage>
      <PageMasthead title="Media" />
      <Sec label="Media" tip="The files and lists couples pick from. Each row opens its own page." />
      <Rows label="Media">
        <ViewRow href="/admin/studio?tab=songs" icon={Music} title="Songs" line="The master song catalogue" />
        <ViewRow href="/admin/studio?tab=moodboard-library" icon={ImageIcon} title="Mood-board library" line="Photos couples add to their boards" />
        <ViewRow href="/admin/background-videos" icon={Clapperboard} title="Front-door background videos" line="The videos behind the front door" />
        <ViewRow href="/admin/website-media" icon={HardDrive} title="Website media" line="Files couples’ websites use, and what can be freed" />
      </Rows>
    </CataloguePage>
  );
}

export function DesignKitView() {
  return (
    <CataloguePage>
      <PageMasthead title="Design kit" />
      <Sec label="Design kit" tip="The app’s look. Each row opens its own page." />
      <Rows label="Design kit">
        <ViewRow href="/admin/colours" icon={Palette} title="Colours" line="The colour for each job, and whether it reads" />
      </Rows>
    </CataloguePage>
  );
}
