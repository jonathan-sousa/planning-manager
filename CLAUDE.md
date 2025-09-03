# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Planning Manager - Application de gestion de plannings (shifts) pour managers avec règles complexes et optimisation automatique.

## Tech Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript
- **Backend**: AWS Amplify Gen 2, AWS Cognito (auth), DynamoDB
- **UI Components**: shadcn/ui, Radix UI, Lucide React (icons)
- **Styling**: Tailwind CSS v4
- **Validation**: Zod
- **State Management**: React Context API
- **Node**: v22

## Commands

```bash
# Development
npm run dev          # Démarre le serveur de développement Next.js

# AWS Amplify
npx ampx sandbox     # Lance l'environnement Amplify sandbox local
npx ampx generate outputs --branch main --app-id dky4b7m7ksc1p  # Génère les types Amplify depuis le backend déployé

# Build & Deploy
npm run build        # Build de production
npm run lint         # Vérifier les erreurs ESLint
npm run lint:fix     # Corriger automatiquement les erreurs ESLint
npm run type-check   # Vérifier les types TypeScript
npm run check        # Vérification complète (lint + types + build)
npm run check:fast   # Vérification rapide (lint + types, sans build)
```

## Vérification avant Push/Deploy

**IMPORTANT**: Pour éviter les erreurs de déploiement, toujours exécuter avant de push :

```bash
npm run check:fast   # Vérification rapide recommandée
# ou
npm run check        # Vérification complète avec build
```

Un hook Git pre-push est configuré pour automatiser ces vérifications.

## Architecture

```
/app
  /(auth)           # Routes protégées par authentification
    /dashboard      # Tableau de bord principal
    /planning       # Calendrier mensuel principal
    /rules          # Gestion des règles de planning  
    /employees      # Gestion des employés
    /preferences    # Préférences utilisateur
    /account        # Profil utilisateur
    /admin          # Section administration
  /components       # Composants spécifiques à l'app
    ConfigureAmplify.tsx  # Configuration Amplify côté client
  /providers        # Providers React
    AmplifyProvider.tsx   # Provider Amplify avec auth
/lib
  /contexts         # Contextes React globaux
    UserContext.tsx # Contexte utilisateur avec persistance
  /hooks           # Custom hooks
    useUserProfile.ts  # Hook pour profil et préférences
  /types           # Types TypeScript
  /validators      # Schémas Zod de validation
/components
  /ui              # Composants UI réutilisables (shadcn/ui)
  /calendar        # Composants du calendrier
  user-menu.tsx    # Menu utilisateur avec déconnexion
  app-sidebar.tsx  # Sidebar de navigation principale
/amplify           # Configuration AWS Amplify Gen 2
  /auth            # Configuration Cognito
  /data            # Schéma DynamoDB (UserProfile, UserPreferences, ActivityLog)
  /backend         # Configuration backend
```

## Fonctionnalités Principales

1. **Calendrier Mensuel**: Grille employés x jours avec affectations
2. **Gestion des Règles**: Système de règles configurables (repos min, heures max, etc.)
3. **Optimisation Auto**: Remplissage automatique selon règles et contraintes
4. **Verrouillage/Forçage**: Possibilité de verrouiller ou forcer des affectations
5. **Persistance DynamoDB**: Synchronisation multi-appareils des données utilisateur
6. **Interface Moderne**: Sidebar navigation, thème sombre/clair, composants shadcn/ui

## Types Principaux

### Types Métier
- `Employee`: Employé avec positions et restrictions
- `Shift`: Affectation employé/poste sur une date
- `Planning`: Planning mensuel contenant les shifts
- `PlanningRule`: Règle de gestion configurable

### Types Amplify Data (DynamoDB)
- `UserProfile`: Profil utilisateur complet
- `UserPreferences`: Préférences d'interface et notifications
- `ActivityLog`: Historique des actions utilisateur

## Notes de Développement

- Back-office uniquement (pas de SEO nécessaire)
- 5-20 employés par planning
- Desktop-first, responsive mobile
- Authentification obligatoire via Cognito
- Protection WAF activée sur CloudFront
- Synchronisation temps réel avec DynamoDB
- Hook pre-push Git pour validation automatique

## Méthodologie de Résolution de Problèmes

### Principe Fondamental
**TOUJOURS** consulter la documentation officielle via MCP avant d'implémenter des solutions personnalisées.

### Processus Obligatoire
1. **Identifier le problème** clairement et précisément
2. **Consulter la documentation officielle** via `mcp__context7__get-library-docs` avec des termes spécifiques
3. **Rechercher des exemples officiels** dans la documentation
4. **Appliquer la solution standard** trouvée dans la documentation
5. **Éviter les solutions personnalisées** sauf si aucune solution officielle n'existe

### Technologies Concernées
- **AWS Amplify** : Toujours vérifier les patterns officiels pour l'authentification, les imports, la configuration
- **Next.js** : Consulter la doc pour les patterns App Router, SSR, build issues
- **TailwindCSS** : Vérifier les classes et configurations officielles
- **TypeScript** : Types officiels et configurations recommandées
- **Toute technologie** avec documentation MCP disponible

### Questions à se Poser
- "Cette problématique existe-t-elle dans la documentation officielle ?"
- "Ai-je consulté MCP avant de développer une solution personnalisée ?"
- "Cette approche est-elle standard ou inventée ?"
- "Y a-t-il un exemple officiel qui traite ce cas d'usage ?"

### Exemple Concret
**Problème** : Import d'`amplify_outputs.json` qui échoue au build Next.js
**❌ Approche incorrecte** : Créer des imports dynamiques personnalisés, hooks custom
**✅ Approche correcte** : Consulter doc AWS → Trouver l'exemple officiel `ConfigureAmplifyClientSide` → Appliquer

### Avantages de cette Méthodologie
- Solutions éprouvées et maintenues
- Compatibilité garantie avec les versions futures
- Moins de bugs et d'effets de bord imprévisibles  
- Code plus maintenable et conforme aux standards
- Gain de temps significatif sur le long terme