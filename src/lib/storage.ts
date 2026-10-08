// Browser storage only for per-visitor conveniences (language, a draft). It can be empty or
// throw (private windows, blocked storage); nothing depends on it.
type Area = 'local' | 'session';

const area = (which: Area): Storage | null => {
  try {
    return which === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export function readJson<T>(which: Area, key: string): T | null {
  try {
    const text = area(which)?.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(which: Area, key: string, value: unknown): void {
  try {
    area(which)?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the page works without it */
  }
}

export function remove(which: Area, key: string): void {
  try {
    area(which)?.removeItem(key);
  } catch {
    /* ignore */
  }
}
