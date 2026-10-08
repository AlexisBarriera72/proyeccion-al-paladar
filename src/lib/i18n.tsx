// Spanish first; English is a toggle (?lang=en, remembered in this browser).
import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {es} from '../i18n/es.ts';
import {en} from '../i18n/en.ts';
import {readJson, writeJson} from './storage.ts';
import type {Lang} from '../../shared/time.ts';

export type Vars = Record<string, string | number>;
type Dictionary = Record<string, string>;

const base: Record<Lang, Dictionary> = {es, en};

function initialLang(): Lang {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'en' || asked === 'es') {
    writeJson('local', 'pap-lang', asked);
    return asked;
  }
  return readJson<string>('local', 'pap-lang') === 'en' ? 'en' : 'es';
}

const LangContext = createContext<{lang: Lang; setLang: (lang: Lang) => void}>({lang: 'es', setLang: () => {}});

export function LangProvider({children}: {children: ReactNode}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(
    () => ({
      lang,
      setLang: (next: Lang) => {
        writeJson('local', 'pap-lang', next);
        const url = new URL(location.href);
        url.searchParams.delete('lang');
        history.replaceState(history.state, '', url.pathname + url.search);
        setLangState(next);
      },
    }),
    [lang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** `t(key, vars)`. Extra dictionaries (the staff area's) are merged over the base ones. */
export function useT(extra?: Record<Lang, Dictionary>) {
  const {lang, setLang} = useContext(LangContext);
  const t = useCallback(
    (key: string, vars?: Vars) =>
      format(extra?.[lang]?.[key] ?? base[lang][key] ?? extra?.es?.[key] ?? base.es[key] ?? key, vars),
    [lang, extra],
  );
  return {t, lang, setLang};
}
