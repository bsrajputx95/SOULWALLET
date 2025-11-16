import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface NotificationBadgeContextType {
  badgeCount: number;
  setBadgeCount: (count: number) => void;
  incrementBadgeCount: () => void;
  decrementBadgeCount: () => void;
  clearBadgeCount: () => void;
}

const NotificationBadgeContext = createContext<NotificationBadgeContextType | undefined>(undefined);

export const NotificationBadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [badgeCount, setBadgeCountState] = useState(0);

  const setBadgeCount = useCallback((count: number) => {
    setBadgeCountState(Math.max(0, count));
  }, []);

  const incrementBadgeCount = useCallback(() => {
    setBadgeCountState(prev => prev + 1);
  }, []);

  const decrementBadgeCount = useCallback(() => {
    setBadgeCountState(prev => Math.max(0, prev - 1));
  }, []);

  const clearBadgeCount = useCallback(() => {
    setBadgeCountState(0);
  }, []);

  const contextValue = useMemo(() => ({
    badgeCount,
    setBadgeCount,
    incrementBadgeCount,
    decrementBadgeCount,
    clearBadgeCount,
  }), [badgeCount, setBadgeCount, incrementBadgeCount, decrementBadgeCount, clearBadgeCount]);

  return (
    <NotificationBadgeContext.Provider value={contextValue}>
      {children}
    </NotificationBadgeContext.Provider>
  );
};

export const useNotificationBadgeContext = () => {
  const context = useContext(NotificationBadgeContext);
  if (context === undefined) {
    throw new Error('useNotificationBadgeContext must be used within a NotificationBadgeProvider');
  }
  return context;
};
