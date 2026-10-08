// The public config (/api/public/config): demo flag, required contact, Instagram link.
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {getJson} from './api.ts';
import type {PublicConfig} from '../../shared/types.ts';

const ConfigContext = createContext<PublicConfig | null>(null);

export function ConfigProvider({children}: {children: ReactNode}) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => {
    let alive = true;
    getJson<PublicConfig>('/api/public/config').then(result => {
      if (alive && result.kind === 'ok') setConfig(result.data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
