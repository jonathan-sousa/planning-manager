# Architecture

## Contexte

- **Client** : un service d'urgences d'hôpital public. Une équipe, un site, pas de multi-tenant.
- **Utilisateurs** : les cadres de santé (groupe Cognito `MANAGERS`), dont des admins (groupe `ADMINS`, aussi managers) qui gèrent les comptes et les règles de planification. Les agents sont des fiches, pas des comptes.
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
| Données             | Aurora DSQL (PostgreSQL distribué, serverless, sans VPC), Drizzle ORM, `eu-west-3`                     | Domaine relationnel, transactions jusqu'à 3 000 lignes (une proposition du solveur s'applique d'un bloc), 0 DPU au repos, free tier permanent.                                                                                     |
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
- **Amplify Hosting** : WAF facturé 15 $/mois par app ; CloudFront + S3, sous forfait Free, restent dans la stack CDK.

Coût mensuel estimé en usage réel : 0 à 5 € (Cognito et CloudFront dans le free tier, HTTP API et Lambda dans le free tier, DSQL dans ou proche du free tier). La consommation DSQL se suit sur CloudWatch (`TotalDPU`).

## Déploiement et stages

`infra/bin/app.ts` instancie `PlanningManager-<stage>` et `PlanningManagerMail`, plus `PlanningManagerEdge-prod` pour la production. Le stage vient du contexte CDK (`-c stage=…`, défaut : nom d'utilisateur du poste). `prod` active `deletionProtection`, `RemovalPolicy.RETAIN` et le plan AWS Backup ; les autres stages se détruisent librement (`npm run infra:destroy`). Les journaux Lambda sont conservés un mois. Toutes les ressources portent les tags `Project=planning-manager` et `Stage=<stage>` (`shared` pour `PlanningManagerMail`), activés comme tags de répartition des coûts dans Billing : Cost Explorer filtre la consommation par projet et par stage.

`PlanningManagerMail` (`infra/lib/mail.ts`) porte le domaine d'envoi, commun à tous les stages, déployé avec la production seulement (un stage de développement ne déploie que son stack) : identité SES `planning-manager.lab.jonathan-sousa.com` (Easy DKIM), MAIL FROM `mail.planning-manager.lab.jonathan-sousa.com` (MX et SPF) et DMARC `p=quarantine` (DKIM aligné strict, SPF relâché : le MAIL FROM de SES est forcément un sous-domaine), écrits dans la zone Route 53 `jonathan-sousa.com` (référencée par son identifiant : la synthèse ne demande aucun identifiant AWS). La stack est protégée contre la suppression : tous les stages en dépendent. Chaque user pool envoie par SES depuis `no-reply@` ; Cognito crée à la première configuration son rôle lié `AWSServiceRoleForAmazonCognitoIdpEmailService`. Le compte SES est sorti du bac à sable en `eu-west-3`. Un sous-domaine isole la réputation d'envoi de l'application de celle de la messagerie du domaine principal.

`npm run infra:deploy [-- <stage>]` (`scripts/deploy.ts`) déploie un stage : build de l'app pour la production, `cdk deploy PlanningManager-<stage>` (seul pour un stage de développement, avec les stacks mail et edge pour la production), sorties dans `cdk-outputs.<stage>.json`, `scripts/db-migrate.ts` (migrations Drizzle, connexion `admin` par jeton IAM de l'appelant, puis rôle du solveur), et `scripts/write-env.ts` (sorties → `.env.local`) pour un stage de développement. Les scripts lisent les sorties du stage de `STAGE`, ou du stage personnel (`scripts/stage-outputs.ts`).

Le frontend lit ses identifiants (user pool, client, domaine Managed Login, URL de l'API) dans `/config.json` au démarrage (`src/config.ts`) : servi par le serveur Vite depuis `.env.local` en développement, écrit à côté de l'app au déploiement en production. Le build ne dépend donc d'aucun stage. Les sessions expirées renvoient vers Managed Login. Les URL de rappel OAuth et les origines CORS sont celles de `appOrigins` dans `infra/lib/stack.ts` : le domaine de production, ou le serveur Vite local pour les autres stages.

Production (`npm run infra:deploy -- prod`) :

- `PlanningManagerEdge-prod` (`infra/lib/edge.ts`, `us-east-1`, exigé par CloudFront) : certificat ACM de `planning-manager.lab.jonathan-sousa.com` et `auth.planning-manager.lab.jonathan-sousa.com`, validé par DNS ; web ACL AWS WAF (règles gérées AWS : réputation IP, règles communes, entrées malveillantes connues). Le stage les lit par références inter-régions.
- `infra/lib/web.ts` : bucket S3 privé derrière CloudFront (contrôle d'accès d'origine), domaine `planning-manager.lab.jonathan-sousa.com` (A et AAAA), en-têtes de sécurité gérés, routes de la SPA renvoyées vers `index.html`. Forfait CloudFront **Free** (`AWS::PricingPlanManager::Subscription`) : CDN, WAF et protection DDoS sans frais, tant qu'une web ACL reste associée. `dist/` est déployé tel quel : fichiers hachés en cache d'un an, page et `config.json` revalidés, invalidation CloudFront à chaque déploiement.
- Managed Login sur `auth.planning-manager.lab.jonathan-sousa.com` (domaine personnalisé Cognito, créé après l'enregistrement A du domaine parent, que Cognito exige).
- L'API reste sur son URL `execute-api` : une HTTP API ne prend pas de WAF, l'authorizer JWT filtre en amont de la Lambda.

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
- Comptes (`api/routes/accounts.ts`, admins seulement, comme `PUT /rule-settings`) : les utilisateurs Cognito du groupe `MANAGERS` (`api/accounts.ts`), avec l'état de leur email. `POST /accounts` invite (Cognito envoie le mot de passe temporaire ; un utilisateur existant hors du groupe `MANAGERS`, invitation interrompue, récupère ses groupes), `PUT /accounts/:username` change le nom et le rôle admin, `POST /accounts/:username/resend` renvoie une invitation en attente, `/disable` et `/enable` coupent ou rendent l'accès (un compte n'est jamais supprimé). `:username` est l'UUID Cognito, jamais l'email. Ces routes revérifient l'appelant dans Cognito (actif et dans `ADMINS`) : le jeton d'accès garde ses groupes jusqu'à une heure. Un admin ne peut ni se désactiver ni se retirer le rôle admin, et il reste toujours un admin actif. Un compte désactivé ne se reconnecte plus et ses jetons de rafraîchissement sont révoqués ; son jeton d'accès reste valable pour les données jusqu'à son expiration (une heure au plus). L'API n'accepte que les jetons d'accès (l'authorizer accepte aussi les jetons d'identité).
- Remises, rebonds et plaintes : chaque stage a un jeu de configuration SES (`planning-manager-<stage>`), utilisé par les emails de son user pool ; ses événements `DELIVERY`, `BOUNCE` et `COMPLAINT` passent par SNS à une Lambda (`api/email-events.ts`, `infra/lib/email-events.ts`) qui les enregistre dans `email_events`. La page Comptes signale un email dont le dernier événement est un rebond ou une plainte : une remise réussie efface l'alerte.

## Grille de planning

- `src/routes/planning.$month.tsx` : un mois, créé à la demande (`POST /plannings/:month`) ; les 7 derniers jours du mois précédent sont affichés en lecture seule.
- `src/components/planning/planning-editor.tsx` : statut (valider, publier, rouvrir), liste des violations, acceptation d'une violation dure avec justification (case en pointillés).
- `src/components/planning/use-planning-editor.ts` : copie locale des cases, modifiée immédiatement, enregistrée en arrière-plan par lots (400 ms) avec la version du planning ; une version dépassée (autre manager) recharge le mois avec un message. Annulation des dernières saisies.
- `src/components/planning/planning-grid.tsx` : saisie au clavier (flèches, Maj pour étendre la sélection, code tapé appliqué à la sélection, Suppr, Alt+L pour verrouiller, copier-coller de codes, Cmd/Ctrl+Z) ; cases hors contrat hachurées, cases verrouillées laissées intactes.
- `src/components/planning/use-solve-run.ts` : lancement du solveur (Compléter, Réoptimiser), suivi toutes les 2 s, proposition affichée par-dessus la grille (cases modifiées marquées d'un point bleu, validateur appliqué à la proposition), puis appliquée ou abandonnée ; la grille est en lecture seule pendant la revue.
- Le validateur `api/rules/` tourne à chaque saisie : violations sur les cases (rouge : dure, orange : souple) et en liste, compteurs par agent, ligne de couverture par besoin.
- `src/components/planning/coverage-diagnosis.tsx` : une case de couverture rouge (ou « Pourquoi ? » dans la liste) explique le manque, agent par agent du grade : libre, sur un autre poste, bloqué par une règle dure (placement simulé avec le validateur, `api/rules/diagnose.ts`), case verrouillée, absent, sans la compétence, hors contrat. Les agents libres ou déplaçables se placent d'un clic.

## Base de données

- Schéma dans `api/db/schema.ts` ; migrations générées par `npm run db:generate` (drizzle-kit puis `dsql-lint` : `CREATE INDEX ASYNC`, pas de `SERIAL`, FK ajoutées `NOT VALID`) et committées dans `api/db/migrations/`.
- Chaque FK ajoutée `NOT VALID` est suivie, à la main dans la migration, d'un `ALTER TABLE ASYNC … VALIDATE CONSTRAINT …` (contrôle des lignes existantes). Les FK sont en `RESTRICT`, sauf les tables qui dépendent d'un agent (`agent_skills`, `agent_requests`) en `CASCADE`.
- Pas de type `enum` en DSQL : colonnes `text` typées par Drizzle, valeurs listées dans `api/domain.ts` et validées par l'API.
- Les données initiales indispensables (la ligne `rule_settings`) sont insérées par la migration ; les données de démonstration relèvent du seed.
- Le migrateur officiel applique un DDL par transaction et attend les index asynchrones.
- Clés primaires UUID (`gen_random_uuid()`, exceptions dans [domain-model.md](domain-model.md#conventions)), horodatages `timestamptz` en UTC.
- Concurrence optimiste : les écritures multi-lignes passent par `db.transactionWithRetry`.
- Rôles : l'API et les scripts se connectent en `admin` ; deux Lambdas ont un rôle limité, créé par migration : `solver` (0006, lecture des tables du mois et mise à jour de `solve_runs`) et `mailer` (0008, insertion dans `email_events`). Leurs rôles IAM n'ont que `dsql:DbConnect`, et `npm run db:migrate` les relie aux rôles de base (`AWS IAM GRANT`, ARN lus dans les sorties CDK). Une table qu'un de ces rôles doit lire ou écrire reçoit son `GRANT` dans sa migration.
- Collation `C` : tri des libellés côté application.

## Solveur : bundling

`infra/lib/solver.ts` bundle la fonction en local, sans Docker :

1. `uv export` produit les dépendances verrouillées, moins le SDK AWS (`boto3`, `botocore`, `s3transfer`, `jmespath`) que le runtime Lambda fournit déjà.
2. `uv pip install --no-deps --python-platform aarch64-manylinux_2_28 --only-binary=:all:` les installe pour la plateforme Lambda.
3. Le package `solver` est copié à côté.

Limite Lambda : 250 Mo décompressés. OR-Tools tire numpy, pandas (43 Mo) et protobuf ; le connecteur DSQL ajoute psycopg (24 Mo). La taille se mesure avec `npm run infra:size` après `npm run infra:synth` (`cdk.out/` conserve d'anciens assets, d'où le script) ; au-delà de la limite, on passe à une image conteneur.

## Solveur

1. Le manager lance le solveur sur un brouillon : `POST /plannings/:month/solve-runs` avec un mode. L'API refuse un second calcul en cours sur le mois (409), crée le `SolveRun` (`PENDING`, version du planning lue à ce moment) et invoque la Lambda solveur en asynchrone (`InvocationType=Event`).
2. La Lambda (`solver/src/solver/`, timeout 90 s, pas de relance, 6 Go) passe le run en `RUNNING`, lit le mois et ses 13 jours de contexte dans DSQL (`db.py`), construit et résout le modèle (`model.py`, au plus 60 s de recherche, moins si le temps restant de la Lambda ne le permet pas), puis écrit la proposition (cases à changer) dans `result` (`SUCCEEDED`) ou un message d'erreur en français (`FAILED`, détail dans les journaux).
3. Le client interroge `GET /plannings/:month/solve-runs/:id` toutes les 2 s et affiche la proposition en différence, avec les violations recalculées par le validateur. Un run encore en cours 3 min après sa création (Lambda tuée par son timeout ou sa mémoire) est renvoyé en `FAILED`.
4. `POST /plannings/:month/solve-runs/:id/apply` applique la proposition dans **une seule transaction** : planning toujours en brouillon et à la version lue à la création du run (sinon 409), écriture des cases (source `SOLVER`), incrément de version. Les absences, besoins et contrats ne sont pas versionnés : une demande validée pendant le calcul apparaît comme violation dure dans la grille après application.

Modes :

- **Compléter** : toutes les cases déjà saisies sont gardées, les vides sont remplies ;
- **Réoptimiser** : les cases verrouillées et les codes non travaillés (absences, repos) sont gardés, les postes travaillés non verrouillés sont recalculés ; le brouillon sert d'indice et chaque changement est pénalisé (poids de stabilité).

Dans les deux modes, une absence validée est posée avec son code sur une case libre (vide, ou poste non verrouillé en réoptimisation) ; une case verrouillée qui la contredit est gardée et reste une violation dure visible. Le solveur ne pose que des postes travaillés non archivés et bien définis (amplitude, pause) ; une case vide est un repos.

Modèle CP-SAT (`model.py`) : une variable booléenne par case libre et poste travaillé autorisé (mode jour/nuit), au plus une par case. Chaque instance de règle dure reçoit un indicateur de violation au lieu d'être imposée : le modèle a toujours une solution, et l'objectif est lexicographique :

1. le moins possible de violations dures (zéro, sauf si des cases fixées en imposent) ;
2. le moins possible de manque de couverture sous les minimums ;
3. la somme pondérée des contraintes souples (écart d'heures, souhaits, équité nuits / week-ends / fériés par grade, repos isolés, cibles de couverture, stabilité), avec les poids de `RuleSettings`.

Le budget de recherche est réparti 20 % / 30 % / 50 % entre les trois niveaux ; le premier part d'une grille vide (ou du brouillon en réoptimisation), chaque niveau repart de la solution du précédent et en garde la valeur. Si le temps manque à un niveau, la solution du niveau précédent est gardée ; sans aucune solution, le run échoue avec un message. Le calendrier Python (`calendar.py`) reproduit `api/calendar.ts` (fériés, changement d'heure, vérifiés sur `fixtures/calendar.json` des deux côtés). Les écarts assumés avec le validateur et les tests croisés sont décrits dans [scheduling-rules.md](scheduling-rules.md#un-seul-validateur).

## Feuille de route

L'existant est décrit dans le [README](../README.md#usage). Phases restantes :

| Phase         | Contenu                                            |
| ------------- | -------------------------------------------------- |
| 4 — Diffusion | Export PDF A3 et CSV, clôture des soldes d'heures. |

## Points ouverts

Technique : l'API se connecte en `admin` ; un rôle limité au DML lui retirerait le DDL.

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
