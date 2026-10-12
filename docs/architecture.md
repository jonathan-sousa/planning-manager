# Architecture

## Contexte

- **Client** : un service d'urgences d'hôpital public. Une équipe, un site, pas de multi-tenant.
- **Utilisateurs** : les cadres de santé (groupe Cognito `MANAGERS`). Les agents sont des fiches, pas des comptes.
- **Population planifiée** : paramédicaux (IDE, AS, ASH…), environ 5 à 20 agents.
- **Postes** : 24h/24 en 12h (jour / nuit), plus des postes courts de renfort. Équipes mixtes : fixes jour, fixes nuit ou alternants.
- **Planning** : mensuel, construit aujourd'hui à la main. L'outil aide à le construire (validation en temps réel) et à l'optimiser (solveur CP-SAT).
- **Cadre réglementaire** : fonction publique hospitalière (décret 2002-9). Voir [scheduling-rules.md](scheduling-rules.md).

## Stack

| Couche              | Choix                                                       | Raison                                                                                   |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend            | SPA Vite + React + TypeScript                               | Back-office entièrement authentifié, sans SEO : le SSR n'apporte rien.                   |
| Routing             | TanStack Router (file-based, `src/routes/`)                 | Routes et search params typés.                                                           |
| Données côté client | TanStack Query autour du client Amplify Data                | Cache, invalidation, mises à jour optimistes de la grille.                               |
| UI                  | shadcn/ui, Tailwind CSS 4, Lucide                           | —                                                                                        |
| Lint                | oxlint (template Vite officiel)                             | —                                                                                        |
| Auth                | Cognito via Amplify Gen 2, `<Authenticator>` en français    | Inscription publique fermée au niveau du user pool (`allowAdminCreateUserOnly`).         |
| Données             | Amplify Data (AppSync + DynamoDB), `eu-west-3`, PITR activé | Volume minuscule, serverless. Autorisation par groupe, données partagées entre managers. |
| Solveur             | Lambda Python 3.14 ARM64 + OR-Tools CP-SAT, projet `uv`     | Référence pour le planning sous contraintes.                                             |
| Tests               | Vitest (TS), pytest (Python), scénarios JSON partagés       | Voir « Un seul validateur » dans [scheduling-rules.md](scheduling-rules.md).             |

Versions : toujours la dernière stable, vérifiée sur le registre. Un écart doit être justifié par une incompatibilité constatée :

- **Node 24** : Lambda ne propose pas encore `nodejs26.x`.
- **Python 3.14** : runtime Lambda maximal, et OR-Tools ne publie pas de wheel au-delà de cp314.
- **TypeScript 6.0** : version fixée par le template Vite officiel ; `ampx` embarque son propre TypeScript.

## Solveur : bundling

`amplify/functions/solver/resource.ts` bundle la fonction en local, sans Docker :

1. `uv export` produit les dépendances verrouillées.
2. `uv pip install --python-platform aarch64-manylinux_2_28 --only-binary=:all:` les installe pour la plateforme Lambda.
3. Le package `solver` est copié à côté.

Taille mesurée le 2026-10-12 : **191 Mo décompressés**, pour une limite Lambda de 250 Mo. OR-Tools tire numpy, pandas et protobuf, et pandas pèse 43 Mo à lui seul. Il faut surveiller cette marge à chaque nouvelle dépendance ; au-delà de la limite, on passe à une image conteneur.

## Flux solveur (phase 3)

1. Le manager lance l'optimisation : le client crée un `SolveRun` (`PENDING`) et appelle `solvePlanning(solveRunId)`, une mutation asynchrone (`a.handler.function(solver).async()`).
2. La Lambda est configurée avec un timeout de 90 s, `retryAttempts: 0`, 6 Go de RAM et un seed fixé. Elle lit les entrées dans DynamoDB, puis :
   - fait un présolve sur les seules cellules fixées ;
   - construit le modèle `x[agent, jour, poste]` ;
   - optimise de façon lexicographique : d'abord la couverture, puis le reste ;
   - écrit le diff dans le `SolveRun`.

   Toute exception passe le run en `FAILED`.

3. Le client interroge le `SolveRun` à intervalles réguliers : les écritures DynamoDB directes ne déclenchent pas les subscriptions AppSync. Il affiche ensuite la proposition en diff, avec les violations recalculées côté client.
4. `applySolveRun(solveRunId)` applique la proposition :
   - refus si `Planning.version` a changé depuis le calcul ;
   - écriture par `BatchWriteItem` en lots de 25, avec relance des `UnprocessedItems` ;
   - attributs gérés par Amplify posés : `__typename`, `createdAt`, `updatedAt`.

## Phases

| Phase               | Contenu                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Fondations      | Scaffold, auth `MANAGERS`, modèle `Grade`, spike solveur (`solverHealth`), dev-baseline, docs.                                                       |
| 1 — Référentiels    | Grades, compétences, agents, postes (codes d'absence inclus), besoins de couverture, paramètres de règles, demandes d'agents, script de seed fictif. |
| 2 — Grille manuelle | Grille agents × jours, saisie clavier, verrouillage, compteurs, validation en temps réel, statuts et publication, continuité entre mois.             |
| 3 — Solveur         | `SolveRun`, proposition en diff, application protégée par version, diagnostic des trous de couverture.                                               |
| 4 — Diffusion       | Export PDF A3 et CSV, clôture des soldes d'heures, groupe `ADMINS` et invitations, Amplify Hosting et WAF.                                           |

## Points ouverts

À clarifier avec le cadre de santé :

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
