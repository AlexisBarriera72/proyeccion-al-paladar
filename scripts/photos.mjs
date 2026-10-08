// Turns the selected research photos into web-ready WebP files and writes src/photos.ts.
//   npm run photos
// Each slot names its research image (research/IMAGE_MANIFEST.json), a crop shape and a
// vertical focus. No file is ever wider than its crop of the original. Uses Playwright's
// Chromium, so there is nothing else to install. Permission to use every photo is
// unverified; the manifest records that, and `npm run launch-check` blocks a public launch.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'public/photos');
const manifestFile = path.join(root, 'src/photos.ts');
export const WIDTHS = [400, 800, 1200];

const CAPTION = {
  es: 'Evento anterior. Fuente: @proyeccionalpaladarpr. Permiso de uso por confirmar.',
  en: 'Earlier event. Source: @proyeccionalpaladarpr. Permission to use pending.',
};

/** The served photos. Room photos are historical; none shows the current Aguada venue. */
export const SLOTS = {
  room: {
    asset: 'A18',
    aspect: [3, 4],
    focus: 0.5,
    alt: {
      es: 'El salón durante un evento anterior: mesas con lámparas y popcorn frente a una pantalla.',
      en: 'The room during an earlier event: tables with lamps and popcorn facing a screen.',
    },
    caption: CAPTION,
    peopleVisible: true,
    filmVisible: true,
  },
  'table-food': {
    asset: 'A27',
    aspect: [4, 3],
    // The bottom of the frame: the food, without the projected film or the screen's brand.
    focus: 1,
    alt: {
      es: 'Una tabla con croissant, quesos y frutas sobre un mantel a cuadros.',
      en: 'A board with a croissant, cheese and fruit on a checked tablecloth.',
    },
    caption: CAPTION,
    peopleVisible: false,
    filmVisible: false,
  },
  food: {
    asset: 'A25',
    aspect: [4, 3],
    focus: 0.56,
    alt: {
      es: 'Bocados dorados servidos en un envase de metal durante una función.',
      en: 'Golden bites served in a metal tin during a screening.',
    },
    caption: CAPTION,
    peopleVisible: false,
    filmVisible: false,
  },
  logo: {
    asset: 'A01',
    aspect: [1, 1],
    focus: 0.5,
    alt: {es: '', en: ''}, // shown next to the business name
    caption: null,
    peopleVisible: false,
    filmVisible: false,
  },
};

/** The widths written for a crop `width` px wide: never wider than the crop itself. */
export function widthsFor(width) {
  const widths = WIDTHS.filter(step => step < width);
  if (width <= 1600) widths.push(width);
  return widths;
}

const photoUrl = (slot, width) => `/photos/${slot}-${width}.webp`;

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'research/IMAGE_MANIFEST.json'), 'utf8'));
  const assets = new Map((manifest.assets ?? manifest).map(asset => [asset.id, asset]));
  const {chromium} = await import('@playwright/test');
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
  const page = await browser.newPage();
  fs.mkdirSync(outDir, {recursive: true});
  const outputs = {};
  for (const [slot, spec] of Object.entries(SLOTS)) {
    const asset = assets.get(spec.asset);
    if (!asset) throw new Error(`${spec.asset} is not in research/IMAGE_MANIFEST.json`);
    const file = path.join(root, 'research', asset.file);
    const data = fs.readFileSync(file).toString('base64');
    const images = await page.evaluate(
      async ({src, aspect, focus, steps}) => {
        const widths = crop => {
          const out = steps.filter(step => step < crop);
          if (crop <= 1600) out.push(crop);
          return out;
        };
        const image = new Image();
        image.src = src;
        await image.decode();
        let sw = image.naturalWidth;
        let sh = Math.round(sw / aspect);
        if (sh > image.naturalHeight) {
          sh = image.naturalHeight;
          sw = Math.round(sh * aspect);
        }
        const sx = Math.round((image.naturalWidth - sw) / 2);
        const sy = Math.round((image.naturalHeight - sh) * focus);
        return widths(sw).map(width => {
          const height = Math.round(width / aspect);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
          return {width, height, data: canvas.toDataURL('image/webp', 0.82).split(',')[1]};
        });
      },
      {
        src: `data:image/jpeg;base64,${data}`,
        aspect: spec.aspect[0] / spec.aspect[1],
        focus: spec.focus,
        steps: WIDTHS,
      },
    );
    for (const image of images) {
      fs.writeFileSync(path.join(outDir, `${slot}-${image.width}.webp`), Buffer.from(image.data, 'base64'));
    }
    const large = images.at(-1);
    outputs[slot] = {width: large.width, height: large.height, asset};
    console.log(`${spec.asset} (${asset.width}×${asset.height}) → ${slot} (${large.width}×${large.height})`);
  }
  await browser.close();
  for (const file of fs.readdirSync(outDir)) {
    const [, slot, width] = file.match(/^(.+)-(\d+)\.webp$/) ?? [];
    if (!outputs[slot] || !widthsFor(outputs[slot].width).includes(Number(width))) fs.rmSync(path.join(outDir, file));
  }
  const entries = Object.entries(outputs).map(([slot, {width, height, asset}]) => {
    const spec = SLOTS[slot];
    const widths = widthsFor(width);
    return {
      slot,
      src: photoUrl(slot, widths.filter(w => w <= 800).at(-1) ?? widths[0]),
      srcset: widths.map(w => `${photoUrl(slot, w)} ${w}w`).join(', '),
      width,
      height,
      sourceId: spec.asset,
      sourceUrl: asset.source_url,
      alt: spec.alt,
      caption: spec.caption,
      peopleVisible: spec.peopleVisible,
      filmVisible: spec.filmVisible,
      reuse: 'not_verified',
    };
  });
  const source = `// Generated by \`npm run photos\` from research/images. Do not edit by hand.
// Permission to use every photo is unverified ('not_verified'); launch-check blocks a public launch.
export interface Photo {
  slot: string;
  src: string;
  srcset: string;
  width: number;
  height: number;
  sourceId: string;
  sourceUrl: string;
  alt: {es: string; en: string};
  caption: {es: string; en: string} | null;
  peopleVisible: boolean;
  filmVisible: boolean;
  reuse: 'not_verified' | 'approved';
}

export const photos: Record<string, Photo> = ${JSON.stringify(Object.fromEntries(entries.map(e => [e.slot, e])), null, 2)};
`;
  fs.writeFileSync(manifestFile, source);
  console.log(`Wrote src/photos.ts (${entries.length} photos).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
