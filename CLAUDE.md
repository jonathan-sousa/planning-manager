# CLAUDE.md

Contexte projet pour Claude Code. Le contexte métier et la conception sont dans `docs/` : commencer par `docs/architecture.md`.

## En bref

Planning mensuel du personnel paramédical d'un service d'urgences (hôpital public, FPH). SPA Vite + React + TanStack Router/Query + shadcn/ui ; backend AWS en CDK TypeScript (`eu-west-3`) : Cognito avec Managed Login (page de connexion hébergée), API Gateway HTTP API + Lambda Hono, Aurora DSQL (PostgreSQL serverless) via Drizzle, solveur OR-Tools CP-SAT en Lambda Python.

## Commandes

```bash
npm run dev            # Vite, http://localhost:5173 (nécessite .env.local)
npm run check          # lint (oxlint) + types (web, api, infra) + tests + build
npm run test           # Vitest
npm run solver:test    # pytest du solveur (uv)
npm run infra:synth    # cdk synth : valide l'infra et bundle API + solveur sans déployer
npm run db:generate    # migration Drizzle réécrite pour DSQL (à committer)
pre-commit run --all-files
```

## Déploiement AWS

`cdk deploy` écrit dans AWS. Le profil de Claude (`jsconsulting-claude-dev`) est en lecture seule : c'est Jonathan qui déploie (`npm run infra:deploy`, soit `cdk deploy` suivi, via le hook `postinfra:deploy`, de `env:write` et `db:migrate` ; `-- -c stage=<nom>` pour un autre stage). Claude valide avec `npm run infra:synth` (exige `BOOTSTRAP_MANAGER_EMAIL`, posé par `.envrc`) et inspecte `cdk.out/`. Sans `.env.local`, ni `npm run dev` ni `db:migrate` ne fonctionnent ; `npm run build` passe mais avec des variables vides.

## Structure

```text
infra/                      app CDK (tsconfig.infra.json)
  bin/app.ts                une stack PlanningManager-<stage> ; stage via -c stage=…
  lib/stack.ts              assemble Auth, Database, Solver, Api ; sorties CloudFormation
  lib/auth.ts               user pool (Essentials, inscription fermée), Managed Login (domaine Cognito, client OAuth code+PKCE, branding par défaut), groupe MANAGERS
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
  validate.ts               zValidator qui lève une ValidationError (400 par champ)
  auth.ts                   middleware : 403 si pas dans MANAGERS (claim cognito:groups)
  db/schema.ts              schéma Drizzle ; db/migrations/ généré, committé
  db/client.ts              drizzle() du connecteur DSQL (jeton IAM, pool)
  solver-client.ts          invocation de la Lambda solveur
solver/                     Python (uv) : src/solver/handler.py, tests/
scripts/                    write-env.ts (cdk-outputs.json → .env.local), db-migrate.ts
src/                        frontend
  main.tsx                  Amplify.configure (Auth + OAuth), QueryClient, router
  auth/auth-gate.tsx        redirige vers Managed Login (signInWithRedirect) tant qu'il n'y a pas de session
  auth/manager-gate.tsx     « Accès refusé » hors du groupe MANAGERS (l'API refuse aussi)
  lib/api-client.ts         hc<AppType> avec le jeton d'accès Cognito ; unwrap() lève ApiRequestError
  lib/resources.ts          requêtes et écritures de chaque ressource, types des lignes
  lib/options.ts            listes de référence (codes par id, options des selects)
  hooks/form.ts             useAppForm (TanStack Form) ; submitToApi reporte les erreurs de l'API sur les champs
  components/form-fields.tsx champs de formulaire liés à shadcn, FormShell
  components/crud-page.tsx  liste + fenêtres de création, modification, suppression
  routes/                   routes file-based (routeTree.gen.ts est généré, ne pas éditer)
  components/ui/            shadcn (générés via `npx shadcn@latest add`)
  styles/shadcn-tailwind.css preset Tailwind de shadcn, copié depuis le paquet (variants data-*, keyframes)
docs/                       architecture, modèle de domaine, règles de planification
```

## Conventions

- **Versions** : toujours la dernière stable, vérifiée sur le registre (`npm view`, PyPI). Ne jamais se fier à la mémoire. Un écart se justifie par une incompatibilité constatée et se documente dans `docs/architecture.md`.
- **Schéma** : toute modification de `api/db/schema.ts` passe par `npm run db:generate` et le SQL généré est committé. Clés primaires UUID, pas de `SERIAL`, un DDL par transaction (géré par le migrateur) ; chaque FK `NOT VALID` générée est suivie d'un `ALTER TABLE ASYNC … VALIDATE CONSTRAINT` ajouté à la main.
- **DSQL** : collation `C` → trier les libellés côté application (`localeCompare('fr')`), jamais par `ORDER BY` sur du texte accentué. Écritures multi-lignes dans `db.transactionWithRetry` (OCC). Une transaction modifie au plus 3 000 lignes.
- **Dates** : chaînes `YYYY-MM-DD`, heures `HH:mm`, durées en minutes calculées en heure de Paris. Pas d'aller-retour par un `Date` UTC.
- **Données** : fictives uniquement tant que l'hôpital n'a pas validé l'hébergement. Aucun code d'absence qui révèle un motif médical.
- **Authentification** : Cognito Managed Login ; `aws-amplify` ne sert qu'à la redirection OAuth et aux jetons. Pas de formulaire de connexion dans l'app, pas d'Amplify UI.
- **Formulaires** : TanStack Form validé par les schémas de `api/schemas.ts` (`onDynamic` + `revalidateLogic` : validation à la soumission, puis à chaque frappe), écriture dans `onSubmitAsync` via `submitToApi`. Pas de second schéma côté client.
- **Autorisations** : le JWT est validé par API Gateway, l'appartenance au groupe `MANAGERS` par `api/auth.ts`. Pas d'autorisation par propriétaire : les données du service sont partagées.
- **Validation des règles** : une seule définition, en TypeScript (`src/lib/rules/`). Le solveur Python est testé contre les mêmes scénarios JSON (`fixtures/rule-scenarios/`).
- **Taille du bundle solveur** : mesurer avec `npm run infra:synth && npm run infra:size` avant d'ajouter une dépendance Python ; limite Lambda 250 Mo décompressés. Le SDK AWS est exclu du bundle (fourni par le runtime).
- **npm** : `npm audit` doit rester à 0, dev compris. Le preset Tailwind de shadcn est vendorisé dans `src/styles/shadcn-tailwind.css` (le CLI `shadcn` n'est pas installé : `npx shadcn@latest add …`). `overrides.esbuild` aligne tous les esbuild transitifs (drizzle-kit en embarque un vieux) sur la version du projet.
- **Shell** : les commandes Bash parallèles partagent le répertoire courant ; utiliser des chemins absolus plutôt que `cd`.

## Méthodologie

Avant d'intégrer une brique CDK, DSQL, Drizzle, Hono, TanStack, shadcn ou OR-Tools, consulter la doc officielle (MCP AWS `aws___search_documentation`, context7 `mcp__plugin_context7_context7__resolve-library-id` puis `query-docs`) et appliquer le pattern officiel plutôt qu'une solution maison.
