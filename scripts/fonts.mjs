// Copies the two self-hosted families into public/fonts, each with its OFL license, so the site
// makes no font requests to other sites:
// - Inter (variable weight, latin and latin-ext) from @fontsource-variable/inter, for text.
// - Fraunces from @fontsource-variable/fraunces, for titles: upright with the optical-size and
//   weight axes, and an italic with the weight axis only (the motto), latin and latin-ext.
import fs from 'node:fs';

const families = [
  {
    name: 'Inter',
    from: 'node_modules/@fontsource-variable/inter',
    to: 'public/fonts/inter',
    files: ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2'],
  },
  {
    name: 'Fraunces',
    from: 'node_modules/@fontsource-variable/fraunces',
    to: 'public/fonts/fraunces',
    files: [
      'fraunces-latin-opsz-normal.woff2',
      'fraunces-latin-ext-opsz-normal.woff2',
      'fraunces-latin-wght-italic.woff2',
      'fraunces-latin-ext-wght-italic.woff2',
    ],
  },
];

for (const {name, from, to, files} of families) {
  fs.mkdirSync(to, {recursive: true});
  for (const file of files) fs.copyFileSync(`${from}/files/${file}`, `${to}/${file}`);
  fs.copyFileSync(`${from}/LICENSE`, `${to}/LICENSE.txt`);
  console.log(`${name} copied to ${to}.`);
}
