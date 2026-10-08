// WCAG 2 contrast for the color tokens in src/styles.css (@theme) and the Tailwind stone steps
// the interface uses (DESIGN.md, "Tokens"). 4.5:1 for text, 3:1 for field borders and focus rings.
//
// Tailwind v4 defines stone in oklch (node_modules/tailwindcss/theme.css). This test reads those
// values and converts them the way a browser renders them (CSS Color 4: OKLCH → OKLab → LMS →
// linear sRGB → sRGB, rounded to 8 bits). stone-50 to stone-300 come out as the familiar v3 hex;
// stone-400 and stone-500 come out as #a6a09b and #79716b, not v3's #a8a29e and #78716c.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ---------------------------------------------------------------- tokens

const css = fs.readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
const themeBlock = css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? '';
const tokens: Record<string, string> = Object.fromEntries(
  [...themeBlock.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(m => [m[1], m[2].toLowerCase()]),
);

const tailwind = fs.readFileSync(new URL(import.meta.resolve('tailwindcss/theme.css')), 'utf8');
function stone(step: number): string {
  const match = tailwind.match(new RegExp(`--color-stone-${step}:\\s*oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\)`));
  assert.ok(match, `stone-${step} in tailwindcss/theme.css`);
  return oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** oklch(L% C H) as the 8-bit sRGB color a browser paints (in-gamut colors; no gamut mapping). */
function oklchToHex(lightnessPercent: number, chroma: number, hueDegrees: number): string {
  const L = lightnessPercent / 100;
  const a = chroma * Math.cos((hueDegrees * Math.PI) / 180);
  const b = chroma * Math.sin((hueDegrees * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return `#${linear
    .map(c =>
      Math.round(Math.min(1, Math.max(0, encode(c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

// ---------------------------------------------------------------- WCAG 2 relative luminance

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = '#ffffff';
const color = (name: string): string => {
  if (name === 'white') return WHITE;
  const step = name.match(/^stone-(\d+)$/);
  if (step) return stone(Number(step[1]));
  assert.ok(tokens[name], `--color-${name} in src/styles.css @theme`);
  return tokens[name];
};

function below(pairs: [string, string][], minimum: number): string[] {
  return pairs
    .map(([fg, bg]) => ({fg, bg, value: ratio(color(fg), color(bg))}))
    .filter(pair => pair.value < minimum)
    .map(({fg, bg, value}) => `${fg} (${color(fg)}) on ${bg} (${color(bg)}): ${value.toFixed(2)}:1`);
}

// ---------------------------------------------------------------- tests

test('the @theme block defines every color token', () => {
  for (const name of ['canvas', 'surface', 'ink', 'muted', 'border', 'accent', 'accent-hover']) {
    assert.match(tokens[name] ?? '', /^#[0-9a-f]{6}$/, `--color-${name}`);
  }
});

test('the oklch conversion reproduces known colors', () => {
  assert.equal(oklchToHex(100, 0, 0), '#ffffff');
  assert.equal(oklchToHex(0, 0, 0), '#000000');
  assert.equal(oklchToHex(62.796, 0.25768, 29.2339), '#ff0000'); // sRGB red (CSS Color 4)
  assert.equal(oklchToHex(51.975, 0.17686, 142.495), '#008000'); // CSS green
});

test('Tailwind v4 stone steps, as rendered', () => {
  assert.deepEqual(Object.fromEntries([50, 100, 200, 300, 400, 500].map(step => [`stone-${step}`, stone(step)])), {
    'stone-50': '#fafaf9',
    'stone-100': '#f5f5f4',
    'stone-200': '#e7e5e4',
    'stone-300': '#d6d3d1',
    'stone-400': '#a6a09b',
    'stone-500': '#79716b',
  });
});

test('the WCAG ratio matches published values', () => {
  assert.equal(ratio('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(ratio('#ffffff', '#ffffff').toFixed(2), '1.00');
  assert.equal(ratio('#767676', '#ffffff').toFixed(2), '4.54'); // the lightest grey that passes on white
});

test('text is at least 4.5:1', () => {
  const pairs: [string, string][] = [
    // Body text and secondary text on every background they sit on.
    ['ink', 'canvas'],
    ['ink', 'surface'],
    ['ink', 'stone-100'],
    ['ink', 'stone-50'],
    ['muted', 'canvas'],
    ['muted', 'surface'],
    ['muted', 'stone-100'],
    ['muted', 'stone-50'],
    // Primary buttons and the selected staff nav item.
    ['white', 'accent'],
    ['white', 'accent-hover'],
    ['white', 'ink'],
    // Links, at rest and on hover, on the panels they sit on.
    ['accent', 'surface'],
    ['accent', 'canvas'],
    ['accent', 'stone-100'],
    ['accent-hover', 'surface'],
    ['accent-hover', 'canvas'],
    ['accent-hover', 'stone-100'],
  ];
  assert.deepEqual(below(pairs, 4.5), []);
});

test('the shared field controls draw their border with a stone step of at least 3:1', () => {
  // The resting border of inputs and textareas, the select trigger and the radio cards.
  // Variant classes (hover:, has-[…]:) are not resting borders, so a space or quote must precede.
  const files = ['src/components/ui/field.tsx', 'src/components/ui/select.tsx', 'src/components/ui/choice.tsx'];
  const pairs: [string, string][] = [];
  for (const file of files) {
    const text = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    const steps = [...text.matchAll(/(?<=[\s'"`])border-stone-(\d+)\b/g)].map(m => `stone-${m[1]}`);
    assert.ok(steps.length > 0, `${file} has no border-stone-* class; update this test`);
    for (const step of new Set(steps)) pairs.push([step, 'surface'], [step, 'canvas']);
  }
  assert.deepEqual(below(pairs, 3), []);
});

test('field borders and focus rings are at least 3:1', () => {
  const pairs: [string, string][] = [
    // Inputs: a stone-500 border on a white field, on a white panel or the canvas.
    ['stone-500', 'surface'],
    ['stone-500', 'canvas'],
    // The focus outline is the accent, on every background a control sits on.
    ['accent', 'surface'],
    ['accent', 'canvas'],
    ['accent', 'stone-100'],
  ];
  assert.deepEqual(below(pairs, 3), []);
});
