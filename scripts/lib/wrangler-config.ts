// Reads wrangler.jsonc (comments outside strings and trailing commas removed), and names the
// placeholders that must be replaced before anything touches a real account.
import fs from 'node:fs';

export function parseJsonc(text: string): any {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      out += char;
      if (char === '\\') out += text[++i];
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
    } else out += char;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

export const WRANGLER_PATH = new URL('../../wrangler.jsonc', import.meta.url);
export const readWrangler = () => parseJsonc(fs.readFileSync(WRANGLER_PATH, 'utf8'));

export const ENVIRONMENTS = ['local', 'demo', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Account and database ids still set to the committed placeholders (all zeros and a digit). */
export function placeholders(env: any): string[] {
  const found: string[] = [];
  if (!env.account_id || /^0{31}\d$/.test(env.account_id)) found.push('account_id');
  const db = env.d1_databases?.[0];
  if (!db?.database_id || /^00000000-0000-4000-8000-00000000000\d$/.test(db.database_id)) found.push('database_id');
  return found;
}

/** Every TEST_* variable written in the config, anywhere. */
export function testVariables(config: any): string[] {
  const found: string[] = [];
  const scan = (vars: Record<string, unknown> | undefined, where: string) => {
    for (const key of Object.keys(vars ?? {})) if (key.startsWith('TEST_')) found.push(`${where}.${key}`);
  };
  scan(config.vars, 'top');
  for (const [name, env] of Object.entries<any>(config.env ?? {})) scan(env.vars, name);
  return found;
}
