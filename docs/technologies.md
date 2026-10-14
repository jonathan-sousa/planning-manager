# Technologies du projet

Guide explicatif : ce qu'est chaque brique du projet, à quoi elle sert ici et comment elle s'articule avec les autres. Les choix et leurs raisons détaillées sont dans [architecture.md](architecture.md).

## Vue d'ensemble

Planning Manager construit le planning mensuel du personnel paramédical d'un service d'urgences. Les cadres saisissent la grille, l'application vérifie les règles du temps de travail en direct, un solveur peut compléter le mois, puis le planning est validé, publié et exporté.

```text
Navigateur (frontend React)
      │  appels HTTPS avec le jeton de connexion
      ▼
API Gateway ──► API (Lambda Node, Hono) ──► Solveur (Lambda Python, OR-Tools)
                      │                              │
                      └────► Base de données ◄───────┘
                           (Aurora DSQL, PostgreSQL)
```

- **Frontend (`src/`)** : l'application dans le navigateur. Les référentiels (agents, grades, postes, besoins, demandes, règles, comptes) et la grille du mois, saisie au clavier comme un tableur, avec sauvegarde automatique, violations en direct, compteurs, soldes, couverture et exports PDF et CSV.
- **API (`api/`)** : une seule Lambda, un routeur par ressource. Elle vérifie les droits, valide les saisies, lit et écrit en base, lance le solveur. Le cœur métier (`api/rules/` : validateur, compteurs, diagnostic) est du code pur, exécuté aussi bien par l'API que par la grille : les règles sont les mêmes des deux côtés.
- **Solveur (`solver/`)** : une Lambda Python qui propose un planning (compléter les cases vides, ou réoptimiser), en arrière-plan ; le cadre applique ou abandonne la proposition.
- **Base de données** : Aurora DSQL, du PostgreSQL serverless.
- **Infrastructure (`infra/`)** : tout est décrit en code (CDK), une stack par stage (un stage personnel par développeur, et la production).

Principe d'organisation : les décisions métier sont des fonctions pures, testées et partagées ; les routes et les écrans chargent les données, appellent ces fonctions, puis écrivent ou affichent ([architecture.md § Organisation du code](architecture.md#organisation-du-code)).

## Frontend

### Vite

Outil de développement et de build du frontend.

- **En développement** (`npm run dev`) : un serveur local sur `localhost:5173`, qui démarre en une seconde et applique chaque modification à chaud, sans recharger la page.
- **Au build** (`npm run build`) : le dossier `dist/`, déployé sur S3 + CloudFront en production. Code minifié, fichiers aux noms hachés (mis en cache longtemps), morceaux chargés à la demande (jsPDF n'est téléchargé qu'au premier export PDF).
- **Plugins** (`vite.config.ts`) : React, TanStack Router (génère `routeTree.gen.ts` depuis `src/routes/`), Tailwind, et un plugin du projet qui sert `/config.json` en développement à partir de `.env.local`.

### TanStack (Query, Router, Form)

Famille de bibliothèques frontend ; le projet en utilise trois, toutes typées de bout en bout.

- **Query : les données du serveur.** Chargement, cache, rechargement, états « en cours » et « erreur ». Chaque ressource a sa requête dans `src/lib/resources.ts` ; après une écriture, la requête concernée est invalidée et se recharge seule (`invalidatePlanning` après une publication). C'est aussi Query qui interroge le solveur toutes les 2 s jusqu'à la fin du calcul.
- **Router : la navigation.** Une adresse, un écran : les routes sont des fichiers de `src/routes/`. Un lien vers une route inexistante ne compile pas.
- **Form : les formulaires.** Saisie, validation par les schémas Zod de l'API, erreurs par champ ; `submitToApi` (`src/hooks/form.ts`) place sous le bon champ les erreurs renvoyées par l'API (un code déjà utilisé, par exemple).

### Tailwind CSS

Framework CSS « utilitaire » : le style se compose dans le JSX avec de petites classes qui font chacune une chose (`text-sm`, `px-2`, `border-b`, `hover:…`, `dark:…`). Pas de noms de classes à inventer, pas de CSS mort ; seules les classes utilisées partent au build. Les couleurs viennent d'un thème commun (`text-muted-foreground`, `bg-destructive`…) ; `cn(...)` combine des classes selon des conditions. La grille du planning s'en sert beaucoup : cases hors contrat hachurées, week-ends grisés, contours des violations, en-têtes collants.

### shadcn/ui et Base UI

- **shadcn/ui** : un catalogue de composants React (boutons, tableaux, fenêtres, champs, badges, barre latérale) qu'on **copie dans le projet** au lieu de les installer : `npx shadcn@latest add <composant>` écrit le fichier dans `src/components/ui/`. Le code nous appartient, aucune mise à jour externe ne le change. Ces fichiers sont générés : on ne les écrit pas à la main.
- **Base UI** (`@base-ui/react`) : la bibliothèque « sans style » sur laquelle reposent ces composants. Elle apporte le comportement et l'accessibilité (fermeture par Échap, focus gardé dans une fenêtre, navigation au clavier dans une liste, attributs ARIA) ; Tailwind apporte l'apparence. C'est le successeur de Radix UI, l'autre base possible de shadcn.

Les composants du projet s'appuient dessus : `CrudPage` (liste, création, modification, suppression), les champs de `form-fields.tsx`, la barre latérale.

### Amplify (bibliothèque d'authentification)

AWS Amplify est une famille d'outils (backend, hébergement, bibliothèques). Le projet n'utilise que sa bibliothèque JavaScript `aws-amplify`, configurée dans `src/main.tsx`, et seulement pour l'authentification : rediriger vers la page de connexion Cognito, revenir dans l'application et rafraîchir les jetons. Pas d'écran de connexion dans l'application, pas d'Amplify UI.

## API

### Hono

Petit framework web TypeScript pour écrire une API : des routes (`GET /agents`…), des middlewares (contrôle du groupe, validation de l'entrée), des réponses HTTP. Léger, fondé sur les standards du web, il tourne sur Lambda grâce à un adaptateur officiel.

Son atout ici : le **client typé** (Hono RPC). L'API exporte son type (`AppType`) et le frontend crée son client avec `hc<AppType>` (`src/lib/api-client.ts`) : si une route change de forme, le frontend ne compile plus. `api/app.ts` assemble les routeurs de `api/routes/`, `api/index.ts` les branche sur la Lambda.

### Zod

Bibliothèque de validation : on décrit la forme attendue d'une donnée, Zod vérifie une valeur reçue, la nettoie (espaces, minuscules) et en donne le type TypeScript. TypeScript contrôle le code à la compilation, Zod contrôle ce qui arrive de l'extérieur à l'exécution.

Les schémas de `api/schemas.ts` sont la **seule définition** de la validation : l'API les applique à chaque requête (400 avec un message par champ), les formulaires du frontend les réutilisent. Les règles croisées y vivent (fin après le début, horaires d'un poste travaillé…), en français. Ce qui demande la base (un code déjà pris, un chevauchement d'absences) reste dans l'API.

### Drizzle

ORM TypeScript léger, proche du SQL :

- **le schéma** est décrit en TypeScript (`api/db/schema.ts`), d'où découlent les types des lignes ;
- **les requêtes** s'écrivent en TypeScript typé (`db.select().from(agents).where(eq(agents.id, id))`) : une colonne inexistante ne compile pas ;
- **les migrations** sont générées par `npm run db:generate`, committées dans `api/db/migrations/` et appliquées au déploiement.

Un adaptateur officiel AWS (`@aws/aurora-dsql-drizzle`) gère la connexion à Aurora DSQL par jeton IAM et rejoue une transaction en conflit (`transactionWithRetry`). Dans les tests, le même code tourne sur PGlite, un PostgreSQL en mémoire.

## Solveur

### OR-Tools (CP-SAT)

La boîte à outils d'optimisation de Google, open source. Le projet en utilise **CP-SAT**, un solveur de programmation par contraintes : on lui décrit des variables (« cet agent fait-il ce poste ce jour-là ? »), des contraintes (repos, durées maximales) et un objectif ; il cherche lui-même la meilleure solution parmi un nombre astronomique de combinaisons.

Dans `solver/src/solver/model.py` :

- une variable par case libre et poste autorisé à l'agent ; cases verrouillées et absences validées fixées d'avance ;
- chaque règle dure reçoit un indicateur de violation au lieu d'être imposée : le solveur trouve toujours une réponse, même quand des cases verrouillées rendent une règle impossible ;
- l'objectif est traité par étages : aucune violation dure, puis la meilleure couverture, puis les préférences (heures, souhaits, équité, stabilité).

Le validateur TypeScript reste la référence des règles ; les scénarios de `fixtures/rule-scenarios/` vérifient que les deux s'accordent ([scheduling-rules.md](scheduling-rules.md)).

### uv

Gestionnaire de projets Python (par Astral) : il installe la bonne version de Python, gère les dépendances (`solver/pyproject.toml`, versions figées dans `uv.lock`), tient l'environnement virtuel et lance les commandes (`uv run pytest`). Les tests de bout en bout lancent le solveur par `uv run` ; CDK construit le paquet de la Lambda avec uv, sans Docker, pour Linux ARM64.

## Données

### Aurora DSQL

Base PostgreSQL **serverless** d'AWS (_Distributed SQL_).

- **Du PostgreSQL** : SQL standard, jointures, transactions, clés étrangères.
- **Serverless** : pas de serveur à dimensionner, paiement à la consommation, presque rien au repos.
- **Sans réseau privé** : connexion en TLS avec un jeton IAM temporaire au lieu d'un mot de passe ; les Lambdas n'ont pas besoin de VPC.
- **Transactions jusqu'à 3 000 lignes** : appliquer une proposition du solveur et vérifier la version du planning se fait en une seule opération.

Particularités gérées dans le code ([architecture.md § Base de données](architecture.md#base-de-données)) : concurrence optimiste (une transaction en conflit échoue et se rejoue), une instruction de schéma par transaction, index créés en asynchrone, tri des libellés accentués côté application. Chaque Lambda se connecte avec son rôle PostgreSQL : `admin` pour l'API, `solver` et `mailer`, limités, pour les deux autres.

## Services AWS

### Lambda

Exécute du code sans serveur à gérer : AWS lance la fonction quand un événement arrive et facture à la milliseconde. Sans trafic, rien ne tourne ; sous la charge, AWS lance autant d'exemplaires que nécessaire. Limites : 15 min, 10 Go de mémoire, un paquet de 250 Mo décompressé (`npm run infra:size` mesure celui du solveur). Le premier appel après une pause est plus lent (démarrage à froid).

| Lambda                                   | Langage          | Déclenchée par       | Rôle                                  |
| ---------------------------------------- | ---------------- | -------------------- | ------------------------------------- |
| API (`api/index.ts`)                     | Node, Hono       | API Gateway          | Toutes les routes                     |
| Solveur (`solver/`)                      | Python, OR-Tools | L'API, sans attendre | Calcule une proposition de planning   |
| Événements email (`api/email-events.ts`) | Node             | SNS (événements SES) | Enregistre remises, rebonds, plaintes |

Toutes tournent sur ARM64, chacune avec son rôle IAM et son rôle en base.

### API Gateway

La porte d'entrée HTTP de l'API (version **HTTP API**). Avant même que le code tourne, elle :

1. vérifie le jeton Cognito (signature, expiration, application) : sans jeton valide, 401 ;
2. applique le CORS : seul le domaine de l'application (ou le serveur Vite en développement) peut appeler l'API depuis un navigateur ;
3. limite le débit de chaque stage ;
4. journalise chaque appel pendant un an (utilisateur, adresse IP, méthode, chemin, statut, durée) ;
5. transmet la requête à la Lambda, qui contrôle ensuite le groupe de l'utilisateur.

L'API reste sur son URL `execute-api`, que le frontend lit dans `/config.json`. Une HTTP API ne prend pas de WAF.

### Cognito

Les comptes des utilisateurs de l'application et leur connexion : aucun mot de passe n'est stocké par le projet.

- **Annuaire** (_user pool_) : email, nom, mot de passe haché, MFA, groupes `MANAGERS` et `ADMINS`.
- **Page de connexion hébergée** (_Managed Login_) : connexion, mot de passe temporaire, enrôlement et saisie du code TOTP, mot de passe oublié.
- **Jetons** (JWT) remis après connexion, envoyés à chaque appel d'API.

Inscription fermée (un admin invite depuis la page Comptes), MFA obligatoire par application d'authentification, email insensible à la casse. Les actions d'admin revérifient l'appelant en direct dans Cognito, un jeton gardant ses groupes jusqu'à une heure. Un compte n'est jamais supprimé, seulement désactivé.

### SES

Le service d'envoi d'emails d'AWS. Il envoie les emails de Cognito (invitations, réinitialisations) depuis `no-reply@planning-manager.lab.jonathan-sousa.com`. La stack `PlanningManagerMail`, partagée par tous les stages, porte le domaine d'envoi et ses preuves d'authenticité dans Route 53 :

- **DKIM** : les emails sont signés ;
- **SPF et MAIL FROM** : qui a le droit d'envoyer pour le domaine ;
- **DMARC** : ce que les messageries font d'un faux email au nom du domaine.

Chaque stage a son jeu de configuration SES, qui publie les remises, rebonds et plaintes sur SNS : la page Comptes signale ainsi une adresse dont l'email n'arrive pas.

### SNS

Service de diffusion de messages : un émetteur publie sur un **sujet**, SNS transmet à tous les **abonnés** (Lambda, email, file…), sans que l'émetteur les connaisse. Ici, SES publie ses événements sur un sujet par stage, auquel est abonnée la Lambda des événements email. Les alertes CloudWatch passeront aussi par SNS ([todo.md](todo.md)).

### CloudFront et S3

- **S3** stocke des fichiers dans des _buckets_. En production, il contient l'application (`dist/`) et son `config.json`, dans un bucket **privé** : seul CloudFront peut le lire (_Origin Access Control_). S3 sert aussi à CDK pour déposer le code des Lambdas avant le déploiement. Les données métier sont dans DSQL ; les exports sont générés dans le navigateur.
- **CloudFront** est le CDN d'AWS : il sert l'application depuis le point de présence le plus proche du visiteur, en HTTPS sur `planning-manager.lab.jonathan-sousa.com`. Fichiers hachés en cache un an, `index.html` et `config.json` revérifiés à chaque visite, cache vidé à chaque déploiement. Une fonction CloudFront renvoie `index.html` pour les adresses de l'application (`/planning/2026-12`) ; des en-têtes de sécurité gérés par AWS et une CSP écrite dans `index.html` protègent la page.

CloudFront est sous le **forfait Free** (flat-rate) : CDN, WAF et protection DDoS sans frais, avec des limites (pas d'en-têtes personnalisés, au plus 5 règles WAF, pas de journaux du WAF en Europe). En développement, pas de CloudFront : l'application tourne avec Vite.

### WAF

Pare-feu applicatif : il inspecte chaque requête HTTP (URL, en-têtes, paramètres, adresse IP) et bloque ce qui ressemble à une attaque. Sa _web ACL_, attachée à CloudFront, utilise trois groupes de règles gérées et tenues à jour par AWS : réputation des adresses IP, attaques web courantes (injections, XSS, requêtes malformées), motifs d'exploitation de failles connues. Il protège le site ; l'API est protégée par le jeton Cognito, le plafond de débit et ses journaux.

### ACM

Délivre et renouvelle les certificats HTTPS, gratuitement pour les services AWS. Un certificat couvre `planning-manager.lab.jonathan-sousa.com` (CloudFront) et `auth.planning-manager.lab.jonathan-sousa.com` (page de connexion Cognito), validé par DNS : tant que les enregistrements de validation restent dans Route 53, le renouvellement est automatique.

CloudFront et les domaines personnalisés de Cognito n'acceptent que des certificats de `us-east-1` : le certificat et le WAF vivent dans une stack de cette région, `PlanningManagerEdge-prod`, que le stage de Paris lit par référence entre régions.

### Route 53

Le DNS d'AWS, l'annuaire qui traduit un nom de domaine en adresse. Tout est écrit dans la zone existante `jonathan-sousa.com` :

| Enregistrement                                 | Rôle                                              |
| ---------------------------------------------- | ------------------------------------------------- |
| `planning-manager.lab…` (A et AAAA, alias)     | Le site, vers CloudFront                          |
| `auth.planning-manager.lab…`                   | La page de connexion Cognito                      |
| CNAME de validation ACM                        | Preuve de propriété du domaine pour le certificat |
| CNAME DKIM, MX et TXT de `mail.`, TXT `_dmarc` | Authenticité des emails SES                       |

Un **alias** pointe directement vers une ressource AWS, sans adresse IP à maintenir.

### IAM

Qui a le droit de faire quoi sur AWS. Tout est refusé par défaut ; des **politiques** autorisent des actions précises à des **utilisateurs** (personnes, outils) ou à des **rôles** (identités temporaires endossées par un service). À distinguer de Cognito : IAM gère l'accès à AWS, Cognito les comptes de l'application.

- **Chaque Lambda a son rôle**, écrit par CDK au plus juste : l'API se connecte à DSQL en `admin`, lance le solveur et gère les comptes Cognito sans droit de suppression ; le solveur et la Lambda des emails n'ont que leur connexion en base.
- **DSQL n'a pas de mot de passe** : chaque Lambda signe un jeton de connexion avec son rôle IAM ; au déploiement, `scripts/db-migrate.ts` relie les rôles PostgreSQL `solver` et `mailer` aux rôles IAM correspondants.
- **Les déploiements** passent par les rôles créés par `cdk bootstrap`.

### CloudWatch

La surveillance d'AWS : journaux, métriques, alarmes, tableaux de bord.

- **Journaux** : ceux des Lambdas, gardés un mois (une erreur 500 y laisse sa pile) ; ceux des accès à l'API, gardés un an.
- **Métriques** : appels, erreurs et durée des Lambdas ; requêtes et erreurs de l'API ; consommation de DSQL (`TotalDPU`) ; requêtes autorisées et bloquées par le WAF.
- **Alarmes** : à mettre en place ([todo.md](todo.md)).

### CDK et CloudFormation

- **CDK** (_Cloud Development Kit_) décrit l'infrastructure en TypeScript (`infra/`) : on déclare des _constructs_ (`new UserPool(...)`, `new HttpApi(...)`), regroupés en **stacks**. L'infrastructure est ainsi reproductible (un stage de développement se crée en une commande), versionnée et relue comme le code, et testable (`infra/lib/app.test.ts`, sans AWS). CDK construit aussi le code des Lambdas (esbuild pour l'API, uv pour le solveur).
- **CloudFormation** applique ce que CDK génère : `cdk synth` produit des templates CloudFormation, `cdk deploy` les envoie. CloudFormation calcule les différences avec l'existant, crée, modifie ou remplace les ressources dans l'ordre de leurs dépendances, et revient à l'état précédent si une étape échoue. Certaines propriétés ne se modifient pas en place et imposent de recréer la ressource.

Les stacks : `PlanningManager-<stage>` (Cognito, DSQL, Lambdas, API, et l'hébergement en production), `PlanningManagerMail` (domaine d'envoi, partagé), `PlanningManagerEdge-prod` (certificat et WAF en `us-east-1`). En production, les stacks sont protégées contre la suppression et les données conservées même si une stack disparaît. Déploiement : `npm run infra:deploy [-- <stage>]` ; validation sans déployer : `npm run infra:synth`.

## Tests et qualité

### Vitest

Le framework de tests du code TypeScript, construit sur Vite (il en réutilise la configuration). Des fichiers `*.test.ts` avec des cas et des vérifications (`expect(...)`), lancés par `npm run test` et `npm run check`. Il fournit les simulations de modules (`vi.mock`), les faux minuteurs (tester une attente sans attendre), un navigateur simulé (jsdom) et la couverture de code (`npm run test:coverage`).

| Ce qui est testé                                 | Comment                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Règles, calendrier, décisions du planning        | Tests unitaires de fonctions pures                                                 |
| Routes de l'API                                  | De la requête HTTP jusqu'à un PostgreSQL en mémoire (PGlite), avec un faux Cognito |
| Modèle de la grille, copier-coller, cases        | Tests unitaires                                                                    |
| Hooks de sauvegarde et du solveur                | jsdom et testing-library, client de l'API simulé                                   |
| Exports CSV et PDF                               | Génération réelle                                                                  |
| Infrastructure                                   | Assertions sur les stacks CDK synthétisées                                         |
| Solveur de bout en bout, mois aléatoires         | Vitest lance le solveur Python et vérifie sa proposition avec le validateur        |
| Scénarios de règles (`fixtures/rule-scenarios/`) | Rejoués aussi par pytest côté Python                                               |

### pytest

Le framework de tests de référence en Python : des fonctions `test_…` avec de simples `assert`, `parametrize` pour rejouer un test sur une liste de cas, `monkeypatch` pour remplacer une fonction le temps d'un test. Lancé par `npm run solver:test` :

- les scénarios de règles partagés : le modèle CP-SAT trouve une violation dure exactement quand le validateur TypeScript en trouve une ;
- le calendrier Python, comparé à `api/calendar.ts` sur `fixtures/calendar.json` ;
- le handler de la Lambda (santé, run enregistré, run en échec) et la conversion des lignes de la base.

Les requêtes SQL du solveur ne sont vérifiées qu'en conditions réelles, faute de base dans pytest.

### oxlint

Linter JavaScript et TypeScript écrit en Rust, alternative très rapide à ESLint : variables ou imports inutilisés, erreurs fréquentes, règles des hooks React. `npm run lint` est la première étape de `npm run check` ; les types sont vérifiés à part par `tsc -b` (`npm run typecheck`).
