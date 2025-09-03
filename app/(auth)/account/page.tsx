"use client"

import { useState, useEffect } from "react"
import { User, Mail, Phone, Shield, Clock, Camera, Building, Loader2, Save, Edit } from "lucide-react"
import { PageWrapper } from "@/components/page-wrapper"
import { useProfile } from "@/lib/contexts/UserContext"
import { signOut } from "aws-amplify/auth"

export default function AccountPage() {
  const { profile, updateProfile, loading, error } = useProfile()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // État local pour l'édition
  const [localProfile, setLocalProfile] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
  })

  // Synchroniser avec le profil du serveur
  useEffect(() => {
    if (profile && !loading) {
      setLocalProfile({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        role: profile.role || "",
        department: profile.department || "",
      })
    }
  }, [profile, loading])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProfile({
        name: localProfile.name,
        phone: localProfile.phone,
        role: localProfile.role,
        department: localProfile.department,
        // L'email ne peut pas être modifié ici car il vient de Cognito
      })
      setIsEditing(false)
      console.log('Profil sauvegardé avec succès')
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setLocalProfile({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        role: profile.role || "",
        department: profile.department || "",
      })
    }
    setIsEditing(false)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err)
    }
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Date inconnue"
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
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
          Erreur lors du chargement du profil
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mon compte</h1>
        <p className="text-muted-foreground">
          Gérez vos informations personnelles et paramètres de sécurité
        </p>
      </div>

      {/* Profil utilisateur */}
      <div className="rounded-lg border p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                {profile?.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl} 
                    alt={localProfile.name || "Avatar"} 
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-primary" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90">
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {localProfile.name || "Utilisateur"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {localProfile.role || "Rôle non défini"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border rounded-lg hover:bg-accent"
                  disabled={isSaving}
                >
                  Annuler
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
                      Sauvegarder
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border rounded-lg hover:bg-accent flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom complet</label>
            {isEditing ? (
              <input
                type="text"
                value={localProfile.name}
                onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Votre nom complet"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {localProfile.name || "Non renseigné"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <p className="text-sm text-muted-foreground">
              {localProfile.email || "Non renseigné"}
            </p>
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                L&apos;email ne peut pas être modifié
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Téléphone
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={localProfile.phone}
                onChange={(e) => setLocalProfile({...localProfile, phone: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="+33 6 12 34 56 78"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {localProfile.phone || "Non renseigné"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Building className="w-4 h-4" />
              Département
            </label>
            {isEditing ? (
              <input
                type="text"
                value={localProfile.department}
                onChange={(e) => setLocalProfile({...localProfile, department: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex: Gestion des Opérations"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {localProfile.department || "Non renseigné"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Rôle</label>
            {isEditing ? (
              <input
                type="text"
                value={localProfile.role}
                onChange={(e) => setLocalProfile({...localProfile, role: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex: Responsable Planning"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {localProfile.role || "Non renseigné"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Membre depuis
            </label>
            <p className="text-sm text-muted-foreground">
              {formatDate(profile?.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Sécurité</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mot de passe</p>
              <p className="text-sm text-muted-foreground">
                Géré par AWS Cognito
              </p>
            </div>
            <button 
              className="px-4 py-2 border rounded-lg hover:bg-accent"
              disabled
            >
              Changer (bientôt)
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Authentification à deux facteurs</p>
              <p className="text-sm text-muted-foreground">
                Renforcez la sécurité de votre compte
              </p>
            </div>
            <button 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              disabled
            >
              Bientôt disponible
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Déconnexion</p>
              <p className="text-sm text-muted-foreground">
                Se déconnecter de cette session
              </p>
            </div>
            <button 
              onClick={handleSignOut}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      {/* Informations système */}
      <div className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Informations système</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID utilisateur</span>
            <span className="font-mono text-xs">{profile?.userId || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dernière mise à jour</span>
            <span>{formatDate(profile?.updatedAt)}</span>
          </div>
        </div>
      </div>
      </div>
    </PageWrapper>
  )
}