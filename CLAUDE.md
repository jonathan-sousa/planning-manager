# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Planning Manager est une application de gestion de planning d'équipes construite avec Next.js 15 et AWS Amplify Gen 2.
L'application permet de gérer des équipes, créer des plannings et assigner des créneaux de travail avec un système
d'autorisation basé sur les rôles.

## Key Commands

### Development

```bash
npm run dev              # Start Next.js development server (port 3000)
npm run amplify:sandbox  # Start Amplify backend in sandbox mode
npm run build           # Build the Next.js application
npm run lint            # Run Next.js linting
```

### Amplify Backend

```bash
npm run amplify:sandbox         # Start backend sandbox
npm run amplify:sandbox:delete  # Delete sandbox resources
npx ampx generate graphql-client-code  # Generate GraphQL types
```

Pour le développement, il faut lancer deux terminaux:

1. Backend Amplify: `npm run amplify:sandbox`
2. Frontend Next.js: `npm run dev`

## Architecture Overview

### Frontend Architecture (Next.js 15 App Router)

L'application utilise Next.js 15 avec App Router et est structurée ainsi:

- **Pages principales**: Dashboard, Planning, Teams (dans `src/app/`)
- **Layout global**: Inclut un Header de navigation partagé
- **Styling**: Tailwind CSS v4 avec configuration PostCSS
- **TypeScript**: Configuration stricte avec path alias `@/*` pour imports

### Backend Architecture (AWS Amplify Gen 2)

Le backend utilise Amplify Gen 2 (code-first approach):

- **Configuration minimale** actuellement dans `amplify/backend.ts`
- **Modèles de données prévus** (selon README):
  - UserProfile: Profils avec rôles (ADMIN, MANAGER, EMPLOYEE)
  - Team: Équipes de travail
  - Schedule: Plannings avec dates
  - Shift: Créneaux de travail
  - Position: Postes dans les équipes

### État actuel du projet

Le projet est en phase initiale avec:

- Structure de base Next.js configurée
- Pages statiques pour Dashboard, Planning et Teams
- Configuration Amplify minimale (backend à développer)
- Provider Amplify préparé mais sans authentification active
- Interface utilisateur basique avec Tailwind CSS

### Points d'intégration importants

1. **AmplifyProvider** (`src/components/providers/amplify-provider.tsx`): Configure Amplify côté client, actuellement en
   mode développement sans backend actif

2. **Routing**: Utilise Next.js App Router avec navigation via le composant Header

3. **État de développement**: L'application fonctionne en mode statique. Le backend Amplify doit être implémenté pour
   activer les fonctionnalités de gestion des données.

## Development Patterns

- Composants React fonctionnels avec TypeScript
- Styling avec classes Tailwind CSS
- Structure modulaire avec séparation claire entre pages, composants et providers
- Configuration Amplify isolée dans un provider client-side
