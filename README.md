# Planning Manager

Application de gestion de plannings (shifts) pour managers avec règles complexes et optimisation automatique.

## Stack Technique

- **Frontend**: Next.js 15.5.2 (App Router), React 19.1.1, TypeScript
- **Backend**: AWS Amplify Gen 2, AWS Cognito
- **Styling**: Tailwind CSS v4
- **Validation**: Zod

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
```

## Build et Déploiement

```bash
# Build de production
npm run build

# Linting
npm run lint
```

## Fonctionnalités

- Calendrier mensuel avec grille employés × jours
- Gestion des règles de planning configurables
- Optimisation automatique selon contraintes
- Verrouillage/forçage d'affectations spécifiques
- Authentification sécurisée via AWS Cognito

## Architecture

- `/app` - Routes et pages Next.js (App Router)
- `/components` - Composants React réutilisables
- `/lib` - Logique métier et utilitaires
- `/amplify` - Configuration AWS Amplify backend
