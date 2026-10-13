# CLAUDE.md

Contexte projet pour Claude Code. Le contexte métier et la conception sont dans `docs/` : commencer par `docs/architecture.md`.

## En bref

Planning mensuel du personnel paramédical d'un service d'urgences (hôpital public, FPH). SPA Vite + React + TanStack Router/Query + shadcn/ui ; backend AWS en CDK TypeScript (`eu-west-3`) : Cognito avec Managed Login (page de connexion hébergée), API Gateway HTTP API + Lambda Hono, Aurora DSQL (PostgreSQL serverless) via Drizzle, solveur OR-Tools CP-SAT en Lambda Python.

## Commandes

Liste complète dans le [README](README.md#development) : `npm run check` avant chaque commit, `npm run infra:synth` pour valider l'infra sans déployer.

## Déploiement AWS

`cdk deploy` écrit dans AWS. Le profil de Claude (`jsconsulting-claude-dev`) est en lecture seule : c'est Jonathan qui déploie (`npm run infra:deploy:mail` une fois par compte, puis `npm run infra:deploy` pour un stage de développement, soit `cdk deploy` suivi, via le hook `postinfra:deploy`, de `env:write` et `db:migrate` (migrations, puis rôle IAM du solveur relié au rôle de base `solver`) ; `-- -c stage=<nom>` pour un autre stage ; `npm run infra:deploy:prod` pour la production hébergée). Claude valide avec `npm run infra:synth` (exige `BOOTSTRAP_MANAGER_EMAIL`, posé par `.envrc` ; aucun identifiant AWS requis) et inspecte `cdk.out/`. Rôle de `.env.local` : voir le README (§ Configuration).

## Structure

```text
infra/                      app CDK (tsconfig.infra.json)
  bin/app.ts                stacks PlanningManager-<stage> (stage via -c stage=…), PlanningManagerMail, et PlanningManagerEdge-prod pour la production
  lib/stack.ts              assemble Auth, Database, Solver, Api (et Web en production) ; sorties CloudFormation
  lib/dns.ts                domaines de production et zone Route 53 parente
  lib/edge.ts               stack us-east-1 de la production : certificat ACM et web ACL WAF de CloudFront
  lib/web.ts                SPA sur S3 + CloudFront (forfait Free), domaine, config.json du stage
  lib/auth.ts               user pool (Essentials, inscription fermée), Managed Login (domaine Cognito, ou personnalisé en production ; client OAuth code+PKCE, branding par défaut), groupe MANAGERS
  lib/mail.ts               stack PlanningManagerMail (partagée, déployée une fois) : identité SES du sous-domaine d'envoi, DKIM/MAIL FROM/DMARC dans Route 53
  lib/bootstrap-manager.ts  premier manager créé au déploiement (custom resources)
  lib/database.ts           cluster Aurora DSQL + plan AWS Backup quotidien
  lib/api.ts                HTTP API + authorizer JWT Cognito → NodejsFunction (api/index.ts)
  lib/solver.ts             Lambda Python ARM64, bundling uv sans Docker
api/                        Hono (tsconfig.api.json, projet référencé par le frontend pour AppType)
  app.ts                    monte les routeurs, gestion d'erreurs ; export type AppType
  routes/                   un routeur Hono par ressource (CRUD)
  schemas.ts                schémas d'entrée Zod, partagés avec les formulaires du frontend
  domain.ts                 énumérations du domaine (sans dépendance)
  errors.ts                 forme ApiError { error, fields? }, mapping des erreurs PostgreSQL
  shift-checks.ts           contrôle du type de poste référencé (lecture en base, hors schémas)
  calendar.ts               jours, fériés, changement d'heure (seul usage de Date)
  rules/                    validateur des règles de planification (partagé avec la grille), compteurs, diagnostic des manques de couverture
  validate.ts               zValidator qui lève une ValidationError (400 par champ)
  auth.ts                   middleware : 403 si pas dans MANAGERS (claim cognito:groups)
  db/schema.ts              schéma Drizzle ; db/migrations/ généré, committé
  db/client.ts              drizzle() du connecteur DSQL (jeton IAM, pool)
  solver-client.ts          invocation de la Lambda solveur
solver/                     Python (uv) : handler.py (actions health, solve), model.py (CP-SAT), db.py (DSQL), calendar.py (miroir de api/calendar.ts), cli.py ; tests/
scripts/                    stage-outputs.ts (sorties CDK du stage), write-env.ts (sorties → .env.local), db-migrate.ts, db-status.ts (avancement des migrations), db-seed.ts + seed/ (service fictif), asset-sizes.ts (infra:size), solver.e2e.test.ts (mois résolu puis validé)
src/                        frontend
  config.ts                 /config.json du stage (ids Cognito, URL de l'API), lu au démarrage
  main.tsx                  Amplify.configure (Auth + OAuth), QueryClient, router
  auth/auth-gate.tsx        redirige vers Managed Login (signInWithRedirect) tant qu'il n'y a pas de session
  auth/manager-gate.tsx     « Accès refusé » hors du groupe MANAGERS (l'API refuse aussi)
  lib/api-client.ts         hc<AppType> avec le jeton d'accès Cognito ; unwrap() lève ApiRequestError
  lib/resources.ts          requêtes et écritures de chaque ressource, types des lignes
  lib/options.ts            listes de référence (codes par id, options des selects)
  hooks/form.ts             useAppForm (TanStack Form) ; submitToApi reporte les erreurs de l'API sur les champs
  components/form-fields.tsx champs de formulaire liés à shadcn, FormShell
  components/crud-page.tsx  liste + fenêtres de création, modification, suppression
  components/planning/      grille mensuelle (saisie clavier, sauvegarde automatique versionnée, validation en direct, revue des propositions du solveur, diagnostic de couverture)
  routes/                   routes file-based (routeTree.gen.ts est généré, ne pas éditer)
  components/ui/            shadcn (générés via `npx shadcn@latest add`)
  styles/shadcn-tailwind.css preset Tailwind de shadcn, copié depuis le paquet (variants data-*, keyframes)
fixtures/rule-scenarios/    scénarios de règles partagés par Vitest et pytest
docs/                       architecture, modèle de domaine, règles de planification
```

## Conventions

- **Versions** : toujours la dernière stable, vérifiée sur le registre (`npm view`, PyPI). Ne jamais se fier à la mémoire. Un écart se justifie par une incompatibilité constatée et se documente dans `docs/architecture.md`.
- **Schéma et DSQL** : toute modification de `api/db/schema.ts` passe par `npm run db:generate` et le SQL généré est committé, sans jamais retoucher une migration déjà appliquée. Règles DSQL (FK `NOT VALID` + validation, tri, OCC, 3 000 lignes, rôle `solver` à qui accorder toute nouvelle table qu'il lit) : `docs/architecture.md` § Base de données.
- **Données, dates, identifiants** : `docs/domain-model.md` § Conventions. Données fictives uniquement tant que l'hôpital n'a pas validé l'hébergement (jeu de démonstration : `scripts/seed/data.ts`).
- **Authentification** : Cognito Managed Login ; `aws-amplify` ne sert qu'à la redirection OAuth et aux jetons. Pas de formulaire de connexion dans l'app, pas d'Amplify UI.
- **Formulaires** : TanStack Form validé par les schémas de `api/schemas.ts` (`onDynamic` + `revalidateLogic` : validation à la soumission, puis à chaque frappe), écriture dans `onSubmitAsync` via `submitToApi`. Pas de second schéma côté client.
- **Autorisations** : le JWT est validé par API Gateway, l'appartenance au groupe `MANAGERS` par `api/auth.ts`. Pas d'autorisation par propriétaire : les données du service sont partagées.
- **Validation des règles de planification** : une seule définition, en TypeScript, testée avec le solveur sur des scénarios partagés (`docs/scheduling-rules.md` § Un seul validateur).
- **Taille du bundle solveur** : mesurer avec `npm run infra:synth && npm run infra:size` avant d'ajouter une dépendance Python ; limite Lambda 250 Mo décompressés. Le SDK AWS est exclu du bundle (fourni par le runtime).
- **npm** : `npm audit` doit rester à 0, dev compris. Le preset Tailwind de shadcn est vendorisé dans `src/styles/shadcn-tailwind.css` (le CLI `shadcn` n'est pas installé : `npx shadcn@latest add …`). `overrides.esbuild` aligne tous les esbuild transitifs (drizzle-kit en embarque un vieux) sur la version du projet.
- **Shell** : les commandes Bash parallèles partagent le répertoire courant ; utiliser des chemins absolus plutôt que `cd`.

## Méthodologie

Avant d'intégrer une brique CDK, DSQL, Drizzle, Hono, TanStack, shadcn ou OR-Tools, consulter la doc officielle (MCP AWS `aws___search_documentation`, context7 `mcp__plugin_context7_context7__resolve-library-id` puis `query-docs`) et appliquer le pattern officiel plutôt qu'une solution maison.
