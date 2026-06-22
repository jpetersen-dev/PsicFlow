import React, { createContext, useContext, useState, useEffect } from 'react';

interface PrivacyModeContextProps {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  maskName: (name: string) => string;
  maskRut: (rut: string) => string;
}

const PrivacyModeContext = createContext<PrivacyModeContextProps | undefined>(undefined);

export const PrivacyModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(false);

  // Load from local storage
  useEffect(() => {
    const stored = localStorage.getItem('privacy-mode-active');
    if (stored === 'true') {
      setIsPrivacyMode(true);
    }
  }, []);

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const newVal = !prev;
      localStorage.setItem('privacy-mode-active', String(newVal));
      return newVal;
    });
  };

  const maskName = (name: string): string => {
    if (!name) return '';
    if (!isPrivacyMode) return name;
    
    // Mask name: "Juan Carlos Pérez" -> "J*** C*** P***"
    return name
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        return word[0].toUpperCase() + '***';
      })
      .join(' ');
  };

  const maskRut = (rut: string): string => {
    if (!rut) return '';
    if (!isPrivacyMode) return rut;

    // Remove dots and hyphens to normalize
    const clean = rut.replace(/[^0-9kK]/g, '');
    if (clean.length >= 8) {
      const start = clean.substring(0, 2);
      const dv = clean.slice(-1);
      return `${start}.***.***-${dv}`;
    }
    
    return rut.replace(/./g, '*');
  };

  return (
    <PrivacyModeContext.Provider value={{ isPrivacyMode, togglePrivacyMode, maskName, maskRut }}>
      {children}
    </PrivacyModeContext.Provider>
  );
};

export const usePrivacyMode = () => {
  const context = useContext(PrivacyModeContext);
  if (context === undefined) {
    throw new Error('usePrivacyMode must be used within a PrivacyModeProvider');
  }
  return context;
};
