# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Planning Manager - Application de gestion de plannings (shifts) pour managers avec règles complexes et optimisation automatique.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: AWS Amplify Gen 2, AWS Cognito (auth), DynamoDB
- **Validation**: Zod
- **Node**: v22

## Commands

```bash
# Development
npm run dev          # Démarre le serveur de développement Next.js

# AWS Amplify
npx ampx sandbox     # Lance l'environnement Amplify sandbox local
npx ampx generate    # Génère les types Amplify

# Build & Deploy
npm run build        # Build de production
npm run lint         # Linting ESLint
```

## Architecture

```
/app
  /(auth)           # Routes protégées par authentification
    /planning       # Calendrier mensuel principal
    /rules          # Gestion des règles de planning
    /employees      # Gestion des employés
/lib
  /db              # Modèles de données (à venir: ElectroDB)
  /types           # Types TypeScript
  /validators      # Schémas Zod de validation
/components
  /calendar        # Composants du calendrier
  /ui              # Composants UI réutilisables
/amplify           # Configuration AWS Amplify Gen 2
```

## Fonctionnalités Principales

1. **Calendrier Mensuel**: Grille employés x jours avec affectations
2. **Gestion des Règles**: Système de règles configurables (repos min, heures max, etc.)
3. **Optimisation Auto**: Remplissage automatique selon règles et contraintes
4. **Verrouillage/Forçage**: Possibilité de verrouiller ou forcer des affectations

## Types Principaux

- `Employee`: Employé avec positions et restrictions
- `Shift`: Affectation employé/poste sur une date
- `Planning`: Planning mensuel contenant les shifts
- `PlanningRule`: Règle de gestion configurable

## Notes de Développement

- Back-office uniquement (pas de SEO nécessaire)
- 5-20 employés par planning
- Desktop-first, responsive mobile
- Authentification obligatoire via Cognito