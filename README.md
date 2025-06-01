# Planning Manager

Application de gestion de planning d'équipes construite avec Next.js 15 et AWS Amplify Gen 2.

## Stack technologique

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: AWS Amplify Gen 2 (code-first)
- **Base de données**: AWS DynamoDB (via Amplify Data)
- **Authentification**: AWS Cognito (via Amplify Auth)
- **API**: GraphQL (générée automatiquement)

## Démarrage rapide

### Prérequis

- Node.js 18+
- AWS CLI configuré
- Compte AWS

### Installation

1. Cloner le projet et installer les dépendances :

```bash
npm install
```

2. Démarrer le backend Amplify en mode sandbox :

```bash
npm run amplify:dev
```

3. Dans un autre terminal, démarrer l'application Next.js :

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## Structure du projet

```
planning-manager/
├── amplify/                 # Configuration backend Amplify Gen 2
│   ├── auth/               # Configuration authentification
│   ├── data/               # Schéma GraphQL et modèles
│   └── backend.ts          # Configuration principale backend
├── src/
│   ├── app/                # Pages Next.js (App Router)
│   ├── components/         # Composants React
│   └── lib/                # Utilitaires et configuration
└── package.json
```

## Commandes Amplify

- `npm run amplify:dev` - Démarrer le backend en mode sandbox
- `npm run amplify:deploy` - Déployer le backend en production
- `npx ampx generate graphql-client-code` - Générer les types GraphQL

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

## Fonctionnalités

- ✅ Authentification utilisateur
- ✅ Gestion des équipes
- ✅ Création de plannings
- ✅ Assignation de créneaux
- ✅ Autorisation par rôles
- 🚧 Interface calendrier
- 🚧 Notifications
- 🚧 Rapports

## Développement

Le projet utilise l'architecture Amplify Gen 2 qui permet de définir le backend avec du code TypeScript. Les modèles sont automatiquement synchronisés avec DynamoDB et l'API GraphQL est générée.

### Authentification

L'authentification est gérée par AWS Cognito et intégrée avec l'UI Amplify pour une expérience utilisateur fluide.

### Autorisation

Les modèles utilisent un système d'autorisation basé sur :

- **Owner** : L'utilisateur peut accéder à ses propres données
- **Groups** : Accès basé sur les rôles (ADMIN, MANAGER, EMPLOYEE)

## Déploiement

Pour déployer en production, configurer une pipeline CI/CD avec :

```bash
npm run amplify:deploy
```

## License

MIT
