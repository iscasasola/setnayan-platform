'use client';

/**
 * /dev/gown-shop-lab?view=scan — Scan a swatch book (step B13) opened on a SAMPLE page drawn here: a card of paper in
 * warm light, eight swatches in two rows, a slight tilt, one lace-like print and two glued edge to edge. A dev page
 * cannot pick a file for a screenshot, so the page is drawn instead. The owner's real phone photos are the real test.
 */
import { useEffect, useState } from 'react';
import { GownStockPanel } from '@/app/vendor-dashboard/shop/_components/gown-stock-panel';
import type { ComponentProps } from 'react';

type Seed = NonNullable<ComponentProps<typeof GownStockPanel>['scanSeed']>;
const SWATCHES: [number, number, number][] = [[240, 232, 214], [238, 205, 200], [196, 140, 142], [110, 28, 45], [160, 178, 150], [28, 38, 70], [226, 204, 170], [250, 250, 248]];

function drawSample(): Seed[number] {
  const W = 900, H = 640, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = 'rgb(120 86 58)';
  g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2);
  g.rotate((3 * Math.PI) / 180);
  g.translate(-W / 2, -H / 2);
  g.fillStyle = 'rgb(246 242 232)';
  g.fillRect(60, 40, W - 120, H - 80);
  const size = 150, gap = 36, x0 = (W - 4 * size - 3 * gap) / 2;
  SWATCHES.forEach((rgb, i) => {
    const x = x0 + (i % 4) * (size + gap) + (i === 5 ? -gap : 0), y = 90 + Math.floor(i / 4) * (size + 90);
    g.fillStyle = `rgb(${rgb.join(' ')})`;
    g.fillRect(x, y, size, size);
    g.save();
    g.beginPath();
    g.rect(x, y, size, size);
    g.clip();
    // the weave: fine crossing threads, a little lighter and darker than the cloth
    for (let t = 0; t < size; t += 3) {
      g.fillStyle = `rgb(${rgb.map((v) => Math.min(255, v + 14)).join(' ')} / 0.6)`;
      g.fillRect(x + t, y, 1, size);
      g.fillStyle = `rgb(${rgb.map((v) => Math.max(0, v - 14)).join(' ')} / 0.6)`;
      g.fillRect(x, y + t + 1, size, 1);
    }
    if (i === 7) { g.strokeStyle = 'rgb(190 184 172)'; g.lineWidth = 6; for (let r = 30; r < 260; r += 70) { g.beginPath(); g.arc(x + 20, y + 30, r, 0, 7); g.stroke(); } }
    g.restore();
    g.fillStyle = 'rgb(90 80 70)';
    g.font = '18px sans-serif';
    g.fillText(`IV-${String(i + 1).padStart(2, '0')}`, x, y + size + 26);
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  const shade = g.createLinearGradient(0, 0, W, H);
  shade.addColorStop(0, 'rgb(255 236 200 / 0)');
  shade.addColorStop(1, 'rgb(40 30 20 / 0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  const id = g.getImageData(0, 0, W, H);
  return { url: c.toDataURL('image/jpeg', 0.9), img: { data: id.data, width: W, height: H } };
}

export function ScanLab({ stock }: { stock: ComponentProps<typeof GownStockPanel>['seed'] }) {
  const [seed, setSeed] = useState<Seed | null>(null);
  useEffect(() => setSeed([drawSample()]), []);
  return seed ? <GownStockPanel view="fabrics" seed={stock} scanSeed={seed} /> : <div className="sn-frame skeleton h-48" aria-busy="true" />;
}
