import {createContext, useContext} from 'react';

export interface Me {
  email: string;
  role: 'owner' | 'staff';
  demo: boolean;
  environment: string;
  now: number;
}

export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;

/** Reloads the header's queue counts (Excepciones, Pedidos) after a write that can change them. */
export const CountsContext = createContext<() => void>(() => {});
export const useRefreshCounts = () => useContext(CountsContext);
