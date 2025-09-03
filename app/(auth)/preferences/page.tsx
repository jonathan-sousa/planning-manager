"use client"

import { useState, useEffect } from "react"
import { PageWrapper } from "@/components/page-wrapper"
import { usePreferences } from "@/lib/contexts/UserContext"
import { 
  Globe, 
  Calendar, 
  Bell, 
  Palette, 
  Clock,
  Monitor,
  Moon,
  Sun,
  Download,
  Mail,
  Smartphone,
  Save,
  Loader2
} from "lucide-react"

export default function PreferencesPage() {
  const { preferences, updatePreferences, loading, error } = usePreferences()
  const [isSaving, setIsSaving] = useState(false)
  const [localPrefs, setLocalPrefs] = useState({
    theme: 'auto' as 'light' | 'dark' | 'auto',
    language: 'fr' as 'fr' | 'en' | 'es' | 'de',
    density: 'standard' as 'comfortable' | 'standard' | 'compact',
    dateFormat: 'dd_mm_yyyy' as 'dd_mm_yyyy' | 'mm_dd_yyyy' | 'yyyy_mm_dd',
    timeFormat: 'h24' as 'h24' | 'h12',
    timezone: 'Europe/Paris',
    firstDayOfWeek: 'monday' as 'monday' | 'sunday' | 'saturday',
    defaultView: 'month' as 'month' | 'week' | 'day' | 'list',
    autoSave: true,
    emailNotifications: true,
    pushNotifications: false,
    planningNotifications: true,
    conflictNotifications: true,
    reminderNotifications: true,
    exportFormat: 'pdf' as 'pdf' | 'excel' | 'csv' | 'ical',
    includeWeekends: true,
    includeStats: true,
  })

  // Synchroniser avec les préférences du serveur
  useEffect(() => {
    if (preferences && !loading) {
      setLocalPrefs({
        theme: preferences.theme || 'auto',
        language: preferences.language || 'fr',
        density: preferences.density || 'standard',
        dateFormat: preferences.dateFormat || 'dd_mm_yyyy',
        timeFormat: preferences.timeFormat || 'h24',
        timezone: preferences.timezone || 'Europe/Paris',
        firstDayOfWeek: preferences.firstDayOfWeek || 'monday',
        defaultView: preferences.defaultView || 'month',
        autoSave: preferences.autoSave ?? true,
        emailNotifications: preferences.emailNotifications ?? true,
        pushNotifications: preferences.pushNotifications ?? false,
        planningNotifications: preferences.planningNotifications ?? true,
        conflictNotifications: preferences.conflictNotifications ?? true,
        reminderNotifications: preferences.reminderNotifications ?? true,
        exportFormat: preferences.exportFormat || 'pdf',
        includeWeekends: preferences.includeWeekends ?? true,
        includeStats: preferences.includeStats ?? true,
      })
    }
  }, [preferences, loading])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updatePreferences(localPrefs)
      // Afficher un message de succès (toast)
      console.log('Préférences sauvegardées avec succès')
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err)
      // Afficher un message d'erreur (toast)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setLocalPrefs({
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
    })
  }

  if (loading) {
    return (
      <PageWrapper maxWidth="xl">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper maxWidth="xl">
        <div className="text-center text-red-500">
          Erreur lors du chargement des préférences
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Préférences</h1>
        <p className="text-muted-foreground">
          Personnalisez votre expérience et configurez l&apos;application selon vos besoins
        </p>
      </div>

      {/* Apparence */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Apparence</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Thème de l&apos;interface</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setLocalPrefs({...localPrefs, theme: "light"})}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  localPrefs.theme === "light" ? "border-primary bg-primary/10" : ""
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-sm">Clair</span>
              </button>
              <button
                onClick={() => setLocalPrefs({...localPrefs, theme: "dark"})}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  localPrefs.theme === "dark" ? "border-primary bg-primary/10" : ""
                }`}
              >
                <Moon className="w-4 h-4" />
                <span className="text-sm">Sombre</span>
              </button>
              <button
                onClick={() => setLocalPrefs({...localPrefs, theme: "auto"})}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  localPrefs.theme === "auto" ? "border-primary bg-primary/10" : ""
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span className="text-sm">Auto</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Densité d&apos;affichage</label>
            <select 
              value={localPrefs.density}
              onChange={(e) => setLocalPrefs({...localPrefs, density: e.target.value as 'comfortable' | 'standard' | 'compact'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="comfortable">Confortable</option>
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>
      </div>

      {/* Localisation */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Localisation</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-2 block">Langue</label>
            <select 
              value={localPrefs.language}
              onChange={(e) => setLocalPrefs({...localPrefs, language: e.target.value as 'fr' | 'en' | 'es' | 'de'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Fuseau horaire</label>
            <select 
              value={localPrefs.timezone}
              onChange={(e) => setLocalPrefs({...localPrefs, timezone: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
              <option value="Europe/London">Europe/London (UTC+0)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Format de date
            </label>
            <select 
              value={localPrefs.dateFormat}
              onChange={(e) => setLocalPrefs({...localPrefs, dateFormat: e.target.value as 'dd_mm_yyyy' | 'mm_dd_yyyy' | 'yyyy_mm_dd'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="dd_mm_yyyy">JJ/MM/AAAA</option>
              <option value="mm_dd_yyyy">MM/JJ/AAAA</option>
              <option value="yyyy_mm_dd">AAAA-MM-JJ</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Format d&apos;heure
            </label>
            <select 
              value={localPrefs.timeFormat}
              onChange={(e) => setLocalPrefs({...localPrefs, timeFormat: e.target.value as 'h24' | 'h12'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="h24">24 heures (14:30)</option>
              <option value="h12">12 heures (2:30 PM)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Planning */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Planning</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Vue par défaut</label>
            <select 
              value={localPrefs.defaultView}
              onChange={(e) => setLocalPrefs({...localPrefs, defaultView: e.target.value as 'month' | 'week' | 'day' | 'list'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="month">Vue mensuelle</option>
              <option value="week">Vue hebdomadaire</option>
              <option value="day">Vue journalière</option>
              <option value="list">Vue liste</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Premier jour de la semaine</label>
            <select 
              value={localPrefs.firstDayOfWeek}
              onChange={(e) => setLocalPrefs({...localPrefs, firstDayOfWeek: e.target.value as 'monday' | 'sunday' | 'saturday'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="monday">Lundi</option>
              <option value="sunday">Dimanche</option>
              <option value="saturday">Samedi</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sauvegarde automatique</p>
              <p className="text-sm text-muted-foreground">
                Enregistrer les modifications automatiquement
              </p>
            </div>
            <button
              onClick={() => setLocalPrefs({...localPrefs, autoSave: !localPrefs.autoSave})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                localPrefs.autoSave ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  localPrefs.autoSave ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <div>
                <p className="font-medium">Notifications par email</p>
                <p className="text-sm text-muted-foreground">
                  Recevoir les mises à jour par email
                </p>
              </div>
            </div>
            <button
              onClick={() => setLocalPrefs({...localPrefs, emailNotifications: !localPrefs.emailNotifications})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                localPrefs.emailNotifications ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  localPrefs.emailNotifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              <div>
                <p className="font-medium">Notifications push</p>
                <p className="text-sm text-muted-foreground">
                  Recevoir les notifications sur mobile
                </p>
              </div>
            </div>
            <button
              onClick={() => setLocalPrefs({...localPrefs, pushNotifications: !localPrefs.pushNotifications})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                localPrefs.pushNotifications ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  localPrefs.pushNotifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="pl-6 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localPrefs.planningNotifications}
                onChange={() => setLocalPrefs({...localPrefs, planningNotifications: !localPrefs.planningNotifications})}
                className="rounded"
              />
              <span className="text-sm">Modifications du planning</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localPrefs.conflictNotifications}
                onChange={() => setLocalPrefs({...localPrefs, conflictNotifications: !localPrefs.conflictNotifications})}
                className="rounded"
              />
              <span className="text-sm">Conflits de règles détectés</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localPrefs.reminderNotifications}
                onChange={() => setLocalPrefs({...localPrefs, reminderNotifications: !localPrefs.reminderNotifications})}
                className="rounded"
              />
              <span className="text-sm">Rappels de validation</span>
            </label>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Export</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Format par défaut</label>
            <select 
              value={localPrefs.exportFormat}
              onChange={(e) => setLocalPrefs({...localPrefs, exportFormat: e.target.value as 'pdf' | 'excel' | 'csv' | 'ical'})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="ical">iCal</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localPrefs.includeWeekends}
                onChange={() => setLocalPrefs({...localPrefs, includeWeekends: !localPrefs.includeWeekends})}
                className="rounded"
              />
              <span className="text-sm">Inclure les weekends</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localPrefs.includeStats}
                onChange={() => setLocalPrefs({...localPrefs, includeStats: !localPrefs.includeStats})}
                className="rounded"
              />
              <span className="text-sm">Inclure les statistiques</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pb-6">
        <button 
          onClick={handleReset}
          className="px-4 py-2 border rounded-lg hover:bg-accent"
        >
          Réinitialiser
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Sauvegarder les préférences
            </>
          )}
        </button>
      </div>
      </div>
    </PageWrapper>
  )
}