"use client"

import { useState } from "react"
import { User, Mail, Phone, Shield, Clock, Camera } from "lucide-react"
import { PageWrapper } from "@/components/page-wrapper"

export default function AccountPage() {
  const [isEditing, setIsEditing] = useState(false)
  
  // Simuler des données utilisateur (à remplacer par les vraies données)
  const [userData, setUserData] = useState({
    name: "Manager Principal",
    email: "manager@example.com",
    phone: "+33 6 12 34 56 78",
    role: "Responsable Planning",
    department: "Gestion des Opérations",
    joinDate: "15 janvier 2023",
  })

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
                <User className="w-10 h-10 text-primary" />
              </div>
              <button className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90">
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{userData.name}</h2>
              <p className="text-sm text-muted-foreground">{userData.role}</p>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 border rounded-lg hover:bg-accent"
          >
            {isEditing ? "Sauvegarder" : "Modifier"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            {isEditing ? (
              <input
                type="email"
                value={userData.email}
                onChange={(e) => setUserData({...userData, email: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{userData.email}</p>
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
                value={userData.phone}
                onChange={(e) => setUserData({...userData, phone: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{userData.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Département</label>
            <p className="text-sm text-muted-foreground">{userData.department}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Membre depuis
            </label>
            <p className="text-sm text-muted-foreground">{userData.joinDate}</p>
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
                Dernière modification il y a 3 mois
              </p>
            </div>
            <button className="px-4 py-2 border rounded-lg hover:bg-accent">
              Changer
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Authentification à deux facteurs</p>
              <p className="text-sm text-muted-foreground">
                Renforcez la sécurité de votre compte
              </p>
            </div>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Activer
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sessions actives</p>
              <p className="text-sm text-muted-foreground">
                Gérez vos connexions actives
              </p>
            </div>
            <button className="px-4 py-2 border rounded-lg hover:bg-accent">
              Voir tout
            </button>
          </div>
        </div>
      </div>

      {/* Historique d&apos;activité */}
      <div className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Activité récente</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Connexion depuis Chrome - Paris, France
            </span>
            <span className="text-xs text-muted-foreground">Il y a 2 heures</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Modification du planning semaine 45
            </span>
            <span className="text-xs text-muted-foreground">Hier à 14:30</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Export du planning mensuel
            </span>
            <span className="text-xs text-muted-foreground">Il y a 3 jours</span>
          </div>
        </div>
      </div>

      {/* Actions danger zone */}
      <div className="rounded-lg border border-red-200 p-6 bg-red-50/50">
        <h2 className="text-xl font-semibold mb-2 text-red-900">Zone dangereuse</h2>
        <p className="text-sm text-red-700 mb-4">
          Ces actions sont irréversibles. Procédez avec prudence.
        </p>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100">
            Désactiver le compte
          </button>
          <button className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100">
            Supprimer le compte
          </button>
        </div>
      </div>
      </div>
    </PageWrapper>
  )
}