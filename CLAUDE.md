# CLAUDE.md

Contexte projet pour Claude Code. Le contexte métier et la conception sont dans `docs/` : commencer par `docs/architecture.md`.

## En bref

Planning mensuel du personnel paramédical d'un service d'urgences (hôpital public, FPH). SPA Vite + React + TanStack Router/Query + shadcn/ui, backend AWS Amplify Gen 2 (Cognito, AppSync, DynamoDB, `eu-west-3`), solveur OR-Tools CP-SAT en Lambda Python.

## Commandes

```bash
npm run dev            # Vite, http://localhost:5173 (nécessite amplify_outputs.json)
npm run check          # lint (oxlint) + types + tests + build
npm run test           # Vitest
npm run solver:test    # pytest du solveur (uv)
pre-commit run --all-files
```

## Sandbox AWS

`npx ampx sandbox` écrit dans AWS. Le profil de Claude (`jsconsulting-claude-dev`) est en lecture seule : c'est Jonathan qui lance la sandbox (`npx ampx sandbox --profile jsconsulting-jsousa-dev`). `BOOTSTRAP_MANAGER_EMAIL` doit être défini (via `.envrc` / direnv), sinon `backend.ts` refuse de synthétiser. Il crée le premier manager du stage (`amplify/auth/bootstrap-manager.ts`). Sans sandbox déployée, `amplify_outputs.json` n'existe pas, et ni `npm run dev` ni `npm run build` ne fonctionnent.

## Structure

```text
amplify/
  auth/resource.ts          Cognito, groupe MANAGERS
  auth/bootstrap-manager.ts premier manager créé au déploiement (custom resource)
  data/resource.ts          schéma Amplify Data
  functions/solver/         Lambda Python (uv) : resource.ts, pyproject.toml, src/solver/, tests/
  backend.ts                overrides CDK : inscription fermée, PITR, grants
src/
  main.tsx                  Amplify.configure, Authenticator, QueryClient, router
  auth/                     garde d'accès au groupe MANAGERS
  routes/                   routes file-based (routeTree.gen.ts est généré, ne pas éditer)
  components/ui/            shadcn (générés via `npx shadcn add`)
  lib/                      client Amplify Data, utilitaires
docs/                       architecture, modèle de domaine, règles de planification
```

## Conventions

- **Versions** : toujours la dernière stable, vérifiée sur le registre (`npm view`, PyPI). Ne jamais se fier à la mémoire. Un écart se justifie par une incompatibilité constatée et se documente dans `docs/architecture.md`.
- **Dates** : chaînes `YYYY-MM-DD`, heures `HH:mm`, durées en minutes calculées en heure de Paris. Pas d'aller-retour par un `Date` UTC.
- **Données** : fictives uniquement tant que l'hôpital n'a pas validé l'hébergement. Aucun code d'absence qui révèle un motif médical.
- **Autorisations** : par groupe (`allow.groups(['MANAGERS'])`), pas par propriétaire.
- **Validation des règles** : une seule définition, en TypeScript (`src/lib/rules/`). Le solveur Python est testé contre les mêmes scénarios JSON (`fixtures/rule-scenarios/`).
- **Taille du bundle solveur** : 191 Mo décompressés pour une limite Lambda de 250 Mo. Mesurer avant d'ajouter une dépendance Python.

## Méthodologie

Avant d'intégrer une brique Amplify, TanStack, shadcn ou OR-Tools, consulter la doc officielle via context7 (`mcp__plugin_context7_context7__resolve-library-id` puis `mcp__plugin_context7_context7__query-docs`) et appliquer le pattern officiel plutôt qu'une solution maison.
