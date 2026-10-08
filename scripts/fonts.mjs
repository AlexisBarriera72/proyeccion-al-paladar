// Copies Inter (variable weight, latin and latin-ext) from @fontsource-variable/inter into
// public/fonts/inter, with its OFL license. Self-hosted: no font requests to other sites.
import fs from 'node:fs';

const from = 'node_modules/@fontsource-variable/inter';
const to = 'public/fonts/inter';
fs.mkdirSync(to, {recursive: true});
for (const file of ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2']) {
  fs.copyFileSync(`${from}/files/${file}`, `${to}/${file}`);
}
fs.copyFileSync(`${from}/LICENSE`, `${to}/LICENSE.txt`);
console.log(`Inter copied to ${to}.`);
