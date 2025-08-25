# Planning Manager

Application moderne de gestion de planning d'équipes construite avec Next.js 15.5 et AWS Amplify Gen 2.

## Stack technologique

### Frontend

- **Framework**: Next.js 15.5.0 (App Router)
- **UI Library**: React 19.1.1
- **Language**: TypeScript 5+ (configuration stricte)
- **Styling**: Tailwind CSS v4 avec PostCSS
- **State Management**: React Context + AWS Amplify

### Backend (à implémenter)

- **Infrastructure**: AWS Amplify Gen 2 (code-first)
- **Base de données**: AWS DynamoDB (via Amplify Data)
- **Authentification**: AWS Cognito (via Amplify Auth)
- **API**: GraphQL (générée automatiquement)

### Outils de développement

- **Linting**: ESLint 9 avec règles Next.js et TypeScript
- **Formatage**: Prettier 3.6 avec plugin Tailwind CSS
- **Analyse de bundle**: Next.js Bundle Analyzer
- **Optimisation CSS**: Critters pour le CSS critique
- **Git Hooks**: Husky pour pre-commit et validation (optionnel)
- **Type checking**: TypeScript avec routes typées

## Démarrage rapide

### Prérequis

- Node.js 18+ (recommandé: 20+)
- npm 10+
- AWS CLI configuré (pour Amplify)
- Compte AWS (pour déploiement)

### Installation

1. Cloner le projet et installer les dépendances :

```bash
npm install
```

2. Copier le fichier de configuration d'environnement :

```bash
cp .env.example .env.local
```

3. Démarrer le backend Amplify en mode sandbox :

```bash
npm run amplify:sandbox
```

4. Dans un autre terminal, démarrer l'application Next.js :

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

### Configuration optionnelle

Pour activer les hooks Git (formatage automatique et validation des commits) :

```bash
bash .husky-setup.sh
```

## Structure du projet

```
planning-manager/
├── amplify/                 # Configuration backend Amplify Gen 2
│   ├── auth/               # Configuration authentification
│   ├── data/               # Schéma GraphQL et modèles
│   └── backend.ts          # Configuration principale backend
├── src/
│   ├── app/                # Pages Next.js (App Router)
│   │   ├── dashboard/      # Page tableau de bord
│   │   ├── planning/       # Page de gestion des plannings
│   │   └── teams/          # Page de gestion des équipes
│   ├── components/         # Composants React réutilisables
│   │   ├── layout/         # Composants de mise en page
│   │   ├── providers/      # Providers React (Amplify, etc.)
│   │   └── ui/             # Composants UI génériques
│   ├── hooks/              # Hooks React personnalisés
│   ├── lib/                # Utilitaires et configuration
│   └── types/              # Types TypeScript partagés
├── .husky-setup.sh         # Script de configuration des hooks Git
├── .env.example            # Template des variables d'environnement
├── .env.local              # Variables d'environnement locales (non commité)
├── .eslintrc.json          # Configuration ESLint
├── .prettierrc.json        # Configuration Prettier
├── CLAUDE.md               # Documentation pour Claude Code
├── tailwind.config.ts      # Configuration Tailwind CSS étendue
├── next.config.mjs         # Configuration Next.js optimisée
└── tsconfig.json           # Configuration TypeScript stricte
```

## Scripts disponibles

### Développement

- `npm run dev` - Démarrer l'application Next.js
- `npm run build` - Construire l'application pour la production
- `npm run start` - Démarrer l'application en mode production

### Qualité de code

- `npm run lint` - Vérifier le code avec ESLint
- `npm run lint:fix` - Corriger automatiquement les problèmes ESLint
- `npm run format` - Formater le code avec Prettier
- `npm run format:check` - Vérifier le formatage du code
- `npm run typecheck` - Vérifier les types TypeScript
- `npm run precommit` - Exécuter tous les checks avant commit

### Amplify Backend

- `npm run amplify:sandbox` - Démarrer le backend en mode sandbox
- `npm run amplify:sandbox:delete` - Supprimer les ressources sandbox
- `npm run amplify:generate` - Générer les types GraphQL
- `npm run amplify:deploy` - Déployer le backend en production

### Utilitaires

- `npm run analyze` - Analyser la taille du bundle
- `npm run clean` - Nettoyer les dossiers de build et node_modules

## Modèles de données

### UserProfile

- Profil utilisateur avec rôles (ADMIN, MANAGER, EMPLOYEE)
- Liaison avec équipes et shifts

### Team

- Équipes de travail
- Gestion des membres et managers

### Schedule

- Plannings avec dates de début/fin
- Associés à une équipe

### Shift

- Créneaux de travail individuels
- Assignés à un employé et une position

### Position

- Postes de travail dans une équipe
- Compétences requises

## État actuel du projet

### ✅ Implémenté

- Interface utilisateur complète avec Next.js 15.5
- Pages statiques: Dashboard, Planning, Teams
- Navigation avec header responsive
- Configuration complète de développement
- Optimisations de production (bundle, sécurité, images)
- Outils de qualité de code configurés

### 🚧 En cours de développement

- Backend Amplify (modèles de données définis, implémentation à faire)
- Authentification avec AWS Cognito
- API GraphQL
- Connexion base de données DynamoDB

### 📋 Fonctionnalités prévues

- ✅ Authentification utilisateur
- ✅ Gestion des équipes
- ✅ Création de plannings
- ✅ Assignation de créneaux
- ✅ Autorisation par rôles (ADMIN, MANAGER, EMPLOYEE)
- 🚧 Interface calendrier interactive
- 🚧 Système de notifications
- 🚧 Génération de rapports

## Développement

### Configuration de l'environnement

Le projet utilise des variables d'environnement pour la configuration. Voir `.env.example` pour la liste complète.

### Standards de code

- **TypeScript** : Configuration stricte avec vérification des types
- **ESLint** : Règles personnalisées pour Next.js et React
- **Prettier** : Formatage automatique avec support Tailwind CSS
- **Conventions de commit** : Format `type(scope): description` (si Husky activé)

### Architecture

Le projet utilise l'architecture Amplify Gen 2 qui permet de définir le backend avec du code TypeScript. Les modèles
sont automatiquement synchronisés avec DynamoDB et l'API GraphQL est générée.

### Authentification

L'authentification est gérée par AWS Cognito et intégrée avec l'UI Amplify pour une expérience utilisateur fluide.

### Autorisation

Les modèles utilisent un système d'autorisation basé sur :

- **Owner** : L'utilisateur peut accéder à ses propres données
- **Groups** : Accès basé sur les rôles (ADMIN, MANAGER, EMPLOYEE)

### Optimisations Next.js

- **Bundle Analyzer** : Analyse de la taille des bundles JavaScript
- **Image Optimization** : Support AVIF et WebP
- **Security Headers** : Headers de sécurité configurés (CSP, X-Frame-Options, etc.)
- **TypeScript Routes** : Routes typées pour une navigation type-safe
- **CSS Optimization** : CSS critique inline avec Critters
- **Performance** : First Load JS ~102KB (optimisé)

## Déploiement

### Production

Pour déployer en production :

1. Configurer les variables d'environnement de production
2. Exécuter les tests et vérifications :
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
3. Déployer le backend Amplify :
   ```bash
   npm run amplify:deploy
   ```
4. Déployer le frontend sur votre plateforme (Vercel, AWS, etc.)

### Analyse des performances

Pour analyser la taille du bundle avant déploiement :

```bash
npm run analyze
```

## Dernières améliorations

### 🚀 Décembre 2024

- Migration vers Next.js 15.5.0 et React 19.1.1
- Configuration complète ESLint + Prettier
- Ajout de l'analyse de bundle
- Optimisation CSS avec Critters
- Headers de sécurité configurés
- Variables d'environnement documentées
- Scripts npm enrichis pour le développement
- TypeScript avec configuration stricte
- Tailwind CSS v4 avec animations personnalisées

## Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commiter les changements (`git commit -m 'feat: Add amazing feature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Conventions de code

- Utiliser les scripts de formatage avant commit : `npm run precommit`
- Suivre les conventions de commit : `type(scope): description`
- Vérifier les types TypeScript : `npm run typecheck`
- Respecter les règles ESLint : `npm run lint`

## Support

Pour toute question ou problème, ouvrir une issue sur le repository GitHub.

## License

MIT
