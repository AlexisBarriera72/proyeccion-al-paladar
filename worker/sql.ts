// A tiny SQL builder. `sql` turns interpolated values into `?` parameters and splices
// nested fragments in order, so named checks compose without hand-numbered parameters.
export type SqlValue = string | number | null;

export class Sql {
  readonly text: string;
  readonly params: SqlValue[];
  constructor(text: string, params: SqlValue[]) {
    this.text = text;
    this.params = params;
  }
}

type Interpolation = Sql | SqlValue | boolean | undefined;

export function sql(strings: TemplateStringsArray, ...values: Interpolation[]): Sql {
  let text = strings[0];
  const params: SqlValue[] = [];
  values.forEach((value, index) => {
    if (value instanceof Sql) {
      text += value.text;
      params.push(...value.params);
    } else {
      text += '?';
      params.push(value === undefined ? null : typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    text += strings[index + 1];
  });
  return new Sql(text, params);
}

/** Trusted SQL text (identifiers, aliases, fixed keywords). Never user input. */
export const raw = (text: string) => new Sql(text, []);

export function join(parts: Sql[], separator: string): Sql {
  return (
    parts.reduce<Sql | null>(
      (all, part) => (all ? new Sql(all.text + separator + part.text, [...all.params, ...part.params]) : part),
      null,
    ) ?? raw('')
  );
}

/** AND of every fragment (TRUE when empty). */
export const and = (parts: Sql[]) => (parts.length ? sql`(${join(parts, ' AND ')})` : raw('1'));
