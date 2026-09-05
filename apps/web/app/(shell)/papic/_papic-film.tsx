/**
 * The product film — a 12-second silent loop of the Papic camera.
 *
 * 🔑 THE PLAYER ITSELF LIVES IN `_components/marketing/_demo-film.tsx` NOW
 * (2026-09-05). It used to be written here, and again in `/pa3d`'s parts,
 * differing only in the slug and the width — so the autoplay lesson (a
 * refused `play()` must hand the viewer controls, never leave a dead still)
 * was written twice and would have needed fixing twice. That docblock moved
 * with the code; this file keeps Papic's own label and width.
 */

import { DemoFilm } from '@/app/_components/marketing/_demo-film';

export function PapicFilm() {
  return (
    <DemoFilm
      slug="papic"
      title="The Papic camera"
      size="hero"
      ariaLabel="The Papic camera, running"
    />
  );
}
