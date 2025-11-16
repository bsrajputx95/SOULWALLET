import type { ReactNode } from 'react';
import React, { createContext, useContext } from 'react';

/**
 * Creates a React context hook similar to @nkzw/create-context-hook
 * Returns a Provider component and a hook to use the context
 */
export default function createContextHook<T>(
  useValue: () => T
): [React.FC<{ children: ReactNode }>, () => T] {
  const Context = createContext<T | undefined>(undefined);

  const Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const value = useValue();
    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  const useContextHook = (): T => {
    const context = useContext(Context);
    if (context === undefined) {
      throw new Error(
        'Context hook must be used within its corresponding Provider'
      );
    }
    return context;
  };

  return [Provider, useContextHook];
}