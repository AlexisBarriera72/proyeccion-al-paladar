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
