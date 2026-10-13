# Architecture

## Contexte

- **Client** : un service d'urgences d'hôpital public. Une équipe, un site, pas de multi-tenant.
- **Utilisateurs** : les cadres de santé (groupe Cognito `MANAGERS`). Les agents sont des fiches, pas des comptes.
- **Population planifiée** : paramédicaux (IDE, AS, ASH…), environ 5 à 20 agents.
- **Postes** : 24h/24 en 12h (jour / nuit), plus des postes courts de renfort. Équipes mixtes : fixes jour, fixes nuit ou alternants.
- **Planning** : mensuel, construit aujourd'hui à la main. L'outil aide à le construire (validation en temps réel) et à l'optimiser (solveur CP-SAT).
- **Cadre réglementaire** : fonction publique hospitalière (décret 2002-9). Voir [scheduling-rules.md](scheduling-rules.md).

## Stack

| Couche              | Choix                                                                                                  | Raison                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend            | SPA Vite + React + TypeScript                                                                          | Back-office entièrement authentifié, sans SEO : le SSR n'apporte rien.                                                                                                                                                             |
| Routing             | TanStack Router (file-based, `src/routes/`)                                                            | Routes et search params typés.                                                                                                                                                                                                     |
| Données côté client | TanStack Query autour du client Hono RPC (`hc<AppType>`)                                               | Typage bout en bout sans codegen ; cache, invalidation, mises à jour optimistes.                                                                                                                                                   |
| UI                  | shadcn/ui, Tailwind CSS 4, Lucide                                                                      | —                                                                                                                                                                                                                                  |
| Formulaires         | TanStack Form, validé par les schémas Zod de l'API (`api/schemas.ts`)                                  | Une seule définition de la validation ; les erreurs renvoyées par l'API reviennent sur les champs.                                                                                                                                 |
| Lint                | oxlint (template Vite officiel), ruff pour Python                                                      | —                                                                                                                                                                                                                                  |
| Infra               | AWS CDK TypeScript, une stack par stage                                                                | Tout service AWS en L2, `cdk watch` avec hotswap Lambda ; fonction Python, réglages Cognito et premier manager s'écrivent directement en CDK.                                                                                      |
| Auth                | Cognito user pool (Essentials) + Managed Login (page hébergée, code + PKCE), domaine Cognito par stage | Parcours complets (mot de passe temporaire, oubli, MFA et passkeys activables) sans code ni Amplify UI ; inscription fermée ; premier manager créé au déploiement. Un domaine personnalisé exige un certificat ACM en `us-east-1`. |
| Emails              | Amazon SES, sous-domaine d'envoi dédié (DKIM, SPF, DMARC)                                              | Expéditeur Cognito par défaut plafonné (~50 emails/jour) et classé en spam.                                                                                                                                                        |
| API                 | API Gateway HTTP API + authorizer JWT Cognito → une Lambda Node 24 ARM64 (Hono)                        | 1 $/M requêtes, auth native ; l'appartenance au groupe est vérifiée dans l'app.                                                                                                                                                    |
| Données             | Aurora DSQL (PostgreSQL distribué, serverless, sans VPC), Drizzle ORM, `eu-west-3`                     | Domaine relationnel, transactions jusqu'à 3 000 lignes (le diff du solveur devient atomique), 0 DPU au repos, free tier permanent.                                                                                                 |
| Sauvegarde          | AWS Backup, plan quotidien, rétention 35 jours, stage `prod` uniquement                                | Sauvegardes complètes du cluster ; restauration vers un nouveau cluster. Les stages de dev restent jetables (un coffre non vide ne se supprime pas).                                                                               |
| Solveur             | Lambda Python 3.14 ARM64 + OR-Tools CP-SAT, projet `uv`, connecteur DSQL psycopg                       | Référence pour le planning sous contraintes ; 6 Go, 90 s, sans relance automatique.                                                                                                                                                |
| Tests               | Vitest (TS), pytest (Python), scénarios JSON partagés                                                  | Voir « Un seul validateur » dans [scheduling-rules.md](scheduling-rules.md).                                                                                                                                                       |

Versions : toujours la dernière stable, vérifiée sur le registre. Un écart doit être justifié par une incompatibilité constatée :

- **Node 24** (et `@types/node` 24) : Lambda ne propose pas encore `nodejs26.x`.
- **Python 3.14** : runtime Lambda maximal, et OR-Tools ne publie pas de wheel au-delà de cp314.
- **TypeScript 6.0** : version fixée par le template Vite officiel.
- **`@aws-cdk/aws-dsql-alpha`** : seul construct L2 pour DSQL ; API expérimentale, à surveiller à chaque mise à jour de CDK.

Alternatives écartées (raisons valables tant que le besoin ne change pas) :

- **Amplify Gen 2** : fonction Python, inscription fermée, premier manager et format des tables sortent de son modèle ; chaque écart se code en CDK de toute façon.
- **DynamoDB** : relations, agrégats et exports à coder à la main ; `TransactWriteItems` plafonne à 100 éléments, le diff mensuel du solveur (~600 lignes) ne peut pas être atomique.
- **AppSync (GraphQL)** : 4 $/M requêtes et subscriptions inutiles pour deux managers ; pas de data source DSQL.
- **Amplify Hosting** : WAF facturé 15 $/mois par app ; CloudFront + S3 restent dans la stack CDK.

Coût mensuel estimé en usage réel : 0 à 5 € (Cognito et CloudFront dans le free tier, HTTP API et Lambda dans le free tier, DSQL dans ou proche du free tier). La consommation DSQL se suit sur CloudWatch (`TotalDPU`).

## Déploiement et stages

`infra/bin/app.ts` instancie `PlanningManager-<stage>` et `PlanningManagerMail`. Le stage vient du contexte CDK (`-c stage=…`, défaut : nom d'utilisateur du poste). `prod` active `deletionProtection`, `RemovalPolicy.RETAIN` et le plan AWS Backup ; les autres stages se détruisent librement (`npm run infra:destroy`). Les journaux Lambda sont conservés un mois.

`PlanningManagerMail` (`infra/lib/mail.ts`) porte le domaine d'envoi, commun à tous les stages et déployé une fois (`npm run infra:deploy:mail`) : identité SES `planning-manager.lab.jonathan-sousa.com` (Easy DKIM), MAIL FROM `mail.planning-manager.lab.jonathan-sousa.com` (MX et SPF) et DMARC `p=quarantine` (DKIM aligné strict, SPF relâché : le MAIL FROM de SES est forcément un sous-domaine), écrits dans la zone Route 53 `jonathan-sousa.com` (référencée par son identifiant : la synthèse ne demande aucun identifiant AWS). La stack est protégée contre la suppression : tous les stages en dépendent. Chaque user pool envoie par SES depuis `no-reply@` ; Cognito crée à la première configuration son rôle lié `AWSServiceRoleForAmazonCognitoIdpEmailService`. Le compte SES est sorti du bac à sable en `eu-west-3`. Un sous-domaine isole la réputation d'envoi de l'application de celle de la messagerie du domaine principal.

`npm run infra:deploy` enchaîne `cdk deploy 'PlanningManager-*' --outputs-file cdk-outputs.json`, `scripts/write-env.ts` (sorties → `.env.local`) et `scripts/db-migrate.ts` (migrations Drizzle, connexion `admin` par jeton IAM de l'appelant). Le frontend lit `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_AUTH_DOMAIN` et `VITE_API_URL`. Les sessions expirées renvoient vers Managed Login. Les URL de rappel OAuth et les origines CORS sont celles de `appOrigins` dans `infra/lib/stack.ts` (le serveur Vite local ; l'hébergement relève de la phase 4).

## API

- Un routeur Hono par ressource dans `api/routes/`, monté dans `api/app.ts` (CRUD : `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` ; `/rule-settings`, ligne unique, n'a que `GET /` et `PUT /`). `GET /health` vérifie la base et le solveur.
- Les schémas d'entrée Zod de `api/schemas.ts` sont la seule définition de la validation : l'API les applique, les formulaires du frontend les réutilisent. Ils ne dépendent que de `zod` et de `api/domain.ts`, sans Drizzle. Messages en français (`z.locales.fr()`). Les règles croisées s'évaluent même quand d'autres champs sont invalides, pour afficher toutes les erreurs d'un coup.
- Les contrôles qui lisent la base vivent dans l'API, hors des schémas : type du poste référencé (`api/shift-checks.ts`), chevauchement des absences validées, poste utilisé qui ne peut plus changer entre travaillé et non travaillé. Ils répondent avec la même forme d'erreur.
- Planning d'un mois : `GET /plannings/:month` renvoie le planning (ou `null`) et les cases du mois, plus 13 jours de part et d'autre pour les règles qui chevauchent deux mois ; `POST /plannings/:month` crée le brouillon, absences validées posées ; `PUT /plannings/:month/status` valide, publie ou rouvre (valider rejoue le validateur côté serveur) ; `POST` et `DELETE /plannings/:month/accepted-violations` acceptent ou retirent une violation dure ; `PUT /plannings/:month/cells` écrit jusqu'à 500 cases en une transaction, avec la version lue (concurrence optimiste : 409 si un autre manager a écrit entre-temps).
- Toute erreur a la forme `{ error, fields? }` (`ApiError`, `api/errors.ts`) ; `fields` associe un champ de formulaire à ses messages :
  - 400 : saisie invalide, ou référence inconnue ;
  - 404 : identifiant inconnu ;
  - 409 : doublon (contrainte unique, rattachée au champ `code` quand c'est lui), suppression d'une ligne encore référencée, ou type d'un poste utilisé.
- Tri des libellés en français dans l'API (`api/sort.ts`), jamais par `ORDER BY` sur du texte.

## Grille de planning

- `src/routes/planning.$month.tsx` : un mois, créé à la demande (`POST /plannings/:month`) ; les 7 derniers jours du mois précédent sont affichés en lecture seule.
- `src/components/planning/planning-editor.tsx` : statut (valider, publier, rouvrir), liste des violations, acceptation d'une violation dure avec justification (case en pointillés).
- `src/components/planning/use-planning-editor.ts` : copie locale des cases, modifiée immédiatement, enregistrée en arrière-plan par lots (400 ms) avec la version du planning ; une version dépassée (autre manager) recharge le mois avec un message. Annulation des dernières saisies.
- `src/components/planning/planning-grid.tsx` : saisie au clavier (flèches, Maj pour étendre la sélection, code tapé appliqué à la sélection, Suppr, Alt+L pour verrouiller, copier-coller de codes, Cmd/Ctrl+Z) ; cases hors contrat hachurées, cases verrouillées laissées intactes.
- Le validateur `api/rules/` tourne à chaque saisie : violations sur les cases (rouge : dure, orange : souple) et en liste, compteurs par agent, ligne de couverture par besoin.

## Base de données

- Schéma dans `api/db/schema.ts` ; migrations générées par `npm run db:generate` (drizzle-kit puis `dsql-lint` : `CREATE INDEX ASYNC`, pas de `SERIAL`, FK ajoutées `NOT VALID`) et committées dans `api/db/migrations/`.
- Chaque FK ajoutée `NOT VALID` est suivie, à la main dans la migration, d'un `ALTER TABLE ASYNC … VALIDATE CONSTRAINT …` (contrôle des lignes existantes). Les FK sont en `RESTRICT`, sauf les tables qui dépendent d'un agent (`agent_skills`, `agent_requests`) en `CASCADE`.
- Pas de type `enum` en DSQL : colonnes `text` typées par Drizzle, valeurs listées dans `api/domain.ts` et validées par l'API.
- Les données initiales indispensables (la ligne `rule_settings`) sont insérées par la migration ; les données de démonstration relèvent du seed.
- Le migrateur officiel applique un DDL par transaction et attend les index asynchrones.
- Clés primaires UUID (`gen_random_uuid()`, exceptions dans [domain-model.md](domain-model.md#conventions)), horodatages `timestamptz` en UTC.
- Concurrence optimiste : les écritures multi-lignes passent par `db.transactionWithRetry`.
- Collation `C` : tri des libellés côté application.

## Solveur : bundling

`infra/lib/solver.ts` bundle la fonction en local, sans Docker :

1. `uv export` produit les dépendances verrouillées, moins le SDK AWS (`boto3`, `botocore`, `s3transfer`, `jmespath`) que le runtime Lambda fournit déjà.
2. `uv pip install --no-deps --python-platform aarch64-manylinux_2_28 --only-binary=:all:` les installe pour la plateforme Lambda.
3. Le package `solver` est copié à côté.

Limite Lambda : 250 Mo décompressés. OR-Tools tire numpy, pandas (43 Mo) et protobuf ; le connecteur DSQL ajoute psycopg (24 Mo). La taille se mesure avec `npm run infra:size` après `npm run infra:synth` (`cdk.out/` conserve d'anciens assets, d'où le script) ; au-delà de la limite, on passe à une image conteneur.

## Solveur

1. Le manager lance le solveur sur un brouillon : `POST /plannings/:month/solve-runs` avec un mode. L'API crée le `SolveRun` (`PENDING`, version du planning lue) et invoque la Lambda solveur en asynchrone (`InvocationType=Event`).
2. La Lambda (`solver/src/solver/`, timeout 90 s, pas de relance, 6 Go, graine fixe, 60 s de recherche) passe le run en `RUNNING`, lit le mois et ses 13 jours de contexte dans DSQL (`db.py`), construit et résout le modèle (`model.py`), puis écrit la proposition (cases à changer) dans `result` (`SUCCEEDED`) ou l'erreur (`FAILED`).
3. Le client interroge `GET /plannings/:month/solve-runs/:id`, affiche la proposition en différence avec les violations recalculées par le validateur.
4. `POST /plannings/:month/solve-runs/:id/apply` applique la proposition dans **une seule transaction** : version du planning identique à celle lue par le solveur (sinon 409), écriture des cases (source `SOLVER`), incrément de version.

Modes :

- **Compléter** : toutes les cases déjà saisies sont gardées, les vides sont remplies ;
- **Réoptimiser** : seules les cases verrouillées et les absences sont gardées ; le brouillon sert d'indice et chaque changement est pénalisé (poids de stabilité).

Le solveur ne pose que des postes travaillés non archivés et bien définis (amplitude, pause) ; une case vide est un repos. Une absence validée non posée l'est avec son code.

Modèle CP-SAT (`model.py`) : une variable booléenne par case libre et poste travaillé autorisé (mode jour/nuit), au plus une par case. Chaque instance de règle dure reçoit un indicateur de violation au lieu d'être imposée : le modèle a toujours une solution, et l'objectif est lexicographique :

1. le moins possible de violations dures (zéro, sauf si des cases fixées en imposent) ;
2. le moins possible de manque de couverture sous les minimums ;
3. la somme pondérée des contraintes souples (écart d'heures, souhaits, équité nuits / week-ends / fériés par grade, repos isolés, cibles de couverture, stabilité), avec les poids de `RuleSettings`.

Le budget de 60 s est réparti 20 % / 30 % / 50 % entre les trois niveaux ; chaque niveau repart de la solution du précédent et en garde la valeur. Le calendrier Python (`calendar.py`) reproduit `api/calendar.ts` (fériés, changement d'heure). Écarts assumés avec le validateur, tous plus stricts ou propres à l'objectif : le repos de 36h est imposé par une condition suffisante (deux jours libres, ou un jour libre entre deux postes assez espacés) ; la cible d'heures du régime mixte vaut 1 607 h.

Tests : les scénarios partagés (`fixtures/rule-scenarios/`) sont rejoués en pytest, grille figée, et le modèle doit trouver une violation dure exactement quand le validateur en trouve une (champ `hard`, vérifié par Vitest). `scripts/solver.e2e.test.ts` résout un mois du service fictif et passe la proposition au validateur : zéro violation dure.

## Feuille de route

L'existant est décrit dans le [README](../README.md#usage). Phases restantes :

| Phase         | Contenu                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 — Solveur   | `SolveRun`, proposition en diff, application transactionnelle protégée par version, diagnostic des trous de couverture.                                                                                                                                                                                                    |
| 4 — Diffusion | Export PDF A3 et CSV, clôture des soldes d'heures, groupe `ADMINS` et invitations (avec notification des rebonds et plaintes SES), hébergement S3 + CloudFront (+ WAF) sur `planning-manager.lab.jonathan-sousa.com`, domaine de connexion `auth.planning-manager.lab.jonathan-sousa.com` (certificat ACM en `us-east-1`). |

## Points ouverts

Technique : rôle de base de données dédié (`dsql:DbConnect` + `AWS IAM GRANT`) à la place d'`admin` pour les Lambdas.

À clarifier avec le cadre de santé :

- **Interprétations du validateur** : voir [scheduling-rules.md](scheduling-rules.md#interprétations-à-valider) (repos de 36h glissant, absences comptées comme repos dans la quinzaine, mois voisin vide, cible d'heures).

- **Protocole temps de travail local** :
  - dérogation 12h ;
  - nombre maximal de jours consécutifs ;
  - statut du lendemain de nuit (repos ou non) ;
  - ancrage des quinzaines ;
  - régimes horaires ;
  - codes d'absence.
- **Postes** : un agent peut-il avoir deux postes le même jour ?
- **Horaires exacts** des postes et besoins par grade.
- **Outil de gestion des temps** de l'hôpital et format d'export attendu.
- **Gouvernance** : accord de la DSI et du DPO de l'hôpital avant toute donnée nominative réelle. En développement, données fictives uniquement.
