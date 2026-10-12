# Planning Manager

Outil de construction et d'optimisation des plannings mensuels du personnel paramédical d'un service d'urgences (hôpital public, roulement jour/nuit en 12h). Back-office réservé aux cadres de santé.

## Quick start

```bash
npm install
cp .envrc.example .envrc && direnv allow              # BOOTSTRAP_MANAGER_EMAIL + profil AWS
npm run infra:deploy                                  # déploie le stage perso (-- -c stage=<nom> pour un autre), écrit .env.local, migre la base
npm run dev                                           # http://localhost:5173
```

Au premier déploiement d'un stage, le compte `BOOTSTRAP_MANAGER_EMAIL` est créé dans le groupe `MANAGERS` et reçoit par email un mot de passe temporaire. La connexion passe par la page Cognito Managed Login (redirection) ; l'inscription publique est désactivée.

## Usage

Phase 0 (fondations) : connexion, page d'accueil avec vérification de la base et du solveur, gestion des grades. La feuille de route complète est dans [`docs/architecture.md`](docs/architecture.md).

## Configuration

- **AWS** : compte JS Consulting, région `eu-west-3`, CDK bootstrappé. Le déploiement écrit dans AWS : il se lance avec un profil disposant des droits d'écriture (`jsconsulting-jsousa-dev`).
- **Stage** : une stack CloudFormation `PlanningManager-<stage>` par développeur ou environnement, choisie avec `-c stage=<nom>` (défaut : le nom d'utilisateur du poste). `prod` active la protection contre la suppression et la rétention des ressources.
- **`BOOTSTRAP_MANAGER_EMAIL`** (obligatoire) : email du premier manager créé à chaque déploiement d'un stage neuf. Il est lu à la synthèse, et le déploiement échoue s'il manque. En local, dans un `.envrc` non versionné (`source_up` puis `export BOOTSTRAP_MANAGER_EMAIL=…`). Changer l'email crée un nouveau manager sans supprimer l'ancien.
- **`.env.local`** : généré par `npm run env:write` à partir des sorties CDK (`cdk-outputs.json`), non versionné, requis par `npm run dev`, `npm run build` et `npm run db:migrate`.
- **Runtimes** : Node 24 (`.nvmrc`), Python 3.14 pour le solveur (`solver/.python-version`), `uv` installé.

## Development

```bash
npm run check          # lint + types (web, api, infra) + tests + build
npm run test           # Vitest
npm run solver:test    # pytest du solveur
npm run infra:synth    # synthèse CDK locale (bundle l'API et le solveur, sans déployer)
npm run infra:watch    # redéploie à chaud l'API et le solveur à chaque modification
npm run db:generate    # génère une migration SQL (Drizzle) réécrite pour Aurora DSQL
npm run db:migrate     # applique les migrations au stage courant
pre-commit run --all-files
```

Détruire un stage : `npm run infra:destroy -- -c stage=<nom>`. Le coffre AWS Backup refuse la suppression tant qu'il contient des points de restauration : les supprimer d'abord dans la console AWS Backup.

Documentation : [`docs/`](docs/README.md).

## License

Propriétaire — voir [`LICENSE`](LICENSE).
