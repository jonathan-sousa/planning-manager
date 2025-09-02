"use client"

import { useState } from "react"
import { PageWrapper } from "@/components/page-wrapper"
import { 
  Globe, 
  Calendar, 
  Bell, 
  Palette, 
  FileText, 
  Clock,
  Monitor,
  Moon,
  Sun,
  Download,
  Mail,
  Smartphone
} from "lucide-react"

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState({
    language: "fr",
    dateFormat: "dd/mm/yyyy",
    timeFormat: "24h",
    theme: "light",
    defaultView: "month",
    autoSave: true,
    notifications: {
      email: true,
      push: false,
      planning: true,
      conflicts: true,
      reminders: true,
    },
    export: {
      format: "pdf",
      includeWeekends: true,
      includeStats: true,
    },
  })

  const handleNotificationChange = (type: string) => {
    setPreferences({
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [type]: !preferences.notifications[type as keyof typeof preferences.notifications]
      }
    })
  }

  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Préférences</h1>
        <p className="text-muted-foreground">
          Personnalisez votre expérience et configurez l'application selon vos besoins
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
            <label className="text-sm font-medium mb-2 block">Thème de l'interface</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPreferences({...preferences, theme: "light"})}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  preferences.theme === "light" ? "border-primary bg-primary/10" : ""
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-sm">Clair</span>
              </button>
              <button
                onClick={() => setPreferences({...preferences, theme: "dark"})}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  preferences.theme === "dark" ? "border-primary bg-primary/10" : ""
                }`}
              >
                <Moon className="w-4 h-4" />
                <span className="text-sm">Sombre</span>
              </button>
              <button
                onClick={() => setPreferences({...preferences, theme: "auto"})}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                  preferences.theme === "auto" ? "border-primary bg-primary/10" : ""
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span className="text-sm">Auto</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Densité d'affichage</label>
            <select className="w-full px-3 py-2 border rounded-lg">
              <option>Confortable</option>
              <option>Standard</option>
              <option>Compact</option>
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
              value={preferences.language}
              onChange={(e) => setPreferences({...preferences, language: e.target.value})}
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
            <select className="w-full px-3 py-2 border rounded-lg">
              <option>Europe/Paris (UTC+1)</option>
              <option>Europe/London (UTC+0)</option>
              <option>America/New_York (UTC-5)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Format de date
            </label>
            <select 
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({...preferences, dateFormat: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="dd/mm/yyyy">JJ/MM/AAAA</option>
              <option value="mm/dd/yyyy">MM/JJ/AAAA</option>
              <option value="yyyy-mm-dd">AAAA-MM-JJ</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Format d'heure
            </label>
            <select 
              value={preferences.timeFormat}
              onChange={(e) => setPreferences({...preferences, timeFormat: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="24h">24 heures (14:30)</option>
              <option value="12h">12 heures (2:30 PM)</option>
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
              value={preferences.defaultView}
              onChange={(e) => setPreferences({...preferences, defaultView: e.target.value})}
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
            <select className="w-full px-3 py-2 border rounded-lg">
              <option>Lundi</option>
              <option>Dimanche</option>
              <option>Samedi</option>
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
              onClick={() => setPreferences({...preferences, autoSave: !preferences.autoSave})}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                preferences.autoSave ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.autoSave ? "translate-x-6" : "translate-x-1"
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
              onClick={() => handleNotificationChange("email")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                preferences.notifications.email ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.notifications.email ? "translate-x-6" : "translate-x-1"
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
              onClick={() => handleNotificationChange("push")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                preferences.notifications.push ? "bg-primary" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  preferences.notifications.push ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="pl-6 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notifications.planning}
                onChange={() => handleNotificationChange("planning")}
                className="rounded"
              />
              <span className="text-sm">Modifications du planning</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notifications.conflicts}
                onChange={() => handleNotificationChange("conflicts")}
                className="rounded"
              />
              <span className="text-sm">Conflits de règles détectés</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.notifications.reminders}
                onChange={() => handleNotificationChange("reminders")}
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
              value={preferences.export.format}
              onChange={(e) => setPreferences({
                ...preferences, 
                export: {...preferences.export, format: e.target.value}
              })}
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
                checked={preferences.export.includeWeekends}
                onChange={() => setPreferences({
                  ...preferences,
                  export: {...preferences.export, includeWeekends: !preferences.export.includeWeekends}
                })}
                className="rounded"
              />
              <span className="text-sm">Inclure les weekends</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.export.includeStats}
                onChange={() => setPreferences({
                  ...preferences,
                  export: {...preferences.export, includeStats: !preferences.export.includeStats}
                })}
                className="rounded"
              />
              <span className="text-sm">Inclure les statistiques</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pb-6">
        <button className="px-4 py-2 border rounded-lg hover:bg-accent">
          Réinitialiser
        </button>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Sauvegarder les préférences
        </button>
      </div>
      </div>
    </PageWrapper>
  )
}