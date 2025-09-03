'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { getCurrentUser } from 'aws-amplify/auth';

type UserProfile = Schema['UserProfile']['type'];
type UserPreferences = Schema['UserPreferences']['type'];

// Create client inside the hook to ensure Amplify is configured
const getClient = () => generateClient<Schema>();

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Charger le profil utilisateur
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await getCurrentUser();
      const userId = user.userId;
      
      const client = getClient();
      
      // Récupérer le profil existant ou en créer un nouveau
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: userId } }
      });
      
      let userProfile = profiles?.[0];
      
      if (!userProfile) {
        // Créer un nouveau profil si inexistant
        const { data: newProfile } = await client.models.UserProfile.create({
          userId,
          email: user.signInDetails?.loginId || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        if (newProfile) {
          userProfile = newProfile;
        }
      }
      
      if (userProfile) {
        setProfile(userProfile);
        
        // Charger les préférences liées
        const { data: prefs } = await client.models.UserPreferences.list({
          filter: { profileId: { eq: userProfile.id } }
        });
        
        let userPreferences = prefs?.[0];
        
        if (!userPreferences && userProfile.id) {
          // Créer des préférences par défaut si inexistantes
          const { data: newPrefs } = await client.models.UserPreferences.create({
            profileId: userProfile.id,
            theme: 'auto',
            language: 'fr',
            density: 'standard',
            dateFormat: 'dd_mm_yyyy',
            timeFormat: 'h24',
            timezone: 'Europe/Paris',
            firstDayOfWeek: 'monday',
            defaultView: 'month',
            autoSave: true,
            emailNotifications: true,
            pushNotifications: false,
            planningNotifications: true,
            conflictNotifications: true,
            reminderNotifications: true,
            exportFormat: 'pdf',
            includeWeekends: true,
            includeStats: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          if (newPrefs) {
            userPreferences = newPrefs;
          }
        }
        
        if (userPreferences) {
          setPreferences(userPreferences);
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement du profil:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mettre à jour le profil
  const updateProfile = useCallback(async (updates: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'owner'>>) => {
    if (!profile?.id) return;
    
    try {
      const client = getClient();
      const { data: updatedProfile } = await client.models.UserProfile.update({
        id: profile.id,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
      
      return updatedProfile;
    } catch (err) {
      console.error('Erreur lors de la mise à jour du profil:', err);
      throw err;
    }
  }, [profile]);

  // Mettre à jour les préférences
  const updatePreferences = useCallback(async (updates: Partial<Omit<UserPreferences, 'id' | 'profileId' | 'createdAt' | 'updatedAt' | 'owner'>>) => {
    if (!preferences?.id) return;
    
    try {
      const client = getClient();
      const { data: updatedPrefs } = await client.models.UserPreferences.update({
        id: preferences.id,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      
      if (updatedPrefs) {
        setPreferences(updatedPrefs);
      }
      
      return updatedPrefs;
    } catch (err) {
      console.error('Erreur lors de la mise à jour des préférences:', err);
      throw err;
    }
  }, [preferences]);

  // Logger une activité
  const logActivity = useCallback(async (action: string, description?: string, metadata?: Record<string, unknown>) => {
    try {
      const user = await getCurrentUser();
      const client = getClient();
      
      await client.models.ActivityLog.create({
        userId: user.userId,
        action,
        description,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erreur lors du logging de l\'activité:', err);
      // Ne pas propager l'erreur pour ne pas bloquer l'UI
    }
  }, []);

  // Charger le profil au montage
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // S'abonner aux changements en temps réel
  useEffect(() => {
    if (!profile?.id) return;
    
    const client = getClient();
    const subscription = client.models.UserProfile.observeQuery({
      filter: { id: { eq: profile.id } }
    }).subscribe({
      next: ({ items }) => {
        const updatedProfile = items[0];
        if (updatedProfile && updatedProfile.updatedAt !== profile.updatedAt) {
          setProfile(updatedProfile);
        }
      },
      error: (err) => console.error('Erreur de synchronisation du profil:', err),
    });
    
    return () => subscription.unsubscribe();
  }, [profile?.id, profile?.updatedAt]);

  // S'abonner aux changements des préférences
  useEffect(() => {
    if (!preferences?.id) return;
    
    const client = getClient();
    const subscription = client.models.UserPreferences.observeQuery({
      filter: { id: { eq: preferences.id } }
    }).subscribe({
      next: ({ items }) => {
        const updatedPrefs = items[0];
        if (updatedPrefs && updatedPrefs.updatedAt !== preferences.updatedAt) {
          setPreferences(updatedPrefs);
        }
      },
      error: (err) => console.error('Erreur de synchronisation des préférences:', err),
    });
    
    return () => subscription.unsubscribe();
  }, [preferences?.id, preferences?.updatedAt]);

  return {
    profile,
    preferences,
    loading,
    error,
    updateProfile,
    updatePreferences,
    logActivity,
    refetch: fetchProfile,
  };
}