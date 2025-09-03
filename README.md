# Planning Manager

Application de gestion de plannings (shifts) pour managers avec règles complexes et optimisation automatique.

## Stack Technique

- **Frontend**: Next.js 15.5.2 (App Router), React 19.1.1, TypeScript
- **Backend**: AWS Amplify Gen 2, AWS Cognito, DynamoDB
- **UI Components**: shadcn/ui, Radix UI
- **Styling**: Tailwind CSS v4
- **Validation**: Zod
- **State Management**: React Context API

## Installation

```bash
npm install
```

## Développement

```bash
# Serveur de développement
npm run dev

# Environnement Amplify sandbox
npx ampx sandbox

# Générer les types TypeScript depuis le schéma Amplify
npx ampx generate outputs --branch main --app-id dky4b7m7ksc1p
```

## Build et Déploiement

```bash
# Build de production
npm run build

# Vérifications avant déploiement (lint + types)
npm run check:fast

# Linting
npm run lint

# Vérification des types TypeScript
npm run type-check
```

## Fonctionnalités

- 🗓️ **Calendrier mensuel** avec grille employés × jours
- 📋 **Gestion des règles** de planning configurables
- 🤖 **Optimisation automatique** selon contraintes
- 🔒 **Verrouillage/forçage** d'affectations spécifiques
- 🔐 **Authentification sécurisée** via AWS Cognito
- 💾 **Persistance des données** utilisateur avec synchronisation multi-appareils
- 👤 **Profils utilisateurs** avec préférences personnalisables
- 🎨 **Interface moderne** avec sidebar navigation et thème sombre/clair
- 🛡️ **Protection WAF** pour sécurité renforcée

## Architecture

```
/app
├── /(auth)              # Routes protégées (dashboard, planning, etc.)
├── /components          # Composants spécifiques à l'app
├── /providers          # Providers React (Amplify, Theme, etc.)
└── layout.tsx          # Layout principal avec providers

/components
├── /ui                 # Composants UI réutilisables (shadcn/ui)
├── /calendar           # Composants du calendrier
└── /user-menu.tsx      # Menu utilisateur avec déconnexion

/lib
├── /contexts           # Contextes React (UserContext)
├── /hooks             # Custom hooks (useUserProfile)
├── /types             # Types TypeScript
└── /validators        # Schémas Zod de validation

/amplify
├── /auth              # Configuration Cognito
├── /data              # Schéma de données (UserProfile, UserPreferences, etc.)
└── /backend           # Configuration backend Amplify
```

## Accès

- **URL Production**: https://planning-manager.lab.jonathan-sousa.com
- **Protection**: AWS WAF avec règles managées
