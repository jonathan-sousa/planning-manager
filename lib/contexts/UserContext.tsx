'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import type { Schema } from '@/amplify/data/resource';

type UserProfile = Schema['UserProfile']['type'];
type UserPreferences = Schema['UserPreferences']['type'];

interface UserContextType {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  error: Error | null;
  updateProfile: (updates: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'owner'>>) => Promise<UserProfile | null | undefined>;
  updatePreferences: (updates: Partial<Omit<UserPreferences, 'id' | 'profileId' | 'createdAt' | 'updatedAt' | 'owner'>>) => Promise<UserPreferences | null | undefined>;
  logActivity: (action: string, description?: string, metadata?: Record<string, unknown>) => Promise<void>;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const userProfileData = useUserProfile();
  
  return (
    <UserContext.Provider value={userProfileData}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// Hook pour accéder uniquement au profil
export function useProfile() {
  const { profile, updateProfile, loading, error } = useUser();
  return { profile, updateProfile, loading, error };
}

// Hook pour accéder uniquement aux préférences
export function usePreferences() {
  const { preferences, updatePreferences, loading, error } = useUser();
  return { preferences, updatePreferences, loading, error };
}

// Hook pour obtenir une préférence spécifique avec valeur par défaut
export function usePreference<K extends keyof UserPreferences>(
  key: K,
  defaultValue: NonNullable<UserPreferences[K]>
): NonNullable<UserPreferences[K]> {
  const { preferences } = useUser();
  return (preferences?.[key] ?? defaultValue) as NonNullable<UserPreferences[K]>;
}

// Hook pour le thème
export function useTheme() {
  const theme = usePreference('theme', 'auto');
  const { updatePreferences } = useUser();
  
  const setTheme = async (newTheme: 'light' | 'dark' | 'auto') => {
    await updatePreferences({ theme: newTheme });
  };
  
  return { theme, setTheme };
}

// Hook pour la langue
export function useLanguage() {
  const language = usePreference('language', 'fr');
  const { updatePreferences } = useUser();
  
  const setLanguage = async (newLanguage: 'fr' | 'en' | 'es' | 'de') => {
    await updatePreferences({ language: newLanguage });
  };
  
  return { language, setLanguage };
}